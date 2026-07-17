import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

import { Client } from "pg";

import {
  createAnonymousIdentityService,
  type EnsuredAnonymousSession,
} from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  assertTarotReadingRuntimeDatabasePrivileges,
  createTarotReadingPersistence,
  TarotReadingPersistenceError,
  type PreparedTarotReadingCreate,
  type TarotReadingPrepareContext,
} from "../src/tarot-reading-persistence.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const identityPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.tarot-session.v1",
  ttlSeconds: 86_400,
});
const readingPolicy = Object.freeze({
  readingLimit: 3,
  readingPolicyVersion: "tarot-reading.test.v1",
  windowSeconds: 3_600,
});
const catalog = Object.freeze({
  approvalReference: "RIT-024:test-catalog-approval",
  checksumSha256: `sha256:${"ca".repeat(32)}`,
  id: "rituvia.test-catalog",
  version: "1.0.0",
});
const idempotencyKeys = Object.freeze({
  "test.idempotency-hmac.v1": Buffer.from("11".repeat(32), "hex"),
  "test.idempotency-hmac.v2": Buffer.from("22".repeat(32), "hex"),
});
const integrityKeys = Object.freeze({
  "test.integrity-hmac.v1": Buffer.from("33".repeat(32), "hex"),
  "test.integrity-hmac.v2": Buffer.from("44".repeat(32), "hex"),
});

const idempotencyKey = (): string => randomBytes(24).toString("base64url");
const digest = (key: Buffer, domain: string, fields: readonly string[]): string =>
  `sha256:${createHmac("sha256", key)
    .update([domain, ...fields].join("\u0000"))
    .digest("hex")}`;

const createdSession = async (
  identity: ReturnType<typeof createAnonymousIdentityService>,
): Promise<Extract<EnsuredAnonymousSession, { kind: "created" }>> => {
  const session = await identity.ensureSession({ idempotencyKey: idempotencyKey() });
  if (session.kind !== "created") assert.fail("Expected a newly created anonymous session.");
  return session;
};

const executionFor = (
  context: Parameters<PreparedTarotReadingCreate["createExecution"]>[0],
  request: TarotReadingPrepareContext["request"],
) => {
  const threeCard = request.readingType === "three_card";
  const facts = {
    algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
    catalog: { id: context.catalog.id, version: context.catalog.version },
    deck: { id: "rituvia.test-deck", version: "1.0.0" },
    engineName: "rituvia.tarot-draw",
    engineVersion: "1.0.0",
    method: "tarot",
    orientationPolicy: "upright_and_reversed",
    positions: threeCard
      ? [
          { cardId: "lantern", order: 1, orientation: "reversed", positionId: "situation" },
          { cardId: "mirror", order: 2, orientation: "upright", positionId: "action" },
          {
            cardId: "threshold",
            order: 3,
            orientation: "reversed",
            positionId: "possibility",
          },
        ]
      : [{ cardId: "lantern", order: 1, orientation: "upright", positionId: "perspective" }],
    replacementPolicy: "without_replacement",
    rulesVersion: "tarot-draw-rules.v1",
    schemaVersion: "tarot-draw-facts.v1",
    spread: {
      id: threeCard ? "situation-action-possibility" : "one-card-perspective",
      version: "1.0.0",
    },
  };
  const integrityKey = integrityKeys[context.integrityKeyVersion as keyof typeof integrityKeys];
  assert.ok(integrityKey);
  const requestDigest = digest(integrityKey, "rituvia.tarot-draw.request.v1", [
    context.subjectId,
    context.readingId,
    request.schemaVersion,
    request.readingType,
    request.themeCode,
    context.catalog.id,
    context.catalog.version,
  ]);
  const commitment = digest(integrityKey, "rituvia.tarot-draw.execution.v1", [
    requestDigest,
    JSON.stringify(facts),
  ]);
  return Object.freeze({
    audit: Object.freeze({
      entropy: Object.freeze({
        bytesConsumed: threeCard ? 5 : 2,
        commitment,
        rejectedSamples: 0,
      }),
      idempotencyKeyDigest: context.idempotencyKeyDigest,
      requestDigest,
    }),
    facts: Object.freeze(facts),
    schemaVersion: "tarot-draw-execution.v1",
  });
};

const prepare =
  ({
    activeVersion,
    executionCount,
    key,
    versions,
  }: Readonly<{
    activeVersion: keyof typeof idempotencyKeys;
    executionCount: { value: number };
    key: string;
    versions: readonly (keyof typeof idempotencyKeys)[];
  }>) =>
  (context: TarotReadingPrepareContext): PreparedTarotReadingCreate => {
    const requestFields = [
      context.subjectId,
      context.request.schemaVersion,
      context.request.locale,
      context.request.readingType,
      context.request.themeCode,
    ];
    return Object.freeze({
      activeIdempotencyKeyVersion: activeVersion,
      candidates: Object.freeze(
        versions.map((version) =>
          Object.freeze({
            clientRequestDigest: digest(
              idempotencyKeys[version],
              "rituvia.tarot-reading.client-request.v1",
              requestFields,
            ),
            idempotencyKeyDigest: digest(
              idempotencyKeys[version],
              "rituvia.tarot-reading.idempotency.v1",
              [context.subjectId, context.request.schemaVersion, key],
            ),
            idempotencyKeyVersion: version,
          }),
        ),
      ),
      catalog,
      createExecution: async (executionContext) => {
        executionCount.value += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return executionFor(executionContext, context.request);
      },
      integrityKeyVersion:
        activeVersion === "test.idempotency-hmac.v1"
          ? "test.integrity-hmac.v1"
          : "test.integrity-hmac.v2",
      integrityScheme: "hmac-sha256.tarot-reading.v1",
    });
  };

const request = (themeCode = "self", readingType = "one_card") =>
  Object.freeze({
    locale: "en",
    readingType,
    schemaVersion: "tarot-reading-create.v1",
    themeCode,
  });

const isPersistenceError = (error: unknown, code: TarotReadingPersistenceError["code"]): boolean =>
  error instanceof TarotReadingPersistenceError && error.code === code;

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
  }
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

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    const controlRuntime = createDatabaseClient(database.controlDatabaseUrl);
    const migratorRuntime = createDatabaseClient(database.migrationDatabaseUrl);
    const runtimeSql = new Client({ connectionString: database.databaseUrl });
    await Promise.all([migrator.connect(), runtimeSql.connect()]);
    try {
      await assertTarotReadingRuntimeDatabasePrivileges(runtime);
      await assert.rejects(
        assertTarotReadingRuntimeDatabasePrivileges(controlRuntime),
        /runtime database privileges are unsafe/u,
      );
      await assert.rejects(
        assertTarotReadingRuntimeDatabasePrivileges(migratorRuntime),
        /runtime database privileges are unsafe/u,
      );

      const identity = createAnonymousIdentityService(runtime, identityPolicy);
      const persistence = createTarotReadingPersistence(runtime, readingPolicy);
      const owner = await createdSession(identity);
      const otherOwner = await createdSession(identity);
      const firstKey = idempotencyKey();
      const firstExecutionCount = { value: 0 };
      const created = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v1",
          executionCount: firstExecutionCount,
          key: firstKey,
          versions: ["test.idempotency-hmac.v1"],
        }),
        request: request(),
        token: owner.token,
      });
      assert.equal(created.kind, "created");
      assert.equal(created.reading.status, "facts_ready");
      assert.equal(created.reading.idempotencyKeyVersion, "test.idempotency-hmac.v1");
      assert.equal(firstExecutionCount.value, 1);
      assert.deepEqual(
        await persistence.get({ readingId: created.reading.id, token: owner.token }),
        created.reading,
      );
      assert.equal(
        await persistence.get({ readingId: created.reading.id, token: otherOwner.token }),
        null,
      );

      const rotationExecutionCount = { value: 0 };
      const replayed = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v2",
          executionCount: rotationExecutionCount,
          key: firstKey,
          versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
        }),
        request: request(),
        token: owner.token,
      });
      assert.equal(replayed.kind, "replayed");
      assert.equal(replayed.reading.id, created.reading.id);
      assert.equal(replayed.reading.idempotencyKeyVersion, "test.idempotency-hmac.v1");
      assert.equal(rotationExecutionCount.value, 0);

      await assert.rejects(
        persistence.resolveCreate({
          prepare: prepare({
            activeVersion: "test.idempotency-hmac.v2",
            executionCount: rotationExecutionCount,
            key: firstKey,
            versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
          }),
          request: request("work"),
          token: owner.token,
        }),
        (error: unknown) => isPersistenceError(error, "TAROT_READING_IDEMPOTENCY_CONFLICT"),
      );
      assert.equal(rotationExecutionCount.value, 0);

      const raceKey = idempotencyKey();
      const raceExecutionCount = { value: 0 };
      const raceResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          persistence.resolveCreate({
            prepare: prepare({
              activeVersion: "test.idempotency-hmac.v2",
              executionCount: raceExecutionCount,
              key: raceKey,
              versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
            }),
            request: request("creativity", "three_card"),
            token: otherOwner.token,
          }),
        ),
      );
      assert.equal(raceResults.filter(({ kind }) => kind === "created").length, 1);
      assert.equal(raceResults.filter(({ kind }) => kind === "replayed").length, 7);
      assert.equal(new Set(raceResults.map(({ reading }) => reading.id)).size, 1);
      assert.equal(raceExecutionCount.value, 1);

      const quotaOwner = await createdSession(identity);
      const quotaSettlements = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) => {
          const counter = { value: 0 };
          return persistence.resolveCreate({
            prepare: prepare({
              activeVersion: "test.idempotency-hmac.v2",
              executionCount: counter,
              key: `quota-key-${index}-${idempotencyKey()}`,
              versions: ["test.idempotency-hmac.v2"],
            }),
            request: request(index % 2 === 0 ? "courage" : "gratitude"),
            token: quotaOwner.token,
          });
        }),
      );
      assert.equal(quotaSettlements.filter(({ status }) => status === "fulfilled").length, 3);
      const limited = quotaSettlements.filter(({ status }) => status === "rejected");
      assert.equal(limited.length, 3);
      for (const result of limited) {
        assert.equal(result.status, "rejected");
        if (result.status === "rejected") {
          assert.ok(isPersistenceError(result.reason, "TAROT_READING_RATE_LIMITED"));
          assert.ok((result.reason as TarotReadingPersistenceError).retryAfterSeconds! > 0);
        }
      }

      const invalidOwner = await createdSession(identity);
      const invalidKey = idempotencyKey();
      const invalidPrepare = prepare({
        activeVersion: "test.idempotency-hmac.v2",
        executionCount: { value: 0 },
        key: invalidKey,
        versions: ["test.idempotency-hmac.v2"],
      });
      await assert.rejects(
        persistence.resolveCreate({
          prepare: (context) => {
            const prepared = invalidPrepare(context);
            return Object.freeze({
              ...prepared,
              createExecution: async (executionContext) => {
                const execution = (await prepared.createExecution(executionContext)) as Record<
                  string,
                  unknown
                >;
                return { ...execution, privateQuestion: "must-not-persist" };
              },
            });
          },
          request: request(),
          token: invalidOwner.token,
        }),
        (error: unknown) => isPersistenceError(error, "TAROT_READING_EXECUTION_INVALID"),
      );
      const invalidRows = await migrator.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM reading WHERE anonymous_subject_id = $1::uuid",
        [invalidOwner.context.subjectId],
      );
      assert.equal(invalidRows.rows[0]?.count, 0);

      const stored = await migrator.query<{
        catalogChecksumBytes: number;
        clientDrawHashesDiffer: boolean;
        expiresAt: Date;
        raw: string;
        subjectExpiresAt: Date;
      }>(
        `SELECT octet_length(reading.catalog_checksum_sha256) AS "catalogChecksumBytes",
                reading.client_request_hash <> draw.draw_request_hash AS "clientDrawHashesDiffer",
                reading.expires_at AS "expiresAt",
                subject.expires_at AS "subjectExpiresAt",
                row_to_json(reading)::text || draw.execution::text AS raw
           FROM reading
           JOIN tarot_draw AS draw ON draw.reading_id = reading.id
           JOIN anonymous_subject AS subject ON subject.id = reading.anonymous_subject_id
          WHERE reading.id = $1::uuid`,
        [created.reading.id],
      );
      assert.equal(stored.rows[0]?.catalogChecksumBytes, 32);
      assert.equal(stored.rows[0]?.clientDrawHashesDiffer, true);
      assert.deepEqual(stored.rows[0]?.expiresAt, stored.rows[0]?.subjectExpiresAt);
      assert.equal(stored.rows[0]?.raw.includes(firstKey), false);
      assert.equal(stored.rows[0]?.raw.includes(owner.token), false);

      for (const statement of [
        "UPDATE reading SET theme_code = 'work'",
        "DELETE FROM tarot_draw",
        "TRUNCATE reading",
      ]) {
        await expectPostgresError(() => runtimeSql.query(statement), "42501");
      }

      const revokedOwner = await createdSession(identity);
      assert.equal(await identity.revokeSession(revokedOwner.token), true);
      assert.equal(
        await persistence.get({ readingId: created.reading.id, token: revokedOwner.token }),
        null,
      );
      await assert.rejects(
        persistence.resolveCreate({
          prepare: prepare({
            activeVersion: "test.idempotency-hmac.v2",
            executionCount: { value: 0 },
            key: idempotencyKey(),
            versions: ["test.idempotency-hmac.v2"],
          }),
          request: request(),
          token: revokedOwner.token,
        }),
        (error: unknown) => isPersistenceError(error, "TAROT_READING_SESSION_UNAVAILABLE"),
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      try {
        const restoredPersistence = createTarotReadingPersistence(restoredRuntime, readingPolicy);
        assert.deepEqual(
          await restoredPersistence.get({ readingId: created.reading.id, token: owner.token }),
          created.reading,
        );
        await assertTarotReadingRuntimeDatabasePrivileges(restoredRuntime);
      } finally {
        await restoredRuntime.$disconnect();
      }
    } finally {
      await Promise.all([
        runtime.$disconnect(),
        controlRuntime.$disconnect(),
        migratorRuntime.$disconnect(),
        migrator.end(),
        runtimeSql.end(),
      ]);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (primaryError === undefined && cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Tarot reading persistence cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified owner-scoped tarot persistence, active sessions, keyed replay rotation, conflict, winner-before-entropy races, atomic limits, immutable execution, least privilege, and logical restore.\n",
);
