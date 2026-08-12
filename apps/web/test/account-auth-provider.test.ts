import { describe, expect, it } from "vitest";

import {
  AccountAuthProviderInputError,
  AccountAuthProviderUnavailableError,
  createAccountAuthProvider,
} from "../server/auth-provider";

const encryptionKey = new Uint8Array(32).fill(7);

describe("local passwordless account provider", () => {
  it("issues unique bounded one-time local callback material for synthetic email only", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
      encryptionKey,
      now: () => new Date("2026-07-18T00:00:00.000Z"),
    });
    const first = provider.startEmailMagicLink({
      email: "Demo@Example.Test",
      returnTo: "/en/account",
    });
    const second = provider.startEmailMagicLink({
      email: "demo@example.test",
      returnTo: "/en/account",
    });

    expect(first).toMatchObject({
      email: "demo@example.test",
      expiresAt: "2026-07-18T00:10:00.000Z",
      providerKey: "local.passwordless.v1",
      returnTo: "/en/account",
    });
    expect(first.challengeId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(first.callbackUrl).toBe(
      `https://example.test/api/v1/auth/callback?challenge=${first.challengeId}&state=${first.state}&token=${first.token}`,
    );
    expect(second.challengeId).not.toBe(first.challengeId);
    expect(second.token).not.toBe(first.token);
    expect(second.state).not.toBe(first.state);
    expect(provider.issueSessionToken()).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(provider.capabilities).toEqual({
      emailMagicLink: "active",
      passkey: "schema_ready",
    });
    const envelope = provider.sealLocalPreview(first);
    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64,1024}$/u);
    expect(provider.readLocalPreview(envelope)).toEqual(first);
    expect(provider.readLocalPreview(`${envelope}x`)).toBeNull();
  });

  it.each(["preview", "staging"] as const)(
    "hard-disables the local provider in %s",
    (deploymentEnvironment) => {
      expect(() =>
        createAccountAuthProvider({
          canonicalOrigin: "https://example.test",
          challengeTtlSeconds: 600,
          deploymentEnvironment,
          encryptionKey,
        }),
      ).toThrow(AccountAuthProviderUnavailableError);
    },
  );

  it("enables production email delivery without exposing local preview material", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.com",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "production",
      encryptionKey,
      productionEmailEnabled: true,
    });
    const started = provider.startEmailMagicLink({
      email: "person@example.net",
      returnTo: "/en/account",
    });

    expect(provider.delivery).toBe("email");
    expect(started.providerKey).toBe("email.magic-link.v1");
    expect(provider.readLocalPreview("invalid")).toBeNull();
    expect(() => provider.sealLocalPreview(started)).toThrow(AccountAuthProviderUnavailableError);
  });

  it("accepts normalized email without account enumeration but rejects unsafe input", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
      encryptionKey,
    });
    expect(
      provider.startEmailMagicLink({ email: "Person@Example.com", returnTo: "/en/account" }).email,
    ).toBe("person@example.com");
    expect(() =>
      provider.startEmailMagicLink({
        email: "person@example.test",
        returnTo: "https://foreign.test",
      }),
    ).toThrow(AccountAuthProviderInputError);
    expect(() => provider.startEmailMagicLink({ email: "not-an-email", returnTo: "/en" })).toThrow(
      AccountAuthProviderInputError,
    );
    expect(() =>
      createAccountAuthProvider({
        canonicalOrigin: "https://example.test/private",
        challengeTtlSeconds: 600,
        deploymentEnvironment: "local",
        encryptionKey,
      }),
    ).toThrow(AccountAuthProviderUnavailableError);
  });

  it("allows only the exact local checkout reauthentication target", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
      encryptionKey,
    });
    const checkout = provider.startEmailMagicLink({
      email: "person@example.test",
      returnTo: "/en/checkout/local?checkout_id=local_checkout.123",
    });
    expect(checkout.returnTo).toBe("/en/checkout/local?checkout_id=local_checkout.123");
    expect(() =>
      provider.startEmailMagicLink({
        email: "person@example.test",
        returnTo: "/en/checkout/local?checkout_id=bad&next=https://foreign.test",
      }),
    ).toThrow(AccountAuthProviderInputError);
  });

  it("enables only the explicitly configured staging sandbox", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://staging.example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "staging",
      encryptionKey,
      sandboxEnabled: true,
    });
    expect(
      provider.startEmailMagicLink({ email: "owner@example.test", returnTo: "/en/account" }),
    ).toMatchObject({ email: "owner@example.test", providerKey: "local.passwordless.v1" });
  });
});
