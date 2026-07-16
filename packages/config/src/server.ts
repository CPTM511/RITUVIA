import * as z from "zod";

import {
  createBrandConfiguration,
  projectClientBrandConfiguration,
  type BrandConfigOverrides,
} from "./brand.js";
import {
  brandAssetManifestSchema,
  brandCanonicalOriginSchema,
  brandSocialHandlesSchema,
} from "./client-brand.js";
import { parseClientConfiguration, type ClientConfiguration } from "./client.js";
import { ConfigurationError } from "./errors.js";
import { parseConfiguration } from "./parsing.js";

export const brandEnvironmentVariables = Object.freeze([
  "BRAND_NAME",
  "BRAND_SHORT_NAME",
  "BRAND_LEGAL_ENTITY",
  "BRAND_TAGLINE",
  "BRAND_CANONICAL_ORIGIN",
  "BRAND_SUPPORT_EMAIL",
  "BRAND_TRANSACTIONAL_SENDER",
  "BRAND_SOCIAL_HANDLES",
  "BRAND_ASSET_MANIFEST",
] as const);

export const buildEnvironmentVariables = Object.freeze([
  "APP_ENV",
  ...brandEnvironmentVariables,
] as const);

export const serverEnvironmentVariables = Object.freeze([
  ...buildEnvironmentVariables,
  "DATABASE_URL",
] as const);

export type DeploymentEnvironment = "local" | "preview" | "production" | "staging";
export type RawEnvironment = Readonly<Record<string, string | undefined>>;

export type BuildConfiguration = Readonly<{
  brand: ReturnType<typeof createBrandConfiguration>;
  client: ClientConfiguration;
  deploymentEnvironment: DeploymentEnvironment;
}>;

export type ServerConfiguration = Readonly<{
  brand: BuildConfiguration["brand"];
  client: ClientConfiguration;
  databaseUrl: string | undefined;
  deploymentEnvironment: DeploymentEnvironment;
}>;

const normalizeEnvironmentValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized === "" ? undefined : normalized;
};

const emailSenderSchema = z.union([
  z.email(),
  z
    .string()
    .regex(/^[^<>\r\n]{1,200}\s<[^<>\s]+@[^<>\s]+>$/)
    .max(320),
]);

const buildEnvironmentSchema = z.object({
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  BRAND_NAME: z.string().min(1).max(120).optional(),
  BRAND_SHORT_NAME: z.string().min(1).max(60).optional(),
  BRAND_LEGAL_ENTITY: z.string().max(200).optional(),
  BRAND_TAGLINE: z.string().max(240).optional(),
  BRAND_CANONICAL_ORIGIN: brandCanonicalOriginSchema.optional(),
  BRAND_SUPPORT_EMAIL: z.email().optional(),
  BRAND_TRANSACTIONAL_SENDER: emailSenderSchema.optional(),
  BRAND_SOCIAL_HANDLES: z.string().optional(),
  BRAND_ASSET_MANIFEST: brandAssetManifestSchema.optional(),
});

const databaseUrlSchema = z
  .string()
  .max(4_096)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  });

const serverEnvironmentSchema = z.object({
  DATABASE_URL: databaseUrlSchema.optional(),
});

const assertNoUnexpectedPublicEnvironment = (environment: RawEnvironment) => {
  const publicKeys = Object.keys(environment)
    .filter((key) => key.startsWith("NEXT_PUBLIC_"))
    .sort();

  if (publicKeys.length > 0) {
    throw new ConfigurationError(
      "build",
      publicKeys.map((key) => ({
        code: "unexpected-public-variable",
        key,
      })),
    );
  }
};

const parseSocialHandles = (
  value: string | undefined,
): Readonly<Record<string, string>> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    const result = brandSocialHandlesSchema.safeParse(JSON.parse(value));
    if (result.success) {
      return Object.freeze({ ...result.data });
    }
  } catch {
    // The stable configuration error below intentionally excludes the raw value.
  }

  throw new ConfigurationError("brand", [{ code: "invalid", key: "BRAND_SOCIAL_HANDLES" }]);
};

const parseBrandOverrides = (
  parsed: z.infer<typeof buildEnvironmentSchema>,
): BrandConfigOverrides => ({
  name: parsed.BRAND_NAME,
  shortName: parsed.BRAND_SHORT_NAME,
  legalEntity: parsed.BRAND_LEGAL_ENTITY,
  tagline: parsed.BRAND_TAGLINE,
  canonicalOrigin: parsed.BRAND_CANONICAL_ORIGIN,
  supportEmail: parsed.BRAND_SUPPORT_EMAIL,
  transactionalSender: parsed.BRAND_TRANSACTIONAL_SENDER,
  socialHandles: parseSocialHandles(parsed.BRAND_SOCIAL_HANDLES),
  assetManifest: parsed.BRAND_ASSET_MANIFEST,
});

const assertProductionBrandOverrides = (
  environment: RawEnvironment,
  deploymentEnvironment: DeploymentEnvironment,
) => {
  if (deploymentEnvironment !== "production") {
    return;
  }

  const environmentValues = new Map(Object.entries(environment));
  const missingKeys = brandEnvironmentVariables.filter(
    (key) => normalizeEnvironmentValue(environmentValues.get(key)) === undefined,
  );

  if (missingKeys.length > 0) {
    throw new ConfigurationError(
      "brand",
      missingKeys.map((key) => ({ code: "missing", key })),
    );
  }

  const origin = normalizeEnvironmentValue(environment.BRAND_CANONICAL_ORIGIN);
  if (origin === undefined || new URL(origin).protocol !== "https:") {
    throw new ConfigurationError("brand", [{ code: "invalid", key: "BRAND_CANONICAL_ORIGIN" }]);
  }
};

const readBuildEnvironmentInput = (environment: RawEnvironment) => ({
  APP_ENV: normalizeEnvironmentValue(environment.APP_ENV),
  BRAND_NAME: normalizeEnvironmentValue(environment.BRAND_NAME),
  BRAND_SHORT_NAME: normalizeEnvironmentValue(environment.BRAND_SHORT_NAME),
  BRAND_LEGAL_ENTITY: normalizeEnvironmentValue(environment.BRAND_LEGAL_ENTITY),
  BRAND_TAGLINE: normalizeEnvironmentValue(environment.BRAND_TAGLINE),
  BRAND_CANONICAL_ORIGIN: normalizeEnvironmentValue(environment.BRAND_CANONICAL_ORIGIN),
  BRAND_SUPPORT_EMAIL: normalizeEnvironmentValue(environment.BRAND_SUPPORT_EMAIL),
  BRAND_TRANSACTIONAL_SENDER: normalizeEnvironmentValue(environment.BRAND_TRANSACTIONAL_SENDER),
  BRAND_SOCIAL_HANDLES: normalizeEnvironmentValue(environment.BRAND_SOCIAL_HANDLES),
  BRAND_ASSET_MANIFEST: normalizeEnvironmentValue(environment.BRAND_ASSET_MANIFEST),
});

export const parseBuildConfiguration = (environment: RawEnvironment): BuildConfiguration => {
  assertNoUnexpectedPublicEnvironment(environment);
  const parsed = parseConfiguration(
    "build",
    buildEnvironmentSchema,
    readBuildEnvironmentInput(environment),
  );
  assertProductionBrandOverrides(environment, parsed.APP_ENV);
  const brand = createBrandConfiguration(parseBrandOverrides(parsed));
  const client = parseClientConfiguration({
    brand: projectClientBrandConfiguration(brand),
  });

  return Object.freeze({
    brand,
    client,
    deploymentEnvironment: parsed.APP_ENV,
  });
};

export const parseServerConfiguration = (environment: RawEnvironment): ServerConfiguration => {
  const build = parseBuildConfiguration(environment);
  const server = parseConfiguration("server", serverEnvironmentSchema, {
    DATABASE_URL: normalizeEnvironmentValue(environment.DATABASE_URL),
  });

  return Object.freeze({
    brand: build.brand,
    client: build.client,
    databaseUrl: server.DATABASE_URL,
    deploymentEnvironment: build.deploymentEnvironment,
  });
};
