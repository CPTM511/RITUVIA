import assert from "node:assert/strict";

import { Client } from "pg";

import {
  assertCountryPolicyRuntimeDatabasePrivileges,
  readCountryPolicyVersions,
} from "../src/country-policies.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

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

const basePolicy = Object.freeze({
  approvalMode: "local_test",
  countryCode: "US",
  crypto: { assets: [], enabled: false, providerRoute: null },
  dataFlags: ["private_by_default"],
  effectiveFrom: "2020-01-01T00:00:00.000Z",
  effectiveUntil: null,
  environment: "local",
  evidence: {
    cryptoApprovalReference: null,
    fiatApprovalReference: "test:local:fiat",
    legalReference: "test:local:legal",
    ownerReference: "test:own-010:local",
    providerReference: "test:local:hosted-checkout",
  },
  fiat: {
    currencies: ["USD"],
    enabled: true,
    methods: ["card"],
    providerRoutes: ["local_hosted"],
    recurringAllowed: false,
  },
  legalDocumentVersions: [
    { documentCode: "privacy", version: "local.privacy.v1" },
    { documentCode: "terms", version: "local.terms.v1" },
  ],
  localeTags: ["en"],
  marketingFlags: ["no_fear_upsell"],
  minimumAge: 18,
  modalities: ["ritual"],
  nextReviewAt: "2099-01-01T00:00:00.000Z",
  prohibitedClaims: ["guaranteed_outcome"],
  products: [
    { access: "paid", productCode: "pack_6", subscriptionAllowed: false },
    { access: "paid", productCode: "pack_15", subscriptionAllowed: false },
    { access: "paid", productCode: "pack_40", subscriptionAllowed: false },
    { access: "paid", productCode: "plus_annual", subscriptionAllowed: true },
    { access: "paid", productCode: "plus_monthly", subscriptionAllowed: true },
  ],
  refundPolicyVersion: "local.refund.v1",
  requiredDisclosures: ["digital_contents", "reflective_not_predictive"],
  schemaVersion: "country-policy-version.v1",
  status: "paid",
  supersedesVersion: null,
  supportAvailable: true,
  taxMode: "not_applicable",
  version: "local.us.commerce.v1",
});

const insertPolicy = async (
  client: Client,
  policy: Record<string, unknown>,
  actorId = "country.policy.test",
  countryCode = String(policy.countryCode),
): Promise<void> => {
  const evidence = policy.evidence as Record<string, unknown>;
  await client.query(
    `
      INSERT INTO country_policy_version (
        schema_version, version, supersedes_version, country_code, environment,
        status, approval_mode, effective_from, effective_until, next_review_at,
        legal_reference, owner_reference, provider_reference, actor_id, policy_document
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz,
        $10::timestamptz, $11, $12, $13, $14, $15::jsonb
      )
    `,
    [
      policy.schemaVersion,
      policy.version,
      policy.supersedesVersion,
      countryCode,
      policy.environment,
      policy.status,
      policy.approvalMode,
      policy.effectiveFrom,
      policy.effectiveUntil,
      policy.nextReviewAt,
      evidence.legalReference,
      evidence.ownerReference,
      evidence.providerReference,
      actorId,
      JSON.stringify(policy),
    ],
  );
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
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const control = new Client({ connectionString: database.controlDatabaseUrl });
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await Promise.all([control.connect(), migrator.connect()]);
    try {
      await assertCountryPolicyRuntimeDatabasePrivileges(application);

      const loaded = await readCountryPolicyVersions(application, {
        countryCode: "US",
        environment: "local",
      });
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0]?.version, "local.us.commerce.v1");
      assert.deepEqual(loaded[0]?.policyDocument, basePolicy);
      assert(Object.isFrozen(loaded));
      assert(Object.isFrozen(loaded[0]));
      await assert.rejects(
        () =>
          readCountryPolicyVersions(application, {
            countryCode: "usa",
            environment: "local",
          }),
        /lookup is invalid/u,
      );

      await expectPostgresError(
        () =>
          application.$executeRaw`
            INSERT INTO country_policy_version (
              schema_version, version, country_code, environment, status, approval_mode,
              effective_from, next_review_at, legal_reference, owner_reference,
              provider_reference, actor_id, policy_document
            ) VALUES (
              'country-policy-version.v1', 'local.us.forbidden', 'US', 'local', 'disabled',
              'local_test', '2026-07-25T00:00:00.000Z', '2026-08-20T00:00:00.000Z',
              'test:local:legal', 'test:local:owner', 'test:local:provider',
              'country.policy.test', '{}'::jsonb
            )
          `,
        ["42501"],
      );
      await expectPostgresError(
        () => application.$executeRaw`UPDATE country_policy_version SET status = 'disabled'`,
        ["42501"],
      );
      await expectPostgresError(
        () => application.$executeRaw`DELETE FROM country_policy_version`,
        ["42501"],
      );
      await expectPostgresError(
        () => application.$executeRaw`TRUNCATE country_policy_version`,
        ["42501"],
      );

      await expectPostgresError(
        () => control.query("UPDATE country_policy_version SET status = 'disabled'"),
        ["42501"],
      );
      await expectPostgresError(
        () => control.query("DELETE FROM country_policy_version"),
        ["42501"],
      );
      await expectPostgresError(() => control.query("TRUNCATE country_policy_version"), ["42501"]);

      await expectPostgresError(
        () =>
          insertPolicy(
            control,
            {
              ...basePolicy,
              version: "local.us.mismatched.v2",
            },
            "country.policy.test",
            "CA",
          ),
        ["23514"],
      );
      await expectPostgresError(
        () =>
          insertPolicy(control, {
            ...basePolicy,
            approvalMode: "local_test",
            environment: "production",
            version: "production.us.test-forbidden.v1",
          }),
        ["42501"],
      );
      const writtenWrongGate = {
        ...basePolicy,
        approvalMode: "written",
        environment: "production",
        evidence: {
          cryptoApprovalReference: null,
          fiatApprovalReference: "OWN-999:wrong",
          legalReference: "LEGAL-001:us",
          ownerReference: "OWN-999:wrong",
          providerReference: "PROVIDER-001:stripe",
        },
        version: "production.us.wrong-gate.v1",
      };
      await expectPostgresError(() => insertPolicy(control, writtenWrongGate), ["42501"]);

      const killSwitch = {
        ...basePolicy,
        effectiveFrom: "2026-07-26T00:00:00.000Z",
        evidence: {
          ...basePolicy.evidence,
          fiatApprovalReference: null,
        },
        fiat: {
          currencies: [],
          enabled: false,
          methods: [],
          providerRoutes: [],
          recurringAllowed: false,
        },
        products: [],
        status: "disabled",
        supersedesVersion: basePolicy.version,
        version: "local.us.kill.v2",
      };
      await insertPolicy(control, killSwitch);
      await expectPostgresError(
        () =>
          insertPolicy(control, {
            ...killSwitch,
            version: "local.us.branch-forbidden.v2",
          }),
        ["23505"],
      );

      const rows = await migrator.query<{ version: string }>(
        "SELECT version FROM country_policy_version ORDER BY version",
      );
      assert.deepEqual(
        rows.rows.map(({ version }) => version),
        ["local.us.commerce.v1", "local.us.kill.v2"],
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredApplication = createDatabaseClient(restored.databaseUrl);
      try {
        await assertCountryPolicyRuntimeDatabasePrivileges(restoredApplication);
        const restoredVersions = await readCountryPolicyVersions(restoredApplication, {
          countryCode: "US",
          environment: "local",
        });
        assert.deepEqual(
          restoredVersions.map(({ version }) => version),
          ["local.us.commerce.v1", "local.us.kill.v2"],
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
  "Verified immutable country-policy versions, approval gates, bounded runtime reads, least privileges, and logical restore.\n",
);
