import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAnonymousIdentityService,
  type EnsuredAnonymousSession,
} from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  assertInterpretationGenerationRuntimeDatabasePrivileges,
  createInterpretationGenerationPersistence,
  InterpretationGenerationPersistenceError,
  type InterpretationGenerationClaimProvenanceV1,
  type InterpretationGenerationProvenanceV1,
  type InterpretationVerificationCompletionV1,
  type PersistedInterpretationGeneration,
} from "../src/interpretation-generation-persistence.js";
import {
  assertTarotReadingRuntimeDatabasePrivileges,
  createTarotReadingPersistence,
  TarotReadingPersistenceError,
  type PreparedTarotReadingCreate,
  type PreparedTarotReadingReport,
  type PersistedTarotReading,
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

const jsonRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    assert.fail("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
};

const generationClaimProvenance = (
  reading: PersistedTarotReading,
): InterpretationGenerationClaimProvenanceV1 => {
  const facts = jsonRecord(
    jsonRecord(reading.execution).facts,
  ) as InterpretationGenerationProvenanceV1["deterministicFacts"];
  const prompt = Object.freeze({
    approvalReference: "OWN-TEST:prompt",
    checksum: `sha256:${"51".repeat(32)}`,
    id: "test.prompt",
    version: "1.0.0",
  });
  const fallbackTemplate = Object.freeze({
    approvalReference: "OWN-TEST:fallback",
    checksum: `sha256:${"52".repeat(32)}`,
    id: "test.fallback-template",
    version: "1.0.0",
  });
  return Object.freeze({
    assemblyPolicyVersion: "tarot-prompt-assembly-policy.v1",
    attemptTimeoutMs: 500,
    contentVersions: Object.freeze(["1.0.0"]),
    currencyCode: "USD",
    deterministicAlgorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
    deterministicEngineName: "rituvia.tarot-draw",
    deterministicEngineVersion: "1.0.0",
    deterministicRulesVersion: "tarot-draw-rules.v1",
    eligibilityAsOf: "2026-07-18",
    fallbackTemplate,
    generationPolicyVersion: "test.interpretation-generation.v1",
    generationProvenance: Object.freeze({
      assemblyPolicyVersion: "tarot-prompt-assembly-policy.v1",
      content: Object.freeze({
        catalog: Object.freeze({
          approvalReference: reading.catalog.approvalReference,
          checksum: reading.catalog.checksumSha256,
          id: reading.catalog.id,
          version: reading.catalog.version,
        }),
      }),
      deterministicEngine: Object.freeze({
        algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
        engineName: "rituvia.tarot-draw",
        engineVersion: "1.0.0",
        rulesVersion: "tarot-draw-rules.v1",
      }),
      deterministicFacts: facts,
      fallbackTemplate,
      inputSchemaVersion: "tarot-interpretation-input.v1",
      locale: "en",
      modality: "tarot",
      outputSchema: Object.freeze({
        checksum: `sha256:${"53".repeat(32)}`,
        id: "tarot.interpretation-output",
        version: "1",
      }),
      prompt: Object.freeze({
        ...prompt,
        evaluationVersion: "test.prompt-eval.v1",
      }),
      retrievalPolicyVersion: "tarot-content-retrieval-policy.v1",
      safetyPolicyVersion: "test.safety.v1",
      schemaVersion: "interpretation-generation-provenance.v1",
      themeCode: reading.themeCode,
      tone: "grounded",
      tradition: "test.tarot",
    }),
    locale: "en",
    maxAttempts: 2,
    maxOutputTokens: 800,
    maximumEstimatedCostMicros: 100_000,
    modality: "tarot",
    model: Object.freeze({ id: "test.model", version: "1.0.0" }),
    outputSchemaVersion: "1",
    prompt,
    provider: Object.freeze({
      approvalReference: "OWN-TEST:provider",
      id: "test.provider",
      version: "1.0.0",
    }),
    readingType: reading.readingType,
    retrievalPolicyVersion: "tarot-content-retrieval-policy.v1",
    retryDelayMs: 50,
    safetyPolicyVersion: "test.safety.v1",
    themeCode: reading.themeCode,
    tone: "grounded",
    totalTimeoutMs: 1_000,
    verificationTimeoutMs: 500,
  });
};

const fallbackOutput = Object.freeze({
  boundaryNote: "This is a symbolic reflection, not a prediction.",
  perspectives: Object.freeze(["Notice what feels useful and leave the rest."]),
  reflectionQuestions: Object.freeze(["What small choice is available today?"]),
  safety: Object.freeze({
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  }),
  schemaVersion: "1",
  smallAction: Object.freeze({
    label: "Write one next step.",
    rationale: "A concrete step keeps the reflection grounded.",
    timeHorizon: "today",
  }),
  sourceRefs: Object.freeze(["test.source"]),
  summary: "Use the symbol as one perspective rather than a fixed answer.",
  symbols: Object.freeze([]),
  title: "A grounded perspective",
});

const verificationOutput = Object.freeze({
  ...fallbackOutput,
  symbols: Object.freeze([
    Object.freeze({
      factRef: "tarot.position.perspective",
      limitation: "A symbol cannot determine an outcome.",
      meaning: "The lantern can suggest patient attention.",
      possibility: "You might pause before choosing one small next step.",
    }),
  ]),
});

const verificationReference = (id: string, byte: string) =>
  Object.freeze({
    approvalReference: `OWN-TEST:${id}`,
    checksum: `sha256:${byte.repeat(32)}`,
    id,
    version: "1.0.0",
  });

const verificationResult = (
  status: "safe_replacement" | "verified",
  byte = "81",
): InterpretationVerificationCompletionV1 =>
  Object.freeze({
    displayable: true,
    metadata: Object.freeze({
      deterministicChecksVersion: "tarot-post-generation-checks.v1",
      outcome: status,
      policyVersion: "1.0.0",
      reviewerModelVersion: "1.0.0",
      reviewerPolicyVersion: "1.0.0",
      reviewerProviderVersion: "1.0.0",
      reviewerVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      schemaVersion: "tarot-verification-operational-metadata.v1",
    }),
    output: verificationOutput,
    provenance: Object.freeze({
      candidateDigest: `hmac-sha256:${byte.repeat(32)}`,
      candidateDigestScope: "canonical-tarot-verification-candidate-json.v1",
      deterministicChecksVersion: "tarot-post-generation-checks.v1",
      outputDigest: `hmac-sha256:${"82".repeat(32)}`,
      outputDigestScope: "canonical-tarot-verification-output-json.v1",
      policy: verificationReference("test.verification-policy", "83"),
      reviewer: verificationReference("test.verification-reviewer", "84"),
      reviewerModel: Object.freeze({ id: "test.reviewer-model", version: "1.0.0" }),
      reviewerPolicy: verificationReference("test.reviewer-policy", "85"),
      reviewerProvider: Object.freeze({ id: "test.reviewer-provider", version: "1.0.0" }),
      runtime: verificationReference("test.verification-runtime", "86"),
      schemaVersion: "tarot-verification-provenance.v1",
      verificationTimeoutMs: 500,
    }),
    schemaVersion: "tarot-interpretation-verification-result.v1",
    status,
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
    const adminDatabaseUrl = new URL(database.databaseUrl);
    adminDatabaseUrl.username = "rituvia_local_admin";
    const runtimeCredentials = jsonRecord(jsonRecord(lease.runtime).credentials);
    const adminPassword = runtimeCredentials.adminPassword;
    if (typeof adminPassword !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(adminPassword)) {
      assert.fail("Expected a validated local integration administrator credential.");
    }
    adminDatabaseUrl.password = adminPassword;
    adminDatabaseUrl.searchParams.set("application_name", "rituvia_integration_admin");
    const adminSql = new Client({ connectionString: adminDatabaseUrl.toString() });
    await Promise.all([adminSql.connect(), migrator.connect(), runtimeSql.connect()]);
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

      const interpretation = createInterpretationGenerationPersistence(runtime, {
        leaseSeconds: 32,
      });
      const generationRequestId = randomUUID();
      const generationIdempotencyDigest = `sha256:${"61".repeat(32)}`;
      const generationCanonicalDigest = `sha256:${"62".repeat(32)}`;
      const claimInput = Object.freeze({
        canonicalRequestDigest: generationCanonicalDigest,
        generationSchemaVersion: "interpretation-generation.v1" as const,
        idempotencyKeyDigest: generationIdempotencyDigest,
        idempotencyKeyVersion: "test.interpretation-idempotency.v1",
        provenance: generationClaimProvenance(created.reading),
        readingId: created.reading.id,
        requestId: generationRequestId,
        token: owner.token,
      });
      const concurrentClaims = await Promise.all(
        Array.from({ length: 8 }, () => interpretation.claim(claimInput)),
      );
      const winningClaim = concurrentClaims.find(({ kind }) => kind === "claimed");
      assert.ok(winningClaim?.kind === "claimed");
      assert.equal(winningClaim.providerEligible, true);
      assert.equal(concurrentClaims.filter(({ kind }) => kind === "claimed").length, 1);
      assert.equal(concurrentClaims.filter(({ kind }) => kind === "in_progress").length, 7);

      await assert.rejects(
        interpretation.claim({ ...claimInput, token: otherOwner.token }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_READING_NOT_FOUND",
      );
      const completionDigest = `sha256:${"63".repeat(32)}`;
      const completedVerification = verificationResult("verified");
      const pendingCompletion = Object.freeze({
        operational: Object.freeze({
          attemptCount: 1 as const,
          costStatus: "reported" as const,
          currencyCode: "USD",
          estimatedCostMicros: 1_000,
          failureCode: null,
          inputTokens: 50,
          latencyMs: 120,
          outputTokens: 60,
          retryReason: null,
          tokenStatus: "reported" as const,
          totalTokens: 110,
        }),
        status: "pending_verification" as const,
        verification: completedVerification,
      });
      await assert.rejects(
        interpretation.finalize({
          claimToken: winningClaim.claimToken,
          claimVersion: winningClaim.claimVersion,
          completion: Object.freeze({
            ...pendingCompletion,
            verification: Object.freeze({
              ...completedVerification,
              provenance: Object.freeze({
                ...completedVerification.provenance,
                verificationTimeoutMs: 501,
              }),
            }),
          }),
          completionDigest: `sha256:${"73".repeat(32)}`,
          interpretationId: winningClaim.interpretationId,
          token: owner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );
      const atomicRollback = await adminSql.query<{ children: number; status: string }>(
        `SELECT interpretation.status,
                (SELECT count(*)::int FROM interpretation_verification AS verification
                  WHERE verification.interpretation_id = interpretation.id) AS children
           FROM interpretation WHERE interpretation.id = $1::uuid`,
        [winningClaim.interpretationId],
      );
      assert.deepEqual(atomicRollback.rows, [{ children: 0, status: "generating" }]);
      const finalized = await interpretation.finalize({
        claimToken: winningClaim.claimToken,
        claimVersion: winningClaim.claimVersion,
        completion: pendingCompletion,
        completionDigest,
        interpretationId: winningClaim.interpretationId,
        token: owner.token,
      });
      assert.equal(finalized.kind, "finalized");
      assert.equal(finalized.interpretation.status, "pending_verification");
      assert.equal(Object.hasOwn(finalized.interpretation, "output"), false);
      assert.equal(finalized.interpretation.verification?.status, "verified");
      assert.equal(
        finalized.interpretation.verification?.provenance.candidateDigest,
        completedVerification.provenance.candidateDigest,
      );
      const replayedFinalization = await interpretation.finalize({
        claimToken: winningClaim.claimToken,
        claimVersion: winningClaim.claimVersion,
        completion: pendingCompletion,
        completionDigest,
        interpretationId: winningClaim.interpretationId,
        token: owner.token,
      });
      assert.equal(replayedFinalization.kind, "replayed");
      const terminalReplay = await interpretation.claim(claimInput);
      assert.equal(terminalReplay.kind, "replayed");
      await assert.rejects(
        interpretation.claim({
          ...claimInput,
          canonicalRequestDigest: `sha256:${"64".repeat(32)}`,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_IDEMPOTENCY_CONFLICT",
      );
      const normalVerificationRaw = await adminSql.query<{ raw: string }>(
        "SELECT row_to_json(verification)::text AS raw FROM interpretation_verification AS verification WHERE interpretation_id = $1::uuid",
        [winningClaim.interpretationId],
      );
      assert.equal(normalVerificationRaw.rows.length, 1);
      assert.equal(normalVerificationRaw.rows[0]?.raw.includes("riskCategories"), false);
      assert.equal(normalVerificationRaw.rows[0]?.raw.includes("providerOutput"), false);

      await adminSql.query(
        "UPDATE interpretation_verification SET finalization_digest = $2::bytea WHERE interpretation_id = $1::uuid",
        [winningClaim.interpretationId, Buffer.from("90".repeat(32), "hex")],
      );
      await assert.rejects(
        interpretation.claim(claimInput),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_VERIFICATION_UNAVAILABLE",
      );
      await assert.rejects(
        interpretation.finalize({
          claimToken: winningClaim.claimToken,
          claimVersion: winningClaim.claimVersion,
          completion: pendingCompletion,
          completionDigest,
          interpretationId: winningClaim.interpretationId,
          token: owner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_VERIFICATION_UNAVAILABLE",
      );
      await adminSql.query(
        "UPDATE interpretation_verification SET finalization_digest = $2::bytea WHERE interpretation_id = $1::uuid",
        [winningClaim.interpretationId, Buffer.from("63".repeat(32), "hex")],
      );
      assert.equal((await interpretation.claim(claimInput)).kind, "replayed");

      const fenceReading = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v2",
          executionCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        request: request("work"),
        token: owner.token,
      });
      const shortLeaseInterpretation = createInterpretationGenerationPersistence(runtime, {
        leaseSeconds: 32,
      });
      const fenceClaimInput = Object.freeze({
        canonicalRequestDigest: `sha256:${"65".repeat(32)}`,
        generationSchemaVersion: "interpretation-generation.v1" as const,
        idempotencyKeyDigest: `sha256:${"66".repeat(32)}`,
        idempotencyKeyVersion: "test.interpretation-idempotency.v1",
        provenance: generationClaimProvenance(fenceReading.reading),
        readingId: fenceReading.reading.id,
        requestId: randomUUID(),
        token: owner.token,
      });
      const initialFenceClaim = await shortLeaseInterpretation.claim(fenceClaimInput);
      assert.equal(initialFenceClaim.kind, "claimed");
      if (initialFenceClaim.kind !== "claimed") assert.fail("Expected a new fenced claim.");

      const failedReading = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v2",
          executionCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        request: request("transition"),
        token: owner.token,
      });
      const failedClaimInput = Object.freeze({
        canonicalRequestDigest: `sha256:${"6a".repeat(32)}`,
        generationSchemaVersion: "interpretation-generation.v1" as const,
        idempotencyKeyDigest: `sha256:${"6b".repeat(32)}`,
        idempotencyKeyVersion: "test.interpretation-idempotency.v1",
        provenance: generationClaimProvenance(failedReading.reading),
        readingId: failedReading.reading.id,
        requestId: randomUUID(),
        token: owner.token,
      });
      const failedCompletion = Object.freeze({
        operational: Object.freeze({
          attemptCount: 1 as const,
          costStatus: "unavailable" as const,
          currencyCode: null,
          estimatedCostMicros: null,
          failureCode: "configuration" as const,
          inputTokens: null,
          latencyMs: 20,
          outputTokens: null,
          retryReason: null,
          tokenStatus: "unavailable" as const,
          totalTokens: null,
        }),
        status: "failed" as const,
      });
      const failedClaim = await shortLeaseInterpretation.claim(failedClaimInput);
      assert.equal(failedClaim.kind, "claimed");
      if (failedClaim.kind !== "claimed") assert.fail("Expected a new failed-terminal claim.");
      await assert.rejects(
        shortLeaseInterpretation.finalize({
          claimToken: failedClaim.claimToken,
          claimVersion: failedClaim.claimVersion,
          completion: Object.freeze({
            operational: Object.freeze({
              attemptCount: 1,
              costStatus: "unavailable",
              currencyCode: null,
              estimatedCostMicros: null,
              failureCode: null,
              inputTokens: 3_000_000_000,
              latencyMs: 20,
              outputTokens: 1,
              retryReason: null,
              tokenStatus: "reported",
              totalTokens: 3_000_000_001,
            }),
            status: "pending_verification",
            verification: completedVerification,
          }),
          completionDigest: `sha256:${"72".repeat(32)}`,
          interpretationId: failedClaim.interpretationId,
          token: owner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );
      await assert.rejects(
        shortLeaseInterpretation.finalize({
          claimToken: failedClaim.claimToken,
          claimVersion: failedClaim.claimVersion,
          completion: Object.freeze({
            operational: failedCompletion.operational,
            output: fallbackOutput,
            status: "fallback",
          }),
          completionDigest: `sha256:${"70".repeat(32)}`,
          interpretationId: failedClaim.interpretationId,
          token: owner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );
      const failedCompletionDigest = `sha256:${"6c".repeat(32)}`;
      const failedFinalized = await shortLeaseInterpretation.finalize({
        claimToken: failedClaim.claimToken,
        claimVersion: failedClaim.claimVersion,
        completion: failedCompletion,
        completionDigest: failedCompletionDigest,
        interpretationId: failedClaim.interpretationId,
        token: owner.token,
      });
      assert.equal(failedFinalized.kind, "finalized");
      assert.equal(failedFinalized.interpretation.status, "failed");
      assert.equal(Object.hasOwn(failedFinalized.interpretation, "output"), false);
      assert.equal(failedFinalized.interpretation.operational.failureCode, "configuration");

      const unknownFailureClaimInput = Object.freeze({
        canonicalRequestDigest: `sha256:${"6d".repeat(32)}`,
        generationSchemaVersion: "interpretation-generation.v1" as const,
        idempotencyKeyDigest: `sha256:${"6e".repeat(32)}`,
        idempotencyKeyVersion: "a".repeat(100),
        provenance: generationClaimProvenance(threeCardReading),
        readingId: threeCardReading.id,
        requestId: randomUUID(),
        token: otherOwner.token,
      });
      const unknownFailureCompletion = Object.freeze({
        operational: Object.freeze({
          ...failedCompletion.operational,
          failureCode: "unknown" as const,
        }),
        status: "failed" as const,
      });
      const unknownFailureClaim = await shortLeaseInterpretation.claim(unknownFailureClaimInput);
      assert.equal(unknownFailureClaim.kind, "claimed");
      if (unknownFailureClaim.kind !== "claimed") {
        assert.fail("Expected a new normalized-unknown failed claim.");
      }
      await assert.rejects(
        shortLeaseInterpretation.finalize({
          claimToken: unknownFailureClaim.claimToken,
          claimVersion: unknownFailureClaim.claimVersion,
          completion: Object.freeze({
            operational: unknownFailureCompletion.operational,
            output: fallbackOutput,
            status: "fallback",
          }),
          completionDigest: `sha256:${"71".repeat(32)}`,
          interpretationId: unknownFailureClaim.interpretationId,
          token: otherOwner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );
      const unknownFailureFinalized = await shortLeaseInterpretation.finalize({
        claimToken: unknownFailureClaim.claimToken,
        claimVersion: unknownFailureClaim.claimVersion,
        completion: unknownFailureCompletion,
        completionDigest: `sha256:${"6f".repeat(32)}`,
        interpretationId: unknownFailureClaim.interpretationId,
        token: otherOwner.token,
      });
      assert.equal(unknownFailureFinalized.interpretation.status, "failed");
      assert.equal(unknownFailureFinalized.interpretation.operational.failureCode, "unknown");
      assert.equal(Object.hasOwn(unknownFailureFinalized.interpretation, "output"), false);

      const expiredLeases = await adminSql.query<{ expired: boolean; id: string }>(
        `UPDATE interpretation
            SET lease_expires_at = created_at + interval '1 microsecond'
          WHERE id = ANY($1::uuid[])
          RETURNING id::text AS id, lease_expires_at <= clock_timestamp() AS expired`,
        [[initialFenceClaim.interpretationId, failedClaim.interpretationId]],
      );
      assert.equal(expiredLeases.rowCount, 2);
      assert.equal(
        expiredLeases.rows.every(({ expired }) => expired),
        true,
      );
      const expiredFailedReplay = await shortLeaseInterpretation.claim(failedClaimInput);
      assert.equal(expiredFailedReplay.kind, "replayed");
      if (expiredFailedReplay.kind !== "replayed") {
        assert.fail("Expected the expired failed terminal to replay without reclaim.");
      }
      assert.equal(expiredFailedReplay.interpretation.status, "failed");
      const expiredFailedFinalizeReplay = await shortLeaseInterpretation.finalize({
        claimToken: failedClaim.claimToken,
        claimVersion: failedClaim.claimVersion,
        completion: failedCompletion,
        completionDigest: failedCompletionDigest,
        interpretationId: failedClaim.interpretationId,
        token: owner.token,
      });
      assert.equal(expiredFailedFinalizeReplay.kind, "replayed");
      assert.equal(expiredFailedFinalizeReplay.interpretation.status, "failed");
      const reclaimedFenceClaim = await shortLeaseInterpretation.claim(fenceClaimInput);
      assert.equal(reclaimedFenceClaim.kind, "reclaimed");
      if (reclaimedFenceClaim.kind !== "reclaimed") assert.fail("Expected an expired reclaim.");
      assert.equal(reclaimedFenceClaim.providerEligible, false);
      await assert.rejects(
        shortLeaseInterpretation.finalize({
          claimToken: initialFenceClaim.claimToken,
          claimVersion: initialFenceClaim.claimVersion,
          completion: Object.freeze({
            operational: Object.freeze({
              attemptCount: 0,
              costStatus: "unavailable",
              currencyCode: null,
              estimatedCostMicros: null,
              failureCode: "aborted",
              inputTokens: null,
              latencyMs: 0,
              outputTokens: null,
              retryReason: null,
              tokenStatus: "unavailable",
              totalTokens: null,
            }),
            output: fallbackOutput,
            status: "fallback",
          }),
          completionDigest: `sha256:${"67".repeat(32)}`,
          interpretationId: initialFenceClaim.interpretationId,
          token: owner.token,
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_CLAIM_LOST",
      );
      const fallbackFinalized = await shortLeaseInterpretation.finalize({
        claimToken: reclaimedFenceClaim.claimToken,
        claimVersion: reclaimedFenceClaim.claimVersion,
        completion: Object.freeze({
          operational: Object.freeze({
            attemptCount: 0,
            costStatus: "unavailable",
            currencyCode: null,
            estimatedCostMicros: null,
            failureCode: "aborted",
            inputTokens: null,
            latencyMs: 0,
            outputTokens: null,
            retryReason: null,
            tokenStatus: "unavailable",
            totalTokens: null,
          }),
          output: fallbackOutput,
          status: "fallback",
        }),
        completionDigest: `sha256:${"68".repeat(32)}`,
        interpretationId: reclaimedFenceClaim.interpretationId,
        token: owner.token,
      });
      assert.equal(fallbackFinalized.interpretation.status, "fallback");
      assert.deepEqual(
        (
          fallbackFinalized.interpretation as Extract<
            PersistedInterpretationGeneration,
            { status: "fallback" }
          >
        ).output,
        fallbackOutput,
      );

      const tooShortLease = createInterpretationGenerationPersistence(runtime, {
        leaseSeconds: 31,
      });
      await assert.rejects(
        tooShortLease.claim({
          ...fenceClaimInput,
          idempotencyKeyDigest: `sha256:${"69".repeat(32)}`,
          requestId: randomUUID(),
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );
      await assert.rejects(
        shortLeaseInterpretation.claim({
          ...fenceClaimInput,
          idempotencyKeyDigest: `sha256:${"73".repeat(32)}`,
          idempotencyKeyVersion: "a".repeat(101),
          requestId: randomUUID(),
        }),
        (error: unknown) =>
          error instanceof InterpretationGenerationPersistenceError &&
          error.code === "INTERPRETATION_GENERATION_INPUT_INVALID",
      );

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
        "UPDATE interpretation_verification SET status = 'safe_replacement'",
        "DELETE FROM interpretation_verification",
        "TRUNCATE interpretation_verification",
        "TRUNCATE reading_report",
        "TRUNCATE reading",
      ]) {
        await expectPostgresError(() => runtimeSql.query(statement), "42501");
      }

      const expiredOwner = await createdSession(identity);
      const expiredReading = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v2",
          executionCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        request: request("transition"),
        token: expiredOwner.token,
      });
      assert.deepEqual(
        await persistence.get({ readingId: expiredReading.reading.id, token: expiredOwner.token }),
        expiredReading.reading,
      );
      await migrator.query(
        `UPDATE reading
            SET created_at = CURRENT_TIMESTAMP - interval '2 hours',
                completed_at = CURRENT_TIMESTAMP - interval '2 hours',
                expires_at = CURRENT_TIMESTAMP - interval '1 hour'
          WHERE id = $1::uuid`,
        [expiredReading.reading.id],
      );
      assert.deepEqual(await identity.resolveSession(expiredOwner.token), expiredOwner.context);
      assert.equal(
        await persistence.get({ readingId: expiredReading.reading.id, token: expiredOwner.token }),
        null,
      );

      const revokedOwner = await createdSession(identity);
      const revokedReading = await persistence.resolveCreate({
        prepare: prepare({
          activeVersion: "test.idempotency-hmac.v2",
          executionCount: { value: 0 },
          key: idempotencyKey(),
          versions: ["test.idempotency-hmac.v2"],
        }),
        request: request("gratitude"),
        token: revokedOwner.token,
      });
      assert.deepEqual(
        await persistence.get({ readingId: revokedReading.reading.id, token: revokedOwner.token }),
        revokedReading.reading,
      );
      assert.equal(await identity.revokeSession(revokedOwner.token), true);
      assert.equal(
        await persistence.get({ readingId: revokedReading.reading.id, token: revokedOwner.token }),
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
        const restoredInterpretation = createInterpretationGenerationPersistence(restoredRuntime, {
          leaseSeconds: 32,
        });
        const restoredPending = await restoredInterpretation.claim(claimInput);
        assert.equal(restoredPending.kind, "replayed");
        if (restoredPending.kind !== "replayed") {
          assert.fail("Expected the pending interpretation to survive restore.");
        }
        assert.equal(restoredPending.interpretation.status, "pending_verification");
        assert.equal(restoredPending.interpretation.verification?.status, "verified");
        const restoredFallback = await restoredInterpretation.claim(fenceClaimInput);
        assert.equal(restoredFallback.kind, "replayed");
        if (restoredFallback.kind !== "replayed") {
          assert.fail("Expected the fallback interpretation to survive restore.");
        }
        assert.equal(restoredFallback.interpretation.status, "fallback");
        const restoredFailed = await restoredInterpretation.claim(failedClaimInput);
        assert.equal(restoredFailed.kind, "replayed");
        if (restoredFailed.kind !== "replayed") {
          assert.fail("Expected the failed interpretation to survive restore.");
        }
        assert.equal(restoredFailed.interpretation.status, "failed");
        assert.equal(restoredFailed.interpretation.operational.failureCode, "configuration");
        const restoredUnknownFailure = await restoredInterpretation.claim(unknownFailureClaimInput);
        assert.equal(restoredUnknownFailure.kind, "replayed");
        if (restoredUnknownFailure.kind !== "replayed") {
          assert.fail("Expected the normalized-unknown failure to survive restore.");
        }
        assert.equal(restoredUnknownFailure.interpretation.status, "failed");
        assert.equal(restoredUnknownFailure.interpretation.operational.failureCode, "unknown");
        const restoredInterpretations = await restoredRuntime.$queryRaw<
          Array<{ count: number; raw: string }>
        >`
          SELECT count(*)::int AS count, string_agg(row_to_json(interpretation)::text, '') AS raw
            FROM interpretation
        `;
        assert.equal(restoredInterpretations[0]?.count, 4);
        assert.equal(restoredInterpretations[0]?.raw.includes(owner.token), false);
        assert.equal(restoredInterpretations[0]?.raw.includes("promptMessages"), false);
        assert.equal(restoredInterpretations[0]?.raw.includes("providerOutput"), false);
        const restoredVerifications = await restoredRuntime.$queryRaw<
          Array<{ count: number; raw: string }>
        >`
          SELECT count(*)::int AS count,
                 string_agg(row_to_json(verification)::text, '') AS raw
            FROM interpretation_verification AS verification
        `;
        assert.equal(restoredVerifications[0]?.count, 1);
        assert.equal(restoredVerifications[0]?.raw.includes("riskCategories"), false);
        assert.equal(restoredVerifications[0]?.raw.includes("providerOutput"), false);
        await assertTarotReadingRuntimeDatabasePrivileges(restoredRuntime);
        await assertInterpretationGenerationRuntimeDatabasePrivileges(restoredRuntime);
      } finally {
        await restoredRuntime.$disconnect();
      }
      await adminSql.query(
        "DELETE FROM interpretation_verification WHERE interpretation_id = $1::uuid",
        [winningClaim.interpretationId],
      );
      await adminSql.query(
        "UPDATE interpretation SET verification_timeout_ms = 0 WHERE id = $1::uuid",
        [winningClaim.interpretationId],
      );
      const historicalZeroTimeoutReplay = await interpretation.claim(claimInput);
      assert.equal(historicalZeroTimeoutReplay.kind, "replayed");
      if (historicalZeroTimeoutReplay.kind !== "replayed") {
        assert.fail("Expected the pre-verification terminal row to replay without display output.");
      }
      assert.equal(historicalZeroTimeoutReplay.interpretation.status, "pending_verification");
      if (historicalZeroTimeoutReplay.interpretation.status !== "pending_verification") {
        assert.fail("Expected a pending-verification replay.");
      }
      assert.equal(historicalZeroTimeoutReplay.interpretation.provenance.verificationTimeoutMs, 0);
      assert.equal(historicalZeroTimeoutReplay.interpretation.verification, null);
      assert.equal(Object.hasOwn(historicalZeroTimeoutReplay.interpretation, "output"), false);
    } finally {
      await Promise.all([
        runtime.$disconnect(),
        controlRuntime.$disconnect(),
        migratorRuntime.$disconnect(),
        adminSql.end(),
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
  "Verified owner-scoped tarot persistence and reporting plus interpretation claim/replay/fencing/fallback, position validation, keyed races, quota independence, least privilege, and non-empty logical restore.\n",
);
