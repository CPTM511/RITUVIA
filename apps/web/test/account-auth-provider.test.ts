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
    const first = provider.start({ email: "Demo@Example.Test", returnTo: "/en/account" });
    const second = provider.start({ email: "demo@example.test", returnTo: "/en/account" });

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

  it("rejects real email domains, external returns, and non-canonical origins", () => {
    const provider = createAccountAuthProvider({
      canonicalOrigin: "https://example.test",
      challengeTtlSeconds: 600,
      deploymentEnvironment: "local",
    });
    expect(() => provider.start({ email: "person@example.com", returnTo: "/en/account" })).toThrow(
      AccountAuthProviderInputError,
    );
    expect(() =>
      provider.start({ email: "person@example.test", returnTo: "https://foreign.test" }),
    ).toThrow(AccountAuthProviderInputError);
    expect(() => provider.start({ email: "not-an-email", returnTo: "/en" })).toThrow(
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
    const checkout = provider.start({
      email: "person@example.test",
      returnTo: "/en/checkout/local?checkout_id=local_checkout.123",
    });
    expect(checkout.returnTo).toBe("/en/checkout/local?checkout_id=local_checkout.123");
    expect(() =>
      provider.start({
        email: "person@example.test",
        returnTo: "/en/checkout/local?checkout_id=bad&next=https://foreign.test",
      }),
    ).toThrow(AccountAuthProviderInputError);
  });
});
