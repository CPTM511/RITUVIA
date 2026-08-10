import { describe, expect, it, vi } from "vitest";

import type { StructuredGenerationProviderV1 } from "@rituvia/ai";
import {
  RecoveryItem11AiCreditPersistenceError,
  type RecoveryItem11AiCreditPersistence,
} from "@rituvia/db";
import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import type { CatalogVersionV1 } from "@rituvia/payments";

import {
  createRecoveryItem11AiApplicationService,
  RecoveryItem11AiError,
} from "./recovery-item-11-ai";

const userId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const now = "2026-08-08T12:00:00.000Z";

const validOutput = JSON.stringify({
  boundaryNote: "This is a symbolic possibility, not a prediction or professional instruction.",
  perspectives: ["A narrow focus may make one observable detail easier to notice."],
  reflectionQuestions: ["What is observable now?"],
  safety: {
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  },
  schemaVersion: "1",
  smallAction: {
    label: "Write down one observation.",
    rationale: "An observation can support a reversible next step.",
    timeHorizon: "today",
  },
  sourceRefs: ["content:recovery-item11:lantern:1"],
  summary: "The Lantern offers one bounded lens on attention.",
  symbols: [
    {
      factRef: "tarot.position.perspective",
      meaning: "The Lantern may represent focused attention.",
      possibility: "One visible detail could support a useful next step.",
    },
  ],
  title: "A bounded lens on attention",
});

const catalog = Object.freeze({
  ...rituviaCatalog20260723LocalData,
  environment: "staging" as const,
  products: Object.freeze(
    rituviaCatalog20260723LocalData.products.filter(({ code }) => code === "deep_one"),
  ),
  version: "recovery.item11.2026-08-08.v1",
}) as CatalogVersionV1;

const harness = (options?: {
  consumedToday?: number;
  outputJson?: string;
  providerFailure?: boolean;
  reservationKind?: "created" | "replayed";
  reservationStatus?: "active" | "consumed" | "released";
}) => {
  const countConsumedToday = vi.fn(async () => options?.consumedToday ?? 0);
  const reserve = vi.fn(async () => ({
    amount: 1 as const,
    kind: options?.reservationKind ?? ("created" as const),
    reservationId,
    status: options?.reservationStatus ?? ("active" as const),
  }));
  const consume = vi.fn(async () => "consumed" as const);
  const release = vi.fn(async () => "released" as const);
  const credits = {
    consume,
    countConsumedToday,
    release,
    reserve,
  } satisfies RecoveryItem11AiCreditPersistence;
  const generateStructured = vi.fn(async () =>
    options?.providerFailure
      ? ({ code: "timeout", retryable: true, status: "failed" } as const)
      : ({
          finishReason: "stop" as const,
          outputJson: options?.outputJson ?? validOutput,
          status: "succeeded" as const,
          usage: Object.freeze({
            estimatedCost: Object.freeze({ amountMicros: 90, currencyCode: "USD" }),
            inputTokens: 100,
            outputTokens: 56,
            totalTokens: 156,
          }),
        } as const),
  );
  const provider = {
    descriptor: Object.freeze({
      capabilities: Object.freeze(["structured_generation", "usage_reporting"] as const),
      provider: Object.freeze({ id: "test.provider", version: "1.0.0" }),
      schemaVersion: "structured-generation-provider.v1" as const,
    }),
    generateStructured,
  } satisfies StructuredGenerationProviderV1;
  const getVerifiedOidcToken = vi.fn(async () => "verified-oidc-token");
  const randomUuid = vi.fn().mockReturnValueOnce(requestId).mockReturnValueOnce(attemptId);
  const service = createRecoveryItem11AiApplicationService({
    accounts: {
      getProfile: async () => ({
        ageAttested: true,
        emailVerified: true,
        id: userId,
        status: "active",
      }),
      resolveSession: async () => ({ userId }),
    },
    catalog: { readActive: async () => catalog },
    clock: () => now,
    createProvider: () => provider,
    credits,
    dailyUserLimit: 3,
    getVerifiedOidcToken,
    maxCostMicros: 25_000,
    maxOutputTokens: 384,
    model: "openai/gpt-5.4-nano",
    randomUuid,
    recoveryScope: "D-098:OWNER:item-11:protected-staging",
    timeoutMs: 8_000,
  });
  return {
    consume,
    countConsumedToday,
    generateStructured,
    getVerifiedOidcToken,
    release,
    reserve,
    service,
  };
};

const request = Object.freeze({
  idempotencyKey: "abcdefghijklmnopqrstuv",
  request: Object.freeze({}),
  sessionToken: "session-token",
});

describe("Recovery Item 11 synthetic provider AI service", () => {
  it("reserves one Credit, validates structured output, then consumes exactly once", async () => {
    const test = harness();
    await expect(test.service.generate(request)).resolves.toMatchObject({
      creditConsumed: true,
      kind: "generated",
      reason: null,
      usage: { estimatedCostMicros: 90, inputTokens: 100, outputTokens: 56 },
    });
    expect(test.reserve).toHaveBeenCalledOnce();
    expect(test.getVerifiedOidcToken).toHaveBeenCalledOnce();
    expect(test.generateStructured).toHaveBeenCalledOnce();
    expect(test.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        outputSchema: expect.objectContaining({ version: "1.0.1" }),
      }),
      expect.anything(),
    );
    expect(test.consume).toHaveBeenCalledWith({
      asOf: now,
      generationId: requestId,
      recoveryScope: "D-098:OWNER:item-11:protected-staging",
      reservationId,
      userId,
    });
    expect(test.release).not.toHaveBeenCalled();
  });

  it("returns a deterministic safe fallback and releases value on provider timeout", async () => {
    const test = harness({ providerFailure: true });
    await expect(test.service.generate(request)).resolves.toMatchObject({
      creditConsumed: false,
      kind: "fallback",
      reason: "provider_failure",
      usage: null,
    });
    expect(test.release).toHaveBeenCalledOnce();
    expect(test.consume).not.toHaveBeenCalled();
  });

  it("blocks malformed or unsafe output and releases the reservation", async () => {
    const malformed = harness({ outputJson: "{}" });
    await expect(malformed.service.generate(request)).resolves.toMatchObject({
      creditConsumed: false,
      kind: "fallback",
      reason: "safety_block",
    });
    expect(malformed.release).toHaveBeenCalledOnce();

    const unsafe = harness({
      outputJson: validOutput.replace(
        "The Lantern may represent focused attention.",
        "The Lantern will definitely reveal a hidden truth.",
      ),
    });
    await expect(unsafe.service.generate(request)).resolves.toMatchObject({
      creditConsumed: false,
      kind: "fallback",
      reason: "safety_block",
    });
    expect(unsafe.release).toHaveBeenCalledOnce();
  });

  it("enforces the exact three-per-day limit before reserving or calling a provider", async () => {
    const test = harness({ consumedToday: 3 });
    await expect(test.service.generate(request)).rejects.toMatchObject({ code: "daily_limit" });
    expect(test.reserve).not.toHaveBeenCalled();
    expect(test.getVerifiedOidcToken).not.toHaveBeenCalled();
    expect(test.generateStructured).not.toHaveBeenCalled();
  });

  it("rejects reservation replay without a second provider charge", async () => {
    const test = harness({ reservationKind: "replayed" });
    await expect(test.service.generate(request)).rejects.toMatchObject({ code: "conflict" });
    expect(test.getVerifiedOidcToken).not.toHaveBeenCalled();
    expect(test.generateStructured).not.toHaveBeenCalled();
    expect(test.consume).not.toHaveBeenCalled();
  });

  it("maps insufficient Credits without calling OIDC or the provider", async () => {
    const test = harness();
    test.reserve.mockRejectedValueOnce(
      new RecoveryItem11AiCreditPersistenceError("insufficient_credits"),
    );
    await expect(test.service.generate(request)).rejects.toMatchObject({
      code: "insufficient_credits",
    });
    expect(test.getVerifiedOidcToken).not.toHaveBeenCalled();
    expect(test.generateStructured).not.toHaveBeenCalled();
  });

  it("fails closed when fixed staging controls are changed", () => {
    const test = harness();
    expect(() =>
      createRecoveryItem11AiApplicationService({
        accounts: {} as never,
        catalog: {} as never,
        clock: () => now,
        createProvider: () => ({}) as never,
        credits: {} as never,
        dailyUserLimit: 3,
        getVerifiedOidcToken: async () => "token",
        maxCostMicros: 25_000,
        maxOutputTokens: 384,
        model: "openai/gpt-5.4-nano",
        randomUuid: () => requestId,
        recoveryScope: "D-098:OWNER:item-11:protected-staging",
        timeoutMs: 7_999 as 8_000,
      }),
    ).toThrow(RecoveryItem11AiError);
    expect(test.generateStructured).not.toHaveBeenCalled();
  });
});
