import { describe, expect, it } from "vitest";

import {
  AccountAuthProviderInputError,
  AccountAuthProviderUnavailableError,
  createAccountAuthProvider,
} from "../server/auth-provider";

describe("local passwordless account provider", () => {
  it("issues unique bounded one-time local callback material for synthetic email only", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
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
    provider.stageLocalPreview(first);
    expect(provider.readLocalPreview(first.state)).toEqual(first);
    expect(provider.consumeLocalPreview(first.state)).toBe(true);
    expect(provider.readLocalPreview(first.state)).toBeNull();
    expect(provider.consumeLocalPreview(first.state)).toBe(false);
  });

  it.each(["preview", "staging", "production"] as const)(
    "hard-disables the local provider in %s",
    (deploymentEnvironment) => {
      expect(() =>
        createAccountAuthProvider({
          canonicalOrigin: "https://example.test",
          challengeTtlSeconds: 600,
          deploymentEnvironment,
        }),
      ).toThrow(AccountAuthProviderUnavailableError);
    },
  );

  it("accepts normalized email without account enumeration but rejects unsafe input", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
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
      }),
    ).toThrow(AccountAuthProviderUnavailableError);
  });

  it("allows only the exact local checkout reauthentication target", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
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

  it("allows the reviewed Credit-pack return target", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
    });
    expect(
      provider.startEmailMagicLink({
        email: "person@example.test",
        returnTo: "/en/plans",
      }).returnTo,
    ).toBe("/en/plans");
  });
});
