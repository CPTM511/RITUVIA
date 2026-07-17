import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { parseTarotCatalogV1 } from "@rituvia/divination";
import { questionIntakeThemeCodes } from "@rituvia/domain";
import { describe, expect, it } from "vitest";

import {
  TarotGenerationError,
  assembleTarotPromptV1,
  executePreparedTarotInterpretationGenerationV1,
  generateTarotInterpretationV1,
  loadApprovedTarotFallbackTemplateV1,
  loadApprovedTarotPromptTemplateV1,
  parseTarotInterpretationInputJsonV1,
  prepareTarotInterpretationGenerationV1,
  preGenerationSafetyPolicyVersion,
  retrieveApprovedTarotContentV1,
  runPreGenerationSafetyGateV1,
  structuredGenerationProviderSchemaVersion,
  tarotContentRetrievalPolicyVersion,
  tarotContentRetrievalRequestSchemaVersion,
  tarotFallbackTemplateSchemaVersion,
  tarotGenerationRuntimeSchemaVersion,
  tarotInterpretationInputSchemaVersion,
  tarotInterpretationOutputSchemaVersion,
  tarotPromptAuthoritySchemaVersion,
  tarotPromptMandatoryInstructions,
  tarotPromptTemplateSchemaVersion,
  tarotRetrievalAuthoritySchemaVersion,
  type GenerateTarotInterpretationInputV1,
  type GenerationDeadlineRunnerV1,
  type PrepareTarotInterpretationGenerationInputV1,
  type StructuredGenerationProviderV1,
  type StructuredGenerationResultV1,
  type TarotGenerationRuntimeRegistrationV1,
} from "../src/index.js";

type Editorial = {
  approvalReference: string | null;
  authorId: string;
  effectiveDate: string;
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string | null;
  reviewerId: string | null;
  reviewerRole: string | null;
  status: string;
};

type Catalog = {
  cardContents: Array<{
    cardId: string;
    editorial: Editorial;
    orientation: string;
    themeReadings: Array<{ text: string; themeCode: string }>;
    translationStatus: string;
    version: string;
  }>;
  catalogId: string;
  decks: Array<{
    artworkRightsSource: { id: string; version: string } | null;
    artworkStatus: string;
    cards: Array<{
      artwork: {
        altText: string;
        assetId: string;
        credit: string;
        localizationNotes: string;
        source: { id: string; version: string };
        version: string;
      } | null;
      cardId: string;
      title: string;
    }>;
    deckId: string;
    editorial: Editorial;
    version: string;
  }>;
  editorial: Editorial;
  locale: string;
  sources: Array<{
    editorial: Editorial;
    rights: { allowedUses: string[]; materialTypes: string[]; status: string };
    sourceId: string;
    version: string;
  }>;
  spreads: Array<{ editorial: Editorial }>;
  supportedThemeCodes: string[];
  usePolicy: {
    aiRetrievalAllowed: boolean;
    indexingAllowed: boolean;
    publicationAllowed: boolean;
  };
  version: string;
};

type PromptTemplate = {
  allowedTones: string[];
  approvalReference: string;
  authorId: string;
  effectiveDate: string;
  evaluationVersion: string;
  instructions: string[];
  locale: string;
  modality: string;
  outputSchema: { checksum: string; id: string; version: string };
  promptId: string;
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string;
  reviewerId: string;
  reviewerRole: string;
  schemaVersion: string;
  status: string;
  toneInstructions: Record<string, string>;
  tradition: string;
  version: string;
};

const asOf = "2026-07-18";
const requestId = "33111111-1111-4111-8111-111111111111";
const tradition = "rituvia-original-secular-placeholder";
const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
const verifySha256 = (canonical: string, checksum: string): boolean =>
  sha256(canonical) === checksum;

const first = <Value>(values: readonly Value[]): Value => {
  const value = values.at(0);
  if (value === undefined) throw new Error("Synthetic generation fixture is empty.");
  return value;
};

const publish = (editorial: Editorial, suffix: string): void => {
  editorial.status = "published";
  editorial.reviewerRole = editorial.requiredApprovalRole;
  editorial.reviewerId = "test.content-reviewer";
  editorial.reviewedDate = "2026-07-17";
  editorial.approvalReference = `test:rit-033:${suffix}`;
  editorial.reviewDueDate = "2027-07-18";
};

const publishedCatalog = async (selectedContentVersion?: string): Promise<Catalog> => {
  const text = await readFile(
    new URL("../../../content/traditions/tarot/rituvia-placeholder.v1.json", import.meta.url),
    "utf8",
  );
  const catalog = JSON.parse(text) as Catalog;
  catalog.usePolicy = {
    aiRetrievalAllowed: true,
    indexingAllowed: false,
    publicationAllowed: true,
  };
  catalog.supportedThemeCodes = [...questionIntakeThemeCodes];
  publish(catalog.editorial, "catalog");
  for (const [index, source] of catalog.sources.entries()) {
    publish(source.editorial, `source-${index}`);
    source.rights.status = "owned";
    source.rights.allowedUses = [
      "internal_validation",
      "public_display",
      "commercial_use",
      "derivative_use",
      "translation",
      "ai_retrieval",
    ];
    source.rights.materialTypes = [
      "structural_data",
      "spread_definition",
      "interpretive_text",
      "artwork",
    ];
  }
  const source = first(catalog.sources);
  const artworkSource = { id: source.sourceId, version: source.version };
  for (const [index, deck] of catalog.decks.entries()) {
    publish(deck.editorial, `deck-${index}`);
    deck.artworkStatus = "assigned";
    deck.artworkRightsSource = artworkSource;
    for (const card of deck.cards) {
      card.artwork = {
        altText: `Synthetic test artwork for ${card.title}.`,
        assetId: `test.${card.cardId}.artwork`,
        credit: "Synthetic RIT-033 fixture",
        localizationNotes: "Test only.",
        source: artworkSource,
        version: "1.0.0",
      };
    }
  }
  for (const [index, spread] of catalog.spreads.entries())
    publish(spread.editorial, `spread-${index}`);
  for (const [index, content] of catalog.cardContents.entries()) {
    publish(content.editorial, `content-${index}`);
    content.translationStatus = "source_reviewed";
    content.themeReadings = questionIntakeThemeCodes.map((themeCode) => ({
      text: `A bounded reflective possibility for the ${themeCode.replaceAll("_", " ")} theme.`,
      themeCode,
    }));
  }
  if (selectedContentVersion !== undefined) {
    const selected = catalog.cardContents.find(
      ({ cardId, orientation }) => cardId === "threshold" && orientation === "reversed",
    );
    if (selected === undefined) throw new Error("Synthetic selected content is unavailable.");
    selected.version = selectedContentVersion;
  }
  return catalog;
};

const makePromptTemplate = (): PromptTemplate => ({
  allowedTones: ["concise", "gentle", "grounded", "poetic-light"],
  approvalReference: "test:rit-033:prompt",
  authorId: "test.prompt-author",
  effectiveDate: asOf,
  evaluationVersion: "1.0.0",
  instructions: [...tarotPromptMandatoryInstructions],
  locale: "en",
  modality: "tarot",
  outputSchema: {
    checksum: sha256("tarot-interpretation-output-schema-v1"),
    id: "tarot.interpretation.output",
    version: tarotInterpretationOutputSchemaVersion,
  },
  promptId: "rituvia.tarot.reflective.en",
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewerId: "test.prompt-reviewer",
  reviewerRole: "ai_safety",
  schemaVersion: tarotPromptTemplateSchemaVersion,
  status: "approved",
  toneInstructions: {
    concise: "Be brief while preserving every required boundary.",
    gentle: "Use calm and autonomy-supporting language.",
    grounded: "Prefer concrete observations and practical reflection.",
    "poetic-light": "Use restrained imagery without supernatural authority.",
  },
  tradition,
  version: "1.0.0",
});

const fallbackTemplate = Object.freeze({
  approvalReference: "test:rit-033:fallback",
  authorId: "test.fallback-author",
  copy: Object.freeze({
    boundaryNote: "This is a symbolic possibility, not a prediction.",
    smallActionRationale: "A small reversible action can support reflection.",
    summary: "The selected symbols offer a bounded lens for reflection.",
    timeHorizon: "today" as const,
    title: "A grounded reflective lens",
  }),
  effectiveDate: asOf,
  evaluationVersion: "1.0.0",
  fallbackId: "rituvia.tarot.fallback.en",
  locale: "en",
  modality: "tarot" as const,
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewerId: "test.fallback-reviewer",
  reviewerRole: "ai_safety",
  schemaVersion: tarotFallbackTemplateSchemaVersion,
  status: "approved" as const,
  tradition,
  version: "1.0.0",
});

const defaultRunner = Object.freeze({
  run: async ({ attempt, operation }: Parameters<GenerationDeadlineRunnerV1["run"]>[0]) => {
    const cancellation = Object.freeze({
      aborted: false,
      subscribe: () => () => undefined,
    });
    const value = await operation(
      Object.freeze({ attempt, attemptId: `test-attempt-${attempt}`, cancellation }),
    );
    return Object.freeze({ elapsedMs: 5, status: "settled" as const, value }) as Awaited<
      ReturnType<GenerationDeadlineRunnerV1["run"]>
    >;
  },
  wait: async ({ delayMs }: Parameters<GenerationDeadlineRunnerV1["wait"]>[0]) =>
    Object.freeze({ elapsedMs: delayMs, status: "settled" as const }),
}) satisfies GenerationDeadlineRunnerV1;

const providerFrom = (
  results: readonly (StructuredGenerationResultV1 | Error)[],
  calls: { value: number },
): StructuredGenerationProviderV1 =>
  Object.freeze({
    descriptor: Object.freeze({
      capabilities: Object.freeze(["structured_generation", "usage_reporting"] as const),
      provider: Object.freeze({ id: "test.provider", version: "1.0.0" }),
      schemaVersion: structuredGenerationProviderSchemaVersion,
    }),
    generateStructured: async () => {
      const result = results.at(calls.value);
      calls.value += 1;
      if (result instanceof Error) throw result;
      if (result === undefined) throw new Error("Synthetic provider result exhausted.");
      return result;
    },
  });

const buildCommon = async (
  options: Readonly<{ contentVersion?: string }> = {},
): Promise<{
  common: PrepareTarotInterpretationGenerationInputV1;
  runtime: TarotGenerationRuntimeRegistrationV1;
}> => {
  const catalog = await publishedCatalog(options.contentVersion);
  const catalogReference = {
    approvalReference: catalog.editorial.approvalReference ?? "invalid",
    checksum: sha256(JSON.stringify(parseTarotCatalogV1(catalog))),
    id: catalog.catalogId,
    version: catalog.version,
  };
  const facts = {
    algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
    catalog: { id: catalog.catalogId, version: catalog.version },
    deck: { id: first(catalog.decks).deckId, version: first(catalog.decks).version },
    engineName: "rituvia.tarot-draw",
    engineVersion: "1.0.0",
    method: "tarot",
    orientationPolicy: "upright_and_reversed",
    positions: [
      {
        cardId: "threshold",
        order: 1,
        orientation: "reversed",
        positionId: "perspective",
      },
    ],
    replacementPolicy: "without_replacement",
    rulesVersion: "tarot-draw-rules.v1",
    schemaVersion: "tarot-draw-facts.v1",
    spread: { id: "one-card-perspective", version: "1.0.0" },
  };
  const retrievalRequest = {
    catalog: catalogReference,
    deterministicFacts: facts,
    locale: "en",
    schemaVersion: tarotContentRetrievalRequestSchemaVersion,
    themeCode: "open_reflection",
    tradition,
  };
  const bundle = await retrieveApprovedTarotContentV1({
    asOf,
    authorizeRetrieval: (authority) =>
      authority.schemaVersion === tarotRetrievalAuthoritySchemaVersion &&
      authority.retrievalPolicyVersion === tarotContentRetrievalPolicyVersion,
    catalogJson: JSON.stringify(catalog),
    requestJson: JSON.stringify(retrievalRequest),
    verifyIntegrity: verifySha256,
  });

  const rawPrompt = makePromptTemplate();
  const promptRegistration = {
    approvalReference: rawPrompt.approvalReference,
    checksum: sha256(JSON.stringify(rawPrompt)),
    id: rawPrompt.promptId,
    version: rawPrompt.version,
  };
  const promptTemplate = await loadApprovedTarotPromptTemplateV1({
    asOf,
    authorizePrompt: (authority) =>
      authority.schemaVersion === tarotPromptAuthoritySchemaVersion &&
      authority.prompt.checksum === promptRegistration.checksum,
    registration: promptRegistration,
    templateJson: JSON.stringify(rawPrompt),
    verifyIntegrity: verifySha256,
  });
  const interpretationInput = parseTarotInterpretationInputJsonV1(
    JSON.stringify({
      approvedContent: bundle.approvedContent,
      approvedRitualTemplateCodes: ["free.candle.v1"],
      deterministicFacts: bundle.deterministicFacts,
      locale: "en",
      modality: "tarot",
      prompt: {
        checksum: promptTemplate.checksum,
        id: promptTemplate.promptId,
        version: promptTemplate.version,
      },
      readingType: bundle.readingType,
      requestId,
      safetyDecision: {
        policyVersion: preGenerationSafetyPolicyVersion,
        route: "allowed",
        schemaVersion: "interpretation-safety-decision.v1",
      },
      schemaVersion: tarotInterpretationInputSchemaVersion,
      themeCode: bundle.themeCode,
      tone: "grounded",
    }),
  );
  const prompt = assembleTarotPromptV1(interpretationInput, bundle, promptTemplate);
  const gate = await runPreGenerationSafetyGateV1(
    {
      asOf,
      authorizePolicy: () => true,
      policyApprovalReference: "test:rit-033:safety-policy",
      readingType: "one_card",
      requestId,
      requestJson: JSON.stringify({
        locale: "en",
        schemaVersion: "1",
        themeCode: "open_reflection",
      }),
    },
    (continuation) => continuation,
  );
  if (gate.status !== "continued") throw new Error("Synthetic safety gate stopped.");

  const fallbackRegistration = {
    approvalReference: fallbackTemplate.approvalReference,
    checksum: sha256(JSON.stringify(fallbackTemplate)),
    id: fallbackTemplate.fallbackId,
    version: fallbackTemplate.version,
  };
  const approvedFallback = await loadApprovedTarotFallbackTemplateV1({
    asOf,
    authorizeFallback: () => true,
    outputSchema: prompt.provenance.outputSchema,
    registration: fallbackRegistration,
    templateJson: JSON.stringify(fallbackTemplate),
    verifyIntegrity: verifySha256,
  });
  const runtime = Object.freeze({
    approvalReference: "test:rit-033:generation-runtime",
    attemptTimeoutMs: 1_000,
    currencyCode: "USD",
    eligibilityAsOf: asOf,
    fallbackTemplate: fallbackRegistration,
    maximumAttempts: 2 as const,
    maximumEstimatedCostMicros: 1_000,
    maxOutputTokens: 1_200,
    model: Object.freeze({ id: "test.model", version: "1.0.0" }),
    outputSchema: prompt.provenance.outputSchema,
    prompt: prompt.prompt,
    provider: Object.freeze({ id: "test.provider", version: "1.0.0" }),
    retryDelayMs: 10,
    schemaVersion: tarotGenerationRuntimeSchemaVersion,
    totalTimeoutMs: 3_000,
  }) satisfies TarotGenerationRuntimeRegistrationV1;
  return {
    common: Object.freeze({
      authorizeRuntime: () => true,
      continuation: gate.value,
      fallbackTemplate: approvedFallback,
      input: interpretationInput,
      prompt,
      provider: providerFrom([], { value: 0 }),
      retrievedContent: bundle,
      runtime,
    }),
    runtime,
  };
};

const success = (outputJson: string, costMicros = 100): StructuredGenerationResultV1 =>
  Object.freeze({
    finishReason: "stop" as const,
    outputJson,
    status: "succeeded" as const,
    usage: Object.freeze({
      estimatedCost: Object.freeze({ amountMicros: costMicros, currencyCode: "USD" }),
      inputTokens: 20,
      outputTokens: 40,
      totalTokens: 60,
    }),
  });

const fallbackOutputJson = async (): Promise<string> => {
  const { common } = await buildCommon();
  const result = await generateTarotInterpretationV1({
    ...common,
    mode: "fallback_only",
  });
  return JSON.stringify(result.output);
};

describe("RIT-033 bounded provider-neutral generation", () => {
  it("prepares before execution, exposes only redacted claim provenance, and rejects clones/reuse", async () => {
    const { common } = await buildCommon();
    const prepared = await prepareTarotInterpretationGenerationV1(common);
    expect(Object.isFrozen(prepared.provenance)).toBe(true);
    expect(prepared.provenance.runtime.maxOutputTokens).toBe(1_200);
    expect(JSON.stringify(prepared.provenance)).not.toMatch(
      /messages|question|outputJson|private-canary|api.?key/iu,
    );

    await expect(
      executePreparedTarotInterpretationGenerationV1({
        mode: "fallback_only",
        prepared: structuredClone(prepared),
      }),
    ).rejects.toMatchObject({ code: "AI_GENERATION_INPUT_INVALID" });

    const fallback = await executePreparedTarotInterpretationGenerationV1({
      mode: "fallback_only",
      prepared,
    });
    expect(fallback).toMatchObject({ displayable: true, status: "fallback" });
    expect(fallback.metadata).toMatchObject({
      attemptCount: 0,
      costStatus: "unavailable",
      failureCode: "aborted",
      readingType: "one_card",
      retryReason: null,
      tokenStatus: "unavailable",
    });
    await expect(
      executePreparedTarotInterpretationGenerationV1({ mode: "fallback_only", prepared }),
    ).rejects.toMatchObject({ code: "AI_GENERATION_INPUT_INVALID" });
  });

  it("requires persistent refs to use <=100-byte identifiers and full semantic versions", async () => {
    const mutations: readonly ((runtime: TarotGenerationRuntimeRegistrationV1) => unknown)[] = [
      (runtime) => ({ ...runtime, provider: { ...runtime.provider, version: "1" } }),
      (runtime) => ({ ...runtime, model: { ...runtime.model, version: "1.0" } }),
      (runtime) => ({ ...runtime, prompt: { ...runtime.prompt, version: "1" } }),
      (runtime) => ({
        ...runtime,
        fallbackTemplate: { ...runtime.fallbackTemplate, version: "1.0" },
      }),
      (runtime) => ({ ...runtime, provider: { ...runtime.provider, id: "a".repeat(101) } }),
    ];
    for (const mutate of mutations) {
      const { common, runtime } = await buildCommon();
      await expect(
        prepareTarotInterpretationGenerationV1({
          ...common,
          runtime: mutate(runtime) as TarotGenerationRuntimeRegistrationV1,
        }),
      ).rejects.toMatchObject({ code: "AI_GENERATION_INPUT_INVALID" });
    }

    const { common } = await buildCommon();
    const prepared = await prepareTarotInterpretationGenerationV1(common);
    expect(prepared.provenance.runtime.outputSchema.version).toBe("1");

    const longContentVersion = `1.${"1".repeat(97)}.0`;
    expect(longContentVersion).toHaveLength(101);
    const longContent = await buildCommon({ contentVersion: longContentVersion });
    await expect(prepareTarotInterpretationGenerationV1(longContent.common)).rejects.toMatchObject({
      code: "AI_GENERATION_INPUT_INVALID",
    });
  });

  it("returns valid provider prose as non-displayable pending verification", async () => {
    const outputJson = await fallbackOutputJson();
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([success(outputJson)], calls),
      runner: defaultRunner,
    });
    expect(calls.value).toBe(1);
    expect(result).toMatchObject({ displayable: false, status: "pending_verification" });
    expect(result.metadata).toMatchObject({
      attemptCount: 1,
      costStatus: "reported",
      estimatedCostMicros: 100,
      failureCode: null,
      inputTokens: 20,
      outputTokens: 40,
      retryReason: null,
      tokenStatus: "reported",
      totalTokens: 60,
    });
    expect(JSON.stringify(result.metadata)).not.toMatch(
      /requestId|messages|question|outputJson|cardId|sourceRef/iu,
    );
  });

  it("retries one settled allowlisted failure but does not under-report partial usage", async () => {
    const outputJson = await fallbackOutputJson();
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom(
        [
          Object.freeze({
            code: "rate_limited" as const,
            retryAfterMs: 20,
            retryable: false,
            status: "failed" as const,
          }),
          success(outputJson),
        ],
        calls,
      ),
      runner: defaultRunner,
    });
    expect(calls.value).toBe(2);
    expect(result.status).toBe("pending_verification");
    expect(result.metadata).toMatchObject({
      attemptCount: 2,
      costStatus: "unavailable",
      estimatedCostMicros: null,
      inputTokens: null,
      retryReason: "rate_limited",
      tokenStatus: "unavailable",
    });
  });

  it("falls back without retry on timeout and never accepts a late provider outcome", async () => {
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const timeoutRunner = Object.freeze({
      run: async () =>
        Object.freeze({
          cancellationAcknowledged: true,
          elapsedMs: 1_000,
          status: "timeout" as const,
        }),
      wait: defaultRunner.wait,
    }) satisfies GenerationDeadlineRunnerV1;
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([new Error("private-canary raw provider error")], calls),
      runner: timeoutRunner,
    });
    expect(calls.value).toBe(0);
    expect(result).toMatchObject({ displayable: true, status: "fallback" });
    expect(result.metadata).toMatchObject({
      attemptCount: 1,
      failureCode: "timeout",
      retryReason: null,
    });
    expect(JSON.stringify(result.metadata)).not.toContain("private-canary");
  });

  it("rejects token usage outside the PostgreSQL integer boundary without retry", async () => {
    const outputJson = await fallbackOutputJson();
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom(
        [
          Object.freeze({
            finishReason: "stop" as const,
            outputJson,
            status: "succeeded" as const,
            usage: Object.freeze({
              inputTokens: 3_000_000_000,
              outputTokens: 40,
              totalTokens: 3_000_000_040,
            }),
          }),
        ],
        calls,
      ),
      runner: defaultRunner,
    });
    expect(calls.value).toBe(1);
    expect(result).toMatchObject({
      metadata: {
        attemptCount: 1,
        failureCode: "invalid_response",
        inputTokens: null,
        retryReason: null,
        tokenStatus: "unavailable",
        totalTokens: null,
      },
      status: "fallback",
    });
  });

  it("normalizes aggregate token totals that exceed the PostgreSQL integer boundary", async () => {
    const outputJson = await fallbackOutputJson();
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const largeUsage = Object.freeze({
      estimatedCost: Object.freeze({ amountMicros: 0, currencyCode: "USD" }),
      inputTokens: 1_500_000_000,
      outputTokens: 40,
      totalTokens: 1_500_000_040,
    });
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom(
        [
          Object.freeze({
            finishReason: "stop" as const,
            outputJson: "{}",
            status: "succeeded" as const,
            usage: largeUsage,
          }),
          Object.freeze({
            finishReason: "stop" as const,
            outputJson,
            status: "succeeded" as const,
            usage: largeUsage,
          }),
        ],
        calls,
      ),
      runner: defaultRunner,
    });
    expect(calls.value).toBe(2);
    expect(result).toMatchObject({
      metadata: {
        attemptCount: 2,
        inputTokens: null,
        retryReason: "invalid_response",
        tokenStatus: "unavailable",
        totalTokens: null,
      },
      status: "pending_verification",
    });
  });

  it("retries invalid success only at reported zero cost and normalizes an over-cap report", async () => {
    const outputJson = await fallbackOutputJson();

    const first = await buildCommon();
    const cappedCalls = { value: 0 };
    const capped = await generateTarotInterpretationV1({
      ...first.common,
      mode: "provider_with_fallback",
      provider: providerFrom([success("{}", 100), success(outputJson, 1)], cappedCalls),
      runner: defaultRunner,
    });
    expect(cappedCalls.value).toBe(1);
    expect(capped.metadata).toMatchObject({
      attemptCount: 1,
      costStatus: "reported",
      estimatedCostMicros: 100,
      failureCode: "invalid_response",
    });

    const second = await buildCommon();
    const overCalls = { value: 0 };
    const over = await generateTarotInterpretationV1({
      ...second.common,
      mode: "provider_with_fallback",
      provider: providerFrom([success("{}", 0), success(outputJson, 1_200)], overCalls),
      runner: defaultRunner,
    });
    expect(overCalls.value).toBe(2);
    expect(over.metadata).toMatchObject({
      attemptCount: 2,
      costStatus: "unavailable",
      currencyCode: null,
      estimatedCostMicros: null,
      failureCode: "invalid_response",
      outputTokens: null,
      tokenStatus: "unavailable",
    });
  });

  it.each(["configuration", "invalid_request"] as const)(
    "returns durable non-displayable failure for normalized %s with no retry or fallback",
    async (code) => {
      const { common } = await buildCommon();
      const calls = { value: 0 };
      const result = await generateTarotInterpretationV1({
        ...common,
        mode: "provider_with_fallback",
        provider: providerFrom(
          [Object.freeze({ code, retryable: false, status: "failed" as const })],
          calls,
        ),
        runner: defaultRunner,
      });
      expect(calls.value).toBe(1);
      expect(result).toMatchObject({
        displayable: false,
        metadata: {
          attemptCount: 1,
          failureCode: code,
          result: "failed",
          retryReason: null,
        },
        status: "failed",
      });
      expect(Object.hasOwn(result, "output")).toBe(false);
    },
  );

  it("returns durable unknown failure for rejection and normalized unknown", async () => {
    for (const providerResult of [
      new Error("private-canary provider rejection"),
      Object.freeze({ code: "unknown" as const, retryable: false, status: "failed" as const }),
    ]) {
      const { common } = await buildCommon();
      const calls = { value: 0 };
      const result = await generateTarotInterpretationV1({
        ...common,
        mode: "provider_with_fallback",
        provider: providerFrom([providerResult], calls),
        runner: defaultRunner,
      });
      expect(calls.value).toBe(1);
      expect(result).toMatchObject({
        displayable: false,
        metadata: {
          attemptCount: 1,
          failureCode: "unknown",
          result: "failed",
          retryReason: null,
        },
        status: "failed",
      });
      expect(Object.hasOwn(result, "output")).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private-canary");
    }
  });

  it("keeps normalized unavailable in the bounded retry-to-fallback path", async () => {
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const unavailable = Object.freeze({
      code: "unavailable" as const,
      retryable: false,
      status: "failed" as const,
    });
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([unavailable, unavailable], calls),
      runner: defaultRunner,
    });
    expect(calls.value).toBe(2);
    expect(result).toMatchObject({
      displayable: true,
      metadata: {
        attemptCount: 2,
        failureCode: "unavailable",
        result: "fallback",
        retryReason: "unavailable",
      },
      status: "fallback",
    });
  });

  it("turns a deadline-runner failure after provider execution into durable unknown", async () => {
    const outputJson = await fallbackOutputJson();
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const runner = Object.freeze({
      run: async ({ attempt, operation }: Parameters<GenerationDeadlineRunnerV1["run"]>[0]) => {
        await operation(
          Object.freeze({
            attempt,
            attemptId: `test-runner-failure-${attempt}`,
            cancellation: Object.freeze({
              aborted: false,
              subscribe: () => () => undefined,
            }),
          }),
        );
        throw new Error("private-canary runner failure");
      },
      wait: defaultRunner.wait,
    }) satisfies GenerationDeadlineRunnerV1;
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([success(outputJson)], calls),
      runner,
    });
    expect(calls.value).toBe(1);
    expect(result).toMatchObject({
      displayable: false,
      metadata: { failureCode: "unknown", result: "failed" },
      status: "failed",
    });
    expect(JSON.stringify(result)).not.toContain("private-canary");
  });

  it("never emits unpersistable operational latency above 240000ms", async () => {
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const runner = Object.freeze({
      run: async () =>
        Object.freeze({
          cancellationAcknowledged: true,
          elapsedMs: 240_001,
          status: "timeout" as const,
        }),
      wait: defaultRunner.wait,
    }) satisfies GenerationDeadlineRunnerV1;
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([], calls),
      runner,
    });
    expect(calls.value).toBe(0);
    expect(result).toMatchObject({
      displayable: false,
      metadata: {
        failureCode: "unknown",
        latencyMs: 0,
        result: "failed",
      },
      status: "failed",
    });
    expect(Object.hasOwn(result, "output")).toBe(false);
  });

  it("turns an invalid host execution context into durable unknown", async () => {
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const runner = Object.freeze({
      run: async ({ attempt, operation }: Parameters<GenerationDeadlineRunnerV1["run"]>[0]) => {
        const value = await operation(
          Object.freeze({
            attempt,
            attemptId: "",
            cancellation: Object.freeze({
              aborted: false,
              subscribe: () => () => undefined,
            }),
          }),
        );
        return Object.freeze({ elapsedMs: 1, status: "settled" as const, value }) as Awaited<
          ReturnType<GenerationDeadlineRunnerV1["run"]>
        >;
      },
      wait: defaultRunner.wait,
    }) satisfies GenerationDeadlineRunnerV1;
    const result = await generateTarotInterpretationV1({
      ...common,
      mode: "provider_with_fallback",
      provider: providerFrom([], calls),
      runner,
    });
    expect(calls.value).toBe(0);
    expect(result).toMatchObject({
      displayable: false,
      metadata: {
        attemptCount: 1,
        failureCode: "unknown",
        result: "failed",
        retryReason: null,
      },
      status: "failed",
    });
    expect(Object.hasOwn(result, "output")).toBe(false);
  });

  it("hard-fails trust denial before provider execution instead of masking it with fallback", async () => {
    const { common } = await buildCommon();
    const calls = { value: 0 };
    const denied = {
      ...common,
      authorizeRuntime: () => false,
      mode: "provider_with_fallback" as const,
      provider: providerFrom([], calls),
      runner: defaultRunner,
    } satisfies GenerateTarotInterpretationInputV1;
    await expect(generateTarotInterpretationV1(denied)).rejects.toBeInstanceOf(
      TarotGenerationError,
    );
    expect(calls.value).toBe(0);
  });
});
