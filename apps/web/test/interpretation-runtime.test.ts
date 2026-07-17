import type {
  TarotGenerationOperationalMetadataV1,
  TarotInterpretationOutputV1,
  TarotVerificationOperationalMetadataV1,
  TarotVerificationProvenanceV1,
} from "@rituvia/ai";
import { describe, expect, it } from "vitest";

import { tarotInterpretationResponseSchemaVersion } from "../app/_contracts/tarot-interpretation-response";
import type { WebInterpretationGenerationResultV1 } from "../server/interpretation-generation";
import {
  getWebTarotInterpretation,
  projectWebInterpretationGenerationResult,
  startWebTarotInterpretation,
} from "../server/interpretation-runtime";

const readingId = "33333333-3333-4333-8333-333333333333";
const interpretationId = "44444444-4444-4444-8444-444444444444";

const internalOutput = Object.freeze({
  boundaryNote: "This is a reflective possibility, not a prediction.",
  perspectives: Object.freeze(["Notice what feels useful right now."]),
  reflectionQuestions: Object.freeze(["What small choice remains yours?"]),
  ritualSuggestion: Object.freeze({
    approvedTemplateCode: "free_candle",
    reason: "A quiet pause can support reflection.",
  }),
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
  sourceRefs: Object.freeze(["source:private"]),
  summary: "A bounded synthetic interpretation.",
  symbols: Object.freeze([
    Object.freeze({
      factRef: "tarot.position.focus",
      limitation: "Keep the symbol open to your own context.",
      meaning: "A grounded meaning.",
      possibility: "You might pause before choosing.",
    }),
  ]),
  title: "A reflective pause",
}) satisfies TarotInterpretationOutputV1;

const publicOutput = Object.freeze({
  boundaryNote: internalOutput.boundaryNote,
  perspectives: internalOutput.perspectives,
  reflectionQuestions: internalOutput.reflectionQuestions,
  ritualSuggestion: Object.freeze({ reason: internalOutput.ritualSuggestion.reason }),
  smallAction: internalOutput.smallAction,
  summary: internalOutput.summary,
  symbols: Object.freeze([
    Object.freeze({
      limitation: internalOutput.symbols[0]?.limitation,
      meaning: internalOutput.symbols[0]?.meaning,
      possibility: internalOutput.symbols[0]?.possibility,
    }),
  ]),
  title: internalOutput.title,
});

const generationMetadata = (
  status: "failed" | "fallback" | "pending_verification",
): TarotGenerationOperationalMetadataV1 =>
  Object.freeze({
    attemptCount: status === "fallback" ? 0 : 1,
    contentVersions: Object.freeze(["1.0.0"]),
    costStatus: "unavailable",
    currencyCode: null,
    estimatedCostMicros: null,
    failureCode:
      status === "pending_verification"
        ? null
        : status === "fallback"
          ? "timeout"
          : "configuration",
    fallbackTemplateVersion: "1.0.0",
    inputTokens: null,
    latencyMs: 1,
    locale: "en",
    modality: "tarot",
    modelId: "private_model",
    modelVersion: "1.0.0",
    outputSchemaVersion: "1",
    outputTokens: null,
    promptId: "private_prompt",
    promptVersion: "1.0.0",
    providerId: "private_provider",
    providerVersion: "1.0.0",
    readingType: "one_card",
    result: status,
    retryReason: null,
    safetyPolicyVersion: "private_safety_policy",
    schemaVersion: "tarot-generation-operational-metadata.v1",
    themeCode: "open_reflection",
    tokenStatus: "unavailable",
    totalTokens: null,
  });

const verificationMetadata = (
  status: "safe_replacement" | "verified",
): TarotVerificationOperationalMetadataV1 =>
  Object.freeze({
    deterministicChecksVersion: "tarot-post-generation-checks.v1",
    outcome: status,
    policyVersion: "1.0.0",
    reviewerModelVersion: "1.0.0",
    reviewerPolicyVersion: "1.0.0",
    reviewerProviderVersion: "1.0.0",
    reviewerVersion: "1.0.0",
    runtimeVersion: "1.0.0",
    schemaVersion: "tarot-verification-operational-metadata.v1",
  });

const verificationReference = Object.freeze({
  approvalReference: "private:approval",
  checksum: `sha256:${"a".repeat(64)}`,
  id: "private_reference",
  version: "1.0.0",
});

const verificationProvenance = Object.freeze({
  candidateDigest: `hmac-sha256:${"b".repeat(64)}`,
  candidateDigestScope: "canonical-tarot-verification-candidate-json.v1",
  deterministicChecksVersion: "tarot-post-generation-checks.v1",
  outputDigest: `hmac-sha256:${"c".repeat(64)}`,
  outputDigestScope: "canonical-tarot-verification-output-json.v1",
  policy: verificationReference,
  reviewer: verificationReference,
  reviewerModel: Object.freeze({ id: "private_reviewer_model", version: "1.0.0" }),
  reviewerPolicy: verificationReference,
  reviewerProvider: Object.freeze({ id: "private_reviewer_provider", version: "1.0.0" }),
  runtime: verificationReference,
  schemaVersion: "tarot-verification-provenance.v1",
  verificationTimeoutMs: 1_000,
}) satisfies TarotVerificationProvenanceV1;

const processingResult = Object.freeze({
  displayable: false,
  interpretationId,
  kind: "in_progress",
  leaseExpiresAt: "2026-07-18T00:00:30.000Z",
  status: "in_progress",
}) satisfies WebInterpretationGenerationResultV1;

const failedResult = Object.freeze({
  displayable: false,
  interpretationId,
  kind: "finalized",
  metadata: generationMetadata("failed"),
  status: "failed",
}) satisfies WebInterpretationGenerationResultV1;

const pendingResult = Object.freeze({
  displayable: false,
  interpretationId,
  kind: "replayed",
  metadata: generationMetadata("pending_verification"),
  status: "pending_verification",
}) satisfies WebInterpretationGenerationResultV1;

const fallbackResult = Object.freeze({
  displayable: true,
  interpretationId,
  kind: "finalized",
  metadata: generationMetadata("fallback"),
  output: internalOutput,
  status: "fallback",
}) satisfies WebInterpretationGenerationResultV1;

const verifiedResult = Object.freeze({
  displayable: true,
  interpretationId,
  kind: "finalized",
  metadata: verificationMetadata("verified"),
  output: internalOutput,
  provenance: verificationProvenance,
  schemaVersion: "tarot-interpretation-verification-result.v1",
  status: "verified",
}) satisfies WebInterpretationGenerationResultV1;

const safeReplacementResult = Object.freeze({
  displayable: true,
  interpretationId,
  kind: "replayed",
  metadata: verificationMetadata("safe_replacement"),
  output: internalOutput,
  provenance: verificationProvenance,
  schemaVersion: "tarot-interpretation-verification-result.v1",
  status: "safe_replacement",
}) satisfies WebInterpretationGenerationResultV1;

describe("tarot interpretation runtime projection", () => {
  it("projects a verified result to the exact public output", () => {
    expect(projectWebInterpretationGenerationResult(readingId, verifiedResult)).toEqual({
      displayable: true,
      output: publicOutput,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "verified",
    });
  });

  it.each([
    ["authorized generation fallback", fallbackResult],
    ["post-verification safe replacement", safeReplacementResult],
  ] as const)("projects %s as a reviewed fallback", (_label, result) => {
    expect(projectWebInterpretationGenerationResult(readingId, result)).toEqual({
      displayable: true,
      output: publicOutput,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "reviewed_fallback",
    });
  });

  it("keeps in-progress work non-displayable and supplies one bounded poll interval", () => {
    expect(projectWebInterpretationGenerationResult(readingId, processingResult)).toEqual({
      displayable: false,
      pollAfterMs: 1_500,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "processing",
    });
  });

  it.each([
    ["terminal generation failure", failedResult],
    ["historical pending verification", pendingResult],
  ] as const)("keeps %s non-displayable", (_label, result) => {
    expect(projectWebInterpretationGenerationResult(readingId, result)).toEqual({
      displayable: false,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "failed",
    });
  });

  it("never serializes internal facts, sources, provider metadata, provenance, digests, or leases", () => {
    const serialized = JSON.stringify(
      [
        verifiedResult,
        safeReplacementResult,
        fallbackResult,
        processingResult,
        failedResult,
        pendingResult,
      ].map((result) => projectWebInterpretationGenerationResult(readingId, result)),
    );

    for (const privateName of [
      "factRef",
      "sourceRefs",
      "approvedTemplateCode",
      "provider",
      "provenance",
      "digest",
      "lease",
      "metadata",
      "interpretationId",
    ]) {
      expect(serialized).not.toContain(privateName);
    }
  });

  it("keeps direct start and polling composition safe-off", async () => {
    await expect(
      startWebTarotInterpretation(readingId, "abcdefghijklmnopqrstuv", "a".repeat(43)),
    ).rejects.toMatchObject({ code: "unavailable" });
    await expect(getWebTarotInterpretation(readingId, "a".repeat(43))).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
