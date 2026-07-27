import "server-only";

import { createHash } from "node:crypto";

import {
  numerologyInterpretationContentSchemaVersion,
  numerologyInterpretationFallbackSchemaVersion,
  numerologyInterpretationPromptSchemaVersion,
  numerologyInterpretationTradition,
  type ApprovedNumerologyInterpretationContentV1,
  type ApprovedNumerologyInterpretationFallbackV1,
  type ApprovedNumerologyInterpretationPromptV1,
} from "@rituvia/ai";

import {
  numerologyPublicationCatalog,
  projectNumerologyInterpretationEntriesV1,
} from "./numerology-publication";

const approvalReference = "OWN-012:option-a:2026-07-25" as const;

const checksumFor = (value: unknown): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;

export const projectApprovedNumerologyInterpretationArtifactsV1 = (): Readonly<{
  content: ApprovedNumerologyInterpretationContentV1;
  fallback: ApprovedNumerologyInterpretationFallbackV1;
  prompt: ApprovedNumerologyInterpretationPromptV1;
}> => {
  const policy = numerologyPublicationCatalog.interpretationPolicy;
  const contentCanonical = Object.freeze({
    approvalReference,
    contentId: policy.contentId,
    entries: projectNumerologyInterpretationEntriesV1(),
    locale: "en" as const,
    schemaVersion: numerologyInterpretationContentSchemaVersion,
    sourceRefs: Object.freeze(
      numerologyPublicationCatalog.sources.map(({ sourceId }) => sourceId).sort(),
    ),
    tradition: numerologyInterpretationTradition,
    version: numerologyPublicationCatalog.version,
  });
  const promptCanonical = Object.freeze({
    approvalReference,
    instructions: policy.prompt.instructions,
    locale: "en" as const,
    promptId: policy.prompt.promptId,
    schemaVersion: numerologyInterpretationPromptSchemaVersion,
    tradition: numerologyInterpretationTradition,
    version: policy.prompt.version,
  });
  const fallbackCanonical = Object.freeze({
    alternativePerspective: policy.fallback.alternativePerspective,
    approvalReference,
    boundaryNote: policy.fallback.boundaryNote,
    fallbackId: policy.fallback.fallbackId,
    locale: "en" as const,
    schemaVersion: numerologyInterpretationFallbackSchemaVersion,
    smallActionRationale: policy.fallback.smallActionRationale,
    summary: policy.fallback.summary,
    title: policy.fallback.title,
    tradition: numerologyInterpretationTradition,
    version: policy.fallback.version,
  });
  return Object.freeze({
    content: Object.freeze({
      ...contentCanonical,
      checksum: checksumFor(contentCanonical),
    }),
    fallback: Object.freeze({
      ...fallbackCanonical,
      checksum: checksumFor(fallbackCanonical),
    }),
    prompt: Object.freeze({
      ...promptCanonical,
      checksum: checksumFor(promptCanonical),
    }),
  });
};
