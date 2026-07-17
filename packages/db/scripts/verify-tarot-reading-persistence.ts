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
  type PreparedTarotReadingReport,
  type TarotReadingPrepareContext,
  type TarotReadingReportPrepareContext,
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
  reportPolicyVersion: "tarot-reading-report.test.v1",
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

const reportRequest = (
  category = "factual",
  target: Readonly<{ kind: "reading" } | { kind: "position"; positionId: string }> = {
    kind: "reading",
  },
) =>
  Object.freeze({
    category,
    schemaVersion: "tarot-reading-report.v1",
    target: Object.freeze(target),
  });

const prepareReport =
  ({
    activeVersion,
    callbackCount,
    key,
    versions,
  }: Readonly<{
    activeVersion: keyof typeof idempotencyKeys;
    callbackCount: { value: number };
    key: string;
    versions: readonly (keyof typeof idempotencyKeys)[];
  }>) =>
  (context: TarotReadingReportPrepareContext): PreparedTarotReadingReport => {
    callbackCount.value += 1;
    return Object.freeze({
      activeIdempotencyKeyVersion: activeVersion,
      candidates: Object.freeze(
        versions.map((version) =>
          Object.freeze({
            canonicalRequestDigest: digest(
              idempotencyKeys[version],
              "rituvia.tarot-reading.report-request.v1",
              [
                context.subjectId,
                context.readingId,
                context.reportPolicyVersion,
                JSON.stringify(context.request),
              ],
            ),
            idempotencyKeyDigest: digest(
              idempotencyKeys[version],
              "rituvia.tarot-reading.report-idempotency.v1",
              [context.subjectId, context.request.schemaVersion, key],
            ),
            idempotencyKeyVersion: version,
          }),
        ),
      ),
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
  constraint?: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
    if (constraint !== undefined) {
      assert.equal((error as { constraint?: unknown }).constraint, constraint);
    }
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

      const reportKey = idempotencyKey();
      const reportPrepareCount = { value: 0 };
      const reportCreated = await persistence.report({
        prepare: prepareReport({
          activeVersion: "test.idempotency-hmac.v1",
          callbackCount: reportPrepareCount,
          key: reportKey,
          versions: ["test.idempotency-hmac.v1"],
        }),
        readingId: created.reading.id,
        request: reportRequest(),
        token: owner.token,
      });
      assert.equal(reportCreated.kind, "created");
      assert.equal(reportPrepareCount.value, 1);

      const replayPrepareCount = { value: 0 };
      const reportReplayed = await persistence.report({
        prepare: prepareReport({
          activeVersion: "test.idempotency-hmac.v2",
          callbackCount: replayPrepareCount,
          key: reportKey,
          versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
        }),
        readingId: created.reading.id,
        request: reportRequest(),
        token: owner.token,
      });
      assert.equal(reportReplayed.kind, "replayed");
      assert.equal(replayPrepareCount.value, 1);

      await assert.rejects(
        persistence.report({
          prepare: prepareReport({
            activeVersion: "test.idempotency-hmac.v2",
            callbackCount: replayPrepareCount,
            key: reportKey,
            versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
          }),
          readingId: created.reading.id,
          request: reportRequest("safety"),
          token: owner.token,
        }),
        (error: unknown) => isPersistenceError(error, "TAROT_READING_IDEMPOTENCY_CONFLICT"),
      );

      const hiddenTargetPrepareCount = { value: 0 };
      const hiddenTargetPrepare = prepareReport({
        activeVersion: "test.idempotency-hmac.v2",
        callbackCount: hiddenTargetPrepareCount,
        key: idempotencyKey(),
        versions: ["test.idempotency-hmac.v2"],
      });
      for (const hiddenTarget of [
        {
          readingId: created.reading.id,
          request: reportRequest(),
          token: otherOwner.token,
        },
        {
          readingId: created.reading.id,
          request: reportRequest("factual", {
            kind: "position",
            positionId: "not-a-real-position",
          }),
          token: owner.token,
        },
        {
          readingId: "00000000-0000-4000-8000-000000000000",
          request: reportRequest(),
          token: owner.token,
        },
      ]) {
        await assert.rejects(
          persistence.report({ prepare: hiddenTargetPrepare, ...hiddenTarget }),
          (error: unknown) => isPersistenceError(error, "TAROT_READING_NOT_FOUND"),
        );
      }
      assert.equal(hiddenTargetPrepareCount.value, 0);

      const threeCardReading = raceResults[0]!.reading;
      const positionReport = await persistence.report({
        prepare: prepareReport({
          activeVersion: "test.idempotency-hmac.v2",
          callbackCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        readingId: threeCardReading.id,
        request: reportRequest("translation", { kind: "position", positionId: "action" }),
        token: otherOwner.token,
      });
      assert.equal(positionReport.kind, "created");

      const reportRaceKey = idempotencyKey();
      const reportRacePrepareCount = { value: 0 };
      const reportRaceResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          persistence.report({
            prepare: prepareReport({
              activeVersion: "test.idempotency-hmac.v2",
              callbackCount: reportRacePrepareCount,
              key: reportRaceKey,
              versions: ["test.idempotency-hmac.v2"],
            }),
            readingId: threeCardReading.id,
            request: reportRequest("accessibility"),
            token: otherOwner.token,
          }),
        ),
      );
      assert.equal(reportRaceResults.filter(({ kind }) => kind === "created").length, 1);
      assert.equal(reportRaceResults.filter(({ kind }) => kind === "replayed").length, 7);
      assert.equal(reportRacePrepareCount.value, 8);

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
      const quotaReading = quotaSettlements.find(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof persistence.resolveCreate>>
        > => result.status === "fulfilled",
      )?.value.reading;
      assert.ok(quotaReading);
      const readingsBeforeQuotaReport = await migrator.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM reading WHERE anonymous_subject_id = $1::uuid",
        [quotaOwner.context.subjectId],
      );
      const quotaReport = await persistence.report({
        prepare: prepareReport({
          activeVersion: "test.idempotency-hmac.v2",
          callbackCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        readingId: quotaReading.id,
        request: reportRequest("rights"),
        token: quotaOwner.token,
      });
      assert.equal(quotaReport.kind, "created");
      const readingsAfterQuotaReport = await migrator.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM reading WHERE anonymous_subject_id = $1::uuid",
        [quotaOwner.context.subjectId],
      );
      assert.deepEqual(readingsAfterQuotaReport.rows, readingsBeforeQuotaReport.rows);

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

      const storedReport = await migrator.query<{
        canonicalRequestHashBytes: number;
        category: string;
        expiresAt: Date;
        idempotencyKeyHashBytes: number;
        idempotencyKeyVersion: string;
        raw: string;
        readingExpiresAt: Date;
        reportPolicyVersion: string;
        schemaVersion: string;
        targetKind: string;
        targetPositionId: string | null;
      }>(
        `SELECT octet_length(report.canonical_request_hash) AS "canonicalRequestHashBytes",
                report.category,
                report.expires_at AS "expiresAt",
                octet_length(report.idempotency_key_hash) AS "idempotencyKeyHashBytes",
                report.idempotency_key_version AS "idempotencyKeyVersion",
                row_to_json(report)::text AS raw,
                reading.expires_at AS "readingExpiresAt",
                report.report_policy_version AS "reportPolicyVersion",
                report.schema_version AS "schemaVersion",
                report.target_kind AS "targetKind",
                report.target_position_id AS "targetPositionId"
           FROM reading_report AS report
           JOIN reading ON reading.id = report.reading_id
          WHERE report.reading_id = $1::uuid
            AND report.category = 'factual'`,
        [created.reading.id],
      );
      assert.equal(storedReport.rows.length, 1);
      assert.deepEqual(
        {
          ...storedReport.rows[0],
          expiresAt: storedReport.rows[0]?.expiresAt.toISOString(),
          raw: undefined,
          readingExpiresAt: storedReport.rows[0]?.readingExpiresAt.toISOString(),
        },
        {
          canonicalRequestHashBytes: 32,
          category: "factual",
          expiresAt: created.reading.expiresAt,
          idempotencyKeyHashBytes: 32,
          idempotencyKeyVersion: "test.idempotency-hmac.v1",
          raw: undefined,
          readingExpiresAt: created.reading.expiresAt,
          reportPolicyVersion: readingPolicy.reportPolicyVersion,
          schemaVersion: "tarot-reading-report.v1",
          targetKind: "reading",
          targetPositionId: null,
        },
      );
      assert.equal(storedReport.rows[0]?.raw.includes(reportKey), false);
      assert.equal(storedReport.rows[0]?.raw.includes(owner.token), false);

      const forgedDigest = (): Buffer => randomBytes(32);
      await expectPostgresError(
        () =>
          runtimeSql.query(
            `INSERT INTO reading_report (
               reading_id, anonymous_subject_id, category, target_kind, target_position_id,
               schema_version, report_policy_version, idempotency_key_version,
               idempotency_key_hash, canonical_request_hash, created_at, expires_at
             ) SELECT reading_id, $1::uuid, category, target_kind, target_position_id,
                      schema_version, report_policy_version, idempotency_key_version,
                      $2::bytea, $3::bytea, created_at, expires_at
                 FROM reading_report
                WHERE reading_id = $4::uuid
                LIMIT 1`,
            [otherOwner.context.subjectId, forgedDigest(), forgedDigest(), created.reading.id],
          ),
        "23503",
        "reading_report_reading_subject_fkey",
      );
      await expectPostgresError(
        () =>
          runtimeSql.query(
            `INSERT INTO reading_report (
               reading_id, anonymous_subject_id, category, target_kind, target_position_id,
               schema_version, report_policy_version, idempotency_key_version,
               idempotency_key_hash, canonical_request_hash, created_at, expires_at
             ) SELECT reading_id, anonymous_subject_id, category, 'position', 'Not valid',
                      schema_version, report_policy_version, idempotency_key_version,
                      $1::bytea, $2::bytea, created_at, expires_at
                 FROM reading_report
                WHERE reading_id = $3::uuid
                LIMIT 1`,
            [forgedDigest(), forgedDigest(), created.reading.id],
          ),
        "23514",
        "reading_report_target_check",
      );

      for (const statement of [
        "UPDATE reading SET theme_code = 'work'",
        "DELETE FROM tarot_draw",
        "UPDATE reading_report SET category = 'safety'",
        "DELETE FROM reading_report",
        "TRUNCATE reading_report",
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
        assert.deepEqual(
          await restoredPersistence.report({
            prepare: prepareReport({
              activeVersion: "test.idempotency-hmac.v2",
              callbackCount: { value: 0 },
              key: reportKey,
              versions: ["test.idempotency-hmac.v2", "test.idempotency-hmac.v1"],
            }),
            readingId: created.reading.id,
            request: reportRequest(),
            token: owner.token,
          }),
          { kind: "replayed" },
        );
        const restoredReports = await restoredRuntime.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count FROM reading_report
        `;
        assert.equal(restoredReports[0]?.count, 4);
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
  "Verified owner-scoped tarot persistence and reporting, position validation, keyed replay/conflict races, quota independence, immutable execution/report rows, least privilege, and logical restore.\n",
);
