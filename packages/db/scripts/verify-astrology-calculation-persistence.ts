import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import {
  assertAstrologyCalculationRuntimeDatabasePrivileges,
  AstrologyCalculationPersistenceError,
  astrologyEngineBuildProvenanceVersion,
  createAstrologyCalculationPersistence,
  type PreparedAstrologyCalculationCreate,
} from "../src/astrology-calculation-persistence.js";
import {
  createBirthProfilePersistence,
  type PreparedBirthProfileWrite,
} from "../src/birth-profile-persistence.js";
import { createDatabaseClient } from "../src/client.js";
import { createPrivacyDeletionPersistence } from "../src/privacy-deletion.js";
import { createPrivacyExportPersistence } from "../src/privacy-export.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.astrology-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});

const privacyExportPolicy = Object.freeze({
  artifactTtlSeconds: 900,
  encryptionKeyVersion: "privacy-export.v1",
  recentAuthenticationSeconds: 900,
  requestWindowSeconds: 3_600,
});

const privacyDeletionPolicy = Object.freeze({
  recentAuthenticationSeconds: 900,
  requestWindowSeconds: 3_600,
});

const bearer = (): string => randomBytes(32).toString("base64url");
const digest = (marker: number): string =>
  `sha256:${Buffer.alloc(32, marker % 256).toString("hex")}`;

const birthProfileWrite = (marker: number): PreparedBirthProfileWrite =>
  Object.freeze({
    canonicalPayloadDigest: digest(marker),
    canonicalRequestDigest: digest(marker + 1),
    digestKeyVersion: "private-content.v1",
    encryptedPayload: Object.freeze({
      ciphertext: new Uint8Array(96).fill(marker),
      keyVersion: "private-content.v1",
      nonce: new Uint8Array(12).fill(marker),
      tag: new Uint8Array(16).fill(marker),
    }),
    idempotencyKeyDigest: digest(marker + 2),
    timeCertainty: "exact",
  });

const preparedCalculation = (
  marker: number,
  options: Readonly<{
    canonicalMarker?: number;
    idempotencyMarker?: number;
  }> = {},
): PreparedAstrologyCalculationCreate =>
  Object.freeze({
    aspectPolicyVersion: "rituvia-major-aspects.v1",
    canonicalRequestDigest: digest(options.canonicalMarker ?? marker + 1),
    digestKeyVersion: "private-content-digest.v1",
    encryptedFacts: Object.freeze({
      ciphertext: new Uint8Array(512).fill(marker),
      keyVersion: "private-content.v1",
      nonce: new Uint8Array(12).fill(marker),
      tag: new Uint8Array(16).fill(marker),
    }),
    engineBuildProvenance: Object.freeze({
      abiVersion: "astrology-native-abi.v1",
      adapterVersion: "1.0.0",
      binarySha256: digest(marker + 2),
      compilerFlagsSha256: digest(marker + 3),
      compilerId: "clang-17.0.0",
      dataInventorySha256: digest(marker + 4),
      libraryVersion: "2.10.03",
      nativeSbomSha256: digest(marker + 5),
      sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
      sourceInventorySha256: digest(marker + 6),
      sourceSnapshotTag: "v2.10.3final",
    }),
    engineProvenanceVersion: astrologyEngineBuildProvenanceVersion,
    idempotencyKeyDigest: digest(options.idempotencyMarker ?? marker + 7),
    inputSnapshotDigest: digest(marker + 8),
    keyedFactsDigest: digest(marker + 9),
    methodCatalogDigest: digest(marker + 10),
    methodVersion: "rituvia-western-natal.v1",
    status: "complete",
    timeCertainty: "exact",
    timezoneProvenanceDigest: digest(marker + 11),
  });

const expectAstrologyError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected astrology persistence error ${code}.`);
  } catch (error) {
    assert(error instanceof AstrologyCalculationPersistenceError, String(error));
    assert.equal(error.code, code);
  }
};

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    const observed = (error as { code?: unknown }).code;
    assert.equal(observed, code, String(error));
  }
};

await withLocalPostgresLease(async (lease) => {
  let database: Awaited<ReturnType<typeof lease.createTestDatabase>> | undefined;
  let runtime: ReturnType<typeof createDatabaseClient> | undefined;
  let deletionRuntime: ReturnType<typeof createDatabaseClient> | undefined;
  let migrator: Client | undefined;
  let app: Client | undefined;
  try {
    database = await lease.createTestDatabase();
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    runtime = createDatabaseClient(database.databaseUrl);
    deletionRuntime = createDatabaseClient(database.privacyDeletionDatabaseUrl);
    migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    app = new Client({ connectionString: database.databaseUrl });
    await Promise.all([migrator.connect(), app.connect()]);

    await assertAstrologyCalculationRuntimeDatabasePrivileges(runtime);
    const accounts = createAccountIdentityService(runtime, accountPolicy);
    const profiles = createBirthProfilePersistence(runtime);
    const calculations = createAstrologyCalculationPersistence(runtime);
    const privacyExports = createPrivacyExportPersistence(runtime, privacyExportPolicy);
    const privacyDeletion = createPrivacyDeletionPersistence(
      deletionRuntime,
      privacyDeletionPolicy,
    );

    const createSession = async (email: string) => {
      const challengeId = randomUUID();
      const state = bearer();
      const token = bearer();
      const sessionToken = bearer();
      await accounts.createChallenge({
        challengeId,
        email,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state,
        token,
      });
      const completed = await accounts.consumeChallenge({
        challengeId,
        sessionToken,
        state,
        token,
      });
      return Object.freeze({ ...completed.context, sessionToken });
    };

    const owner = await createSession("astrology-owner@example.test");
    const other = await createSession("astrology-other@example.test");
    const profile = await profiles.create({
      prepare: () => birthProfileWrite(11),
      sessionToken: owner.sessionToken,
    });
    const calculationId = randomUUID();

    await expectAstrologyError(
      () =>
        calculations.create({
          birthProfileId: profile.id,
          calculationId: randomUUID(),
          expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
          expectedBirthProfileRevision: profile.revision,
          prepare: () => preparedCalculation(21),
          sessionToken: other.sessionToken,
        }),
      "ASTROLOGY_CALCULATION_PROFILE_NOT_FOUND",
    );

    await expectAstrologyError(
      () =>
        calculations.create({
          birthProfileId: profile.id,
          calculationId: randomUUID(),
          expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
          expectedBirthProfileRevision: profile.revision + 1,
          prepare: () => preparedCalculation(31),
          sessionToken: owner.sessionToken,
        }),
      "ASTROLOGY_CALCULATION_PROFILE_CONFLICT",
    );

    await expectAstrologyError(
      () =>
        calculations.create({
          birthProfileId: profile.id,
          calculationId: randomUUID(),
          expectedBirthProfilePayloadDigest: digest(199),
          expectedBirthProfileRevision: profile.revision,
          prepare: () => preparedCalculation(41),
          sessionToken: owner.sessionToken,
        }),
      "ASTROLOGY_CALCULATION_PROFILE_CONFLICT",
    );

    const invalidEnginePrepared = Object.freeze({
      ...preparedCalculation(45),
      engineBuildProvenance: Object.freeze({
        ...preparedCalculation(45).engineBuildProvenance,
        unexpectedField: "rejected",
      }),
    }) as unknown as PreparedAstrologyCalculationCreate;
    await expectAstrologyError(
      () =>
        calculations.create({
          birthProfileId: profile.id,
          calculationId: randomUUID(),
          expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
          expectedBirthProfileRevision: profile.revision,
          prepare: () => invalidEnginePrepared,
          sessionToken: owner.sessionToken,
        }),
      "ASTROLOGY_CALCULATION_INVALID",
    );

    const prepared = preparedCalculation(51);
    const created = await calculations.create({
      birthProfileId: profile.id,
      calculationId,
      expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
      expectedBirthProfileRevision: profile.revision,
      prepare: () => prepared,
      sessionToken: owner.sessionToken,
    });
    assert.equal(created.id, calculationId);
    assert.equal(created.userId, owner.userId);
    assert.equal(created.birthProfileId, profile.id);
    assert.equal(created.birthProfileRevision, profile.revision);
    assert.equal(created.birthProfilePayloadDigest, profile.canonicalPayloadDigest);
    assert.equal(created.status, "complete");
    assert.equal(created.engineBuildProvenance.libraryVersion, "2.10.03");

    const replay = await calculations.create({
      birthProfileId: profile.id,
      calculationId,
      expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
      expectedBirthProfileRevision: profile.revision,
      prepare: () => preparedCalculation(51),
      sessionToken: owner.sessionToken,
    });
    assert.equal(replay.id, created.id);

    await expectAstrologyError(
      () =>
        calculations.create({
          birthProfileId: profile.id,
          calculationId,
          expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
          expectedBirthProfileRevision: profile.revision,
          prepare: () =>
            preparedCalculation(51, {
              canonicalMarker: 222,
              idempotencyMarker: 58,
            }),
          sessionToken: owner.sessionToken,
        }),
      "ASTROLOGY_CALCULATION_REPLAY_CONFLICT",
    );

    assert.equal((await calculations.list({ sessionToken: owner.sessionToken })).length, 1);
    assert.equal(
      (
        await calculations.read({
          calculationId,
          sessionToken: owner.sessionToken,
        })
      ).id,
      calculationId,
    );
    assert.equal((await calculations.list({ sessionToken: other.sessionToken })).length, 0);
    await expectAstrologyError(
      () => calculations.read({ calculationId, sessionToken: other.sessionToken }),
      "ASTROLOGY_CALCULATION_NOT_FOUND",
    );

    await expectPostgresError(
      () =>
        app!.query(
          `
            INSERT INTO astrology_calculation (
              id, user_id, birth_profile_id, birth_profile_revision,
              birth_profile_payload_digest, status, time_certainty,
              method_version, aspect_policy_version, method_catalog_digest,
              input_snapshot_digest, timezone_provenance_digest,
              engine_provenance_version, engine_build_provenance,
              facts_ciphertext, facts_nonce, facts_tag,
              encryption_key_version, digest_key_version, keyed_facts_digest,
              created_at
            ) VALUES (
              $1::uuid, $2::uuid, $3::uuid, $4, $5, 'complete', 'exact',
              'rituvia-western-natal.v1', 'rituvia-major-aspects.v1', $6, $7, $8,
              'astrology-engine-build-provenance.v1', $9::jsonb,
              $10, $11, $12, 'private-content.v1', 'private-content-digest.v1', $13,
              CURRENT_TIMESTAMP
            )
          `,
          [
            randomUUID(),
            owner.userId,
            profile.id,
            profile.revision + 1,
            Buffer.from(profile.canonicalPayloadDigest.slice("sha256:".length), "hex"),
            randomBytes(32),
            randomBytes(32),
            randomBytes(32),
            JSON.stringify(prepared.engineBuildProvenance),
            randomBytes(64),
            randomBytes(12),
            randomBytes(16),
            randomBytes(32),
          ],
        ),
      "42501",
    );

    await expectPostgresError(
      () =>
        app!.query("UPDATE astrology_calculation SET status = 'complete' WHERE id = $1", [
          calculationId,
        ]),
      "42501",
    );
    await expectPostgresError(
      () =>
        app!.query(
          "DELETE FROM astrology_calculation_operation WHERE astrology_calculation_id = $1",
          [calculationId],
        ),
      "42501",
    );

    const privileges = await migrator.query<{
      appCalculationDelete: boolean;
      appCalculationUpdate: boolean;
      appOperationDelete: boolean;
      appOperationUpdate: boolean;
      appPrivacyDeletedInsert: boolean;
      deletionFactsUpdate: boolean;
      deletionMethodUpdate: boolean;
    }>(
      `
        SELECT
          has_table_privilege('rituvia_app', 'astrology_calculation', 'DELETE')
            AS "appCalculationDelete",
          has_any_column_privilege('rituvia_app', 'astrology_calculation', 'UPDATE')
            AS "appCalculationUpdate",
          has_table_privilege('rituvia_app', 'astrology_calculation_operation', 'DELETE')
            AS "appOperationDelete",
          has_any_column_privilege(
            'rituvia_app',
            'astrology_calculation_operation',
            'UPDATE'
          ) AS "appOperationUpdate",
          has_column_privilege(
            'rituvia_app',
            'astrology_calculation',
            'privacy_deleted_at',
            'INSERT'
          ) AS "appPrivacyDeletedInsert",
          has_column_privilege(
            'rituvia_privacy_deletion',
            'astrology_calculation',
            'facts_ciphertext',
            'UPDATE'
          ) AS "deletionFactsUpdate",
          has_column_privilege(
            'rituvia_privacy_deletion',
            'astrology_calculation',
            'method_version',
            'UPDATE'
          ) AS "deletionMethodUpdate"
      `,
    );
    assert.deepEqual(privileges.rows[0], {
      appCalculationDelete: false,
      appCalculationUpdate: false,
      appOperationDelete: false,
      appOperationUpdate: false,
      appPrivacyDeletedInsert: false,
      deletionFactsUpdate: true,
      deletionMethodUpdate: false,
    });

    const preparedExport = await privacyExports.prepare({
      idempotencyKey: "a".repeat(22),
      sessionToken: owner.sessionToken,
    });
    assert.equal(preparedExport.kind, "created");
    if (preparedExport.kind !== "created") assert.fail("Expected a new privacy export.");
    const exportedCalculations = preparedExport.snapshot.astrologyCalculations as Array<{
      encryptedFacts?: { ciphertext?: unknown };
      id?: unknown;
    }>;
    assert.equal(exportedCalculations.length, 1);
    assert.equal(exportedCalculations[0]?.id, calculationId);
    assert.equal(typeof exportedCalculations[0]?.encryptedFacts?.ciphertext, "string");
    assert(!JSON.stringify(preparedExport.snapshot).includes(prepared.idempotencyKeyDigest));

    const beforeDeletion = await migrator.query<{
      facts_ciphertext: Buffer;
      facts_tag: Buffer;
      keyed_facts_digest: Buffer;
    }>(
      `
        SELECT facts_ciphertext, facts_tag, keyed_facts_digest
          FROM astrology_calculation
         WHERE id = $1::uuid
      `,
      [calculationId],
    );
    assert.equal(beforeDeletion.rowCount, 1);

    const deleted = await privacyDeletion.request({
      idempotencyKey: "d".repeat(22),
      scope: "private_content",
      sessionToken: owner.sessionToken,
    });
    assert.equal(deleted.counts.astrologyCalculations, 1);
    assert.equal(deleted.counts.birthProfiles, 1);

    const shredded = await migrator.query<{
      digest_key_version: string;
      encryption_key_version: string;
      facts_ciphertext: Buffer;
      facts_nonce: Buffer;
      facts_tag: Buffer;
      keyed_facts_digest: Buffer;
      privacy_deleted_at: Date | null;
    }>(
      `
        SELECT facts_ciphertext, facts_nonce, facts_tag, encryption_key_version,
               digest_key_version, keyed_facts_digest, privacy_deleted_at
          FROM astrology_calculation
         WHERE id = $1::uuid
      `,
      [calculationId],
    );
    const shreddedRow = shredded.rows[0];
    assert(shreddedRow !== undefined);
    assert(shreddedRow.privacy_deleted_at instanceof Date);
    assert.equal(shreddedRow.encryption_key_version, "privacy-deleted.v1");
    assert.equal(shreddedRow.digest_key_version, "privacy-deleted.v1");
    assert.equal(shreddedRow.facts_nonce.byteLength, 12);
    assert.equal(shreddedRow.facts_tag.byteLength, 16);
    assert.equal(shreddedRow.keyed_facts_digest.byteLength, 32);
    assert.notDeepEqual(shreddedRow.facts_ciphertext, beforeDeletion.rows[0]?.facts_ciphertext);
    assert.notDeepEqual(shreddedRow.facts_tag, beforeDeletion.rows[0]?.facts_tag);
    assert.notDeepEqual(shreddedRow.keyed_facts_digest, beforeDeletion.rows[0]?.keyed_facts_digest);

    assert.equal((await calculations.list({ sessionToken: owner.sessionToken })).length, 0);
    await expectAstrologyError(
      () => calculations.read({ calculationId, sessionToken: owner.sessionToken }),
      "ASTROLOGY_CALCULATION_NOT_FOUND",
    );

    const evidence = await migrator.query<{
      astrology_calculation_count: number;
      evidence_sha256: Buffer;
      operation_count: string;
    }>(
      `
        SELECT completion.astrology_calculation_count,
               completion.evidence_sha256,
               (
                 SELECT count(*)::text
                   FROM astrology_calculation_operation
                  WHERE astrology_calculation_id = $2::uuid
               ) AS operation_count
          FROM privacy_deletion_completion AS completion
         WHERE completion.request_id = $1::uuid
      `,
      [deleted.id, calculationId],
    );
    assert.equal(evidence.rows[0]?.astrology_calculation_count, 1);
    assert.equal(evidence.rows[0]?.evidence_sha256.byteLength, 32);
    assert.equal(evidence.rows[0]?.operation_count, "1");

    console.log(
      "Verified astrology calculation ownership, profile binding, replay conflicts, append-only privileges, privacy export presence, and deletion crypto-shred evidence.",
    );
  } finally {
    await Promise.allSettled([
      app?.end(),
      migrator?.end(),
      runtime?.$disconnect(),
      deletionRuntime?.$disconnect(),
    ]);
    if (database !== undefined) await database.drop();
    await stopLeaseOwnedRuntime(lease);
  }
});
