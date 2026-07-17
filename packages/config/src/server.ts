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

const anonymousSessionEnvironmentVariables = Object.freeze([
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT",
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS",
  "RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION",
  "RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS",
] as const);

export const serverEnvironmentVariables = Object.freeze([
  ...buildEnvironmentVariables,
  "DATABASE_URL",
  ...anonymousSessionEnvironmentVariables,
  "RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE",
] as const);

export type DeploymentEnvironment = "local" | "preview" | "production" | "staging";
export type RawEnvironment = Readonly<Record<string, string | undefined>>;

export type BuildConfiguration = Readonly<{
  brand: ReturnType<typeof createBrandConfiguration>;
  client: ClientConfiguration;
  deploymentEnvironment: DeploymentEnvironment;
}>;

export type ServerConfiguration = Readonly<{
  anonymousSessionPolicy: AnonymousSessionPolicyConfiguration | undefined;
  brand: BuildConfiguration["brand"];
  client: ClientConfiguration;
  databaseUrl: string | undefined;
  deploymentEnvironment: DeploymentEnvironment;
  questionIntakeActivationReference: string | undefined;
}>;

export type AnonymousSessionPolicyConfiguration = Readonly<{
  issuanceLimit: number;
  issuanceWindowSeconds: number;
  policyVersion: string;
  ttlSeconds: number;
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
  RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100_000))
    .optional(),
  RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: z
    .string()
    .regex(/^[1-9][0-9]{0,3}$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(3_600))
    .optional(),
  RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: z
    .string()
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u)
    .max(100)
    .optional(),
  RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: z
    .string()
    .regex(/^[1-9][0-9]{0,7}$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(34_560_000))
    .optional(),
  RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: z
    .string()
    .regex(/^(?:test|own-[0-9]{3})[._-][a-z0-9]+(?:[._-][a-z0-9]+)*$/u)
    .max(120)
    .optional(),
});

const parseAnonymousSessionPolicy = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
  deploymentEnvironment: DeploymentEnvironment,
): AnonymousSessionPolicyConfiguration | undefined => {
  const values = {
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: parsed.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT,
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS:
      parsed.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS,
    RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: parsed.RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION,
    RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: parsed.RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS,
  } as const;
  const present = Object.values(values).filter((value) => value !== undefined).length;
  if (present === 0) return undefined;
  if (present !== anonymousSessionEnvironmentVariables.length) {
    const missing = [
      ...(values.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT === undefined
        ? ["RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT"]
        : []),
      ...(values.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS === undefined
        ? ["RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS"]
        : []),
      ...(values.RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION === undefined
        ? ["RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION"]
        : []),
      ...(values.RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS === undefined
        ? ["RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS"]
        : []),
    ];
    throw new ConfigurationError(
      "server",
      missing.map((key) => ({ code: "missing", key })),
    );
  }
  const policyVersion = values.RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION;
  if (
    policyVersion === undefined ||
    (deploymentEnvironment === "production" && !policyVersion.startsWith("own-004."))
  ) {
    throw new ConfigurationError("server", [
      { code: "invalid", key: "RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION" },
    ]);
  }
  return Object.freeze({
    issuanceLimit: values.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT!,
    issuanceWindowSeconds: values.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS!,
    policyVersion,
    ttlSeconds: values.RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS!,
  });
};

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
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: normalizeEnvironmentValue(
      environment.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT,
    ),
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS,
    ),
    RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: normalizeEnvironmentValue(
      environment.RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION,
    ),
    RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS,
    ),
    RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: normalizeEnvironmentValue(
      environment.RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE,
    ),
  });

  const questionIntakeActivationReference = server.RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE;
  if (
    build.deploymentEnvironment === "production" &&
    questionIntakeActivationReference !== undefined &&
    !questionIntakeActivationReference.startsWith("own-009.")
  ) {
    throw new ConfigurationError("server", [
      { code: "invalid", key: "RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE" },
    ]);
  }

  return Object.freeze({
    anonymousSessionPolicy: parseAnonymousSessionPolicy(server, build.deploymentEnvironment),
    brand: build.brand,
    client: build.client,
    databaseUrl: server.DATABASE_URL,
    deploymentEnvironment: build.deploymentEnvironment,
    questionIntakeActivationReference,
  });
};
