import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import {
  tarotDrawAlgorithmVersion,
  tarotDrawEngineName,
  tarotDrawEngineVersion,
  tarotDrawRulesVersion,
  type TarotCSPRNG,
  type TarotDrawExecutionV1,
  type TarotDrawFactsV1,
  type TarotExecutionVerifierV1,
} from "@rituvia/divination";
import type { TarotReadingCreateRequestV1 } from "@rituvia/domain";

export const tarotReadingIntegritySchemeVersion = "hmac-sha256.tarot-reading.v1" as const;
export const tarotReadingIntegrityPayloadVersion = "tarot-reading-integrity-payload.v1" as const;

const keyVersionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const digestPattern = /^sha256:([0-9a-f]{64})$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;

export type TarotReadingIntegrityKeyInput = Readonly<{
  encodedKey: string;
  version: string;
}>;

export type TarotReadingIntegrityKeyringInput = Readonly<{
  activeVersion: string;
  keys: readonly TarotReadingIntegrityKeyInput[];
}>;

export type TarotReadingIntegrityBinding = Readonly<{
  catalogApprovalReference: string;
  catalogChecksum: string;
  clientRequestDigest: string;
  idempotencyKeyDigest: string;
  integrityKeyVersion: string;
  locale: "en";
  readingId: string;
  readingPolicyVersion: string;
  readingType: "one_card" | "three_card";
  requestDigest: string;
  subjectId: string;
  themeCode: TarotReadingCreateRequestV1["themeCode"];
}>;

type KeyRecord = Readonly<{ key: Buffer; version: string }>;

export type TarotV1EntropyCounts = Readonly<{
  bytesConsumed: number;
  rejectedSamples: number;
}>;

const invalid = (): never => {
  throw new TypeError("Tarot reading integrity configuration is invalid.");
};

const parseKey = (input: TarotReadingIntegrityKeyInput): KeyRecord => {
  if (
    typeof input !== "object" ||
    input === null ||
    !keyVersionPattern.test(input.version) ||
    typeof input.encodedKey !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(input.encodedKey)
  ) {
    return invalid();
  }
  const key = Buffer.from(input.encodedKey, "base64url");
  if (key.byteLength !== 32 || key.toString("base64url") !== input.encodedKey) return invalid();
  return Object.freeze({ key: Buffer.from(key), version: input.version });
};

const digestBytes = (value: string): Buffer | null => {
  const match = digestPattern.exec(value);
  return match?.[1] === undefined ? null : Buffer.from(match[1], "hex");
};

const equalDigest = (left: string, right: string): boolean => {
  const leftBytes = digestBytes(left);
  const rightBytes = digestBytes(right);
  return (
    leftBytes !== null &&
    rightBytes !== null &&
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

export const tarotReadingDigestsEqual = (left: string, right: string): boolean =>
  equalDigest(left, right);

export const createTarotReadingId = (): string => randomUUID();

const hmac = (key: Buffer, domain: string, payload: string): string =>
  `sha256:${createHmac("sha256", key).update(domain, "utf8").update("\0").update(payload, "utf8").digest("hex")}`;

export const tarotReadingDigestToBytes = (value: string): Uint8Array => {
  const bytes = digestBytes(value);
  if (bytes === null) return invalid();
  return Uint8Array.from(bytes);
};

export const createTarotCatalogChecksum = (canonicalCatalogJson: string): string =>
  `sha256:${createHash("sha256").update(canonicalCatalogJson, "utf8").digest("hex")}`;

export const deriveTarotV1EntropyCounts = (
  facts: TarotDrawFactsV1,
  deckCardCount: number,
  bytesConsumed: number,
): TarotV1EntropyCounts => {
  if (
    facts.engineName !== tarotDrawEngineName ||
    facts.engineVersion !== tarotDrawEngineVersion ||
    facts.algorithmVersion !== tarotDrawAlgorithmVersion ||
    facts.rulesVersion !== tarotDrawRulesVersion ||
    !Number.isSafeInteger(deckCardCount) ||
    deckCardCount < facts.positions.length ||
    deckCardCount > 200 ||
    !Number.isSafeInteger(bytesConsumed) ||
    bytesConsumed < 0
  ) {
    return invalid();
  }
  const drawCount = facts.positions.length;
  const acceptedSelectionSamples = Math.min(drawCount, deckCardCount - 1);
  const acceptedOrientationSamples =
    facts.orientationPolicy === "upright_and_reversed" ? drawCount : 0;
  const rejectedSamples = bytesConsumed - acceptedSelectionSamples - acceptedOrientationSamples;
  let rejectionEligibleSamples = 0;
  for (let index = 0; index < drawCount; index += 1) {
    const bound = deckCardCount - index;
    if (bound > 1 && 256 % bound !== 0) rejectionEligibleSamples += 1;
  }
  if (rejectedSamples < 0 || rejectedSamples > rejectionEligibleSamples * 255) return invalid();
  return Object.freeze({ bytesConsumed, rejectedSamples });
};

const bindingPayload = (binding: TarotReadingIntegrityBinding): object => ({
  catalogApprovalReference: binding.catalogApprovalReference,
  catalogChecksum: binding.catalogChecksum,
  clientRequestDigest: binding.clientRequestDigest,
  idempotencyKeyDigest: binding.idempotencyKeyDigest,
  integrityKeyVersion: binding.integrityKeyVersion,
  locale: binding.locale,
  readingId: binding.readingId,
  readingPolicyVersion: binding.readingPolicyVersion,
  readingType: binding.readingType,
  requestDigest: binding.requestDigest,
  subjectId: binding.subjectId,
  themeCode: binding.themeCode,
});

const commitmentPayload = (
  binding: TarotReadingIntegrityBinding,
  facts: TarotDrawFactsV1,
  counts: TarotV1EntropyCounts,
): string =>
  JSON.stringify({
    binding: bindingPayload(binding),
    execution: {
      audit: {
        entropy: counts,
        idempotencyKeyDigest: binding.idempotencyKeyDigest,
        requestDigest: binding.requestDigest,
      },
      facts,
    },
    integritySchemeVersion: tarotReadingIntegritySchemeVersion,
    schemaVersion: tarotReadingIntegrityPayloadVersion,
  });

export const createTarotReadingCryptography = (input: TarotReadingIntegrityKeyringInput) => {
  if (
    typeof input !== "object" ||
    input === null ||
    !Array.isArray(input.keys) ||
    input.keys.length < 1 ||
    input.keys.length > 16 ||
    !keyVersionPattern.test(input.activeVersion)
  ) {
    return invalid();
  }
  const keys = Object.freeze(input.keys.map(parseKey));
  const byVersion = new Map(keys.map((entry) => [entry.version, entry]));
  if (byVersion.size !== keys.length || !byVersion.has(input.activeVersion)) return invalid();

  const requireKey = (version: string): KeyRecord => byVersion.get(version) ?? invalid();
  const deriveIdempotencyKeyDigest = (
    version: string,
    subjectId: string,
    idempotencyKey: string,
  ): string => {
    if (!idPattern.test(subjectId) || !idempotencyKeyPattern.test(idempotencyKey)) return invalid();
    return hmac(
      requireKey(version).key,
      "rituvia.tarot-reading.idempotency.v1",
      JSON.stringify({ operation: "reading.tarot.create.v1", subjectId, idempotencyKey }),
    );
  };
  const deriveClientRequestDigest = (
    version: string,
    subjectId: string,
    request: TarotReadingCreateRequestV1,
  ): string => {
    if (!idPattern.test(subjectId)) return invalid();
    return hmac(
      requireKey(version).key,
      "rituvia.tarot-reading.client-request.v1",
      JSON.stringify({ operation: "reading.tarot.create.v1", request, subjectId }),
    );
  };
  const deriveRequestDigest = (
    version: string,
    inputBinding: Omit<
      TarotReadingIntegrityBinding,
      | "catalogApprovalReference"
      | "catalogChecksum"
      | "clientRequestDigest"
      | "idempotencyKeyDigest"
      | "integrityKeyVersion"
      | "requestDigest"
    > &
      Readonly<{
        catalog: Readonly<{
          approvalReference: string;
          checksum: string;
          id: string;
          version: string;
        }>;
        deck: Readonly<{ id: string; version: string }>;
        orientationPolicy: "upright_and_reversed" | "upright_only";
        spread: Readonly<{ id: string; version: string }>;
      }>,
  ): string =>
    hmac(
      requireKey(version).key,
      "rituvia.tarot-reading.draw-request.v1",
      JSON.stringify({
        algorithmVersion: tarotDrawAlgorithmVersion,
        catalog: {
          approvalReference: inputBinding.catalog.approvalReference,
          checksum: inputBinding.catalog.checksum,
          id: inputBinding.catalog.id,
          version: inputBinding.catalog.version,
        },
        deck: { id: inputBinding.deck.id, version: inputBinding.deck.version },
        engineName: tarotDrawEngineName,
        engineVersion: tarotDrawEngineVersion,
        locale: inputBinding.locale,
        orientationPolicy: inputBinding.orientationPolicy,
        readingId: inputBinding.readingId,
        readingPolicyVersion: inputBinding.readingPolicyVersion,
        readingType: inputBinding.readingType,
        rulesVersion: tarotDrawRulesVersion,
        spread: { id: inputBinding.spread.id, version: inputBinding.spread.version },
        subjectId: inputBinding.subjectId,
        themeCode: inputBinding.themeCode,
      }),
    );

  const createEntropy = (
    binding: TarotReadingIntegrityBinding,
    deckCardCount: number,
  ): TarotCSPRNG => {
    const key = requireKey(binding.integrityKeyVersion).key;
    let bytesConsumed = 0;
    return Object.freeze({
      auditCommitment: (facts: TarotDrawFactsV1): string => {
        const counts = deriveTarotV1EntropyCounts(facts, deckCardCount, bytesConsumed);
        return hmac(
          key,
          "rituvia.tarot-reading.execution.v1",
          commitmentPayload(binding, facts, counts),
        );
      },
      readBytes: (length: number): Uint8Array => {
        if (length !== 1) return invalid();
        bytesConsumed += length;
        return Uint8Array.from(randomBytes(length));
      },
    });
  };

  const createExecutionVerifier = (
    binding: TarotReadingIntegrityBinding,
    deckCardCount: number,
  ): TarotExecutionVerifierV1 => {
    const key = requireKey(binding.integrityKeyVersion).key;
    return (execution: TarotDrawExecutionV1): boolean => {
      try {
        if (
          execution.audit.idempotencyKeyDigest !== binding.idempotencyKeyDigest ||
          execution.audit.requestDigest !== binding.requestDigest
        ) {
          return false;
        }
        const counts = deriveTarotV1EntropyCounts(
          execution.facts,
          deckCardCount,
          execution.audit.entropy.bytesConsumed,
        );
        if (counts.rejectedSamples !== execution.audit.entropy.rejectedSamples) return false;
        const expected = hmac(
          key,
          "rituvia.tarot-reading.execution.v1",
          commitmentPayload(binding, execution.facts, counts),
        );
        return equalDigest(expected, execution.audit.entropy.commitment);
      } catch {
        return false;
      }
    };
  };

  return Object.freeze({
    activeVersion: input.activeVersion,
    createEntropy,
    createExecutionVerifier,
    deriveClientRequestDigest,
    deriveIdempotencyKeyDigest,
    deriveRequestDigest,
    keyVersions: Object.freeze(keys.map(({ version }) => version)),
  });
};
