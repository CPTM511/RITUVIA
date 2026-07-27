import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

const keyVersionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const nonceLength = 12;
const authenticationTagLength = 16;
const maximumPrivateContentBytes = 12_000;
const maximumAdditionalDataBytes = 1_024;

export type PrivateContentPurpose =
  | "astrology_calculation.payload"
  | "birth_profile.payload"
  | "intention.small_action"
  | "intention.text"
  | "journal.reflection"
  | "revisit.action_snapshot"
  | "revisit.completion"
  | "revisit.intention_snapshot";

export type PrivateContentKeyringInput = Readonly<{
  activeKeyVersion: string;
  digestKeyVersion: string;
  keys: readonly Readonly<{ key: Uint8Array; version: string }>[];
}>;

export type EncryptedPrivateContent = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type PrivateContentEncryptionContext = Readonly<{
  ownerSubjectId: string;
  purpose: PrivateContentPurpose;
  resourceBinding: string;
}>;

export class PrivateContentCryptoError extends Error {
  constructor() {
    super("Private content cryptography is unavailable.");
    this.name = "PrivateContentCryptoError";
  }
}

export type PrivateContentCryptography = Readonly<{
  activeKeyVersion: string;
  digestKeyVersion: string;
  decrypt(
    input: Readonly<{
      context: PrivateContentEncryptionContext;
      encrypted: EncryptedPrivateContent;
    }>,
  ): string;
  deriveCanonicalRequestDigest(
    input: Readonly<{
      canonicalRequest: string;
      ownerSubjectId: string;
    }>,
  ): string;
  deriveIdempotencyKeyDigest(
    input: Readonly<{
      idempotencyKey: string;
      ownerSubjectId: string;
    }>,
  ): string;
  digestsEqual(left: string, right: string): boolean;
  encrypt(
    input: Readonly<{
      context: PrivateContentEncryptionContext;
      plaintext: string;
    }>,
  ): EncryptedPrivateContent;
}>;

const invalid = (): never => {
  throw new PrivateContentCryptoError();
};

const decodeKey = (value: Uint8Array): Buffer => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) return invalid();
  return Buffer.from(value);
};

const deriveKey = (masterKey: Buffer, label: string): Buffer =>
  createHmac("sha256", masterKey).update(`rituvia\0${label}\0v1`, "utf8").digest();

const parseContext = (value: PrivateContentEncryptionContext): Buffer => {
  if (
    typeof value !== "object" ||
    value === null ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      value.ownerSubjectId,
    ) ||
    (value.purpose !== "astrology_calculation.payload" &&
      value.purpose !== "birth_profile.payload" &&
      value.purpose !== "intention.small_action" &&
      value.purpose !== "intention.text" &&
      value.purpose !== "journal.reflection" &&
      value.purpose !== "revisit.action_snapshot" &&
      value.purpose !== "revisit.completion" &&
      value.purpose !== "revisit.intention_snapshot") ||
    !/^[a-z0-9][a-z0-9.:_-]{0,255}$/u.test(value.resourceBinding)
  ) {
    return invalid();
  }
  const additionalData = Buffer.from(
    JSON.stringify({
      ownerSubjectId: value.ownerSubjectId,
      purpose: value.purpose,
      resourceBinding: value.resourceBinding,
      scheme: "aes-256-gcm.private-content.v1",
    }),
    "utf8",
  );
  if (additionalData.byteLength > maximumAdditionalDataBytes) return invalid();
  return additionalData;
};

const parseDigest = (value: string): Buffer => {
  if (!sha256DigestPattern.test(value)) return invalid();
  return Buffer.from(value.slice("sha256:".length), "hex");
};

export const createPrivateContentCryptography = (
  input: PrivateContentKeyringInput,
  randomBytes: (size: number) => Uint8Array = nodeRandomBytes,
): PrivateContentCryptography => {
  if (
    typeof input !== "object" ||
    input === null ||
    !keyVersionPattern.test(input.activeKeyVersion) ||
    !keyVersionPattern.test(input.digestKeyVersion) ||
    !Array.isArray(input.keys)
  ) {
    return invalid();
  }
  const entries = [...input.keys];
  if (
    entries.length === 0 ||
    entries.length > 8 ||
    entries.some(
      (entry) =>
        typeof entry !== "object" ||
        entry === null ||
        !keyVersionPattern.test(entry.version) ||
        !(entry.key instanceof Uint8Array) ||
        entry.key.byteLength !== 32,
    ) ||
    new Set(entries.map(({ version }) => version)).size !== entries.length ||
    !entries.some(({ version }) => version === input.activeKeyVersion) ||
    !entries.some(({ version }) => version === input.digestKeyVersion)
  ) {
    return invalid();
  }
  const keys = new Map(
    entries.map(({ key, version }) => {
      const master = decodeKey(key);
      return [
        version,
        Object.freeze({
          encryption: deriveKey(master, "private-content-encryption"),
          integrity: deriveKey(master, "private-content-integrity"),
        }),
      ] as const;
    }),
  );
  const activeKeyVersion = input.activeKeyVersion;
  const digestKeyVersion = input.digestKeyVersion;

  const keyFor = (version: string) => keys.get(version) ?? invalid();

  const digest = (label: string, ownerSubjectId: string, value: string): string => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        ownerSubjectId,
      ) ||
      value.length === 0 ||
      Buffer.byteLength(value, "utf8") > 16_384
    ) {
      return invalid();
    }
    const valueDigest = createHmac("sha256", keyFor(digestKeyVersion).integrity)
      .update(`rituvia\0${label}\0${ownerSubjectId}\0`, "utf8")
      .update(value, "utf8")
      .digest("hex");
    return `sha256:${valueDigest}`;
  };

  return Object.freeze({
    activeKeyVersion,
    digestKeyVersion,
    decrypt({ context, encrypted }) {
      if (
        typeof encrypted !== "object" ||
        encrypted === null ||
        !keyVersionPattern.test(encrypted.keyVersion) ||
        !(encrypted.ciphertext instanceof Uint8Array) ||
        encrypted.ciphertext.byteLength === 0 ||
        encrypted.ciphertext.byteLength > maximumPrivateContentBytes ||
        !(encrypted.nonce instanceof Uint8Array) ||
        encrypted.nonce.byteLength !== nonceLength ||
        !(encrypted.tag instanceof Uint8Array) ||
        encrypted.tag.byteLength !== authenticationTagLength
      ) {
        return invalid();
      }
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          keyFor(encrypted.keyVersion).encryption,
          encrypted.nonce,
          { authTagLength: authenticationTagLength },
        );
        decipher.setAAD(parseContext(context));
        decipher.setAuthTag(encrypted.tag);
        const plaintext = Buffer.concat([
          decipher.update(encrypted.ciphertext),
          decipher.final(),
        ]).toString("utf8");
        if (
          plaintext.length === 0 ||
          Buffer.byteLength(plaintext, "utf8") > maximumPrivateContentBytes
        ) {
          return invalid();
        }
        return plaintext;
      } catch {
        return invalid();
      }
    },
    deriveCanonicalRequestDigest({ canonicalRequest, ownerSubjectId }) {
      return digest("canonical-request", ownerSubjectId, canonicalRequest);
    },
    deriveIdempotencyKeyDigest({ idempotencyKey, ownerSubjectId }) {
      return digest("idempotency-key", ownerSubjectId, idempotencyKey);
    },
    digestsEqual(left, right) {
      try {
        return timingSafeEqual(parseDigest(left), parseDigest(right));
      } catch {
        return false;
      }
    },
    encrypt({ context, plaintext }) {
      if (
        typeof plaintext !== "string" ||
        plaintext.length === 0 ||
        Buffer.byteLength(plaintext, "utf8") > maximumPrivateContentBytes
      ) {
        return invalid();
      }
      const nonce = Buffer.from(randomBytes(nonceLength));
      if (nonce.byteLength !== nonceLength) return invalid();
      const cipher = createCipheriv("aes-256-gcm", keyFor(activeKeyVersion).encryption, nonce, {
        authTagLength: authenticationTagLength,
      });
      cipher.setAAD(parseContext(context));
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Object.freeze({
        ciphertext: Uint8Array.from(ciphertext),
        keyVersion: activeKeyVersion,
        nonce: Uint8Array.from(nonce),
        tag: Uint8Array.from(tag),
      });
    },
  });
};
