import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";

import { createBrandConfiguration, parseClientBrandConfiguration } from "../src/brand.js";
import { parseClientConfiguration } from "../src/client.js";
import { ConfigurationError } from "../src/errors.js";
import {
  brandEnvironmentVariables,
  buildEnvironmentVariables,
  parseBuildConfiguration,
  parseServerConfiguration,
  serverEnvironmentVariables,
} from "../src/server.js";

describe("brand configuration", () => {
  it("provides one deeply immutable working-brand configuration", () => {
    const brand = createBrandConfiguration();

    expect(Object.keys(brand)).toEqual([
      "name",
      "shortName",
      "legalEntity",
      "tagline",
      "canonicalOrigin",
      "supportEmail",
      "transactionalSender",
      "socialHandles",
      "assetManifest",
    ]);
    expect(brand.name).toBe("RITUVIA");
    expect(brand.canonicalOrigin).toBe("http://localhost:3000");
    expect(Object.isFrozen(brand)).toBe(true);
    expect(Object.isFrozen(brand.socialHandles)).toBe(true);
  });

  it.each([
    { canonicalOrigin: "javascript:alert(1)" },
    { canonicalOrigin: "https://user:password@example.com" },
    { canonicalOrigin: "https://example.com/path" },
    { supportEmail: "not-an-email" },
    { transactionalSender: "sender\r\nBcc: victim@example.com" },
    { assetManifest: "//untrusted.example/manifest.json" },
    { assetManifest: "/brand/../private/manifest.json" },
    { assetManifest: "https://example.com/manifest.json?token=secret" },
    { socialHandles: { "unsafe key": "@configurable" } },
  ])("rejects an unsafe brand override without echoing it", (override) => {
    const unsafeValue = Object.values(override)[0];

    expect(() => createBrandConfiguration(override)).toThrow(ConfigurationError);

    try {
      createBrandConfiguration(override);
    } catch (error) {
      expect(String(error)).not.toContain(unsafeValue);
      expect(JSON.stringify(error)).not.toContain(unsafeValue);
      expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    }
  });

  it("rejects unexpected client fields instead of silently stripping them", () => {
    const brand = createBrandConfiguration();

    expect(() =>
      parseClientBrandConfiguration({
        name: brand.name,
        shortName: brand.shortName,
        tagline: brand.tagline,
        canonicalOrigin: brand.canonicalOrigin,
        socialHandles: brand.socialHandles,
        assetManifest: brand.assetManifest,
        transactionalSender: "must-not-cross-the-boundary",
      }),
    ).toThrow(ConfigurationError);
  });
});

describe("server and client configuration boundary", () => {
  it("uses explicit environment inventories and keeps database configuration out of builds", () => {
    expect(brandEnvironmentVariables).toHaveLength(9);
    expect(buildEnvironmentVariables).not.toContain("DATABASE_URL");
    expect(serverEnvironmentVariables).toEqual([
      ...buildEnvironmentVariables,
      "DATABASE_URL",
      "AI_GENERATION_DATABASE_URL",
      "RITUVIA_AI_GENERATION_ROLE_PASSWORD",
      "PAYMENT_WEBHOOK_DATABASE_URL",
      "RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD",
      "PRIVACY_DELETION_DATABASE_URL",
      "RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD",
      "RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH",
      "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT",
      "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS",
      "RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION",
      "RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS",
      "RITUVIA_ACCOUNT_SESSION_TTL_SECONDS",
      "RITUVIA_AUTH_CHALLENGE_TTL_SECONDS",
      "RITUVIA_AUTH_DATA_KEY_V1",
      "RITUVIA_AUTH_START_GLOBAL_LIMIT",
      "RITUVIA_AUTH_START_IDENTIFIER_LIMIT",
      "RITUVIA_AUTH_START_WINDOW_SECONDS",
      "RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1",
      "RITUVIA_AI_DAILY_USER_LIMIT",
      "RITUVIA_AI_GATEWAY_MODEL",
      "RITUVIA_AI_MAX_COST_MICROS",
      "RITUVIA_AI_MAX_OUTPUT_TOKENS",
      "RITUVIA_AI_TIMEOUT_MS",
      "RITUVIA_COINBASE_API_KEY_ID",
      "RITUVIA_COINBASE_API_KEY_SECRET",
      "RITUVIA_COINBASE_WEBHOOK_SECRET",
      "RITUVIA_RECOVERY_IDENTITY_SANDBOX",
      "RITUVIA_RECOVERY_ITEM_11_SANDBOX",
      "RITUVIA_RECOVERY_COMMERCE_SANDBOX",
      "RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1",
      "RITUVIA_PAYMENT_PROVIDER",
      "RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS",
      "RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS",
      "RITUVIA_PRIVACY_EXPORT_KEY_V1",
      "RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS",
      "RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS",
      "RITUVIA_PRIVACY_EXPORT_TTL_SECONDS",
      "RITUVIA_PRIVATE_CONTENT_KEY_V1",
      "RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE",
      "RITUVIA_REFLECTION_POLICY_VERSION",
      "RITUVIA_REFLECTION_RETENTION_SECONDS",
      "RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS",
      "RITUVIA_STRIPE_ACCOUNT_ID",
      "RITUVIA_STRIPE_PRICE_IDS",
      "RITUVIA_TAROT_INTEGRITY_KEY_V1",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);
  });

  it("parses valid overrides and projects only the client allowlist", () => {
    const serverOnlyCanary = "server-only-sender-canary@invalid.example";
    const configuration = parseServerConfiguration({
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://local:password@127.0.0.1:5432/app",
      PRIVACY_DELETION_DATABASE_URL: "postgresql://privacy-delete:password@127.0.0.1:5432/app",
      RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: "/srv/rituvia/astrology/build-metadata.json",
      BRAND_NAME: "Configurable Brand",
      BRAND_SHORT_NAME: "CB",
      BRAND_LEGAL_ENTITY: "Private Legal Entity",
      BRAND_TAGLINE: "A configurable tagline",
      BRAND_CANONICAL_ORIGIN: "https://example.com",
      BRAND_SUPPORT_EMAIL: "support@example.com",
      BRAND_TRANSACTIONAL_SENDER: serverOnlyCanary,
      BRAND_SOCIAL_HANDLES: JSON.stringify({ example: "@configurable" }),
      BRAND_ASSET_MANIFEST: "/brand/manifest.json",
    });

    expect(configuration.deploymentEnvironment).toBe("staging");
    expect(configuration.brand.transactionalSender).toBe(serverOnlyCanary);
    expect(Object.keys(configuration.client)).toEqual(["brand"]);
    expect(Object.keys(configuration.client.brand)).toEqual([
      "name",
      "shortName",
      "tagline",
      "canonicalOrigin",
      "socialHandles",
      "assetManifest",
    ]);
    expect(JSON.stringify(configuration.client)).not.toContain(serverOnlyCanary);
    expect(JSON.stringify(configuration.client)).not.toContain("DATABASE_URL");
    expect(configuration.privacyDeletionDatabaseUrl).toContain("privacy-delete");
    expect(configuration.astrologyNativeBuildMetadataPath).toBe(
      "/srv/rituvia/astrology/build-metadata.json",
    );
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.client)).toBe(true);
    expect(Object.isFrozen(configuration.client.brand.socialHandles)).toBe(true);
  });

  it("keeps native astrology safe-off and accepts only an absolute metadata JSON path", () => {
    expect(parseServerConfiguration({}).astrologyNativeBuildMetadataPath).toBeUndefined();
    expect(
      parseServerConfiguration({
        RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: "/srv/rituvia/astrology/build-metadata.json",
      }).astrologyNativeBuildMetadataPath,
    ).toBe("/srv/rituvia/astrology/build-metadata.json");
    expect(() =>
      parseServerConfiguration({
        RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: "../private/build-metadata.json",
      }),
    ).toThrowError("RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH:invalid");
    expect(() =>
      parseServerConfiguration({
        RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: "/srv/rituvia/../private/build-metadata.json",
      }),
    ).toThrowError("RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH:invalid");
  });

  it("keeps anonymous sessions safe-off until one complete explicit policy is supplied", () => {
    expect(parseServerConfiguration({}).anonymousSessionPolicy).toBeUndefined();
    expect(() =>
      parseServerConfiguration({ RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: "86400" }),
    ).toThrowError(
      "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT:missing, RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS:missing, RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION:missing",
    );

    const configuration = parseServerConfiguration({
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: "100",
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: "60",
      RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "test.anonymous-session.v1",
      RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: "86400",
    });
    expect(configuration.anonymousSessionPolicy).toEqual({
      issuanceLimit: 100,
      issuanceWindowSeconds: 60,
      policyVersion: "test.anonymous-session.v1",
      ttlSeconds: 86_400,
    });
    expect(Object.isFrozen(configuration.anonymousSessionPolicy)).toBe(true);
  });

  it("keeps account auth safe-off and validates bounded database rate controls", () => {
    expect(parseServerConfiguration({}).accountIdentityPolicy).toBeUndefined();
    expect(() =>
      parseServerConfiguration({ RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "5" }),
    ).toThrowError("RITUVIA_AUTH_DATA_KEY_V1:missing, RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1:missing");

    const configuration = parseServerConfiguration({
      RITUVIA_AUTH_DATA_KEY_V1: Buffer.alloc(32, 1).toString("base64url"),
      RITUVIA_AUTH_START_GLOBAL_LIMIT: "200",
      RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "4",
      RITUVIA_AUTH_START_WINDOW_SECONDS: "600",
      RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
    });
    expect(configuration.accountIdentityPolicy).toMatchObject({
      challengeTtlSeconds: 900,
      sessionTtlSeconds: 2_592_000,
      startGlobalLimit: 200,
      startIdentifierLimit: 4,
      startWindowSeconds: 600,
    });
    expect(Object.isFrozen(configuration.accountIdentityPolicy)).toBe(true);
    expect(() =>
      parseServerConfiguration({
        RITUVIA_AUTH_DATA_KEY_V1: Buffer.alloc(32, 1).toString("base64url"),
        RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "10001",
        RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
      }),
    ).toThrowError("RITUVIA_AUTH_START_IDENTIFIER_LIMIT:invalid");
  });

  it("keeps privacy export safe-off until one complete independently keyed policy exists", () => {
    expect(parseServerConfiguration({}).privacyExport).toBeUndefined();
    expect(() =>
      parseServerConfiguration({
        RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
      }),
    ).toThrowError(
      "RITUVIA_PRIVACY_EXPORT_KEY_V1:missing, RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS:missing, RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS:missing",
    );
    const key = Buffer.alloc(32, 9).toString("base64url");
    const configuration = parseServerConfiguration({
      RITUVIA_PRIVACY_EXPORT_KEY_V1: key,
      RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
    });
    expect(configuration.privacyExport).toMatchObject({
      artifactTtlSeconds: 900,
      encryptionKeyVersion: "privacy-export.v1",
      recentAuthenticationSeconds: 900,
      requestWindowSeconds: 3600,
    });
    expect(configuration.privacyExport?.artifactKey).toEqual(new Uint8Array(32).fill(9));
    expect(Object.isFrozen(configuration.privacyExport)).toBe(true);
    expect(() =>
      parseServerConfiguration({
        RITUVIA_PRIVACY_EXPORT_KEY_V1: key,
        RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
        RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
        RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "60",
      }),
    ).toThrowError("RITUVIA_PRIVACY_EXPORT_TTL_SECONDS:invalid");
    expect(() =>
      parseServerConfiguration({
        RITUVIA_AUTH_DATA_KEY_V1: key,
        RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
        RITUVIA_PRIVACY_EXPORT_KEY_V1: key,
        RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
        RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
        RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
      }),
    ).toThrowError("RITUVIA_PRIVACY_EXPORT_KEY_V1:invalid");
  });

  it("keeps privacy deletion safe-off until both bounded policy windows exist", () => {
    expect(parseServerConfiguration({}).privacyDeletionPolicy).toBeUndefined();
    expect(() =>
      parseServerConfiguration({
        RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      }),
    ).toThrowError("RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS:missing");
    const configuration = parseServerConfiguration({
      PRIVACY_DELETION_DATABASE_URL: "postgresql://privacy-delete:password@127.0.0.1:5432/app",
      RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
    });
    expect(configuration.privacyDeletionPolicy).toEqual({
      recentAuthenticationSeconds: 900,
      requestWindowSeconds: 3600,
    });
    expect(configuration.privacyDeletionDatabaseUrl).toContain("privacy-delete");
    expect(Object.isFrozen(configuration.privacyDeletionPolicy)).toBe(true);
    expect(() =>
      parseServerConfiguration({
        RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "86401",
        RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
      }),
    ).toThrowError("RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS:invalid");
  });

  it("enables the exact Item 9 identity sandbox only for local or staging", () => {
    const identitySandbox = {
      PRIVACY_DELETION_DATABASE_URL: "postgresql://privacy-delete:password@127.0.0.1:5432/app",
      RITUVIA_AUTH_DATA_KEY_V1: Buffer.alloc(32, 1).toString("base64url"),
      RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
      RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_KEY_V1: Buffer.alloc(32, 3).toString("base64url"),
      RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
      RITUVIA_RECOVERY_IDENTITY_SANDBOX: "item-9",
    } as const;
    expect(
      parseServerConfiguration({ APP_ENV: "local", ...identitySandbox }).recoveryIdentitySandbox,
    ).toMatchObject({
      allowedWalletChainIds: [84_532],
      enabled: true,
      walletChallengeTtlSeconds: 300,
      walletRecentAuthenticationSeconds: 900,
    });
    expect(
      parseServerConfiguration({ APP_ENV: "staging", ...identitySandbox }).recoveryIdentitySandbox,
    ).toMatchObject({ enabled: true });
    expect(() => parseServerConfiguration({ APP_ENV: "preview", ...identitySandbox })).toThrowError(
      "RITUVIA_RECOVERY_IDENTITY_SANDBOX:invalid",
    );
  });

  it("derives the exact deletion-role connection only in Item 9 staging", () => {
    const rolePassword = Buffer.alloc(32, 4).toString("base64url");
    const applicationUrl = new URL("postgresql://staging.invalid/rituvia?sslmode=require");
    applicationUrl.username = "rituvia_app";
    applicationUrl.password = "application-password";
    const staging = parseServerConfiguration({
      APP_ENV: "staging",
      DATABASE_URL: applicationUrl.toString(),
      RITUVIA_AUTH_DATA_KEY_V1: Buffer.alloc(32, 1).toString("base64url"),
      RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
      RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD: rolePassword,
      RITUVIA_PRIVACY_EXPORT_KEY_V1: Buffer.alloc(32, 3).toString("base64url"),
      RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
      RITUVIA_RECOVERY_IDENTITY_SANDBOX: "item-9",
    });
    const deletionUrl = new URL(staging.privacyDeletionDatabaseUrl!);
    expect(decodeURIComponent(deletionUrl.username)).toBe("rituvia_privacy_deletion");
    expect(decodeURIComponent(deletionUrl.password)).toBe(rolePassword);
    expect(deletionUrl.hostname).toBe("staging.invalid");
    expect(deletionUrl.searchParams.get("sslmode")).toBe("require");

    for (const environment of ["local", "preview", "production"] as const) {
      expect(() =>
        parseServerConfiguration({
          APP_ENV: environment,
          ...(environment === "production"
            ? {
                BRAND_ASSET_MANIFEST: "/brand/manifest.json",
                BRAND_CANONICAL_ORIGIN: "https://example.com",
                BRAND_LEGAL_ENTITY: "Entity",
                BRAND_NAME: "Brand",
                BRAND_SHORT_NAME: "Brand",
                BRAND_SOCIAL_HANDLES: "{}",
                BRAND_SUPPORT_EMAIL: "support@example.com",
                BRAND_TAGLINE: "Tagline",
                BRAND_TRANSACTIONAL_SENDER: "Brand <support@example.com>",
              }
            : {}),
          DATABASE_URL: applicationUrl.toString(),
          RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD: rolePassword,
          RITUVIA_RECOVERY_IDENTITY_SANDBOX: "item-9",
        }),
      ).toThrowError("RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD:invalid");
    }
  });

  it("keeps question intake safe-off and requires an owner reference for production", () => {
    expect(parseServerConfiguration({}).questionIntakeActivationReference).toBeUndefined();
    expect(
      parseServerConfiguration({
        RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: "test.question-intake.v1",
      }).questionIntakeActivationReference,
    ).toBe("test.question-intake.v1");

    const production = {
      APP_ENV: "production",
      BRAND_NAME: "Brand",
      BRAND_SHORT_NAME: "Brand",
      BRAND_LEGAL_ENTITY: "Entity",
      BRAND_TAGLINE: "Tagline",
      BRAND_CANONICAL_ORIGIN: "https://example.com",
      BRAND_SUPPORT_EMAIL: "support@example.com",
      BRAND_TRANSACTIONAL_SENDER: "Brand <support@example.com>",
      BRAND_SOCIAL_HANDLES: "{}",
      BRAND_ASSET_MANIFEST: "/brand/manifest.json",
    } as const;
    expect(() =>
      parseServerConfiguration({
        ...production,
        RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: "test.question-intake.v1",
      }),
    ).toThrowError("RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE:invalid");
    expect(
      parseServerConfiguration({
        ...production,
        RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: "own-009.question-intake.v1",
      }).questionIntakeActivationReference,
    ).toBe("own-009.question-intake.v1");
  });

  it("requires an owner-decision policy reference in production and rejects unsafe bounds", () => {
    const base = {
      APP_ENV: "production",
      BRAND_NAME: "Brand",
      BRAND_SHORT_NAME: "Brand",
      BRAND_LEGAL_ENTITY: "Entity",
      BRAND_TAGLINE: "Tagline",
      BRAND_CANONICAL_ORIGIN: "https://example.com",
      BRAND_SUPPORT_EMAIL: "support@example.com",
      BRAND_TRANSACTIONAL_SENDER: "Brand <support@example.com>",
      BRAND_SOCIAL_HANDLES: "{}",
      BRAND_ASSET_MANIFEST: "/brand/manifest.json",
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: "100",
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: "60",
      RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: "86400",
    } as const;
    expect(() =>
      parseServerConfiguration({
        ...base,
        RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "test.anonymous-session.v1",
      }),
    ).toThrowError("RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION:invalid");
    expect(
      parseServerConfiguration({
        ...base,
        RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "own-004.anonymous-session.v1",
      }).anonymousSessionPolicy,
    ).toMatchObject({ policyVersion: "own-004.anonymous-session.v1", ttlSeconds: 86_400 });
    expect(() =>
      parseServerConfiguration({
        ...base,
        RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: "0",
        RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "own-004.anonymous-session.v1",
      }),
    ).toThrowError("RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT:invalid");
  });

  it("rejects public environment variables because the client uses a server projection", () => {
    expect(() =>
      parseBuildConfiguration({ NEXT_PUBLIC_ACCIDENTAL_SECRET: "never-public" }),
    ).toThrowError(
      "Invalid build configuration: NEXT_PUBLIC_ACCIDENTAL_SECRET:unexpected-public-variable",
    );
  });

  it("redacts invalid database values from every error surface", () => {
    const secretCanary = "invalid-database-secret-canary";

    try {
      parseServerConfiguration({ DATABASE_URL: secretCanary });
      expect.unreachable("invalid database configuration should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain("DATABASE_URL:invalid");
      expect(String(error)).not.toContain(secretCanary);
      expect((error as Error).stack).not.toContain(secretCanary);
      expect(JSON.stringify(error)).not.toContain(secretCanary);
      expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    }
  });

  it("requires public HTTPS brand configuration without blocking a free production launch", () => {
    const productionEnvironment = {
      APP_ENV: "production",
      BRAND_NAME: "Brand",
      BRAND_SHORT_NAME: "Brand",
      BRAND_TAGLINE: "Tagline",
      BRAND_CANONICAL_ORIGIN: "https://example.com",
      BRAND_SOCIAL_HANDLES: "{}",
      BRAND_ASSET_MANIFEST: "/brand/manifest.json",
    } as const;

    try {
      parseBuildConfiguration({ APP_ENV: "production" });
      throw new Error("Expected production brand validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain("BRAND_NAME:missing");
      expect(String(error)).not.toContain("BRAND_LEGAL_ENTITY:missing");
      expect(String(error)).not.toContain("BRAND_SUPPORT_EMAIL:missing");
      expect(String(error)).not.toContain("BRAND_TRANSACTIONAL_SENDER:missing");
    }
    expect(parseBuildConfiguration(productionEnvironment)).toMatchObject({
      deploymentEnvironment: "production",
      brand: {
        legalEntity: "",
        supportEmail: "",
        transactionalSender: "",
      },
    });
    expect(() =>
      parseBuildConfiguration({
        ...productionEnvironment,
        BRAND_CANONICAL_ORIGIN: "http://example.com",
      }),
    ).toThrowError("BRAND_CANONICAL_ORIGIN:invalid");
  });

  it("binds Stripe Test and Live credentials to the deployment environment", () => {
    const databaseUrl = (username: string, password: string, database = "app") => {
      const url = new URL(`postgresql://127.0.0.1:5432/${database}`);
      url.username = username;
      url.password = password;
      url.searchParams.set("sslmode", "require");
      return url.toString();
    };
    const priceIds = JSON.stringify({
      pack_15: "price_pack15test",
      pack_40: "price_pack40test",
      pack_6: "price_pack06test",
      plus_annual: "price_plusannual",
      plus_monthly: "price_plusmonthly",
    });
    const sandbox = {
      APP_ENV: "staging",
      DATABASE_URL: databaseUrl("rituvia_app", "app-password"),
      PAYMENT_WEBHOOK_DATABASE_URL: databaseUrl("rituvia_payment_webhook", "webhook-password"),
      RITUVIA_PAYMENT_PROVIDER: "stripe",
      RITUVIA_STRIPE_ACCOUNT_ID: "acct_12345678",
      RITUVIA_STRIPE_PRICE_IDS: priceIds,
      STRIPE_SECRET_KEY: `sk_test_${"a".repeat(24)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"b".repeat(24)}`,
    } as const;

    expect(parseServerConfiguration(sandbox).payment).toMatchObject({
      accountId: sandbox.RITUVIA_STRIPE_ACCOUNT_ID,
      mode: "test",
      provider: "stripe",
      secretKey: sandbox.STRIPE_SECRET_KEY,
    });
    expect(
      parseServerConfiguration({
        ...sandbox,
        RITUVIA_RECOVERY_COMMERCE_SANDBOX: "item-10",
      }).recoveryCommerceSandbox,
    ).toEqual({ enabled: true });
    const rolePassword = Buffer.alloc(32, 5).toString("base64url");
    const derivedRoleConfiguration = parseServerConfiguration({
      ...sandbox,
      PAYMENT_WEBHOOK_DATABASE_URL: undefined,
      RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD: rolePassword,
      RITUVIA_RECOVERY_COMMERCE_SANDBOX: "item-10",
    });
    const derivedWebhookUrl = new URL(derivedRoleConfiguration.paymentWebhookDatabaseUrl!);
    expect(decodeURIComponent(derivedWebhookUrl.username)).toBe("rituvia_payment_webhook");
    expect(decodeURIComponent(derivedWebhookUrl.password)).toBe(rolePassword);
    expect(derivedWebhookUrl.hostname).toBe("127.0.0.1");
    expect(derivedWebhookUrl.searchParams.get("sslmode")).toBe("require");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        PAYMENT_WEBHOOK_DATABASE_URL: undefined,
        RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD: "app-password",
        RITUVIA_RECOVERY_COMMERCE_SANDBOX: "item-10",
      }),
    ).toThrowError("RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        APP_ENV: "local",
        PAYMENT_WEBHOOK_DATABASE_URL: undefined,
        RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD: rolePassword,
        RITUVIA_RECOVERY_COMMERCE_SANDBOX: "item-10",
      }),
    ).toThrowError("RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        PAYMENT_WEBHOOK_DATABASE_URL: undefined,
      }),
    ).toThrowError("PAYMENT_WEBHOOK_DATABASE_URL:missing");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        PAYMENT_WEBHOOK_DATABASE_URL: sandbox.DATABASE_URL,
      }),
    ).toThrowError("PAYMENT_WEBHOOK_DATABASE_URL:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        PAYMENT_WEBHOOK_DATABASE_URL: sandbox.DATABASE_URL.replace(
          "rituvia_app:app-password",
          "%72ituvia_app:%61pp-password",
        ),
      }),
    ).toThrowError("PAYMENT_WEBHOOK_DATABASE_URL:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        PAYMENT_WEBHOOK_DATABASE_URL: databaseUrl(
          "rituvia_payment_webhook",
          "webhook-password",
          "other",
        ),
      }),
    ).toThrowError("PAYMENT_WEBHOOK_DATABASE_URL:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        STRIPE_SECRET_KEY: `sk_live_${"a".repeat(24)}`,
      }),
    ).toThrowError("STRIPE_SECRET_KEY:invalid");
    const live = {
      ...sandbox,
      APP_ENV: "production",
      BRAND_ASSET_MANIFEST: "/brand/manifest.json",
      BRAND_CANONICAL_ORIGIN: "https://example.com",
      BRAND_LEGAL_ENTITY: "Entity",
      BRAND_NAME: "Brand",
      BRAND_SHORT_NAME: "Brand",
      BRAND_SOCIAL_HANDLES: "{}",
      BRAND_SUPPORT_EMAIL: "support@example.com",
      BRAND_TAGLINE: "Tagline",
      BRAND_TRANSACTIONAL_SENDER: "Brand <support@example.com>",
      STRIPE_SECRET_KEY: `sk_live_${"a".repeat(24)}`,
    } as const;
    expect(parseServerConfiguration(live).payment).toMatchObject({
      mode: "live",
      provider: "stripe",
    });
    expect(
      parseServerConfiguration({
        ...live,
        RITUVIA_STRIPE_PRICE_IDS: JSON.stringify({ pack_6: "price_pack06live" }),
      }).payment,
    ).toMatchObject({
      priceIds: { pack_6: "price_pack06live" },
    });
    expect(() =>
      parseServerConfiguration({
        ...live,
        BRAND_LEGAL_ENTITY: undefined,
        BRAND_SUPPORT_EMAIL: undefined,
        BRAND_TRANSACTIONAL_SENDER: undefined,
      }),
    ).toThrowError(
      "BRAND_LEGAL_ENTITY:missing, BRAND_SUPPORT_EMAIL:missing, BRAND_TRANSACTIONAL_SENDER:missing",
    );
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        APP_ENV: "production",
        BRAND_ASSET_MANIFEST: "/brand/manifest.json",
        BRAND_CANONICAL_ORIGIN: "https://example.com",
        BRAND_LEGAL_ENTITY: "Entity",
        BRAND_NAME: "Brand",
        BRAND_SHORT_NAME: "Brand",
        BRAND_SOCIAL_HANDLES: "{}",
        BRAND_SUPPORT_EMAIL: "support@example.com",
        BRAND_TAGLINE: "Tagline",
        BRAND_TRANSACTIONAL_SENDER: "Brand <support@example.com>",
      }),
    ).toThrowError("STRIPE_SECRET_KEY:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        RITUVIA_STRIPE_PRICE_IDS: JSON.stringify({
          mindful_incense: "price_legacytest",
        }),
      }),
    ).toThrowError("RITUVIA_STRIPE_PRICE_IDS:invalid");
    expect(() =>
      parseServerConfiguration({
        ...sandbox,
        RITUVIA_STRIPE_PRICE_IDS: "{}",
      }),
    ).toThrowError("RITUVIA_STRIPE_PRICE_IDS:invalid");
  });

  it("allows Item 11 only as a complete protected-staging sandbox", () => {
    const databaseUrl = (username: string, password: string) => {
      const url = new URL("postgresql://127.0.0.1:5432/app");
      url.username = username;
      url.password = password;
      return url.toString();
    };
    const item11 = {
      AI_GENERATION_DATABASE_URL: databaseUrl("rituvia_ai_generation", "ai-password"),
      APP_ENV: "staging",
      DATABASE_URL: databaseUrl("rituvia_app", "app-password"),
      PAYMENT_WEBHOOK_DATABASE_URL: databaseUrl("rituvia_payment_webhook", "webhook-password"),
      RITUVIA_AI_DAILY_USER_LIMIT: "3",
      RITUVIA_AI_GATEWAY_MODEL: "openai/gpt-5.4-nano",
      RITUVIA_AI_MAX_COST_MICROS: "25000",
      RITUVIA_AI_MAX_OUTPUT_TOKENS: "384",
      RITUVIA_AI_TIMEOUT_MS: "8000",
      RITUVIA_COINBASE_API_KEY_ID: "11111111-1111-4111-8111-111111111111",
      RITUVIA_COINBASE_API_KEY_SECRET: Buffer.alloc(64, 7).toString("base64"),
      RITUVIA_COINBASE_WEBHOOK_SECRET: "sandbox_webhook_secret_123456",
      RITUVIA_PAYMENT_PROVIDER: "stripe",
      RITUVIA_RECOVERY_COMMERCE_SANDBOX: "item-10",
      RITUVIA_RECOVERY_ITEM_11_SANDBOX: "item-11",
      RITUVIA_STRIPE_ACCOUNT_ID: "acct_12345678",
      RITUVIA_STRIPE_PRICE_IDS: JSON.stringify({
        pack_15: "price_pack15test",
        pack_40: "price_pack40test",
        pack_6: "price_pack06test",
        plus_annual: "price_plusannual",
        plus_monthly: "price_plusmonthly",
      }),
      STRIPE_SECRET_KEY: `sk_test_${"a".repeat(24)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${"b".repeat(24)}`,
    } as const;

    expect(parseServerConfiguration(item11).recoveryItem11Sandbox).toMatchObject({
      ai: {
        dailyUserLimit: 3,
        maxCostMicros: 25_000,
        maxOutputTokens: 384,
        model: "openai/gpt-5.4-nano",
        timeoutMs: 8_000,
      },
      coinbase: { apiKeyId: item11.RITUVIA_COINBASE_API_KEY_ID },
      enabled: true,
    });
    expect(() => parseServerConfiguration({ ...item11, APP_ENV: "preview" })).toThrowError(
      "RITUVIA_RECOVERY_ITEM_11_SANDBOX:invalid",
    );
    expect(() =>
      parseServerConfiguration({ ...item11, RITUVIA_COINBASE_WEBHOOK_SECRET: undefined }),
    ).toThrowError("RITUVIA_COINBASE_WEBHOOK_SECRET:missing");
    expect(
      parseServerConfiguration({
        ...item11,
        RITUVIA_COINBASE_API_KEY_ID: "organizations/recovery/apiKeys/item11",
        RITUVIA_COINBASE_API_KEY_SECRET: `-----BEGIN EC ${"PRIVATE KEY"}-----\n${"a".repeat(100)}\n-----END EC ${"PRIVATE KEY"}-----`,
      }).recoveryItem11Sandbox,
    ).toMatchObject({ enabled: true });
    expect(() =>
      parseServerConfiguration({
        ...item11,
        AI_GENERATION_DATABASE_URL: item11.DATABASE_URL,
      }),
    ).toThrowError("AI_GENERATION_DATABASE_URL:invalid");
  });

  it("revalidates serialized client input and rejects extra fields", () => {
    const configuration = parseBuildConfiguration({});

    expect(parseClientConfiguration(configuration.client)).toEqual(configuration.client);
    expect(() =>
      parseClientConfiguration({
        ...configuration.client,
        databaseUrl: "must-not-cross-the-boundary",
      }),
    ).toThrow(ConfigurationError);
  });
});
