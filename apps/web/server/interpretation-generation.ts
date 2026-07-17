import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  executePreparedTarotInterpretationGenerationV1,
  parseTarotInterpretationOutputForInputV1,
  prepareTarotInterpretationGenerationV1,
  tarotGenerationOperationalMetadataSchemaVersion,
  type ApprovedTarotFallbackTemplateV1,
  type GenerationDeadlineRunnerV1,
  type GenerationDeadlineRunInputV1,
  type GenerationDeadlineRunResultV1,
  type PreGenerationSafetyContinuationContextV1,
  type PreparedTarotInterpretationGenerationV1,
  type RetrievedTarotContentBundleV1,
  type StructuredGenerationCancellationV1,
  type StructuredGenerationFailureCode,
  type StructuredGenerationProviderV1,
  type TarotGenerationAuthorityVerifierV1,
  type TarotGenerationOperationalMetadataV1,
  type TarotGenerationRuntimeRegistrationV1,
  type TarotInterpretationGenerationResultV1,
  type TarotInterpretationInputV1,
  type TarotInterpretationOutputV1,
  type TarotPromptAssemblyV1,
} from "@rituvia/ai";
import {
  InterpretationGenerationPersistenceError,
  type InterpretationGenerationClaimProvenanceV1,
  type InterpretationGenerationCompletionV1,
  type InterpretationGenerationOperationalMetadataV1,
  type InterpretationGenerationPersistence,
  type InterpretationGenerationProvenanceV1,
  type PersistedInterpretationGeneration,
} from "@rituvia/db";

const digestKeyVersionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;

const isDurableFallbackFailureCode = (value: StructuredGenerationFailureCode | null): boolean =>
  value === "aborted" ||
  value === "content_filtered" ||
  value === "invalid_response" ||
  value === "quota_exceeded" ||
  value === "rate_limited" ||
  value === "timeout" ||
  value === "unavailable";

export const interpretationGenerationDigestSchemaVersion =
  "interpretation-generation-digest.v1" as const;

export type InterpretationGenerationDigestKeyV1 = Readonly<{
  encodedKey: string;
  version: string;
}>;

type JsonPrimitive = boolean | number | string | null;
type CanonicalJson =
  JsonPrimitive | readonly CanonicalJson[] | { readonly [key: string]: CanonicalJson };

const invalidConfiguration = (): never => {
  throw new TypeError("Interpretation generation service configuration is invalid.");
};

const parseDigestKey = (
  input: InterpretationGenerationDigestKeyV1,
): Readonly<{ key: Buffer; version: string }> => {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof input.version !== "string" ||
    input.version.length > 100 ||
    !digestKeyVersionPattern.test(input.version) ||
    typeof input.encodedKey !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(input.encodedKey)
  ) {
    return invalidConfiguration();
  }
  const key = Buffer.from(input.encodedKey, "base64url");
  if (key.byteLength !== 32 || key.toString("base64url") !== input.encodedKey) {
    return invalidConfiguration();
  }
  return Object.freeze({ key: Buffer.from(key), version: input.version });
};

const canonicalJson = (value: unknown): string => {
  const visit = (candidate: unknown): string => {
    if (candidate === null || typeof candidate === "boolean" || typeof candidate === "string") {
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isSafeInteger(candidate)) return invalidConfiguration();
      return JSON.stringify(candidate);
    }
    if (Array.isArray(candidate)) return `[${candidate.map(visit).join(",")}]`;
    if (typeof candidate !== "object" || candidate === null) return invalidConfiguration();
    const record = candidate as Record<string, unknown>;
    return `{${Object.entries(record)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${visit(child)}`)
      .join(",")}}`;
  };
  return visit(value as CanonicalJson);
};

const keyedDigest = (key: Buffer, domain: string, value: CanonicalJson): string =>
  `sha256:${createHmac("sha256", key)
    .update(domain, "utf8")
    .update("\0", "utf8")
    .update(canonicalJson(value), "utf8")
    .digest("hex")}`;

const elapsedMilliseconds = (startedAt: number): number =>
  Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(performance.now() - startedAt)));

export const createWebGenerationDeadlineRunnerV1 = (): GenerationDeadlineRunnerV1 =>
  Object.freeze({
    run: async <Value>({
      attempt,
      operation,
      timeoutMs,
    }: GenerationDeadlineRunInputV1<Value>): Promise<GenerationDeadlineRunResultV1<Value>> => {
      if (
        (attempt !== 1 && attempt !== 2) ||
        typeof operation !== "function" ||
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > 120_000
      ) {
        return invalidConfiguration();
      }

      const startedAt = performance.now();
      let completed = false;
      const controller = new AbortController();
      const listeners = new Set<() => void>();
      const clearListeners = (): void => {
        for (const listener of listeners) {
          controller.signal.removeEventListener("abort", listener);
        }
        listeners.clear();
      };
      const cancellation = Object.freeze({
        get aborted() {
          return controller.signal.aborted;
        },
        subscribe(listener: () => void): () => void {
          if (typeof listener !== "function") return invalidConfiguration();
          const safeListener = (): void => {
            try {
              listener();
            } catch {
              // A broken vendor cancellation hook cannot block the hard deadline.
            }
          };
          if (controller.signal.aborted) {
            safeListener();
            return () => undefined;
          }
          listeners.add(safeListener);
          controller.signal.addEventListener("abort", safeListener, { once: true });
          return () => {
            listeners.delete(safeListener);
            controller.signal.removeEventListener("abort", safeListener);
          };
        },
      }) satisfies StructuredGenerationCancellationV1;

      return await new Promise<
        | Readonly<{ status: "settled"; value: Value; elapsedMs: number }>
        | Readonly<{
            status: "timeout";
            elapsedMs: number;
            cancellationAcknowledged: boolean;
          }>
      >((resolve, reject) => {
        const timer = setTimeout(() => {
          if (completed) return;
          completed = true;
          controller.abort();
          clearListeners();
          resolve(
            Object.freeze({
              // Signal delivery cannot prove that a remote request was cancelled.
              cancellationAcknowledged: false,
              elapsedMs: elapsedMilliseconds(startedAt),
              status: "timeout" as const,
            }),
          );
        }, timeoutMs);

        const pending = Promise.resolve().then(() =>
          operation(
            Object.freeze({
              attempt,
              attemptId: randomUUID(),
              cancellation,
            }),
          ),
        );
        void pending.then(
          (value) => {
            if (completed) return;
            completed = true;
            clearTimeout(timer);
            clearListeners();
            resolve(
              Object.freeze({
                elapsedMs: elapsedMilliseconds(startedAt),
                status: "settled" as const,
                value,
              }),
            );
          },
          (error: unknown) => {
            if (completed) return;
            completed = true;
            clearTimeout(timer);
            clearListeners();
            reject(error);
          },
        );
      });
    },
    wait: async ({ delayMs, timeoutMs }) => {
      if (
        !Number.isSafeInteger(delayMs) ||
        delayMs < 0 ||
        delayMs > 120_000 ||
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > 240_000
      ) {
        return invalidConfiguration();
      }
      const startedAt = performance.now();
      const timedOut = delayMs >= timeoutMs;
      return await new Promise((resolve) => {
        setTimeout(
          () => {
            const elapsedMs = elapsedMilliseconds(startedAt);
            resolve(
              timedOut
                ? Object.freeze({
                    cancellationAcknowledged: false,
                    elapsedMs,
                    status: "timeout" as const,
                  })
                : Object.freeze({ elapsedMs, status: "settled" as const }),
            );
          },
          timedOut ? timeoutMs : delayMs,
        );
      });
    },
  });

const createDigestFactory = (input: InterpretationGenerationDigestKeyV1) => {
  const parsed = parseDigestKey(input);
  return Object.freeze({
    canonicalRequest(value: CanonicalJson): string {
      return keyedDigest(parsed.key, "rituvia.interpretation-generation.request.v1", value);
    },
    completion(value: CanonicalJson): string {
      return keyedDigest(parsed.key, "rituvia.interpretation-generation.completion.v1", value);
    },
    idempotency(readingId: string, idempotencyKey: string): string {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(readingId) ||
        !idempotencyKeyPattern.test(idempotencyKey)
      ) {
        return invalidConfiguration();
      }
      return keyedDigest(parsed.key, "rituvia.interpretation-generation.idempotency.v1", {
        idempotencyKey,
        operation: "interpretation.tarot.generate.v1",
        readingId,
        schemaVersion: interpretationGenerationDigestSchemaVersion,
      });
    },
    version: parsed.version,
  });
};

const interpretationGenerationSchemaVersion = "interpretation-generation.v1" as const;
const interpretationGenerationProvenanceSchemaVersion =
  "interpretation-generation-provenance.v1" as const;

export type WebInterpretationGenerationErrorCode =
  "conflict" | "not_found" | "session_required" | "unavailable";

export class WebInterpretationGenerationError extends Error {
  readonly code: WebInterpretationGenerationErrorCode;

  constructor(code: WebInterpretationGenerationErrorCode) {
    super("The interpretation generation operation failed.");
    this.name = "WebInterpretationGenerationError";
    this.code = code;
  }
}

export type WebInterpretationGenerationRequestV1 = Readonly<{
  continuation: PreGenerationSafetyContinuationContextV1;
  idempotencyKey: string;
  input: TarotInterpretationInputV1;
  prompt: TarotPromptAssemblyV1;
  readingId: string;
  retrievedContent: RetrievedTarotContentBundleV1;
  sessionToken: string;
}>;

export type WebInterpretationGenerationResultV1 =
  | Readonly<{
      displayable: false;
      interpretationId: string;
      kind: "in_progress";
      leaseExpiresAt: string;
      status: "in_progress";
    }>
  | (TarotInterpretationGenerationResultV1 &
      Readonly<{
        interpretationId: string;
        kind: "finalized";
      }>)
  | Readonly<{
      displayable: false;
      interpretationId: string;
      kind: "replayed";
      metadata: TarotGenerationOperationalMetadataV1;
      status: "pending_verification";
    }>
  | Readonly<{
      displayable: false;
      interpretationId: string;
      kind: "replayed";
      metadata: TarotGenerationOperationalMetadataV1;
      status: "failed";
    }>
  | Readonly<{
      displayable: true;
      interpretationId: string;
      kind: "replayed";
      metadata: TarotGenerationOperationalMetadataV1;
      output: TarotInterpretationOutputV1;
      status: "fallback";
    }>;

export type InterpretationGenerationApplicationDependenciesV1 = Readonly<{
  authorizeRuntime: TarotGenerationAuthorityVerifierV1;
  digestKey: InterpretationGenerationDigestKeyV1;
  fallbackTemplate: ApprovedTarotFallbackTemplateV1;
  persistence: InterpretationGenerationPersistence;
  provider: StructuredGenerationProviderV1;
  runtime: TarotGenerationRuntimeRegistrationV1;
}>;

const contentVersionsFor = (prepared: PreparedTarotInterpretationGenerationV1): readonly string[] =>
  Object.freeze(
    [...new Set(prepared.provenance.prompt.content.content.map(({ version }) => version))].sort(),
  );

const persistenceJson = <Value extends object>(
  value: Value,
): InterpretationGenerationProvenanceV1["content"] =>
  value as unknown as InterpretationGenerationProvenanceV1["content"];

const createClaimProvenance = (
  prepared: PreparedTarotInterpretationGenerationV1,
): InterpretationGenerationClaimProvenanceV1 => {
  const { fallbackTemplate, prompt, request, runtime } = prepared.provenance;
  if (request.locale !== "en" || prompt.locale !== "en") {
    return invalidConfiguration();
  }
  const fallbackReference = Object.freeze({
    approvalReference: fallbackTemplate.approvalReference,
    checksum: fallbackTemplate.checksum,
    id: fallbackTemplate.id,
    version: fallbackTemplate.version,
  });
  const generationProvenance = Object.freeze({
    assemblyPolicyVersion: prompt.assemblyPolicyVersion,
    content: persistenceJson(prompt.content),
    deterministicFacts: persistenceJson(prompt.deterministicFacts),
    deterministicEngine: Object.freeze({ ...prompt.deterministicEngine }),
    fallbackTemplate: fallbackReference,
    inputSchemaVersion: prompt.inputSchemaVersion,
    locale: "en" as const,
    modality: "tarot" as const,
    outputSchema: Object.freeze({ ...prompt.outputSchema }),
    prompt: persistenceJson(prompt.prompt),
    retrievalPolicyVersion: prompt.retrievalPolicyVersion,
    safetyPolicyVersion: prompt.safetyPolicyVersion,
    schemaVersion: interpretationGenerationProvenanceSchemaVersion,
    themeCode: request.themeCode,
    tone: prompt.tone,
    tradition: prompt.tradition,
  }) satisfies InterpretationGenerationProvenanceV1;
  return Object.freeze({
    assemblyPolicyVersion: prompt.assemblyPolicyVersion,
    attemptTimeoutMs: runtime.attemptTimeoutMs,
    contentVersions: contentVersionsFor(prepared),
    deterministicAlgorithmVersion: prompt.deterministicEngine.algorithmVersion,
    deterministicEngineName: prompt.deterministicEngine.engineName,
    deterministicEngineVersion: prompt.deterministicEngine.engineVersion,
    deterministicRulesVersion: prompt.deterministicEngine.rulesVersion,
    eligibilityAsOf: runtime.eligibilityAsOf,
    fallbackTemplate: fallbackReference,
    generationPolicyVersion: runtime.schemaVersion,
    generationProvenance,
    locale: "en" as const,
    maxAttempts: runtime.maximumAttempts,
    maxOutputTokens: runtime.maxOutputTokens,
    maximumEstimatedCostMicros: runtime.maximumEstimatedCostMicros,
    modality: "tarot" as const,
    model: Object.freeze({ ...runtime.model }),
    outputSchemaVersion: runtime.outputSchema.version,
    prompt: Object.freeze({
      approvalReference: prompt.prompt.approvalReference,
      checksum: runtime.prompt.checksum,
      id: runtime.prompt.id,
      version: runtime.prompt.version,
    }),
    provider: Object.freeze({
      approvalReference: runtime.approvalReference,
      id: runtime.provider.id,
      version: runtime.provider.version,
    }),
    readingType: request.readingType,
    retryDelayMs: runtime.retryDelayMs,
    retrievalPolicyVersion: prompt.retrievalPolicyVersion,
    safetyPolicyVersion: request.safetyPolicyVersion,
    themeCode: request.themeCode,
    tone: prompt.tone,
    totalTimeoutMs: runtime.totalTimeoutMs,
    currencyCode: runtime.currencyCode,
  });
};

const operationalForPersistence = (
  metadata: TarotGenerationOperationalMetadataV1,
): InterpretationGenerationOperationalMetadataV1 => {
  if (metadata.attemptCount !== 0 && metadata.attemptCount !== 1 && metadata.attemptCount !== 2) {
    return invalidConfiguration();
  }
  return Object.freeze({
    attemptCount: metadata.attemptCount,
    costStatus: metadata.costStatus,
    currencyCode: metadata.currencyCode,
    estimatedCostMicros: metadata.estimatedCostMicros,
    failureCode: metadata.failureCode,
    inputTokens: metadata.inputTokens,
    latencyMs: metadata.latencyMs,
    outputTokens: metadata.outputTokens,
    retryReason: metadata.retryReason,
    tokenStatus: metadata.tokenStatus,
    totalTokens: metadata.totalTokens,
  });
};

const metadataFromPersisted = (
  interpretation: PersistedInterpretationGeneration,
): TarotGenerationOperationalMetadataV1 =>
  Object.freeze({
    ...interpretation.operational,
    contentVersions: Object.freeze([...interpretation.provenance.contentVersions]),
    fallbackTemplateVersion: interpretation.provenance.fallbackTemplate.version,
    locale: interpretation.provenance.locale,
    modality: interpretation.provenance.modality,
    modelId: interpretation.provenance.model.id,
    modelVersion: interpretation.provenance.model.version,
    outputSchemaVersion: interpretation.provenance.outputSchemaVersion,
    promptId: interpretation.provenance.prompt.id,
    promptVersion: interpretation.provenance.prompt.version,
    providerId: interpretation.provenance.provider.id,
    providerVersion: interpretation.provenance.provider.version,
    readingType: interpretation.provenance.readingType,
    result: interpretation.status,
    safetyPolicyVersion: interpretation.provenance.safetyPolicyVersion,
    schemaVersion: tarotGenerationOperationalMetadataSchemaVersion,
    themeCode: interpretation.provenance.themeCode,
  });

const projectPersisted = (
  interpretation: PersistedInterpretationGeneration,
  request: WebInterpretationGenerationRequestV1,
  expectedProvenance: InterpretationGenerationClaimProvenanceV1,
): Extract<WebInterpretationGenerationResultV1, { kind: "replayed" }> => {
  if (
    interpretation.readingId !== request.readingId ||
    interpretation.requestId !== request.input.requestId ||
    canonicalJson(interpretation.provenance) !== canonicalJson(expectedProvenance)
  ) {
    throw new WebInterpretationGenerationError("unavailable");
  }
  const metadata = metadataFromPersisted(interpretation);
  if (interpretation.status === "pending_verification") {
    return Object.freeze({
      displayable: false,
      interpretationId: interpretation.id,
      kind: "replayed" as const,
      metadata,
      status: "pending_verification" as const,
    });
  }
  if (interpretation.status === "failed") {
    return Object.freeze({
      displayable: false,
      interpretationId: interpretation.id,
      kind: "replayed" as const,
      metadata,
      status: "failed" as const,
    });
  }
  const output = parseTarotInterpretationOutputForInputV1(
    request.input,
    JSON.stringify(interpretation.output),
  );
  return Object.freeze({
    displayable: true,
    interpretationId: interpretation.id,
    kind: "replayed" as const,
    metadata,
    output,
    status: "fallback" as const,
  });
};

const mapPersistenceError = (error: unknown): WebInterpretationGenerationError => {
  if (error instanceof WebInterpretationGenerationError) return error;
  if (error instanceof InterpretationGenerationPersistenceError) {
    switch (error.code) {
      case "INTERPRETATION_GENERATION_IDEMPOTENCY_CONFLICT":
        return new WebInterpretationGenerationError("conflict");
      case "INTERPRETATION_GENERATION_READING_NOT_FOUND":
        return new WebInterpretationGenerationError("not_found");
      case "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE":
        return new WebInterpretationGenerationError("session_required");
      case "INTERPRETATION_GENERATION_CLAIM_LOST":
      case "INTERPRETATION_GENERATION_INPUT_INVALID":
      case "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE":
        return new WebInterpretationGenerationError("unavailable");
    }
  }
  return new WebInterpretationGenerationError("unavailable");
};

export const createInterpretationGenerationApplicationService = (
  dependencies: InterpretationGenerationApplicationDependenciesV1,
) => {
  if (
    typeof dependencies !== "object" ||
    dependencies === null ||
    typeof dependencies.authorizeRuntime !== "function" ||
    typeof dependencies.provider !== "object" ||
    dependencies.provider === null ||
    typeof dependencies.provider.generateStructured !== "function" ||
    typeof dependencies.persistence !== "object" ||
    dependencies.persistence === null ||
    typeof dependencies.persistence.claim !== "function" ||
    typeof dependencies.persistence.finalize !== "function"
  ) {
    return invalidConfiguration();
  }
  const digest = createDigestFactory(dependencies.digestKey);
  const runner = createWebGenerationDeadlineRunnerV1();
  const runtime = Object.freeze({
    ...dependencies.runtime,
    fallbackTemplate: Object.freeze({ ...dependencies.runtime.fallbackTemplate }),
    model: Object.freeze({ ...dependencies.runtime.model }),
    outputSchema: Object.freeze({ ...dependencies.runtime.outputSchema }),
    prompt: Object.freeze({ ...dependencies.runtime.prompt }),
    provider: Object.freeze({ ...dependencies.runtime.provider }),
  });
  const generateStructured = dependencies.provider.generateStructured.bind(dependencies.provider);
  const provider = Object.freeze({
    descriptor: Object.freeze({
      ...dependencies.provider.descriptor,
      capabilities: Object.freeze([...dependencies.provider.descriptor.capabilities]),
      provider: Object.freeze({ ...dependencies.provider.descriptor.provider }),
    }),
    generateStructured,
  });
  const persistence = Object.freeze({
    claim: dependencies.persistence.claim.bind(dependencies.persistence),
    finalize: dependencies.persistence.finalize.bind(dependencies.persistence),
  });
  const stableDependencies = Object.freeze({
    ...dependencies,
    persistence,
    provider,
    runtime,
  });

  return Object.freeze({
    generate: async (
      request: WebInterpretationGenerationRequestV1,
    ): Promise<WebInterpretationGenerationResultV1> => {
      try {
        const commonGenerationInput = Object.freeze({
          authorizeRuntime: stableDependencies.authorizeRuntime,
          continuation: request.continuation,
          fallbackTemplate: stableDependencies.fallbackTemplate,
          input: request.input,
          prompt: request.prompt,
          provider: stableDependencies.provider,
          retrievedContent: request.retrievedContent,
          runtime: stableDependencies.runtime,
        });
        // Trust, exact binding, fallback-template integrity, and runtime authority
        // must all succeed before a durable claim is allowed to exist.
        const prepared = await prepareTarotInterpretationGenerationV1(commonGenerationInput);
        const provenance = createClaimProvenance(prepared);
        const canonicalRequestDigest = digest.canonicalRequest({
          approvedContent: request.input.approvedContent,
          approvedRitualTemplateCodes: request.input.approvedRitualTemplateCodes,
          generationSchemaVersion: interpretationGenerationSchemaVersion,
          policyApprovalReference: request.continuation.policyApprovalReference,
          prepared: prepared.provenance,
          provenance,
          readingId: request.readingId,
          requestId: prepared.provenance.request.requestId,
          schemaVersion: interpretationGenerationDigestSchemaVersion,
        });
        const claimed = await stableDependencies.persistence.claim({
          canonicalRequestDigest,
          generationSchemaVersion: interpretationGenerationSchemaVersion,
          idempotencyKeyDigest: digest.idempotency(request.readingId, request.idempotencyKey),
          idempotencyKeyVersion: digest.version,
          provenance,
          readingId: request.readingId,
          requestId: prepared.provenance.request.requestId,
          token: request.sessionToken,
        });

        if (claimed.kind === "in_progress") {
          return Object.freeze({
            displayable: false,
            interpretationId: claimed.interpretationId,
            kind: "in_progress" as const,
            leaseExpiresAt: claimed.leaseExpiresAt,
            status: "in_progress" as const,
          });
        }
        if (claimed.kind === "replayed") {
          return projectPersisted(claimed.interpretation, request, provenance);
        }
        if (
          (claimed.kind === "claimed" && !claimed.providerEligible) ||
          (claimed.kind === "reclaimed" && claimed.providerEligible)
        ) {
          return invalidConfiguration();
        }

        const generated = await executePreparedTarotInterpretationGenerationV1(
          claimed.providerEligible
            ? {
                mode: "provider_with_fallback",
                prepared,
                provider: stableDependencies.provider,
                runner,
              }
            : { mode: "fallback_only", prepared },
        );
        if (generated.metadata.result !== generated.status) return invalidConfiguration();
        if (
          generated.status === "failed" &&
          ((generated.metadata.failureCode !== "configuration" &&
            generated.metadata.failureCode !== "invalid_request" &&
            generated.metadata.failureCode !== "unknown") ||
            generated.metadata.attemptCount < 1 ||
            generated.metadata.retryReason !== null ||
            generated.metadata.tokenStatus !== "unavailable" ||
            generated.metadata.costStatus !== "unavailable" ||
            generated.metadata.inputTokens !== null ||
            generated.metadata.outputTokens !== null ||
            generated.metadata.totalTokens !== null ||
            generated.metadata.estimatedCostMicros !== null ||
            generated.metadata.currencyCode !== null)
        ) {
          return invalidConfiguration();
        }
        if (
          generated.status === "fallback" &&
          !isDurableFallbackFailureCode(generated.metadata.failureCode)
        ) {
          return invalidConfiguration();
        }
        const operational = operationalForPersistence(generated.metadata);
        const completion: InterpretationGenerationCompletionV1 =
          generated.status === "fallback"
            ? Object.freeze({
                operational,
                output: generated.output,
                status: "fallback" as const,
              })
            : generated.status === "failed"
              ? Object.freeze({ operational, status: "failed" as const })
              : Object.freeze({
                  operational,
                  status: "pending_verification" as const,
                });
        const finalized = await stableDependencies.persistence.finalize({
          claimToken: claimed.claimToken,
          claimVersion: claimed.claimVersion,
          completion,
          completionDigest: digest.completion({
            completion,
            interpretationId: claimed.interpretationId,
            schemaVersion: interpretationGenerationDigestSchemaVersion,
          }),
          interpretationId: claimed.interpretationId,
          token: request.sessionToken,
        });
        if (finalized.kind === "replayed") {
          return projectPersisted(finalized.interpretation, request, provenance);
        }
        if (
          finalized.interpretation.id !== claimed.interpretationId ||
          finalized.interpretation.status !== generated.status
        ) {
          return invalidConfiguration();
        }
        return Object.freeze({
          ...generated,
          interpretationId: claimed.interpretationId,
          kind: "finalized" as const,
        });
      } catch (error) {
        throw mapPersistenceError(error);
      }
    },
  });
};
