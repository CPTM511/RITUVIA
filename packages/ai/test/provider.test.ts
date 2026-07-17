import { readFile } from "node:fs/promises";

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isInterpretationGenerationAuthorizationV1,
  parseTarotInterpretationInputJsonV1,
  parseTarotInterpretationOutputForInputV1,
  structuredGenerationProviderSchemaVersion,
  structuredGenerationRequestSchemaVersion,
  type InterpretationOperationalMetadataV1,
  type StructuredGenerationFailureV1,
  type StructuredGenerationProviderV1,
  type StructuredGenerationRequestV1,
  type StructuredGenerationStreamEventV1,
  type StructuredStreamingProviderV1,
} from "../src/index.js";
import { issueInterpretationGenerationAuthorizationV1 } from "../src/provider.js";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/tarot-interpretation-v1.json", import.meta.url), "utf8"),
) as Readonly<{ cases: readonly Readonly<{ input: unknown }>[] }>;
const fixtureInput = fixture.cases.at(0)?.input;
if (fixtureInput === undefined) throw new Error("The provider fixture input is unavailable.");
const parsedInput = parseTarotInterpretationInputJsonV1(JSON.stringify(fixtureInput));
const authorization = issueInterpretationGenerationAuthorizationV1({
  policyVersion: "safety.tarot.en.v1",
  route: "allowed",
  schemaVersion: "interpretation-safety-decision.v1",
});

const request = Object.freeze({
  authorization,
  maxOutputTokens: 1_200,
  messages: Object.freeze([
    Object.freeze({ content: "Use only the supplied synthetic facts.", role: "system" as const }),
    Object.freeze({ content: "Return the approved schema.", role: "user" as const }),
  ]),
  model: Object.freeze({ id: "test.model", version: "1.0.0" }),
  outputSchema: Object.freeze({
    checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    id: "tarot.interpretation.output",
    version: "1.0.0",
  }),
  prompt: Object.freeze({
    checksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    id: "test.prompt.tarot.en",
    version: "1.0.0",
  }),
  requestId: "33333333-3333-4333-8333-333333333333",
  schemaVersion: structuredGenerationRequestSchemaVersion,
  timeoutMs: 8_000,
}) satisfies StructuredGenerationRequestV1;

const validOutput = JSON.stringify({
  boundaryNote: "This is a symbolic possibility, not a prediction.",
  perspectives: ["A narrow focus may make one detail easier to notice."],
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
  sourceRefs: ["content:lantern:1"],
  summary: "The symbol offers one bounded lens on attention.",
  symbols: [
    {
      factRef: "tarot.position.perspective",
      meaning: "The Lantern may represent focused attention.",
      possibility: "One detail may be useful without resolving every uncertainty.",
    },
  ],
  title: "A bounded lens on attention",
});

describe("provider-neutral structured generation contracts", () => {
  it("accepts a fake provider without importing a vendor SDK or raw provider object", async () => {
    let captured: StructuredGenerationRequestV1 | null = null;
    const provider = {
      descriptor: Object.freeze({
        capabilities: Object.freeze(["structured_generation", "usage_reporting"] as const),
        provider: Object.freeze({ id: "test.provider", version: "1.0.0" }),
        schemaVersion: structuredGenerationProviderSchemaVersion,
      }),
      generateStructured: async (candidate) => {
        expect(isInterpretationGenerationAuthorizationV1(candidate.authorization)).toBe(true);
        captured = candidate;
        return Object.freeze({
          finishReason: "stop" as const,
          outputJson: validOutput,
          status: "succeeded" as const,
          usage: Object.freeze({ inputTokens: 30, outputTokens: 60, totalTokens: 90 }),
        });
      },
    } satisfies StructuredGenerationProviderV1;

    const result = await provider.generateStructured(request);

    expect(captured).toBe(request);
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") expect.unreachable("The fake provider must succeed.");
    expect(parseTarotInterpretationOutputForInputV1(parsedInput, result.outputJson).title).toBe(
      "A bounded lens on attention",
    );
    expectTypeOf(provider).toMatchTypeOf<StructuredGenerationProviderV1>();
  });

  it("requires an internally issued allowed authorization instead of a forgeable route object", () => {
    const forged = Object.freeze({
      policyVersion: "safety.tarot.en.v1",
      route: "allowed" as const,
      schemaVersion: "interpretation-safety-decision.v1" as const,
    });
    expect(isInterpretationGenerationAuthorizationV1(authorization)).toBe(true);
    expect(isInterpretationGenerationAuthorizationV1(forged)).toBe(false);

    // @ts-expect-error A plain object does not carry the package-private authorization brand.
    const forgedRequest: StructuredGenerationRequestV1 = { ...request, authorization: forged };
    expect(isInterpretationGenerationAuthorizationV1(forgedRequest.authorization)).toBe(false);

    for (const route of ["blocked", "crisis", "reframed"] as const) {
      expect(() =>
        issueInterpretationGenerationAuthorizationV1({
          policyVersion: "safety.tarot.en.v1",
          route,
          schemaVersion: "interpretation-safety-decision.v1",
        }),
      ).toThrow("The interpretation generation authorization is invalid.");
    }
  });

  it("normalizes provider failures without raw errors, prompts, payloads, or secrets", () => {
    const failure = Object.freeze({
      code: "rate_limited",
      retryAfterMs: 2_000,
      retryable: true,
      status: "failed",
    }) satisfies StructuredGenerationFailureV1;

    expect(failure).toEqual({
      code: "rate_limited",
      retryAfterMs: 2_000,
      retryable: true,
      status: "failed",
    });
    expect(Object.keys(failure).sort()).toEqual(["code", "retryAfterMs", "retryable", "status"]);
    expect(JSON.stringify(failure)).not.toMatch(
      /error|message|prompt|payload|response|api.?key|authorization|private-canary/iu,
    );
  });

  it("marks every stream delta provisional and still requires a final structured result", async () => {
    const provider = {
      descriptor: Object.freeze({
        capabilities: Object.freeze([
          "structured_generation",
          "structured_streaming",
          "usage_reporting",
        ] as const),
        provider: Object.freeze({ id: "test.provider", version: "1.0.0" }),
        schemaVersion: structuredGenerationProviderSchemaVersion,
      }),
      generateStructured: async () =>
        Object.freeze({
          finishReason: "stop" as const,
          outputJson: validOutput,
          status: "succeeded" as const,
          usage: Object.freeze({ inputTokens: 30, outputTokens: 60, totalTokens: 90 }),
        }),
      streamStructured: async function* () {
        yield Object.freeze({ delta: "{", provisional: true as const, type: "delta" as const });
        yield Object.freeze({
          result: Object.freeze({
            finishReason: "stop" as const,
            outputJson: validOutput,
            status: "succeeded" as const,
            usage: Object.freeze({ inputTokens: 30, outputTokens: 60, totalTokens: 90 }),
          }),
          type: "completed" as const,
        });
      },
    } satisfies StructuredStreamingProviderV1;

    const events: StructuredGenerationStreamEventV1[] = [];
    for await (const event of provider.streamStructured(request)) events.push(event);

    expect(events.at(0)).toEqual({ delta: "{", provisional: true, type: "delta" });
    const completion = events.at(1);
    expect(completion?.type).toBe("completed");
    if (completion?.type !== "completed") expect.unreachable("The stream must complete.");
    expect(
      parseTarotInterpretationOutputForInputV1(parsedInput, completion.result.outputJson)
        .schemaVersion,
    ).toBe("1");
  });

  it("keeps operational metadata categorical and excludes raw prompt or response fields", () => {
    const metadata = Object.freeze({
      contentVersions: Object.freeze(["test.tarot.lantern@1.0.0"]),
      estimatedCostMicros: 12,
      inputTokens: 30,
      latencyMs: 420,
      locale: "en",
      modality: "tarot",
      modelVersion: "1.0.0",
      outputSchemaVersion: "1",
      outputTokens: 60,
      promptVersion: "1.0.0",
      providerVersion: "1.0.0",
      result: "succeeded",
      safetyPolicyVersion: "safety.tarot.en.v1",
      themeCode: "open_reflection",
    }) satisfies InterpretationOperationalMetadataV1;

    expect(Object.keys(metadata).sort()).toEqual([
      "contentVersions",
      "estimatedCostMicros",
      "inputTokens",
      "latencyMs",
      "locale",
      "modality",
      "modelVersion",
      "outputSchemaVersion",
      "outputTokens",
      "promptVersion",
      "providerVersion",
      "result",
      "safetyPolicyVersion",
      "themeCode",
    ]);
    expect(JSON.stringify(metadata)).not.toMatch(
      /promptText|messages|outputJson|raw|question|journal|birth|email|readingId|sessionId/iu,
    );
  });
});
