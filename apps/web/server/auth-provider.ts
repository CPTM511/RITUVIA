import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";

import { normalizeAccountEmail, parseAuthProviderKey } from "@rituvia/domain";

import { isReviewedReturnTo } from "../app/_contracts/reviewed-return-to";

export const localPasswordlessProviderKey = parseAuthProviderKey("local.passwordless.v1");
export const productionEmailMagicLinkProviderKey = parseAuthProviderKey("email.magic-link.v1");

export const accountAuthProviderCapabilities = Object.freeze({
  emailMagicLink: "active",
  passkey: "schema_ready",
} as const);

export class AccountAuthProviderUnavailableError extends Error {
  constructor() {
    super("The account authentication provider is unavailable.");
    this.name = "AccountAuthProviderUnavailableError";
  }
}

export class AccountAuthProviderInputError extends Error {
  constructor() {
    super("The account authentication request is invalid.");
    this.name = "AccountAuthProviderInputError";
  }
}

export type LocalPasswordlessStart = Readonly<{
  callbackUrl: string;
  challengeId: string;
  email: string;
  expiresAt: string;
  providerKey: typeof localPasswordlessProviderKey | typeof productionEmailMagicLinkProviderKey;
  returnTo: string;
  state: string;
  token: string;
}>;

export type AccountAuthProvider = Readonly<{
  capabilities: typeof accountAuthProviderCapabilities;
  delivery: "email" | "local_preview";
  issueSessionToken(): string;
  readLocalPreview(envelope: string): LocalPasswordlessStart | null;
  sealLocalPreview(started: LocalPasswordlessStart): string;
  startEmailMagicLink(
    input: Readonly<{ email: unknown; returnTo: unknown }>,
  ): LocalPasswordlessStart;
}>;

const issueOpaqueToken = (): string => {
  const token = randomBytes(32).toString("base64url");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    throw new AccountAuthProviderUnavailableError();
  }
  return token;
};

export const createAccountAuthProvider = (input: {
  canonicalOrigin: string;
  challengeTtlSeconds: number;
  deploymentEnvironment: "local" | "preview" | "production" | "staging";
  encryptionKey: Uint8Array;
  now?: (() => Date) | undefined;
  productionEmailEnabled?: boolean | undefined;
  sandboxEnabled?: boolean | undefined;
}): AccountAuthProvider => {
  const localPreviewEnabled =
    input.deploymentEnvironment === "local" ||
    (input.deploymentEnvironment === "staging" && input.sandboxEnabled === true);
  const productionEmailEnabled =
    input.deploymentEnvironment === "production" && input.productionEmailEnabled === true;
  if (
    (!localPreviewEnabled && !productionEmailEnabled) ||
    !Number.isSafeInteger(input.challengeTtlSeconds) ||
    input.challengeTtlSeconds < 60 ||
    input.challengeTtlSeconds > 3_600 ||
    !(input.encryptionKey instanceof Uint8Array) ||
    input.encryptionKey.byteLength !== 32
  ) {
    throw new AccountAuthProviderUnavailableError();
  }
  const origin = new URL(input.canonicalOrigin);
  if (origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") {
    throw new AccountAuthProviderUnavailableError();
  }
  const now = input.now ?? (() => new Date());
  const delivery = productionEmailEnabled ? "email" : "local_preview";
  const previewEnvelopePattern = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64,1024}$/u;
  const previewAdditionalData = Buffer.from("rituvia.auth-sandbox-preview.v1", "utf8");

  return Object.freeze({
    capabilities: accountAuthProviderCapabilities,
    delivery,
    issueSessionToken: issueOpaqueToken,
    readLocalPreview(envelope) {
      if (delivery !== "local_preview") return null;
      if (!previewEnvelopePattern.test(envelope)) return null;
      const [, encodedNonce, encodedSealed] = envelope.split(".");
      if (encodedNonce === undefined || encodedSealed === undefined) return null;
      const nonce = Buffer.from(encodedNonce, "base64url");
      const sealed = Buffer.from(encodedSealed, "base64url");
      if (
        nonce.byteLength !== 12 ||
        sealed.byteLength <= 16 ||
        nonce.toString("base64url") !== encodedNonce ||
        sealed.toString("base64url") !== encodedSealed
      ) {
        return null;
      }
      try {
        const ciphertext = sealed.subarray(0, -16);
        const tag = sealed.subarray(-16);
        const decipher = createDecipheriv("aes-256-gcm", input.encryptionKey, nonce);
        decipher.setAAD(previewAdditionalData);
        decipher.setAuthTag(tag);
        const parsed = JSON.parse(
          Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"),
        ) as unknown;
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed) ||
          Object.keys(parsed).sort().join("\u0000") !==
            "callbackUrl\u0000challengeId\u0000email\u0000expiresAt\u0000providerKey\u0000returnTo\u0000state\u0000token" ||
          !("expiresAt" in parsed) ||
          typeof parsed.expiresAt !== "string" ||
          Date.parse(parsed.expiresAt) <= now().getTime()
        ) {
          return null;
        }
        return parsed as LocalPasswordlessStart;
      } catch {
        return null;
      }
    },
    sealLocalPreview(started) {
      if (delivery !== "local_preview") throw new AccountAuthProviderUnavailableError();
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", input.encryptionKey, nonce);
      cipher.setAAD(previewAdditionalData);
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(started), "utf8"),
        cipher.final(),
      ]);
      const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);
      return `v1.${nonce.toString("base64url")}.${sealed.toString("base64url")}`;
    },
    startEmailMagicLink(raw) {
      let email: string;
      try {
        email = normalizeAccountEmail(raw.email);
      } catch {
        throw new AccountAuthProviderInputError();
      }
      if (!isReviewedReturnTo(raw.returnTo)) {
        throw new AccountAuthProviderInputError();
      }
      const challengeId = randomUUID();
      const token = issueOpaqueToken();
      const state = issueOpaqueToken();
      const expiresAt = new Date(now().getTime() + input.challengeTtlSeconds * 1_000).toISOString();
      const callback = new URL("/api/v1/auth/callback", origin);
      callback.searchParams.set("challenge", challengeId);
      callback.searchParams.set("state", state);
      callback.searchParams.set("token", token);
      return Object.freeze({
        callbackUrl: callback.toString(),
        challengeId,
        email,
        expiresAt,
        providerKey:
          delivery === "email" ? productionEmailMagicLinkProviderKey : localPasswordlessProviderKey,
        returnTo: raw.returnTo,
        state,
        token,
      });
    },
  });
};
