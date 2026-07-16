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
    expect(serverEnvironmentVariables).toEqual([...buildEnvironmentVariables, "DATABASE_URL"]);
  });

  it("parses valid overrides and projects only the client allowlist", () => {
    const serverOnlyCanary = "server-only-sender-canary@invalid.example";
    const configuration = parseServerConfiguration({
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://local:password@127.0.0.1:5432/app",
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
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.client)).toBe(true);
    expect(Object.isFrozen(configuration.client.brand.socialHandles)).toBe(true);
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

  it("requires explicit complete HTTPS brand configuration for production", () => {
    const productionEnvironment = {
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

    expect(() => parseBuildConfiguration({ APP_ENV: "production" })).toThrowError(
      ConfigurationError,
    );
    expect(parseBuildConfiguration(productionEnvironment).deploymentEnvironment).toBe("production");
    expect(() =>
      parseBuildConfiguration({
        ...productionEnvironment,
        BRAND_CANONICAL_ORIGIN: "http://example.com",
      }),
    ).toThrowError("BRAND_CANONICAL_ORIGIN:invalid");
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
