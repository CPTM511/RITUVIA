import assert from "node:assert/strict";

import { Client } from "pg";

import { createDatabaseClient } from "../src/client.js";
import {
  assertFeatureFlagRuntimeDatabasePrivileges,
  readFeatureFlagVersions,
} from "../src/feature-flags.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const flagKey = "experience.astrology";

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  codes: readonly string[],
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${codes.join(" or ")}.`);
  } catch (error) {
    const observed = (error as { code?: unknown }).code;
    const serialized = `${String(error)} ${JSON.stringify(error)}`;
    assert(
      codes.includes(String(observed)) ||
        (observed === "P2010" && codes.some((code) => serialized.includes(code))),
      `Observed unexpected PostgreSQL error ${String(observed)}.`,
    );
  }
};

const insertVersion = async (
  control: Client,
  input: Readonly<{
    approvalReference?: string;
    countryCodes?: readonly string[];
    localeTags?: readonly string[];
    state: "off" | "on";
    version: number;
  }>,
): Promise<void> => {
  await control.query(
    `
      INSERT INTO feature_flag_version (
        registry_version, flag_key, version, state, country_codes, locale_tags,
        effective_at, change_reference, approval_reference, actor_id
      ) VALUES (
        1, $1, $2, $3, $4::text[], $5::text[], clock_timestamp() + interval '1 second',
        'RIT-093', $6, 'rituvia.astrology.drill'
      )
    `,
    [
      flagKey,
      input.version,
      input.state,
      input.countryCodes ?? [],
      input.localeTags ?? [],
      input.approvalReference ?? null,
    ],
  );
};

const readLatestState = async (
  database: ReturnType<typeof createDatabaseClient>,
): Promise<"off" | "on" | null> => {
  const versions = await readFeatureFlagVersions(database, 1);
  const latest = versions.filter((version) => version.flagKey === flagKey).at(-1);
  if (latest === undefined) return null;
  assert(latest.state === "off" || latest.state === "on");
  return latest.state;
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;

  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const control = new Client({ connectionString: database.controlDatabaseUrl });
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await Promise.all([control.connect(), migrator.connect()]);

    try {
      await assertFeatureFlagRuntimeDatabasePrivileges(application);
      assert.equal(await readLatestState(application), null);

      await expectPostgresError(
        () =>
          control.query(
            `
              INSERT INTO feature_flag_version (
                registry_version, flag_key, version, state, effective_at,
                change_reference, actor_id
              ) VALUES (
                1, 'astrology_enabled', 1, 'off', clock_timestamp() + interval '1 second',
                'RIT-093', 'rituvia.astrology.drill'
              )
            `,
          ),
        ["23514"],
      );
      await expectPostgresError(
        () =>
          insertVersion(control, {
            approvalReference: "OWN-999:wrong-gate",
            state: "on",
            version: 1,
          }),
        ["42501"],
      );
      await expectPostgresError(
        () =>
          insertVersion(control, {
            approvalReference: "OWN-015:D-070",
            countryCodes: ["US"],
            state: "on",
            version: 1,
          }),
        ["42501"],
      );
      await expectPostgresError(
        () =>
          insertVersion(control, {
            approvalReference: "OWN-015:D-070",
            localeTags: ["en"],
            state: "on",
            version: 1,
          }),
        ["42501"],
      );

      await insertVersion(control, { state: "off", version: 1 });
      assert.equal(await readLatestState(application), "off");
      await insertVersion(control, {
        approvalReference: "OWN-015:D-070",
        state: "on",
        version: 2,
      });
      assert.equal(await readLatestState(application), "on");
      await insertVersion(control, { state: "off", version: 3 });
      assert.equal(await readLatestState(application), "off");

      const policies = await migrator.query<{
        command: string;
        policyName: string;
        roles: string[];
      }>(
        `
          SELECT policyname AS "policyName", cmd AS command, to_json(roles) AS roles
            FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'feature_flag_version'
           ORDER BY policyname
        `,
      );
      assert.deepEqual(policies.rows, [
        {
          command: "INSERT",
          policyName: "feature_flag_version_append",
          roles: ["rituvia_feature_flag_writer"],
        },
        {
          command: "INSERT",
          policyName: "feature_flag_version_astrology_append",
          roles: ["rituvia_feature_flag_writer"],
        },
        {
          command: "SELECT",
          policyName: "feature_flag_version_read",
          roles: ["rituvia_feature_flag_reader"],
        },
      ]);

      await expectPostgresError(
        () =>
          application.$executeRaw`
            INSERT INTO feature_flag_version (
              registry_version, flag_key, version, state, effective_at,
              change_reference, actor_id
            ) VALUES (
              1, ${flagKey}, 4, 'off', clock_timestamp() + interval '1 second',
              'RIT-093', 'rituvia.astrology.runtime'
            )
          `,
        ["42501"],
      );
      await expectPostgresError(
        () => control.query("UPDATE feature_flag_version SET state = 'on'"),
        ["42501"],
      );
      await expectPostgresError(() => control.query("DELETE FROM feature_flag_version"), ["42501"]);
      await expectPostgresError(() => control.query("TRUNCATE feature_flag_version"), ["42501"]);

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredApplication = createDatabaseClient(restored.databaseUrl);
      try {
        await assertFeatureFlagRuntimeDatabasePrivileges(restoredApplication);
        assert.equal(await readLatestState(restoredApplication), "off");
        const restoredVersions = await readFeatureFlagVersions(restoredApplication, 1);
        assert.deepEqual(
          restoredVersions
            .filter((version) => version.flagKey === flagKey)
            .map(({ approvalReference, state, version }) => ({
              approvalReference,
              state,
              version,
            })),
          [
            { approvalReference: null, state: "off", version: 1 },
            { approvalReference: "OWN-015:D-070", state: "on", version: 2 },
            { approvalReference: null, state: "off", version: 3 },
          ],
        );
      } finally {
        await restoredApplication.$disconnect();
      }
    } finally {
      await Promise.all([application.$disconnect(), control.end(), migrator.end()]);
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }

  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified astrology kill-switch off/on/emergency-off history, OWN-015 activation gate, runtime least privilege, and logical restore.\n",
);
