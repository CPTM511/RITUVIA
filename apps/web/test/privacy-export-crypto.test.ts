import { describe, expect, it } from "vitest";

import { createPrivacyExportArtifactCryptography } from "../server/privacy-export-crypto";

const binding = {
  createdAt: "2026-07-25T00:00:00.000Z",
  encryptionKeyVersion: "privacy-export.v1",
  expiresAt: "2026-07-25T00:15:00.000Z",
  exportId: "11111111-1111-4111-8111-111111111111",
  schemaVersion: "privacy-export-package.v2",
  userId: "22222222-2222-4222-8222-222222222222",
} as const;

describe("privacy export artifact cryptography", () => {
  it("round-trips one account/export/expiry-bound artifact with integrity evidence", () => {
    const cryptography = createPrivacyExportArtifactCryptography(
      { key: new Uint8Array(32).fill(7), version: "privacy-export.v1" },
      () => new Uint8Array(12).fill(9),
    );
    const plaintext = JSON.stringify({ privateCanary: "only-in-decrypted-export" });
    const encrypted = cryptography.encrypt(binding, plaintext);

    expect(encrypted.ciphertext).not.toEqual(new TextEncoder().encode(plaintext));
    expect(encrypted.nonce).toEqual(new Uint8Array(12).fill(9));
    expect(encrypted.authenticationTag).toHaveLength(16);
    expect(encrypted.plaintextSha256).toHaveLength(32);
    expect(cryptography.decrypt(binding, encrypted)).toBe(plaintext);
  });

  it("rejects tampering, wrong account binding, wrong key, and malformed key material", () => {
    const cryptography = createPrivacyExportArtifactCryptography(
      { key: new Uint8Array(32).fill(7), version: "privacy-export.v1" },
      () => new Uint8Array(12).fill(9),
    );
    const encrypted = cryptography.encrypt(binding, '{"ok":true}');
    const tampered = {
      ...encrypted,
      ciphertext: Uint8Array.from(encrypted.ciphertext, (value, index) =>
        index === 0 ? value ^ 1 : value,
      ),
    };

    expect(() => cryptography.decrypt(binding, tampered)).toThrow();
    expect(() =>
      cryptography.decrypt(
        { ...binding, userId: "33333333-3333-4333-8333-333333333333" },
        encrypted,
      ),
    ).toThrow();
    expect(() =>
      createPrivacyExportArtifactCryptography({
        key: new Uint8Array(32).fill(8),
        version: "privacy-export.v1",
      }).decrypt(binding, encrypted),
    ).toThrow();
    expect(() =>
      createPrivacyExportArtifactCryptography({
        key: new Uint8Array(31),
        version: "privacy-export.v1",
      }),
    ).toThrow();
  });
});
