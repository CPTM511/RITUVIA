import {
  structuredGenerationProviderSchemaVersion,
  type ProviderChecksummedReferenceV1,
  type ProviderVersionReferenceV1,
  type StructuredGenerationExecutionContextV1,
  type StructuredGenerationFailureV1,
  type StructuredGenerationProviderV1,
  type StructuredGenerationRequestV1,
  type StructuredGenerationResultV1,
  type StructuredGenerationSuccessV1,
  type StructuredGenerationUsageV1,
} from "./provider.js";

export const vercelAiGatewayOpenAiStructuredGenerationAdapterVersion =
  "vercel-ai-gateway-openai-structured-generation-adapter.v1" as const;
export const vercelAiGatewayOpenAiMaximumReportedTokenCount = 2_147_483_647 as const;
export const vercelAiGatewayOpenAiMaximumEstimatedCostMicros = 2_147_483_647 as const;

type JsonPrimitive = boolean | null | number | string;
export type JsonArray = readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type VercelAiGatewayOpenAiResponseV1 = Readonly<{
  readonly ok: boolean;
  readonly status: number;
  readonly headers: Readonly<{ get: (name: string) => string | null }>;
  json: () => Promise<unknown>;
}>;

export type VercelAiGatewayOpenAiTransportRequestV1 = Readonly<{
  body: string;
  timeoutMs: number;
}>;

export type VercelAiGatewayOpenAiTransportV1 = (
  request: VercelAiGatewayOpenAiTransportRequestV1,
  executionContext: StructuredGenerationExecutionContextV1,
) => Promise<VercelAiGatewayOpenAiResponseV1 | StructuredGenerationFailureV1>;

export type ResolveStructuredOutputSchemaV1 = (
  reference: ProviderChecksummedReferenceV1,
) => JsonValue | null;

export type ResolveGatewayEstimatedCostV1 = (
  input: Readonly<{
    request: StructuredGenerationRequestV1;
    responseJson: unknown;
    usage: Readonly<{
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }>;
  }>,
) => Readonly<{
  amountMicros: number;
  currencyCode: string;
}> | null;

export type VercelAiGatewayOpenAiStructuredGenerationProviderOptionsV1 = Readonly<{
  executeRequest: VercelAiGatewayOpenAiTransportV1;
  maximumEstimatedCostMicros?: number;
  maximumReportedInputTokens?: number;
  maximumReportedTotalTokens?: number;
  provider: ProviderVersionReferenceV1;
  resolveEstimatedCost?: ResolveGatewayEstimatedCostV1;
  resolveModelId?: (request: StructuredGenerationRequestV1) => string;
  resolveOutputSchema: ResolveStructuredOutputSchemaV1;
}>;

type GatewayUsageV1 = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

type GatewaySuccessParseV1 = Readonly<{
  finishReason: StructuredGenerationSuccessV1["finishReason"];
  outputJson: string;
  status: "succeeded";
  usage: GatewayUsageV1;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isSafeIntegerIn = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;

const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(seconds) || seconds < 0) return undefined;
    const milliseconds = seconds * 1_000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return undefined;
  const milliseconds = Math.max(0, timestamp - Date.now());
  return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
};

const failure = (
  code: StructuredGenerationFailureV1["code"],
  retryable: boolean,
  retryAfterMs?: number,
): StructuredGenerationFailureV1 =>
  Object.freeze(
    retryAfterMs === undefined
      ? {
          code,
          retryable,
          status: "failed" as const,
        }
      : {
          code,
          retryAfterMs,
          retryable,
          status: "failed" as const,
        },
  );

const parseContentParts = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.length === 0) return null;
  const textParts: string[] = [];
  for (const part of value) {
    if (!isRecord(part) || part.type !== "text" || !isNonEmptyString(part.text)) return null;
    textParts.push(part.text);
  }
  return textParts.join("");
};

const parseFinishReason = (
  value: unknown,
): StructuredGenerationSuccessV1["finishReason"] | "content_filtered" | null => {
  if (value === "stop") return "stop";
  if (value === "length") return "length";
  if (value === "content_filter") return "content_filtered";
  if (typeof value === "string" && value.length > 0) return "other";
  return null;
};

const parseGatewaySuccess = (
  responseJson: unknown,
  request: StructuredGenerationRequestV1,
  options: Readonly<{
    maximumReportedInputTokens: number;
    maximumReportedTotalTokens: number;
  }>,
): GatewaySuccessParseV1 | StructuredGenerationFailureV1 => {
  if (
    !isRecord(responseJson) ||
    !Array.isArray(responseJson.choices) ||
    responseJson.choices.length !== 1
  ) {
    return failure("invalid_response", false);
  }
  const choice = responseJson.choices.at(0);
  if (!isRecord(choice)) return failure("invalid_response", false);
  const parsedFinishReason = parseFinishReason(choice.finish_reason);
  if (parsedFinishReason === null) return failure("invalid_response", false);
  if (parsedFinishReason === "content_filtered") return failure("content_filtered", false);
  const message = isRecord(choice.message) ? choice.message : null;
  if (message === null) return failure("invalid_response", false);
  if (isNonEmptyString(message.refusal)) return failure("content_filtered", false);
  const rawContent = parseContentParts(message.content);
  if (!isNonEmptyString(rawContent)) return failure("invalid_response", false);
  let outputJson: string;
  try {
    outputJson = JSON.stringify(JSON.parse(rawContent));
  } catch {
    return failure("invalid_response", false);
  }
  const usage = isRecord(responseJson.usage) ? responseJson.usage : null;
  if (
    usage === null ||
    !isSafeIntegerIn(usage.prompt_tokens, 0, options.maximumReportedInputTokens) ||
    !isSafeIntegerIn(usage.completion_tokens, 0, request.maxOutputTokens) ||
    !isSafeIntegerIn(usage.total_tokens, 0, options.maximumReportedTotalTokens) ||
    usage.prompt_tokens + usage.completion_tokens !== usage.total_tokens
  ) {
    return failure("invalid_response", false);
  }
  return Object.freeze({
    finishReason: parsedFinishReason,
    outputJson,
    status: "succeeded" as const,
    usage: Object.freeze({
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    }),
  });
};

const parseEstimatedCost = (
  resolveEstimatedCost: ResolveGatewayEstimatedCostV1 | undefined,
  request: StructuredGenerationRequestV1,
  responseJson: unknown,
  usage: GatewayUsageV1,
  maximumEstimatedCostMicros: number,
): StructuredGenerationUsageV1["estimatedCost"] | StructuredGenerationFailureV1 | undefined => {
  if (resolveEstimatedCost === undefined) return undefined;
  let resolved: ReturnType<ResolveGatewayEstimatedCostV1>;
  try {
    resolved = resolveEstimatedCost(
      Object.freeze({
        request,
        responseJson,
        usage,
      }),
    );
  } catch {
    return failure("invalid_response", false);
  }
  if (resolved === null) return undefined;
  if (
    !isSafeIntegerIn(resolved.amountMicros, 0, maximumEstimatedCostMicros) ||
    typeof resolved.currencyCode !== "string" ||
    !/^[A-Z]{3}$/u.test(resolved.currencyCode)
  ) {
    return failure("invalid_response", false);
  }
  return Object.freeze({
    amountMicros: resolved.amountMicros,
    currencyCode: resolved.currencyCode,
  });
};

const mapHttpFailure = (
  response: VercelAiGatewayOpenAiResponseV1,
): StructuredGenerationFailureV1 => {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
  if (response.status === 408 || response.status === 504)
    return failure("timeout", true, retryAfterMs);
  if (response.status === 429) return failure("rate_limited", true, retryAfterMs);
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return failure("configuration", false);
  }
  if (
    response.status === 400 ||
    response.status === 409 ||
    response.status === 413 ||
    response.status === 422
  ) {
    return failure("invalid_request", false);
  }
  if (response.status >= 500) return failure("unavailable", true, retryAfterMs);
  return failure("unknown", false);
};

const sanitizeSchemaName = (reference: ProviderChecksummedReferenceV1): string => {
  const base = `${reference.id}_${reference.version}`.replace(/[^A-Za-z0-9_-]/gu, "_");
  const trimmed = base.slice(0, 64);
  return trimmed.length > 0 ? trimmed : "rituvia_structured_output";
};

const validateProviderOptions = (
  options: VercelAiGatewayOpenAiStructuredGenerationProviderOptionsV1,
): Readonly<{
  executeRequest: VercelAiGatewayOpenAiTransportV1;
  maximumEstimatedCostMicros: number;
  maximumReportedInputTokens: number;
  maximumReportedTotalTokens: number;
  provider: ProviderVersionReferenceV1;
  resolveEstimatedCost?: ResolveGatewayEstimatedCostV1;
  resolveModelId: (request: StructuredGenerationRequestV1) => string;
  resolveOutputSchema: ResolveStructuredOutputSchemaV1;
}> => {
  if (typeof options.executeRequest !== "function") {
    throw new TypeError("The Vercel AI Gateway transport is invalid.");
  }
  const maximumReportedInputTokens =
    options.maximumReportedInputTokens ?? vercelAiGatewayOpenAiMaximumReportedTokenCount;
  const maximumReportedTotalTokens =
    options.maximumReportedTotalTokens ?? vercelAiGatewayOpenAiMaximumReportedTokenCount;
  const maximumEstimatedCostMicros =
    options.maximumEstimatedCostMicros ?? vercelAiGatewayOpenAiMaximumEstimatedCostMicros;
  if (
    !isSafeIntegerIn(
      maximumReportedInputTokens,
      0,
      vercelAiGatewayOpenAiMaximumReportedTokenCount,
    ) ||
    !isSafeIntegerIn(
      maximumReportedTotalTokens,
      0,
      vercelAiGatewayOpenAiMaximumReportedTokenCount,
    ) ||
    !isSafeIntegerIn(maximumEstimatedCostMicros, 0, vercelAiGatewayOpenAiMaximumEstimatedCostMicros)
  ) {
    throw new TypeError("The Vercel AI Gateway metadata limits are invalid.");
  }
  return Object.freeze({
    executeRequest: options.executeRequest,
    maximumEstimatedCostMicros,
    maximumReportedInputTokens,
    maximumReportedTotalTokens,
    provider: Object.freeze({
      id: options.provider.id,
      version: options.provider.version,
    }),
    ...(options.resolveEstimatedCost === undefined
      ? null
      : { resolveEstimatedCost: options.resolveEstimatedCost }),
    resolveModelId: options.resolveModelId ?? ((request) => request.model.id),
    resolveOutputSchema: options.resolveOutputSchema,
  });
};

export const createVercelAiGatewayOpenAiStructuredGenerationProviderV1 = (
  options: VercelAiGatewayOpenAiStructuredGenerationProviderOptionsV1,
): StructuredGenerationProviderV1 => {
  const validated = validateProviderOptions(options);
  return Object.freeze({
    descriptor: Object.freeze({
      capabilities: Object.freeze(["structured_generation", "usage_reporting"] as const),
      provider: validated.provider,
      schemaVersion: structuredGenerationProviderSchemaVersion,
    }),
    generateStructured: async (
      request: StructuredGenerationRequestV1,
      executionContext: StructuredGenerationExecutionContextV1,
    ): Promise<StructuredGenerationResultV1> => {
      if (executionContext.cancellation.aborted) return failure("aborted", true);
      const schema = validated.resolveOutputSchema(request.outputSchema);
      if (schema === null) return failure("configuration", false);
      const model = validated.resolveModelId(request);
      if (!isNonEmptyString(model)) return failure("configuration", false);

      try {
        const response = await validated.executeRequest(
          Object.freeze({
            body: JSON.stringify({
              max_tokens: request.maxOutputTokens,
              messages: request.messages,
              model,
              response_format: {
                json_schema: {
                  name: sanitizeSchemaName(request.outputSchema),
                  schema,
                  strict: true,
                },
                type: "json_schema",
              },
              stream: false,
            }),
            timeoutMs: request.timeoutMs,
          }),
          executionContext,
        );
        if ("code" in response) return response;
        if (!response.ok) return mapHttpFailure(response);
        let responseJson: unknown;
        try {
          responseJson = await response.json();
        } catch {
          return failure("invalid_response", false);
        }
        const parsed = parseGatewaySuccess(responseJson, request, {
          maximumReportedInputTokens: validated.maximumReportedInputTokens,
          maximumReportedTotalTokens: validated.maximumReportedTotalTokens,
        });
        if (parsed.status === "failed") return parsed;
        const estimatedCost = parseEstimatedCost(
          validated.resolveEstimatedCost,
          request,
          responseJson,
          parsed.usage,
          validated.maximumEstimatedCostMicros,
        );
        if (estimatedCost !== undefined && "status" in estimatedCost) return estimatedCost;
        const usage: StructuredGenerationUsageV1 =
          estimatedCost === undefined
            ? Object.freeze({
                inputTokens: parsed.usage.inputTokens,
                outputTokens: parsed.usage.outputTokens,
                totalTokens: parsed.usage.totalTokens,
              })
            : Object.freeze({
                estimatedCost,
                inputTokens: parsed.usage.inputTokens,
                outputTokens: parsed.usage.outputTokens,
                totalTokens: parsed.usage.totalTokens,
              });
        return Object.freeze({
          finishReason: parsed.finishReason,
          outputJson: parsed.outputJson,
          status: "succeeded" as const,
          usage,
        });
      } catch (error) {
        if (error instanceof TypeError) return failure("unavailable", true);
        return failure("unknown", false);
      }
    },
  });
};
