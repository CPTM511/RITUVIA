import type {
  PreparedTarotInterpretationGenerationV1,
  TarotGenerationOperationalMetadataV1,
  TarotInterpretationOutputV1,
} from "@rituvia/ai";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aiHarness = vi.hoisted(() => ({
  execute: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock("@rituvia/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rituvia/ai")>()),
  executePreparedTarotInterpretationGenerationV1: aiHarness.execute,
  prepareTarotInterpretationGenerationV1: aiHarness.prepare,
}));

import {
  createInterpretationGenerationApplicationService,
  createWebGenerationDeadlineRunnerV1,
  WebInterpretationGenerationError,
  type InterpretationGenerationApplicationDependenciesV1,
  type WebInterpretationGenerationRequestV1,
} from "../server/interpretation-generation";

type WebPersistence = InterpretationGenerationApplicationDependenciesV1["persistence"];
type ClaimProvenance = Parameters<WebPersistence["claim"]>[0]["provenance"];
type PersistedInterpretation = Extract<
  Awaited<ReturnType<WebPersistence["claim"]>>,
  { kind: "replayed" }
>["interpretation"];

beforeEach(() => {
  aiHarness.execute.mockReset();
  aiHarness.prepare.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const readingId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const interpretationId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const sessionToken = "a".repeat(43);
const checksum = `sha256:${"a".repeat(64)}`;
const outputSchemaChecksum = `sha256:${"b".repeat(64)}`;

const deterministicFacts = Object.freeze({
  algorithmVersion: "test.algorithm.v1",
  catalog: Object.freeze({ id: "test_catalog", version: "1.0.0" }),
  deck: Object.freeze({ id: "test_deck", version: "1.0.0" }),
  engineName: "test_engine",
  engineVersion: "1.0.0",
  method: "tarot" as const,
  orientationPolicy: "upright_only" as const,
  positions: Object.freeze([
    Object.freeze({
      cardId: "test_card",
      order: 1,
      orientation: "upright" as const,
      positionId: "focus",
    }),
  ]),
  replacementPolicy: "without_replacement" as const,
  rulesVersion: "test.rules.v1",
  schemaVersion: "tarot-draw-facts.v1" as const,
  spread: Object.freeze({ id: "one_card", version: "1.0.0" }),
});

const runtime = Object.freeze({
  approvalReference: "test:provider-approved",
  attemptTimeoutMs: 1_000,
  currencyCode: "USD",
  eligibilityAsOf: "2026-07-18",
  fallbackTemplate: Object.freeze({
    approvalReference: "test:fallback-approved",
    checksum,
    id: "test_fallback",
    version: "1.0.0",
  }),
  maximumAttempts: 2 as const,
  maximumEstimatedCostMicros: 100_000,
  maxOutputTokens: 256,
  model: Object.freeze({ id: "test_model", version: "1.0.0" }),
  outputSchema: Object.freeze({
    checksum: outputSchemaChecksum,
    id: "tarot_interpretation",
    version: "1",
  }),
  prompt: Object.freeze({ checksum, id: "test_prompt", version: "1.0.0" }),
  provider: Object.freeze({ id: "test_provider", version: "1.0.0" }),
  retryDelayMs: 25,
  schemaVersion: "tarot-generation-runtime.v1" as const,
  totalTimeoutMs: 3_000,
});

const prepared = Object.freeze({
  provenance: Object.freeze({
    fallbackTemplate: Object.freeze({
      approvalReference: "test:fallback-approved",
      authorId: "author.test",
      checksum,
      checksumScope: "canonical-parsed-tarot-fallback-json.v1" as const,
      effectiveDate: "2026-07-18",
      eligibilityAsOf: "2026-07-18",
      evaluationVersion: "1.0.0",
      id: "test_fallback",
      requiredApprovalRole: "cultural_reviewer",
      reviewDueDate: "2027-07-18",
      reviewedDate: "2026-07-18",
      reviewerId: "reviewer.test",
      reviewerRole: "cultural_reviewer",
      schemaVersion: "tarot-fallback-template.v1" as const,
      version: "1.0.0",
    }),
    prompt: Object.freeze({
      assemblyPolicyVersion: "tarot-prompt-assembly-policy.v1" as const,
      content: Object.freeze({
        catalog: Object.freeze({
          approvalReference: "test:catalog-approved",
          checksum,
          id: "test_catalog",
          version: "1.0.0",
        }),
        catalogChecksumScope: "canonical-parsed-tarot-catalog-json.v1" as const,
        content: Object.freeze([
          Object.freeze({
            approvalReference: "test:content-approved",
            cardId: "test_card",
            checksum,
            contentId: "test_content",
            integrityScope: "catalog_snapshot" as const,
            locale: "en",
            order: 1,
            orientation: "upright" as const,
            positionId: "focus",
            sourceRef: "source:test",
            sourceRefs: Object.freeze(["source:test"]),
            tradition: "tarot",
            version: "1.0.0",
          }),
        ]),
        deck: Object.freeze({
          approvalReference: "test:deck-approved",
          id: "test_deck",
          version: "1.0.0",
        }),
        eligibilityAsOf: "2026-07-18",
        retrievalPolicyVersion: "tarot-content-retrieval-policy.v1" as const,
        sources: Object.freeze([]),
        spread: Object.freeze({
          approvalReference: "test:spread-approved",
          id: "one_card",
          version: "1.0.0",
        }),
      }),
      deterministicFacts,
      deterministicEngine: Object.freeze({
        algorithmVersion: "test.algorithm.v1",
        engineName: "test_engine",
        engineVersion: "1.0.0",
        rulesVersion: "test.rules.v1",
      }),
      inputSchemaVersion: "tarot-interpretation-input.v1" as const,
      locale: "en",
      modality: "tarot" as const,
      outputSchema: Object.freeze({
        checksum: outputSchemaChecksum,
        id: "tarot_interpretation",
        version: "1",
      }),
      prompt: Object.freeze({
        approvalReference: "test:prompt-approved",
        authorId: "author.test",
        checksum,
        checksumScope: "canonical-parsed-tarot-prompt-json.v1" as const,
        effectiveDate: "2026-07-18",
        eligibilityAsOf: "2026-07-18",
        evaluationVersion: "1.0.0",
        id: "test_prompt",
        requiredApprovalRole: "cultural_reviewer",
        reviewDueDate: "2027-07-18",
        reviewedDate: "2026-07-18",
        reviewerId: "reviewer.test",
        reviewerRole: "cultural_reviewer",
        version: "1.0.0",
      }),
      retrievalPolicyVersion: "tarot-content-retrieval-policy.v1" as const,
      safetyPolicyVersion: "pre-generation-safety.en.v1",
      schemaVersion: "tarot-prompt-provenance.v1" as const,
      themeCode: "open_reflection",
      tone: "grounded" as const,
      tradition: "tarot",
    }),
    request: Object.freeze({
      locale: "en",
      modality: "tarot" as const,
      readingType: "one_card" as const,
      requestId,
      safetyPolicyVersion: "pre-generation-safety.en.v1",
      themeCode: "open_reflection",
    }),
    runtime,
    schemaVersion: "prepared-tarot-interpretation-generation-provenance.v1" as const,
  }),
  schemaVersion: "prepared-tarot-interpretation-generation.v1" as const,
}) as unknown as PreparedTarotInterpretationGenerationV1;

const output = Object.freeze({
  boundaryNote: "This is a reflective possibility, not a prediction.",
  perspectives: Object.freeze(["Notice what feels useful right now."]),
  reflectionQuestions: Object.freeze(["What small choice remains yours?"]),
  safety: Object.freeze({
    certaintyLevel: "reflective" as const,
    containsGuaranteedOutcome: false as const,
    containsProfessionalAdvice: false as const,
  }),
  schemaVersion: "1" as const,
  smallAction: Object.freeze({
    label: "Write one sentence.",
    rationale: "A small note keeps the reflection grounded.",
    timeHorizon: "today" as const,
  }),
  sourceRefs: Object.freeze(["source:test"]),
  summary: "A bounded synthetic interpretation.",
  symbols: Object.freeze([
    Object.freeze({
      factRef: "position:focus:card:test_card:upright",
      meaning: "A synthetic grounded meaning.",
      possibility: "You might pause before choosing.",
    }),
  ]),
  title: "Synthetic reflection",
}) satisfies TarotInterpretationOutputV1;

const metadata = (
  status: "failed" | "fallback" | "pending_verification",
  attemptCount = status === "fallback" ? 0 : 1,
  failureCode: TarotGenerationOperationalMetadataV1["failureCode"] = status === "fallback"
    ? "aborted"
    : status === "failed"
      ? "configuration"
      : null,
): TarotGenerationOperationalMetadataV1 =>
  Object.freeze({
    attemptCount,
    contentVersions: Object.freeze(["1.0.0"]),
    costStatus: "unavailable",
    currencyCode: null,
    estimatedCostMicros: null,
    failureCode,
    fallbackTemplateVersion: "1.0.0",
    inputTokens: null,
    latencyMs: 0,
    locale: "en",
    modality: "tarot",
    modelId: "test_model",
    modelVersion: "1.0.0",
    outputSchemaVersion: "1",
    outputTokens: null,
    promptId: "test_prompt",
    promptVersion: "1.0.0",
    providerId: "test_provider",
    providerVersion: "1.0.0",
    readingType: "one_card",
    result: status,
    retryReason: null,
    safetyPolicyVersion: "pre-generation-safety.en.v1",
    schemaVersion: "tarot-generation-operational-metadata.v1",
    themeCode: "open_reflection",
    tokenStatus: "unavailable",
    totalTokens: null,
  });

const request = Object.freeze({
  continuation: Object.freeze({ policyApprovalReference: "test:safety-approved" }),
  idempotencyKey: "abcdefghijklmnopqrstuv",
  input: Object.freeze({
    approvedContent: Object.freeze([
      Object.freeze({
        checksum,
        contentId: "test_content",
        locale: "en",
        sourceRef: "source:test",
        tradition: "tarot",
        version: "1.0.0",
      }),
    ]),
    approvedRitualTemplateCodes: Object.freeze(["free_candle"]),
    deterministicFacts,
    locale: "en",
    modality: "tarot",
    prompt: runtime.prompt,
    readingType: "one_card",
    requestId,
    safetyDecision: Object.freeze({
      policyVersion: "pre-generation-safety.en.v1",
      route: "allowed",
      schemaVersion: "interpretation-safety-decision.v1",
    }),
    schemaVersion: "tarot-interpretation-input.v1",
    themeCode: "open_reflection",
    tone: "grounded",
  }),
  prompt: Object.freeze({}),
  readingId,
  retrievedContent: Object.freeze({}),
  sessionToken,
}) as unknown as WebInterpretationGenerationRequestV1;

const useFakeMonotonicClock = (): ((milliseconds: number) => Promise<void>) => {
  let monotonicMilliseconds = 0;
  vi.spyOn(performance, "now").mockImplementation(() => monotonicMilliseconds);
  return async (milliseconds: number) => {
    monotonicMilliseconds += milliseconds;
    await vi.advanceTimersByTimeAsync(milliseconds);
  };
};

const persisted = (
  provenance: ClaimProvenance,
  status: "failed" | "fallback" | "pending_verification",
  failureCode: TarotGenerationOperationalMetadataV1["failureCode"] = status === "fallback"
    ? "aborted"
    : status === "failed"
      ? "configuration"
      : null,
): PersistedInterpretation =>
  ({
    completedAt: "2026-07-18T00:00:01.000Z",
    createdAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-19T00:00:00.000Z",
    generationNumber: 1,
    generationSchemaVersion: "interpretation-generation.v1",
    id: interpretationId,
    operational: {
      attemptCount: status === "fallback" ? 0 : 1,
      costStatus: "unavailable",
      currencyCode: null,
      estimatedCostMicros: null,
      failureCode,
      inputTokens: null,
      latencyMs: 0,
      outputTokens: null,
      retryReason: null,
      tokenStatus: "unavailable",
      totalTokens: null,
    },
    ...(status === "fallback" ? { output } : {}),
    provenance,
    readingId,
    requestId,
    status,
    subjectId,
  }) as PersistedInterpretation;

const createHarness = (
  claim: WebPersistence["claim"],
  finalize: WebPersistence["finalize"],
  digestKeyVersion = "test.key.v1",
) => {
  const persistence = Object.freeze({
    claim: vi.fn(claim),
    finalize: vi.fn(finalize),
  });
  const providerCall = vi.fn();
  const service = createInterpretationGenerationApplicationService({
    authorizeRuntime: vi.fn(() => true),
    digestKey: Object.freeze({
      encodedKey: Buffer.alloc(32, 7).toString("base64url"),
      version: digestKeyVersion,
    }),
    fallbackTemplate: Object.freeze({}) as never,
    persistence,
    provider: Object.freeze({
      descriptor: Object.freeze({
        capabilities: Object.freeze(["structured_generation", "usage_reporting"] as const),
        provider: runtime.provider,
        schemaVersion: "structured-generation-provider.v1",
      }),
      generateStructured: providerCall,
    }),
    runtime,
  });
  return { persistence, providerCall, service };
};

describe("web interpretation generation composition", () => {
  it("rejects a digest key version wider than its persistence column", () => {
    expect(() =>
      createHarness(
        async () => {
          throw new Error("claim must not run");
        },
        async () => {
          throw new Error("finalize must not run");
        },
        "a".repeat(101),
      ),
    ).toThrow(TypeError);
    expect(aiHarness.prepare).not.toHaveBeenCalled();
  });

  it("creates no claim when trusted preparation or provider validation fails", async () => {
    aiHarness.prepare.mockRejectedValue(new Error("synthetic private preflight failure"));
    const harness = createHarness(
      async () => {
        throw new Error("claim must not run");
      },
      async () => {
        throw new Error("finalize must not run");
      },
    );

    await expect(harness.service.generate(request)).rejects.toMatchObject({
      code: "unavailable",
    } satisfies Partial<WebInterpretationGenerationError>);
    expect(harness.persistence.claim).not.toHaveBeenCalled();
    expect(aiHarness.execute).not.toHaveBeenCalled();
    expect(harness.providerCall).not.toHaveBeenCalled();
  });

  it("preflights before claiming, then finalizes only redacted pending metadata", async () => {
    const order: string[] = [];
    let claimProvenance: ClaimProvenance | undefined;
    aiHarness.prepare.mockImplementation(async (input) => {
      order.push("prepare");
      expect(input.provider.descriptor.provider).toEqual(runtime.provider);
      return prepared;
    });
    aiHarness.execute.mockImplementation(async () => {
      order.push("execute");
      return {
        displayable: false,
        metadata: metadata("pending_verification"),
        output,
        status: "pending_verification",
      };
    });
    const harness = createHarness(
      async (input) => {
        order.push("claim");
        claimProvenance = input.provenance;
        expect(input.canonicalRequestDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
        expect(input.idempotencyKeyDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
        const serialized = JSON.stringify(input);
        expect(serialized).not.toContain('"messages"');
        expect(serialized).not.toContain('"question"');
        expect(serialized).not.toContain('"authorization"');
        return {
          claimToken: "b".repeat(43),
          claimVersion: 1,
          interpretationId,
          kind: "claimed",
          leaseExpiresAt: "2026-07-18T00:01:00.000Z",
          providerEligible: true,
        };
      },
      async (input) => {
        order.push("finalize");
        expect(input.completion).not.toHaveProperty("output");
        expect(JSON.stringify(input.completion)).not.toContain(output.title);
        if (claimProvenance === undefined) throw new Error("missing claim provenance");
        return {
          interpretation: persisted(claimProvenance, "pending_verification"),
          kind: "finalized",
        };
      },
    );

    const result = await harness.service.generate(request);

    expect(order).toEqual(["prepare", "claim", "execute", "finalize"]);
    expect(result).toMatchObject({
      displayable: false,
      interpretationId,
      kind: "finalized",
      status: "pending_verification",
    });
    expect(claimProvenance).toMatchObject({
      currencyCode: "USD",
      eligibilityAsOf: "2026-07-18",
      maximumEstimatedCostMicros: 100_000,
      retryDelayMs: 25,
    });
  });

  it("durably finalizes provider configuration failure and replays it without fallback", async () => {
    aiHarness.prepare.mockResolvedValue(prepared);
    aiHarness.execute.mockResolvedValue({
      displayable: false,
      metadata: metadata("failed"),
      status: "failed",
    });
    let claimProvenance: ClaimProvenance | undefined;
    const first = createHarness(
      async (input) => {
        claimProvenance = input.provenance;
        return {
          claimToken: "b".repeat(43),
          claimVersion: 1,
          interpretationId,
          kind: "claimed",
          leaseExpiresAt: "2026-07-18T00:01:00.000Z",
          providerEligible: true,
        };
      },
      async (input) => {
        expect(input.completion).toEqual({
          operational: expect.objectContaining({
            attemptCount: 1,
            failureCode: "configuration",
            retryReason: null,
          }),
          status: "failed",
        });
        expect(input.completion).not.toHaveProperty("output");
        if (claimProvenance === undefined) throw new Error("missing claim provenance");
        return {
          interpretation: persisted(claimProvenance, "failed"),
          kind: "finalized",
        };
      },
    );

    await expect(first.service.generate(request)).resolves.toMatchObject({
      displayable: false,
      interpretationId,
      kind: "finalized",
      status: "failed",
    });

    aiHarness.execute.mockReset();
    const replay = createHarness(
      async (input) => ({
        interpretation: persisted(input.provenance, "failed"),
        kind: "replayed",
      }),
      async () => {
        throw new Error("failed terminal must not finalize twice");
      },
    );
    await expect(replay.service.generate(request)).resolves.toMatchObject({
      displayable: false,
      interpretationId,
      kind: "replayed",
      status: "failed",
    });
    expect(aiHarness.execute).not.toHaveBeenCalled();
    expect(replay.persistence.finalize).not.toHaveBeenCalled();
    expect(replay.providerCall).not.toHaveBeenCalled();
  });

  it.each(["provider promise rejection", "normalized provider unknown"])(
    "durably finalizes %s as unknown and replays it without provider or fallback work",
    async () => {
      aiHarness.prepare.mockResolvedValue(prepared);
      aiHarness.execute.mockResolvedValue({
        displayable: false,
        metadata: metadata("failed", 1, "unknown"),
        status: "failed",
      });
      let claimProvenance: ClaimProvenance | undefined;
      const first = createHarness(
        async (input) => {
          claimProvenance = input.provenance;
          return {
            claimToken: "b".repeat(43),
            claimVersion: 1,
            interpretationId,
            kind: "claimed",
            leaseExpiresAt: "2026-07-18T00:01:00.000Z",
            providerEligible: true,
          };
        },
        async (input) => {
          expect(input.completion).toEqual({
            operational: expect.objectContaining({
              attemptCount: 1,
              failureCode: "unknown",
              retryReason: null,
            }),
            status: "failed",
          });
          expect(input.completion).not.toHaveProperty("output");
          if (claimProvenance === undefined) throw new Error("missing claim provenance");
          return {
            interpretation: persisted(claimProvenance, "failed", "unknown"),
            kind: "finalized",
          };
        },
      );

      await expect(first.service.generate(request)).resolves.toMatchObject({
        displayable: false,
        interpretationId,
        kind: "finalized",
        status: "failed",
      });
      expect(first.providerCall).not.toHaveBeenCalled();

      aiHarness.execute.mockReset();
      const replay = createHarness(
        async (input) => ({
          interpretation: persisted(input.provenance, "failed", "unknown"),
          kind: "replayed",
        }),
        async () => {
          throw new Error("failed terminal must not finalize twice");
        },
      );
      await expect(replay.service.generate(request)).resolves.toMatchObject({
        displayable: false,
        interpretationId,
        kind: "replayed",
        status: "failed",
      });
      expect(aiHarness.execute).not.toHaveBeenCalled();
      expect(replay.persistence.finalize).not.toHaveBeenCalled();
      expect(replay.providerCall).not.toHaveBeenCalled();
    },
  );

  it("returns in-progress and exact terminal replay without executing provider work", async () => {
    aiHarness.prepare.mockResolvedValue(prepared);
    const inProgress = createHarness(
      async () => ({
        interpretationId,
        kind: "in_progress",
        leaseExpiresAt: "2026-07-18T00:01:00.000Z",
      }),
      async () => {
        throw new Error("finalize must not run");
      },
    );
    await expect(inProgress.service.generate(request)).resolves.toMatchObject({
      kind: "in_progress",
      status: "in_progress",
    });
    expect(aiHarness.execute).not.toHaveBeenCalled();
    expect(inProgress.persistence.finalize).not.toHaveBeenCalled();

    const replay = createHarness(
      async (input) => ({
        interpretation: persisted(input.provenance, "pending_verification"),
        kind: "replayed",
      }),
      async () => {
        throw new Error("finalize must not run");
      },
    );
    await expect(replay.service.generate(request)).resolves.toMatchObject({
      displayable: false,
      kind: "replayed",
      status: "pending_verification",
    });
    expect(aiHarness.execute).not.toHaveBeenCalled();
    expect(replay.persistence.finalize).not.toHaveBeenCalled();
  });

  it("forces a reclaimed lease through fallback-only execution", async () => {
    aiHarness.prepare.mockResolvedValue(prepared);
    aiHarness.execute.mockResolvedValue({
      displayable: true,
      metadata: metadata("fallback"),
      output,
      status: "fallback",
    });
    let claimProvenance: ClaimProvenance | undefined;
    const harness = createHarness(
      async (input) => {
        claimProvenance = input.provenance;
        return {
          claimToken: "b".repeat(43),
          claimVersion: 2,
          interpretationId,
          kind: "reclaimed",
          leaseExpiresAt: "2026-07-18T00:01:00.000Z",
          providerEligible: false,
        };
      },
      async () => {
        if (claimProvenance === undefined) throw new Error("missing claim provenance");
        return {
          interpretation: persisted(claimProvenance, "fallback"),
          kind: "finalized",
        };
      },
    );

    await expect(harness.service.generate(request)).resolves.toMatchObject({
      displayable: true,
      kind: "finalized",
      status: "fallback",
    });
    expect(aiHarness.execute).toHaveBeenCalledWith({ mode: "fallback_only", prepared });
    expect(harness.providerCall).not.toHaveBeenCalled();
  });

  it("persists an authorized fallback only for a normalized unavailable provider result", async () => {
    aiHarness.prepare.mockResolvedValue(prepared);
    aiHarness.execute.mockResolvedValue({
      displayable: true,
      metadata: metadata("fallback", 1, "unavailable"),
      output,
      status: "fallback",
    });
    let claimProvenance: ClaimProvenance | undefined;
    const harness = createHarness(
      async (input) => {
        claimProvenance = input.provenance;
        return {
          claimToken: "b".repeat(43),
          claimVersion: 1,
          interpretationId,
          kind: "claimed",
          leaseExpiresAt: "2026-07-18T00:01:00.000Z",
          providerEligible: true,
        };
      },
      async (input) => {
        expect(input.completion).toEqual({
          operational: expect.objectContaining({
            attemptCount: 1,
            failureCode: "unavailable",
          }),
          output,
          status: "fallback",
        });
        if (claimProvenance === undefined) throw new Error("missing claim provenance");
        return {
          interpretation: persisted(claimProvenance, "fallback", "unavailable"),
          kind: "finalized",
        };
      },
    );

    await expect(harness.service.generate(request)).resolves.toMatchObject({
      displayable: true,
      kind: "finalized",
      status: "fallback",
    });
    expect(aiHarness.execute).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "provider_with_fallback", prepared }),
    );
  });

  it.each(["configuration", "invalid_request", "unknown"] as const)(
    "rejects a forged displayable fallback carrying the durable failed code %s",
    async (failureCode) => {
      aiHarness.prepare.mockResolvedValue(prepared);
      aiHarness.execute.mockResolvedValue({
        displayable: true,
        metadata: metadata("fallback", 1, failureCode),
        output,
        status: "fallback",
      });
      const harness = createHarness(
        async () => ({
          claimToken: "b".repeat(43),
          claimVersion: 1,
          interpretationId,
          kind: "claimed",
          leaseExpiresAt: "2026-07-18T00:01:00.000Z",
          providerEligible: true,
        }),
        async () => {
          throw new Error("forged fallback must not become durable or displayable");
        },
      );

      await expect(harness.service.generate(request)).rejects.toMatchObject({
        code: "unavailable",
      } satisfies Partial<WebInterpretationGenerationError>);
      expect(harness.persistence.finalize).not.toHaveBeenCalled();
    },
  );

  it("maps persistence and finalization failures without reporting success", async () => {
    aiHarness.prepare.mockResolvedValue(prepared);
    const failedClaim = createHarness(
      async () => {
        throw new Error("synthetic private persistence failure");
      },
      async () => {
        throw new Error("finalize must not run");
      },
    );
    await expect(failedClaim.service.generate(request)).rejects.toMatchObject({
      code: "unavailable",
    } satisfies Partial<WebInterpretationGenerationError>);
    expect(aiHarness.execute).not.toHaveBeenCalled();

    aiHarness.execute.mockResolvedValue({
      displayable: false,
      metadata: Object.freeze({ ...metadata("failed"), failureCode: "quota_exceeded" }),
      status: "failed",
    });
    const invalidFailedResult = createHarness(
      async () => ({
        claimToken: "b".repeat(43),
        claimVersion: 1,
        interpretationId,
        kind: "claimed",
        leaseExpiresAt: "2026-07-18T00:01:00.000Z",
        providerEligible: true,
      }),
      async () => {
        throw new Error("invalid AI failure must not become durable failed");
      },
    );
    await expect(invalidFailedResult.service.generate(request)).rejects.toMatchObject({
      code: "unavailable",
    } satisfies Partial<WebInterpretationGenerationError>);
    expect(invalidFailedResult.persistence.finalize).not.toHaveBeenCalled();

    aiHarness.execute.mockResolvedValue({
      displayable: false,
      metadata: metadata("pending_verification"),
      output,
      status: "pending_verification",
    });
    const failedFinalize = createHarness(
      async () => ({
        claimToken: "b".repeat(43),
        claimVersion: 1,
        interpretationId,
        kind: "claimed",
        leaseExpiresAt: "2026-07-18T00:01:00.000Z",
        providerEligible: true,
      }),
      async () => {
        throw new Error("synthetic private finalization failure");
      },
    );
    await expect(failedFinalize.service.generate(request)).rejects.toMatchObject({
      code: "unavailable",
    } satisfies Partial<WebInterpretationGenerationError>);
  });
});

describe("web interpretation generation deadline runner", () => {
  it("passes an opaque attempt context and returns a settled result", async () => {
    const runner = createWebGenerationDeadlineRunnerV1();
    const operation = vi.fn(async (context) => {
      expect(context.attempt).toBe(1);
      expect(context.attemptId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      );
      expect(context.cancellation.aborted).toBe(false);
      return Object.freeze({ status: "synthetic" as const });
    });

    await expect(runner.run({ attempt: 1, operation, timeoutMs: 1_000 })).resolves.toMatchObject({
      status: "settled",
      value: { status: "synthetic" },
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("enforces the timer, signals cancellation, and consumes a late rejection", async () => {
    vi.useFakeTimers();
    const advance = useFakeMonotonicClock();
    const runner = createWebGenerationDeadlineRunnerV1();
    let rejectLate: ((error: Error) => void) | undefined;
    const cancel = vi.fn();
    const operation = vi.fn(
      (context) =>
        new Promise<never>((_resolve, reject) => {
          rejectLate = reject;
          context.cancellation.subscribe(cancel);
        }),
    );

    const pending = runner.run({ attempt: 2, operation, timeoutMs: 25 });
    await advance(25);
    await expect(pending).resolves.toEqual({
      cancellationAcknowledged: false,
      elapsedMs: 25,
      status: "timeout",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    rejectLate?.(new Error("synthetic private provider failure"));
    await Promise.resolve();
  });

  it("does not claim cancellation acknowledgement when the provider ignores the signal", async () => {
    vi.useFakeTimers();
    const advance = useFakeMonotonicClock();
    const runner = createWebGenerationDeadlineRunnerV1();
    const pending = runner.run({
      attempt: 1,
      operation: () => new Promise(() => undefined),
      timeoutMs: 10,
    });

    await advance(10);
    await expect(pending).resolves.toEqual({
      cancellationAcknowledged: false,
      elapsedMs: 10,
      status: "timeout",
    });
  });

  it("uses monotonic elapsed time when the wall clock moves backward", async () => {
    vi.useFakeTimers();
    const advance = useFakeMonotonicClock();
    let wallClockMs = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => wallClockMs);
    const runner = createWebGenerationDeadlineRunnerV1();
    const pending = runner.run({
      attempt: 1,
      operation: () => new Promise(() => undefined),
      timeoutMs: 25,
    });
    wallClockMs = 0;

    await advance(25);
    await expect(pending).resolves.toEqual({
      cancellationAcknowledged: false,
      elapsedMs: 25,
      status: "timeout",
    });
  });

  it("charges retry delay to the supplied whole-operation budget", async () => {
    vi.useFakeTimers();
    const advance = useFakeMonotonicClock();
    const runner = createWebGenerationDeadlineRunnerV1();
    const settled = runner.wait({ delayMs: 20, timeoutMs: 50 });
    await advance(20);
    await expect(settled).resolves.toEqual({ elapsedMs: 20, status: "settled" });

    const timedOut = runner.wait({ delayMs: 50, timeoutMs: 30 });
    await advance(30);
    await expect(timedOut).resolves.toEqual({
      cancellationAcknowledged: false,
      elapsedMs: 30,
      status: "timeout",
    });
  });
});
