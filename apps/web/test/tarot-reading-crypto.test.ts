import { readFile } from "node:fs/promises";

import type { TarotDrawExecutionV1 } from "@rituvia/divination";
import { resolveTarotDrawV1, tarotDrawRulesVersion } from "@rituvia/divination";
import type { TarotReadingReportRequest } from "@rituvia/domain";
import { describe, expect, it, vi } from "vitest";

const cryptoHarness = vi.hoisted(() => ({ bytes: [0] as number[], offset: 0 }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes: vi.fn((length: number) => {
      const value = cryptoHarness.bytes.at(cryptoHarness.offset);
      cryptoHarness.offset += 1;
      if (length !== 1 || value === undefined) throw new Error("fixed entropy exhausted");
      return Buffer.from([value]);
    }),
  };
});

import {
  createTarotReadingCryptography,
  deriveTarotV1EntropyCounts,
  tarotReadingDigestToBytes,
} from "../server/tarot-reading-crypto";

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

const catalog = JSON.parse(
  await readFile(
    new URL("../../../content/traditions/tarot/rituvia-placeholder.v1.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

const key = (byte: number): string => Buffer.alloc(32, byte).toString("base64url");
const keyring = Object.freeze({
  activeVersion: "test.key.v2",
  keys: Object.freeze([
    Object.freeze({ encodedKey: key(3), version: "test.key.v1" }),
    Object.freeze({ encodedKey: key(7), version: "test.key.v2" }),
  ]),
});
const subjectId = "11111111-1111-4111-8111-111111111111";
const readingId = "22222222-2222-4222-8222-222222222222";
const interpretationRequestId = "33333333-3333-4333-8333-333333333333";
const request = Object.freeze({
  locale: "en" as const,
  readingType: "one_card" as const,
  schemaVersion: "tarot-reading-create.v1" as const,
  themeCode: "open_reflection" as const,
});
const reportRequest = Object.freeze({
  category: "cultural" as const,
  schemaVersion: "tarot-reading-report.v1" as const,
  target: Object.freeze({ kind: "reading" as const }),
});

const createFixture = () => {
  cryptoHarness.bytes = [2, 1];
  cryptoHarness.offset = 0;
  const cryptography = createTarotReadingCryptography(keyring);
  const idempotencyKeyDigest = cryptography.deriveIdempotencyKeyDigest(
    cryptography.activeVersion,
    subjectId,
    "abcdefghijklmnopqrstuv",
  );
  const clientRequestDigest = cryptography.deriveClientRequestDigest(
    cryptography.activeVersion,
    subjectId,
    request,
  );
  const requestInput = {
    catalog: {
      approvalReference: "test:catalog-approval",
      checksum: `sha256:${"c".repeat(64)}`,
      id: "rituvia.placeholder-catalog",
      version: "1.0.0",
    },
    deck: { id: "rituvia.placeholder-deck", version: "1.0.0" },
    locale: "en" as const,
    orientationPolicy: "upright_and_reversed" as const,
    readingId,
    readingPolicyVersion: "test.tarot-reading.v1",
    readingType: "one_card" as const,
    spread: { id: "one-card-perspective", version: "1.0.0" },
    subjectId,
    themeCode: "open_reflection" as const,
  };
  const requestDigest = cryptography.deriveRequestDigest(cryptography.activeVersion, requestInput);
  const binding = Object.freeze({
    catalogApprovalReference: requestInput.catalog.approvalReference,
    catalogChecksum: requestInput.catalog.checksum,
    clientRequestDigest,
    idempotencyKeyDigest,
    integrityKeyVersion: cryptography.activeVersion,
    locale: "en" as const,
    readingId,
    readingPolicyVersion: "test.tarot-reading.v1",
    readingType: "one_card" as const,
    requestDigest,
    subjectId,
    themeCode: "open_reflection" as const,
  });
  const drawRequest = Object.freeze({
    catalog: { id: requestInput.catalog.id, version: requestInput.catalog.version },
    deck: requestInput.deck,
    idempotencyKeyDigest,
    method: "tarot" as const,
    orientationPolicy: requestInput.orientationPolicy,
    requestDigest,
    rulesVersion: tarotDrawRulesVersion,
    schemaVersion: "tarot-draw-request.v1" as const,
    spread: requestInput.spread,
  });
  const execution = resolveTarotDrawV1({
    catalog,
    entropy: cryptography.createEntropy(binding, 3),
    request: drawRequest,
  });
  return { binding, cryptography, execution };
};

describe("tarot reading cryptography", () => {
  it("creates an OS-random execution and immediately verifies the complete bound envelope", () => {
    const { binding, cryptography, execution } = createFixture();
    const verifier = cryptography.createExecutionVerifier(binding, 3);

    expect(execution.audit.entropy).toMatchObject({ bytesConsumed: 2, rejectedSamples: 0 });
    expect(verifier(execution)).toBe(true);
    expect(tarotReadingDigestToBytes(binding.idempotencyKeyDigest)).toHaveLength(32);
    expect(JSON.stringify(execution)).not.toContain(key(7));
  });

  it.each([
    [
      "card",
      (value: DeepMutable<TarotDrawExecutionV1>) => (value.facts.positions[0]!.cardId = "mirror"),
    ],
    [
      "orientation",
      (value: DeepMutable<TarotDrawExecutionV1>) =>
        (value.facts.positions[0]!.orientation = "upright"),
    ],
    [
      "byte count",
      (value: DeepMutable<TarotDrawExecutionV1>) => (value.audit.entropy.bytesConsumed = 3),
    ],
    [
      "rejected count",
      (value: DeepMutable<TarotDrawExecutionV1>) => (value.audit.entropy.rejectedSamples = 1),
    ],
    [
      "request digest",
      (value: DeepMutable<TarotDrawExecutionV1>) =>
        (value.audit.requestDigest = `sha256:${"a".repeat(64)}`),
    ],
  ])("rejects a changed %s", (_label, mutate) => {
    const { binding, cryptography, execution } = createFixture();
    const changed = structuredClone(execution) as DeepMutable<TarotDrawExecutionV1>;
    mutate(changed);

    expect(cryptography.createExecutionVerifier(binding, 3)(changed)).toBe(false);
  });

  it("rejects cross-owner, cross-reading, theme, policy, and key-version transplanting", () => {
    const { binding, cryptography, execution } = createFixture();
    const changes = [
      { ...binding, subjectId: "33333333-3333-4333-8333-333333333333" },
      { ...binding, readingId: "44444444-4444-4444-8444-444444444444" },
      { ...binding, themeCode: "work" as const },
      { ...binding, readingPolicyVersion: "test.tarot-reading.v2" },
      { ...binding, catalogChecksum: `sha256:${"d".repeat(64)}` },
      { ...binding, catalogApprovalReference: "test:other-approval" },
      { ...binding, integrityKeyVersion: "test.key.v1" },
    ];

    for (const changed of changes) {
      expect(cryptography.createExecutionVerifier(changed, 3)(execution)).toBe(false);
    }
  });

  it("domain-separates report idempotency from reading creation and binds it to the owner", () => {
    const { cryptography } = createFixture();
    const idempotencyKey = "abcdefghijklmnopqrstuv";
    const reportDigest = cryptography.deriveReportIdempotencyKeyDigest(
      cryptography.activeVersion,
      subjectId,
      idempotencyKey,
    );

    expect(reportDigest).not.toBe(
      cryptography.deriveIdempotencyKeyDigest(
        cryptography.activeVersion,
        subjectId,
        idempotencyKey,
      ),
    );
    expect(reportDigest).not.toBe(
      cryptography.deriveReportIdempotencyKeyDigest(
        cryptography.activeVersion,
        "33333333-3333-4333-8333-333333333333",
        idempotencyKey,
      ),
    );
    expect(reportDigest).not.toBe(
      cryptography.deriveReportIdempotencyKeyDigest("test.key.v1", subjectId, idempotencyKey),
    );
  });

  it("binds a report request digest to owner, reading, policy, category, and target", () => {
    const { cryptography } = createFixture();
    const derive = (
      owner: string,
      reportedReadingId: string,
      policyVersion: string,
      report: TarotReadingReportRequest,
    ) =>
      cryptography.deriveReportRequestDigest(
        cryptography.activeVersion,
        owner,
        reportedReadingId,
        policyVersion,
        report,
      );
    const digest = derive(subjectId, readingId, "test.tarot-reading-report.v1", reportRequest);
    const changed = [
      derive(
        "33333333-3333-4333-8333-333333333333",
        readingId,
        "test.tarot-reading-report.v1",
        reportRequest,
      ),
      derive(
        subjectId,
        "44444444-4444-4444-8444-444444444444",
        "test.tarot-reading-report.v1",
        reportRequest,
      ),
      derive(subjectId, readingId, "test.tarot-reading-report.v2", reportRequest),
      derive(subjectId, readingId, "test.tarot-reading-report.v1", {
        category: "rights",
        schemaVersion: "tarot-reading-report.v1",
        target: { kind: "position", positionId: "perspective" },
      }),
      derive(subjectId, readingId, "test.tarot-reading-report.v1", {
        category: "cultural",
        schemaVersion: "tarot-reading-report.v2",
        target: { interpretationRequestId, kind: "interpretation" },
      }),
    ];

    expect(changed).not.toContain(digest);
    expect(new Set(changed).size).toBe(changed.length);
  });

  it("fails closed on noncanonical report digest bindings", () => {
    const { cryptography } = createFixture();

    expect(() =>
      cryptography.deriveReportIdempotencyKeyDigest(
        cryptography.activeVersion,
        subjectId,
        "private invalid key",
      ),
    ).toThrow(/integrity configuration/u);
    expect(() =>
      cryptography.deriveReportRequestDigest(
        cryptography.activeVersion,
        subjectId,
        "not-a-reading",
        "test.tarot-reading-report.v1",
        reportRequest,
      ),
    ).toThrow(/integrity configuration/u);
    expect(() =>
      cryptography.deriveReportRequestDigest(
        cryptography.activeVersion,
        subjectId,
        readingId,
        "not semver",
        reportRequest,
      ),
    ).toThrow(/integrity configuration/u);
  });

  it("derives the exact singleton and orientation counts without accepting impossible audits", () => {
    const { execution } = createFixture();
    const oneCardFacts = execution.facts;

    expect(deriveTarotV1EntropyCounts(oneCardFacts, 3, 2)).toEqual({
      bytesConsumed: 2,
      rejectedSamples: 0,
    });
    expect(deriveTarotV1EntropyCounts(oneCardFacts, 1, 1)).toEqual({
      bytesConsumed: 1,
      rejectedSamples: 0,
    });
    expect(() => deriveTarotV1EntropyCounts(oneCardFacts, 1, 0)).toThrow(
      /integrity configuration/u,
    );
  });

  it("fails closed for weak, duplicated, missing-active, and noncanonical key material", () => {
    expect(() =>
      createTarotReadingCryptography({
        activeVersion: "test.key.v1",
        keys: [{ encodedKey: "weak", version: "test.key.v1" }],
      }),
    ).toThrow(/integrity configuration/u);
    expect(() =>
      createTarotReadingCryptography({
        activeVersion: "test.key.v2",
        keys: [{ encodedKey: key(1), version: "test.key.v1" }],
      }),
    ).toThrow(/integrity configuration/u);
    expect(() =>
      createTarotReadingCryptography({
        activeVersion: "test.key.v1",
        keys: [
          { encodedKey: key(1), version: "test.key.v1" },
          { encodedKey: key(2), version: "test.key.v1" },
        ],
      }),
    ).toThrow(/integrity configuration/u);
  });
});
