import { describe, expect, it } from "vitest";

import {
  createPrivateContentCryptography,
  PrivateContentCryptoError,
} from "../server/private-content-crypto";

const ownerSubjectId = "11111111-1111-4111-8111-111111111111";
const key = new Uint8Array(32).fill(7);
const context = Object.freeze({
  ownerSubjectId,
  purpose: "journal.reflection" as const,
  resourceBinding: "journal:33333333-3333-4333-8333-333333333333",
});

describe("private content cryptography", () => {
  it("round-trips AES-256-GCM content with opaque storage fields", () => {
    const crypto = createPrivateContentCryptography(
      { activeKeyVersion: "local.v1", keys: [{ key, version: "local.v1" }] },
      () => new Uint8Array(12).fill(9),
    );
    const encrypted = crypto.encrypt({ context, plaintext: "private journal canary" });

    expect(encrypted.keyVersion).toBe("local.v1");
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.tag).toHaveLength(16);
    expect(Buffer.from(encrypted.ciphertext).toString("utf8")).not.toContain("private journal");
    expect(crypto.decrypt({ context, encrypted })).toBe("private journal canary");
  });

  it("binds ciphertext to owner, purpose, resource, and authentication tag", () => {
    const crypto = createPrivateContentCryptography(
      { activeKeyVersion: "local.v1", keys: [{ key, version: "local.v1" }] },
      () => new Uint8Array(12).fill(4),
    );
    const encrypted = crypto.encrypt({ context, plaintext: "private journal canary" });

    expect(() =>
      crypto.decrypt({
        context: { ...context, resourceBinding: "journal:44444444-4444-4444-8444-444444444444" },
        encrypted,
      }),
    ).toThrowError(PrivateContentCryptoError);
    expect(() =>
      crypto.decrypt({
        context,
        encrypted: { ...encrypted, tag: new Uint8Array(16) },
      }),
    ).toThrowError(PrivateContentCryptoError);
  });

  it("supports historical decryption after active-key rotation", () => {
    const oldCrypto = createPrivateContentCryptography(
      { activeKeyVersion: "key.v1", keys: [{ key, version: "key.v1" }] },
      () => new Uint8Array(12).fill(1),
    );
    const encrypted = oldCrypto.encrypt({ context, plaintext: "private journal canary" });
    const rotated = createPrivateContentCryptography({
      activeKeyVersion: "key.v2",
      keys: [
        { key, version: "key.v1" },
        { key: new Uint8Array(32).fill(8), version: "key.v2" },
      ],
    });

    expect(rotated.decrypt({ context, encrypted })).toBe("private journal canary");
    expect(rotated.activeKeyVersion).toBe("key.v2");
  });

  it("derives scoped stable digests without exposing raw private values", () => {
    const crypto = createPrivateContentCryptography({
      activeKeyVersion: "local.v1",
      keys: [{ key, version: "local.v1" }],
    });
    const idempotency = crypto.deriveIdempotencyKeyDigest({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      ownerSubjectId,
    });
    const canonical = crypto.deriveCanonicalRequestDigest({
      canonicalRequest: '{"reflection":"private journal canary"}',
      ownerSubjectId,
    });

    expect(idempotency).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(canonical).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(idempotency).not.toBe(canonical);
    expect(crypto.digestsEqual(idempotency, idempotency)).toBe(true);
    expect(crypto.digestsEqual(idempotency, canonical)).toBe(false);
    expect(crypto.digestsEqual("private journal canary", canonical)).toBe(false);
  });

  it("rejects malformed keys, entropy, context, and oversized content safely", () => {
    expect(() =>
      createPrivateContentCryptography({ activeKeyVersion: "local.v1", keys: [] }),
    ).toThrowError(PrivateContentCryptoError);
    expect(() =>
      createPrivateContentCryptography({
        activeKeyVersion: "local.v1",
        keys: [{ key: new Uint8Array(1), version: "local.v1" }],
      }),
    ).toThrowError(PrivateContentCryptoError);

    const crypto = createPrivateContentCryptography(
      { activeKeyVersion: "local.v1", keys: [{ key, version: "local.v1" }] },
      () => new Uint8Array(11),
    );
    expect(() => crypto.encrypt({ context, plaintext: "private journal canary" })).toThrowError(
      PrivateContentCryptoError,
    );
    expect(() =>
      crypto.encrypt({ context: { ...context, ownerSubjectId: "unsafe" }, plaintext: "private" }),
    ).toThrowError(PrivateContentCryptoError);
    expect(() => crypto.encrypt({ context, plaintext: "x".repeat(4_097) })).toThrowError(
      PrivateContentCryptoError,
    );
  });
});
