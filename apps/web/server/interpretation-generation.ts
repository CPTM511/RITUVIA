import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  executePreparedTarotInterpretationGenerationV1,
  parseTarotInterpretationOutputForInputV1,
  prepareTarotInterpretationGenerationV1,
  prepareTarotInterpretationVerifierV1,
  tarotGenerationOperationalMetadataSchemaVersion,
  verifyTarotInterpretationCandidateV1,
  type ApprovedTarotFallbackTemplateV1,
  type ApprovedTarotVerificationPolicyV1,
  type ApprovedTarotVerificationRuntimeV1,
  type GenerationDeadlineRunnerV1,
  type GenerationDeadlineRunInputV1,
  type GenerationDeadlineRunResultV1,
  type PreGenerationSafetyContinuationContextV1,
  type PreparedTarotInterpretationGenerationV1,
  type PreparedTarotInterpretationVerifierV1,
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
  type TarotInterpretationVerificationResultV1,
  type TarotPromptAssemblyV1,
  type TarotSemanticReviewerExecutionContextV1,
  type TarotSemanticReviewerV1,
  type TarotVerificationCandidateAuthorityVerifierV1,
  type TarotVerificationDeadlineRunInputV1,
  type TarotVerificationDeadlineRunResultV1,
  type TarotVerificationDeadlineRunnerV1,
  type TarotVerificationOperationalMetadataV1,
  type TarotVerificationProvenanceV1,
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

const verificationDigest = (key: Buffer, canonical: string): string =>
  `hmac-sha256:${createHmac("sha256", key)
    .update("rituvia.ai.verification.v1", "utf8")
    .update("\0", "utf8")
    // The AI-owned canonical bytes include the exact candidate/output digestScope.
    // Web treats them as opaque bytes so an untrusted field cannot select a domain.
    .update(canonical, "utf8")
    .digest("hex")}`;

const verifyVerificationDigest = (key: Buffer, canonical: string, digest: string): boolean => {
  if (typeof canonical !== "string" || !/^hmac-sha256:[0-9a-f]{64}$/u.test(digest)) return false;
  const expected = Buffer.from(
    verificationDigest(key, canonical).slice("hmac-sha256:".length),
    "hex",
  );
  const received = Buffer.from(digest.slice("hmac-sha256:".length), "hex");
  return expected.byteLength === received.byteLength && timingSafeEqual(expected, received);
};

const equalCompletionDigest = (expected: string, received: string): boolean => {
  if (!/^sha256:[0-9a-f]{64}$/u.test(expected) || !/^sha256:[0-9a-f]{64}$/u.test(received)) {
    return false;
  }
  const expectedBytes = Buffer.from(expected.slice("sha256:".length), "hex");
  const receivedBytes = Buffer.from(received.slice("sha256:".length), "hex");
  return (
    expectedBytes.byteLength === receivedBytes.byteLength &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
};

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

export const createWebTarotVerificationDeadlineRunnerV1 = (): TarotVerificationDeadlineRunnerV1 =>
  Object.freeze({
    run: async <Value>({
      operation,
      timeoutMs,
    }: TarotVerificationDeadlineRunInputV1<Value>): Promise<
      TarotVerificationDeadlineRunResultV1<Value>
    > => {
      if (
        typeof operation !== "function" ||
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 100 ||
        timeoutMs > 30_000
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
        // Keep the reviewer context descriptor-safe: cancellation is observed
        // through subscribe(), while this immutable snapshot remains data-only.
        aborted: false,
        subscribe(listener: () => void): () => void {
          if (typeof listener !== "function") return invalidConfiguration();
          const safeListener = (): void => {
            try {
              listener();
            } catch {
              // A reviewer cancellation hook cannot weaken the host deadline.
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

      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (completed) return;
          completed = true;
          controller.abort();
          clearListeners();
          resolve(
            Object.freeze({
              cancellationAcknowledged: false,
              elapsedMs: elapsedMilliseconds(startedAt),
              status: "timeout" as const,
            }),
          );
        }, timeoutMs);

        const context = Object.freeze({
          attemptId: randomUUID(),
          cancellation,
        }) satisfies TarotSemanticReviewerExecutionContextV1;
        const pending = Promise.resolve().then(() => operation(context));
        // Both branches stay attached after timeout, consuming any late settlement.
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
    verification(canonical: string): string {
      if (typeof canonical !== "string" || Buffer.byteLength(canonical, "utf8") > 262_144) {
        return invalidConfiguration();
      }
      return verificationDigest(parsed.key, canonical);
    },
    verifyVerification(canonical: string, candidate: string): boolean {
      return verifyVerificationDigest(parsed.key, canonical, candidate);
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

type WebTarotInterpretationVerificationProjectionV1 = Readonly<{
  displayable: true;
  metadata: TarotVerificationOperationalMetadataV1;
  output: TarotInterpretationOutputV1;
  provenance: TarotVerificationProvenanceV1;
  schemaVersion: TarotInterpretationVerificationResultV1["schemaVersion"];
  status: TarotInterpretationVerificationResultV1["status"];
}>;

export type WebInterpretationGenerationResultV1 =
  | Readonly<{
      displayable: false;
      interpretationId: string;
      kind: "in_progress";
      leaseExpiresAt: string;
      status: "in_progress";
    }>
  | (Extract<TarotInterpretationGenerationResultV1, { status: "failed" | "fallback" }> &
      Readonly<{
        interpretationId: string;
        kind: "finalized";
      }>)
  | (WebTarotInterpretationVerificationProjectionV1 &
      Readonly<{
        interpretationId: string;
        kind: "finalized";
      }>)
  | (WebTarotInterpretationVerificationProjectionV1 &
      Readonly<{
        interpretationId: string;
        kind: "replayed";
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
  authorizeCandidate: TarotVerificationCandidateAuthorityVerifierV1;
  authorizeRuntime: TarotGenerationAuthorityVerifierV1;
  digestKey: InterpretationGenerationDigestKeyV1;
  fallbackTemplate: ApprovedTarotFallbackTemplateV1;
  persistence: Pick<InterpretationGenerationPersistence, "claim" | "finalize">;
  provider: StructuredGenerationProviderV1;
  runtime: TarotGenerationRuntimeRegistrationV1;
  verificationPolicy: ApprovedTarotVerificationPolicyV1;
  verificationReviewer: TarotSemanticReviewerV1;
  verificationRuntime: ApprovedTarotVerificationRuntimeV1;
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
  verificationTimeoutMs: number,
): InterpretationGenerationClaimProvenanceV1 => {
  const { fallbackTemplate, prompt, request, runtime } = prepared.provenance;
  if (
    request.locale !== "en" ||
    prompt.locale !== "en" ||
    !Number.isSafeInteger(verificationTimeoutMs) ||
    verificationTimeoutMs < 100 ||
    verificationTimeoutMs > 30_000
  ) {
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
    verificationTimeoutMs,
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

const verificationTrustFailureForPersistence = (
  metadata: TarotGenerationOperationalMetadataV1,
): InterpretationGenerationOperationalMetadataV1 => {
  if (metadata.attemptCount !== 1 && metadata.attemptCount !== 2) return invalidConfiguration();
  return Object.freeze({
    attemptCount: metadata.attemptCount,
    costStatus: "unavailable" as const,
    currencyCode: null,
    estimatedCostMicros: null,
    failureCode: "unknown" as const,
    inputTokens: null,
    latencyMs: metadata.latencyMs,
    outputTokens: null,
    retryReason: null,
    tokenStatus: "unavailable" as const,
    totalTokens: null,
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

const projectPersistedVerification = (
  interpretation: Extract<PersistedInterpretationGeneration, { status: "pending_verification" }>,
  request: WebInterpretationGenerationRequestV1,
  verifier: PreparedTarotInterpretationVerifierV1,
  completionDigest: (value: CanonicalJson) => string,
  verifyOutputDigest: (canonical: string, digest: string) => boolean,
): WebTarotInterpretationVerificationProjectionV1 | null => {
  const verification = interpretation.verification;
  if (verification == null) return null;
  if (
    verification.interpretationId !== interpretation.id ||
    verification.subjectId !== interpretation.subjectId ||
    verification.expiresAt !== interpretation.expiresAt
  ) {
    throw new WebInterpretationGenerationError("unavailable");
  }
  const persistedCompletion = Object.freeze({
    operational: interpretation.operational,
    status: "pending_verification" as const,
    verification: Object.freeze({
      displayable: verification.displayable,
      metadata: verification.metadata,
      output: verification.output,
      provenance: verification.provenance,
      schemaVersion: verification.schemaVersion,
      status: verification.status,
    }),
  }) satisfies InterpretationGenerationCompletionV1;
  const expectedFinalizationDigest = completionDigest({
    completion: persistedCompletion,
    interpretationId: interpretation.id,
    schemaVersion: interpretationGenerationDigestSchemaVersion,
  });
  if (!equalCompletionDigest(expectedFinalizationDigest, verification.finalizationDigest)) {
    throw new WebInterpretationGenerationError("unavailable");
  }
  const candidateBindingValid =
    verification.provenance.candidateDigestScope ===
      "canonical-tarot-verification-candidate-json.v1" &&
    typeof verification.provenance.candidateDigest === "string" &&
    /^hmac-sha256:[0-9a-f]{64}$/u.test(verification.provenance.candidateDigest);
  if (
    !candidateBindingValid ||
    verification.displayable !== true ||
    verification.schemaVersion !== "tarot-interpretation-verification-result.v1" ||
    (verification.status !== "verified" && verification.status !== "safe_replacement") ||
    verification.metadata.outcome !== verification.status ||
    verification.metadata.deterministicChecksVersion !== "tarot-post-generation-checks.v1" ||
    verification.metadata.schemaVersion !== "tarot-verification-operational-metadata.v1" ||
    verification.metadata.policyVersion !== verifier.policy.version ||
    verification.metadata.runtimeVersion !== verifier.runtime.version ||
    verification.metadata.reviewerVersion !== verifier.reviewer.version ||
    verification.metadata.reviewerPolicyVersion !== verifier.reviewerPolicy.version ||
    verification.metadata.reviewerProviderVersion !== verifier.reviewerProvider.version ||
    verification.metadata.reviewerModelVersion !== verifier.reviewerModel.version ||
    verification.provenance.schemaVersion !== "tarot-verification-provenance.v1" ||
    verification.provenance.deterministicChecksVersion !== "tarot-post-generation-checks.v1" ||
    verification.provenance.outputDigestScope !== "canonical-tarot-verification-output-json.v1" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(verification.provenance.outputDigest) ||
    canonicalJson(verification.provenance.policy) !== canonicalJson(verifier.policy) ||
    canonicalJson(verification.provenance.runtime) !== canonicalJson(verifier.runtime) ||
    canonicalJson(verification.provenance.reviewer) !== canonicalJson(verifier.reviewer) ||
    canonicalJson(verification.provenance.reviewerPolicy) !==
      canonicalJson(verifier.reviewerPolicy) ||
    canonicalJson(verification.provenance.reviewerProvider) !==
      canonicalJson(verifier.reviewerProvider) ||
    canonicalJson(verification.provenance.reviewerModel) !==
      canonicalJson(verifier.reviewerModel) ||
    verification.provenance.verificationTimeoutMs !==
      interpretation.provenance.verificationTimeoutMs
  ) {
    throw new WebInterpretationGenerationError("unavailable");
  }
  const output = parseTarotInterpretationOutputForInputV1(
    request.input,
    JSON.stringify(verification.output),
  );
  if (
    !verifyOutputDigest(
      JSON.stringify({
        digestScope: "canonical-tarot-verification-output-json.v1",
        output,
      }),
      verification.provenance.outputDigest,
    )
  ) {
    throw new WebInterpretationGenerationError("unavailable");
  }
  return Object.freeze({
    displayable: true,
    metadata: Object.freeze({ ...verification.metadata }),
    output,
    provenance: Object.freeze({
      ...verification.provenance,
      policy: Object.freeze({ ...verification.provenance.policy }),
      reviewer: Object.freeze({ ...verification.provenance.reviewer }),
      reviewerModel: Object.freeze({ ...verification.provenance.reviewerModel }),
      reviewerPolicy: Object.freeze({ ...verification.provenance.reviewerPolicy }),
      reviewerProvider: Object.freeze({ ...verification.provenance.reviewerProvider }),
      runtime: Object.freeze({ ...verification.provenance.runtime }),
    }),
    schemaVersion: verification.schemaVersion,
    status: verification.status,
  });
};

const projectPersisted = (
  interpretation: PersistedInterpretationGeneration,
  request: WebInterpretationGenerationRequestV1,
  expectedProvenance: InterpretationGenerationClaimProvenanceV1,
  verifier: PreparedTarotInterpretationVerifierV1,
  completionDigest: (value: CanonicalJson) => string,
  verifyOutputDigest: (canonical: string, digest: string) => boolean,
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
    const verified = projectPersistedVerification(
      interpretation,
      request,
      verifier,
      completionDigest,
      verifyOutputDigest,
    );
    if (verified !== null) {
      return Object.freeze({
        ...verified,
        interpretationId: interpretation.id,
        kind: "replayed" as const,
      });
    }
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
      case "INTERPRETATION_VERIFICATION_CONFLICT":
        return new WebInterpretationGenerationError("conflict");
      case "INTERPRETATION_GENERATION_READING_NOT_FOUND":
        return new WebInterpretationGenerationError("not_found");
      case "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE":
        return new WebInterpretationGenerationError("session_required");
      case "INTERPRETATION_GENERATION_CLAIM_LOST":
      case "INTERPRETATION_GENERATION_INPUT_INVALID":
      case "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE":
      case "INTERPRETATION_VERIFICATION_UNAVAILABLE":
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
    typeof dependencies.authorizeCandidate !== "function" ||
    typeof dependencies.authorizeRuntime !== "function" ||
    typeof dependencies.provider !== "object" ||
    dependencies.provider === null ||
    typeof dependencies.provider.generateStructured !== "function" ||
    typeof dependencies.persistence !== "object" ||
    dependencies.persistence === null ||
    typeof dependencies.persistence.claim !== "function" ||
    typeof dependencies.persistence.finalize !== "function" ||
    typeof dependencies.verificationPolicy !== "object" ||
    dependencies.verificationPolicy === null ||
    typeof dependencies.verificationRuntime !== "object" ||
    dependencies.verificationRuntime === null ||
    typeof dependencies.verificationRuntime.reviewerTimeoutMs !== "number" ||
    typeof dependencies.verificationReviewer !== "object" ||
    dependencies.verificationReviewer === null ||
    typeof dependencies.verificationReviewer.review !== "function"
  ) {
    return invalidConfiguration();
  }
  const digest = createDigestFactory(dependencies.digestKey);
  const runner = createWebGenerationDeadlineRunnerV1();
  const verificationRunner = createWebTarotVerificationDeadlineRunnerV1();
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
        // Static verification policy/runtime/reviewer trust must fail before a claim
        // exists and before any generation provider capability can execute.
        const verifier = prepareTarotInterpretationVerifierV1({
          digest: digest.verification,
          generationProvider: stableDependencies.runtime.provider,
          policy: stableDependencies.verificationPolicy,
          reviewer: stableDependencies.verificationReviewer,
          runner: verificationRunner,
          runtime: stableDependencies.verificationRuntime,
          verifyDigest: digest.verifyVerification,
        });
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
        const provenance = createClaimProvenance(
          prepared,
          stableDependencies.verificationRuntime.reviewerTimeoutMs,
        );
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
          verifier,
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
          return projectPersisted(
            claimed.interpretation,
            request,
            provenance,
            verifier,
            digest.completion,
            digest.verifyVerification,
          );
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
        let verification: TarotInterpretationVerificationResultV1 | undefined;
        if (generated.status === "pending_verification") {
          try {
            verification = await verifyTarotInterpretationCandidateV1({
              authorizeCandidate: stableDependencies.authorizeCandidate,
              candidate: generated,
              verifier,
            });
          } catch {
            // Candidate authorization, binding, or digest ambiguity is not an
            // eligible content fallback. Seal a no-output terminal failure so a
            // reclaimed lease cannot later disguise it as a safe replacement.
            const failedCompletion = Object.freeze({
              operational: verificationTrustFailureForPersistence(generated.metadata),
              status: "failed" as const,
            }) satisfies InterpretationGenerationCompletionV1;
            await stableDependencies.persistence.finalize({
              claimToken: claimed.claimToken,
              claimVersion: claimed.claimVersion,
              completion: failedCompletion,
              completionDigest: digest.completion({
                completion: failedCompletion,
                interpretationId: claimed.interpretationId,
                schemaVersion: interpretationGenerationDigestSchemaVersion,
              }),
              interpretationId: claimed.interpretationId,
              token: request.sessionToken,
            });
            throw new WebInterpretationGenerationError("unavailable");
          }
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
                  verification:
                    verification ??
                    // This branch is unreachable unless the AI result union or
                    // verifier contract drifted underneath Web composition.
                    invalidConfiguration(),
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
          return projectPersisted(
            finalized.interpretation,
            request,
            provenance,
            verifier,
            digest.completion,
            digest.verifyVerification,
          );
        }
        if (
          finalized.interpretation.id !== claimed.interpretationId ||
          finalized.interpretation.status !== generated.status
        ) {
          return invalidConfiguration();
        }
        if (generated.status === "pending_verification") {
          if (finalized.interpretation.status !== "pending_verification") {
            return invalidConfiguration();
          }
          const projected = projectPersistedVerification(
            finalized.interpretation,
            request,
            verifier,
            digest.completion,
            digest.verifyVerification,
          );
          if (projected === null) return invalidConfiguration();
          return Object.freeze({
            ...projected,
            interpretationId: claimed.interpretationId,
            kind: "finalized" as const,
          });
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
