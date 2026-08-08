import { describe, expect, it, vi } from "vitest";

import {
  createVercelAiGatewayOpenAiStructuredGenerationProviderV1,
  preGenerationSafetyPolicyVersion,
  structuredGenerationRequestSchemaVersion,
  type JsonValue,
  type StructuredGenerationCancellationV1,
  type StructuredGenerationExecutionContextV1,
  type StructuredGenerationRequestV1,
} from "../src/index.js";
import { issueInterpretationGenerationAuthorizationV1 } from "../src/provider.js";

const authorization = issueInterpretationGenerationAuthorizationV1(
  {
    policyVersion: preGenerationSafetyPolicyVersion,
    route: "allowed",
    schemaVersion: "interpretation-safety-decision.v1",
  },
  Object.freeze({
    intakePolicyVersion: "question-intake.en.v1",
    locale: "en",
    modality: "tarot" as const,
    policyApprovalReference: "test:rit-033:policy",
    readingType: "one_card" as const,
    requestId: "11111111-1111-4111-8111-111111111111",
    safetyPolicyVersion: preGenerationSafetyPolicyVersion,
    themeCode: "open_reflection" as const,
  }),
);

const request = Object.freeze({
  authorization,
  maxOutputTokens: 1_200,
  messages: Object.freeze([
    Object.freeze({ content: "Use only the supplied synthetic facts.", role: "system" as const }),
    Object.freeze({ content: "Return the approved schema.", role: "user" as const }),
  ]),
  model: Object.freeze({ id: "openai/gpt-5-mini", version: "2026-08-01" }),
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
  requestId: "11111111-1111-4111-8111-111111111111",
  schemaVersion: structuredGenerationRequestSchemaVersion,
  timeoutMs: 25,
}) satisfies StructuredGenerationRequestV1;

const schema = Object.freeze({
  additionalProperties: false,
  properties: {
    boundaryNote: { type: "string" },
    perspectives: {
      items: { type: "string" },
      type: "array",
    },
    reflectionQuestions: {
      items: { type: "string" },
      type: "array",
    },
    safety: {
      additionalProperties: false,
      properties: {
        certaintyLevel: { const: "reflective" },
        containsGuaranteedOutcome: { const: false },
        containsProfessionalAdvice: { const: false },
      },
      required: ["certaintyLevel", "containsGuaranteedOutcome", "containsProfessionalAdvice"],
      type: "object",
    },
    schemaVersion: { const: "1" },
    smallAction: {
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        rationale: { type: "string" },
        timeHorizon: { enum: ["open", "this_week", "today"] },
      },
      required: ["label", "rationale", "timeHorizon"],
      type: "object",
    },
    sourceRefs: {
      items: { type: "string" },
      type: "array",
    },
    summary: { type: "string" },
    symbols: {
      items: {
        additionalProperties: false,
        properties: {
          factRef: { type: "string" },
          meaning: { type: "string" },
          possibility: { type: "string" },
        },
        required: ["factRef", "meaning", "possibility"],
        type: "object",
      },
      type: "array",
    },
    title: { type: "string" },
  },
  required: [
    "boundaryNote",
    "perspectives",
    "reflectionQuestions",
    "safety",
    "schemaVersion",
    "smallAction",
    "sourceRefs",
    "summary",
    "symbols",
    "title",
  ],
  type: "object",
}) satisfies JsonValue;

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

const createCancellation = (): StructuredGenerationCancellationV1 => {
  let aborted = false;
  const listeners = new Set<() => void>();
  return Object.freeze({
    get aborted() {
      return aborted;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    trigger: () => {
      aborted = true;
      for (const listener of listeners) listener();
    },
  }) as StructuredGenerationCancellationV1;
};

const executionContext = (
  cancellation: StructuredGenerationCancellationV1 = createCancellation(),
): StructuredGenerationExecutionContextV1 =>
  Object.freeze({
    attempt: 1,
    attemptId: "22222222-2222-4222-8222-222222222222",
    cancellation,
  });

describe("Vercel AI Gateway OpenAI-compatible structured generation adapter", () => {
  it("sends one strict JSON-schema request and returns bounded usage metadata", async () => {
    const executeRequest = vi.fn(async (transportRequest: Readonly<{ body: string }>) => {
      const body = JSON.parse(transportRequest.body) as Record<string, unknown>;
      expect(body.model).toBe(request.model.id);
      expect(body.max_tokens).toBe(request.maxOutputTokens);
      expect(body.stream).toBe(false);
      expect(body.messages).toEqual(request.messages);
      expect(body.response_format).toEqual({
        json_schema: {
          name: "tarot_interpretation_output_1_0_0",
          schema,
          strict: true,
        },
        type: "json_schema",
      });
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: validOutput, role: "assistant" },
            },
          ],
          usage: {
            completion_tokens: 15,
            prompt_tokens: 10,
            total_tokens: 25,
          },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    });

    const provider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest,
      maximumEstimatedCostMicros: 500,
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveEstimatedCost: () =>
        Object.freeze({
          amountMicros: 125,
          currencyCode: "USD",
        }),
      resolveOutputSchema: () => schema,
    });

    const result = await provider.generateStructured(request, executionContext());

    expect(executeRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      finishReason: "stop",
      outputJson: JSON.stringify(JSON.parse(validOutput)),
      status: "succeeded",
      usage: {
        estimatedCost: { amountMicros: 125, currencyCode: "USD" },
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
      },
    });
  });

  it("maps request timeout to a bounded timeout failure", async () => {
    const provider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest: vi.fn(async () => ({
        code: "timeout" as const,
        retryable: true,
        status: "failed" as const,
      })),
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveOutputSchema: () => schema,
    });

    await expect(provider.generateStructured(request, executionContext())).resolves.toEqual({
      code: "timeout",
      retryable: true,
      status: "failed",
    });
  });

  it("rejects malformed provider output without surfacing raw response text", async () => {
    const provider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: "{not-json", role: "assistant" },
                },
              ],
              usage: {
                completion_tokens: 15,
                prompt_tokens: 10,
                total_tokens: 25,
              },
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          ),
      ),
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveOutputSchema: () => schema,
    });

    const result = await provider.generateStructured(request, executionContext());

    expect(result).toEqual({
      code: "invalid_response",
      retryable: false,
      status: "failed",
    });
    expect(JSON.stringify(result)).not.toContain(validOutput);
  });

  it("maps HTTP rate limits to provider-neutral failures with retry-after metadata", async () => {
    const provider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest: vi.fn(
        async () =>
          new Response(null, {
            headers: { "retry-after": "2" },
            status: 429,
          }),
      ),
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveOutputSchema: () => schema,
    });

    await expect(provider.generateStructured(request, executionContext())).resolves.toEqual({
      code: "rate_limited",
      retryAfterMs: 2_000,
      retryable: true,
      status: "failed",
    });
  });

  it("fails closed when provider usage or estimated cost exceeds bounded caps", async () => {
    const response = JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: validOutput, role: "assistant" },
        },
      ],
      usage: {
        completion_tokens: 15,
        prompt_tokens: 10,
        total_tokens: 25,
      },
    });

    const usageCappedProvider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: validOutput, role: "assistant" },
                },
              ],
              usage: {
                completion_tokens: 15,
                prompt_tokens: 26,
                total_tokens: 41,
              },
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          ),
      ),
      maximumReportedInputTokens: 25,
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveOutputSchema: () => schema,
    });

    await expect(
      usageCappedProvider.generateStructured(request, executionContext()),
    ).resolves.toEqual({
      code: "invalid_response",
      retryable: false,
      status: "failed",
    });

    const costCappedProvider = createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
      executeRequest: vi.fn(
        async () =>
          new Response(response, {
            headers: { "content-type": "application/json" },
            status: 200,
          }),
      ),
      maximumEstimatedCostMicros: 100,
      provider: Object.freeze({ id: "vercel.ai-gateway", version: "1.0.0" }),
      resolveEstimatedCost: () =>
        Object.freeze({
          amountMicros: 101,
          currencyCode: "USD",
        }),
      resolveOutputSchema: () => schema,
    });

    await expect(
      costCappedProvider.generateStructured(request, executionContext()),
    ).resolves.toEqual({
      code: "invalid_response",
      retryable: false,
      status: "failed",
    });
  });
});
