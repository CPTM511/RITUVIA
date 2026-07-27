import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const versionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const maximumArtifactBytes = 16_777_216;

export type PrivacyExportArtifactBinding = Readonly<{
  createdAt: string;
  encryptionKeyVersion: string;
  expiresAt: string;
  exportId: string;
  schemaVersion: "privacy-export-package.v2";
  userId: string;
}>;

export type EncryptedPrivacyExportArtifact = Readonly<{
  authenticationTag: Uint8Array;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  plaintextBytes: number;
  plaintextSha256: Uint8Array;
}>;

export class PrivacyExportCryptoError extends Error {
  constructor() {
    super("Privacy export cryptography is unavailable.");
    this.name = "PrivacyExportCryptoError";
  }
}

const invalid = (): never => {
  throw new PrivacyExportCryptoError();
};

const additionalData = (binding: PrivacyExportArtifactBinding): Buffer => {
  if (
    !uuidPattern.test(binding.exportId) ||
    !uuidPattern.test(binding.userId) ||
    binding.schemaVersion !== "privacy-export-package.v2" ||
    !versionPattern.test(binding.encryptionKeyVersion) ||
    !timestampPattern.test(binding.createdAt) ||
    !timestampPattern.test(binding.expiresAt) ||
    Date.parse(binding.expiresAt) <= Date.parse(binding.createdAt)
  ) {
    return invalid();
  }
  return Buffer.from(
    JSON.stringify({
      ...binding,
      scheme: "aes-256-gcm.privacy-export.v1",
    }),
    "utf8",
  );
};

export const createPrivacyExportArtifactCryptography = (
  input: Readonly<{ key: Uint8Array; version: string }>,
  randomBytes: (size: number) => Uint8Array = nodeRandomBytes,
) => {
  if (
    !(input.key instanceof Uint8Array) ||
    input.key.byteLength !== 32 ||
    !versionPattern.test(input.version)
  ) {
    return invalid();
  }
  const key = Buffer.from(input.key);
  const version = input.version;
  return Object.freeze({
    decrypt(
      binding: PrivacyExportArtifactBinding,
      encrypted: EncryptedPrivacyExportArtifact,
    ): string {
      if (
        binding.encryptionKeyVersion !== version ||
        !(encrypted.ciphertext instanceof Uint8Array) ||
        encrypted.ciphertext.byteLength < 1 ||
        encrypted.ciphertext.byteLength > maximumArtifactBytes ||
        !(encrypted.nonce instanceof Uint8Array) ||
        encrypted.nonce.byteLength !== 12 ||
        !(encrypted.authenticationTag instanceof Uint8Array) ||
        encrypted.authenticationTag.byteLength !== 16 ||
        !(encrypted.plaintextSha256 instanceof Uint8Array) ||
        encrypted.plaintextSha256.byteLength !== 32 ||
        encrypted.plaintextBytes < 1 ||
        encrypted.plaintextBytes > maximumArtifactBytes
      ) {
        return invalid();
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce);
        decipher.setAAD(additionalData(binding));
        decipher.setAuthTag(encrypted.authenticationTag);
        const plaintext = Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
        const plaintextHash = createHash("sha256").update(plaintext).digest();
        if (
          plaintext.byteLength !== encrypted.plaintextBytes ||
          !timingSafeEqual(plaintextHash, Buffer.from(encrypted.plaintextSha256))
        ) {
          return invalid();
        }
        return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
      } catch {
        return invalid();
      }
    },
    encrypt(
      binding: PrivacyExportArtifactBinding,
      plaintext: string,
    ): EncryptedPrivacyExportArtifact {
      const source = Buffer.from(plaintext, "utf8");
      if (source.byteLength < 1 || source.byteLength > maximumArtifactBytes) return invalid();
      const nonce = Buffer.from(randomBytes(12));
      if (nonce.byteLength !== 12) return invalid();
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(additionalData(binding));
      const ciphertext = Buffer.concat([cipher.update(source), cipher.final()]);
      return Object.freeze({
        authenticationTag: Uint8Array.from(cipher.getAuthTag()),
        ciphertext: Uint8Array.from(ciphertext),
        nonce: Uint8Array.from(nonce),
        plaintextBytes: source.byteLength,
        plaintextSha256: Uint8Array.from(createHash("sha256").update(source).digest()),
      });
    },
    version,
  });
};
