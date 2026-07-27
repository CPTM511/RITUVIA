import * as z from "zod";
import { Buffer } from "node:buffer";

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
  "PRIVACY_DELETION_DATABASE_URL",
  "RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH",
  ...anonymousSessionEnvironmentVariables,
  "RITUVIA_ACCOUNT_SESSION_TTL_SECONDS",
  "RITUVIA_AUTH_CHALLENGE_TTL_SECONDS",
  "RITUVIA_AUTH_DATA_KEY_V1",
  "RITUVIA_AUTH_START_GLOBAL_LIMIT",
  "RITUVIA_AUTH_START_IDENTIFIER_LIMIT",
  "RITUVIA_AUTH_START_WINDOW_SECONDS",
  "RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1",
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
  "RITUVIA_STRIPE_PRICE_IDS",
  "RITUVIA_TAROT_INTEGRITY_KEY_V1",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const);

export type DeploymentEnvironment = "local" | "preview" | "production" | "staging";
export type RawEnvironment = Readonly<Record<string, string | undefined>>;

export type BuildConfiguration = Readonly<{
  brand: ReturnType<typeof createBrandConfiguration>;
  client: ClientConfiguration;
  deploymentEnvironment: DeploymentEnvironment;
}>;

export type ServerConfiguration = Readonly<{
  accountIdentityPolicy: AccountIdentityPolicyConfiguration | undefined;
  anonymousSessionPolicy: AnonymousSessionPolicyConfiguration | undefined;
  astrologyNativeBuildMetadataPath: string | undefined;
  brand: BuildConfiguration["brand"];
  client: ClientConfiguration;
  databaseUrl: string | undefined;
  deploymentEnvironment: DeploymentEnvironment;
  payment: PaymentConfiguration | undefined;
  privateContentKeyring: PrivateContentKeyringConfiguration | undefined;
  privacyDeletionPolicy: PrivacyDeletionPolicyConfiguration | undefined;
  privacyDeletionDatabaseUrl: string | undefined;
  privacyExport: PrivacyExportConfiguration | undefined;
  questionIntakeActivationReference: string | undefined;
  reflectionPolicy: ReflectionPolicyConfiguration | undefined;
  tarotReadingIntegrityKeyring: TarotReadingIntegrityKeyringConfiguration | undefined;
}>;

export type AnonymousSessionPolicyConfiguration = Readonly<{
  issuanceLimit: number;
  issuanceWindowSeconds: number;
  policyVersion: string;
  ttlSeconds: number;
}>;

export type AccountIdentityPolicyConfiguration = Readonly<{
  challengeTtlSeconds: number;
  emailEncryptionKey: Uint8Array;
  encryptionKeyVersion: "auth-data.v1";
  providerSubjectHmacKey: Uint8Array;
  sessionTtlSeconds: number;
  startGlobalLimit: number;
  startIdentifierLimit: number;
  startWindowSeconds: number;
}>;

export type PrivateContentKeyringConfiguration = Readonly<{
  activeKeyVersion: "private-content.v1";
  digestKeyVersion: "private-content.v1";
  keys: readonly Readonly<{ key: Uint8Array; version: "private-content.v1" }>[];
}>;

export type PrivacyExportConfiguration = Readonly<{
  artifactKey: Uint8Array;
  artifactTtlSeconds: number;
  encryptionKeyVersion: "privacy-export.v1";
  recentAuthenticationSeconds: number;
  requestWindowSeconds: number;
}>;

export type PrivacyDeletionPolicyConfiguration = Readonly<{
  recentAuthenticationSeconds: number;
  requestWindowSeconds: number;
}>;

export type ReflectionPolicyConfiguration = Readonly<{
  policyVersion: string;
  retentionSeconds: number;
  revisitDelaySeconds: number;
}>;

export type PaymentConfiguration =
  | Readonly<{
      localSigningSecret: Uint8Array;
      provider: "local";
    }>
  | Readonly<{
      priceIds: Readonly<Record<string, string>>;
      provider: "stripe";
      secretKey: string;
      webhookSecret: string;
    }>;

export type TarotReadingIntegrityKeyringConfiguration = Readonly<{
  activeVersion: "tarot-integrity.v1";
  keys: readonly Readonly<{ encodedKey: string; version: "tarot-integrity.v1" }>[];
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

const encodedSecretKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/u)
  .refine((value) => {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength === 32 && decoded.toString("base64url") === value;
  });

const positiveSecondsSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,7}$/u)
  .transform(Number)
  .pipe(z.number().int().min(60).max(34_560_000));

const stripePriceIdsSchema = z.string().max(8_192);
const absoluteMetadataPathSchema = z
  .string()
  .min(2)
  .max(4_096)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.includes("\0") &&
      !value.split("/").includes("..") &&
      value.endsWith(".json"),
  );

const serverEnvironmentSchema = z.object({
  DATABASE_URL: databaseUrlSchema.optional(),
  PRIVACY_DELETION_DATABASE_URL: databaseUrlSchema.optional(),
  RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: absoluteMetadataPathSchema.optional(),
  RITUVIA_ACCOUNT_SESSION_TTL_SECONDS: positiveSecondsSchema.optional(),
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
  RITUVIA_AUTH_CHALLENGE_TTL_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_AUTH_DATA_KEY_V1: encodedSecretKeySchema.optional(),
  RITUVIA_AUTH_START_GLOBAL_LIMIT: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100_000))
    .optional(),
  RITUVIA_AUTH_START_IDENTIFIER_LIMIT: z
    .string()
    .regex(/^[1-9][0-9]{0,3}$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(10_000))
    .optional(),
  RITUVIA_AUTH_START_WINDOW_SECONDS: z
    .string()
    .regex(/^[1-9][0-9]{0,4}$/u)
    .transform(Number)
    .pipe(z.number().int().min(60).max(86_400))
    .optional(),
  RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: encodedSecretKeySchema.optional(),
  RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1: encodedSecretKeySchema.optional(),
  RITUVIA_PAYMENT_PROVIDER: z.enum(["local", "stripe"]).optional(),
  RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_PRIVACY_EXPORT_KEY_V1: encodedSecretKeySchema.optional(),
  RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_PRIVATE_CONTENT_KEY_V1: encodedSecretKeySchema.optional(),
  RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: z
    .string()
    .regex(/^(?:test|own-[0-9]{3})[._-][a-z0-9]+(?:[._-][a-z0-9]+)*$/u)
    .max(120)
    .optional(),
  RITUVIA_REFLECTION_POLICY_VERSION: z
    .string()
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u)
    .max(100)
    .optional(),
  RITUVIA_REFLECTION_RETENTION_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS: positiveSecondsSchema.optional(),
  RITUVIA_STRIPE_PRICE_IDS: stripePriceIdsSchema.optional(),
  RITUVIA_TAROT_INTEGRITY_KEY_V1: encodedSecretKeySchema.optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(?:test|live)_[A-Za-z0-9_]{16,255}$/u)
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_[A-Za-z0-9]{16,255}$/u)
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

const decodeSecretKey = (value: string): Uint8Array =>
  Uint8Array.from(Buffer.from(value, "base64url"));

const parseAccountIdentityPolicy = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
): AccountIdentityPolicyConfiguration | undefined => {
  const keyValues = [parsed.RITUVIA_AUTH_DATA_KEY_V1, parsed.RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1];
  const configuredKeys = keyValues.filter((value) => value !== undefined).length;
  const hasTtlOverrides =
    parsed.RITUVIA_AUTH_CHALLENGE_TTL_SECONDS !== undefined ||
    parsed.RITUVIA_ACCOUNT_SESSION_TTL_SECONDS !== undefined ||
    parsed.RITUVIA_AUTH_START_GLOBAL_LIMIT !== undefined ||
    parsed.RITUVIA_AUTH_START_IDENTIFIER_LIMIT !== undefined ||
    parsed.RITUVIA_AUTH_START_WINDOW_SECONDS !== undefined;
  if (configuredKeys === 0 && !hasTtlOverrides) return undefined;
  if (configuredKeys !== keyValues.length) {
    throw new ConfigurationError("server", [
      ...(parsed.RITUVIA_AUTH_DATA_KEY_V1 === undefined
        ? [{ code: "missing" as const, key: "RITUVIA_AUTH_DATA_KEY_V1" }]
        : []),
      ...(parsed.RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1 === undefined
        ? [{ code: "missing" as const, key: "RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1" }]
        : []),
    ]);
  }
  return Object.freeze({
    challengeTtlSeconds: parsed.RITUVIA_AUTH_CHALLENGE_TTL_SECONDS ?? 900,
    emailEncryptionKey: decodeSecretKey(parsed.RITUVIA_AUTH_DATA_KEY_V1!),
    encryptionKeyVersion: "auth-data.v1",
    providerSubjectHmacKey: decodeSecretKey(parsed.RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1!),
    sessionTtlSeconds: parsed.RITUVIA_ACCOUNT_SESSION_TTL_SECONDS ?? 2_592_000,
    startGlobalLimit: parsed.RITUVIA_AUTH_START_GLOBAL_LIMIT ?? 500,
    startIdentifierLimit: parsed.RITUVIA_AUTH_START_IDENTIFIER_LIMIT ?? 5,
    startWindowSeconds: parsed.RITUVIA_AUTH_START_WINDOW_SECONDS ?? 900,
  });
};

const parseReflectionConfiguration = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
): Readonly<{
  keyring: PrivateContentKeyringConfiguration | undefined;
  policy: ReflectionPolicyConfiguration | undefined;
}> => {
  const hasPolicyOverrides =
    parsed.RITUVIA_REFLECTION_POLICY_VERSION !== undefined ||
    parsed.RITUVIA_REFLECTION_RETENTION_SECONDS !== undefined ||
    parsed.RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS !== undefined;
  if (parsed.RITUVIA_PRIVATE_CONTENT_KEY_V1 === undefined) {
    if (hasPolicyOverrides) {
      throw new ConfigurationError("server", [
        { code: "missing", key: "RITUVIA_PRIVATE_CONTENT_KEY_V1" },
      ]);
    }
    return Object.freeze({ keyring: undefined, policy: undefined });
  }
  const policyVersion = parsed.RITUVIA_REFLECTION_POLICY_VERSION ?? "reflection-loop.en.v1";
  if (policyVersion !== "reflection-loop.en.v1") {
    throw new ConfigurationError("server", [
      { code: "invalid", key: "RITUVIA_REFLECTION_POLICY_VERSION" },
    ]);
  }
  const key = decodeSecretKey(parsed.RITUVIA_PRIVATE_CONTENT_KEY_V1);
  return Object.freeze({
    keyring: Object.freeze({
      activeKeyVersion: "private-content.v1",
      digestKeyVersion: "private-content.v1",
      keys: Object.freeze([Object.freeze({ key, version: "private-content.v1" as const })]),
    }),
    policy: Object.freeze({
      policyVersion,
      retentionSeconds: parsed.RITUVIA_REFLECTION_RETENTION_SECONDS ?? 7_776_000,
      revisitDelaySeconds: parsed.RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS ?? 86_400,
    }),
  });
};

const parsePrivacyExportConfiguration = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
): PrivacyExportConfiguration | undefined => {
  const values = {
    RITUVIA_PRIVACY_EXPORT_KEY_V1: parsed.RITUVIA_PRIVACY_EXPORT_KEY_V1,
    RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: parsed.RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS,
    RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS:
      parsed.RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS,
    RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: parsed.RITUVIA_PRIVACY_EXPORT_TTL_SECONDS,
  } as const;
  const present = Object.values(values).filter((value) => value !== undefined).length;
  if (present === 0) return undefined;
  if (present !== Object.keys(values).length) {
    throw new ConfigurationError(
      "server",
      Object.entries(values)
        .filter(([, value]) => value === undefined)
        .map(([key]) => ({ code: "missing" as const, key })),
    );
  }
  const artifactTtlSeconds = values.RITUVIA_PRIVACY_EXPORT_TTL_SECONDS!;
  const recentAuthenticationSeconds = values.RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS!;
  const requestWindowSeconds = values.RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS!;
  if (
    artifactTtlSeconds < 300 ||
    artifactTtlSeconds > 604_800 ||
    recentAuthenticationSeconds > 86_400 ||
    requestWindowSeconds > 604_800
  ) {
    throw new ConfigurationError("server", [
      {
        code: "invalid",
        key:
          artifactTtlSeconds < 300 || artifactTtlSeconds > 604_800
            ? "RITUVIA_PRIVACY_EXPORT_TTL_SECONDS"
            : recentAuthenticationSeconds > 86_400
              ? "RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS"
              : "RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS",
      },
    ]);
  }
  return Object.freeze({
    artifactKey: decodeSecretKey(values.RITUVIA_PRIVACY_EXPORT_KEY_V1!),
    artifactTtlSeconds,
    encryptionKeyVersion: "privacy-export.v1" as const,
    recentAuthenticationSeconds,
    requestWindowSeconds,
  });
};

const parsePrivacyDeletionPolicy = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
): PrivacyDeletionPolicyConfiguration | undefined => {
  const values = {
    RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS:
      parsed.RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS,
    RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS:
      parsed.RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS,
  } as const;
  const present = Object.values(values).filter((value) => value !== undefined).length;
  if (present === 0) return undefined;
  if (present !== Object.keys(values).length) {
    throw new ConfigurationError(
      "server",
      Object.entries(values)
        .filter(([, value]) => value === undefined)
        .map(([key]) => ({ code: "missing" as const, key })),
    );
  }
  const recentAuthenticationSeconds = values.RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS!;
  const requestWindowSeconds = values.RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS!;
  if (recentAuthenticationSeconds > 86_400 || requestWindowSeconds > 604_800) {
    throw new ConfigurationError("server", [
      {
        code: "invalid",
        key:
          recentAuthenticationSeconds > 86_400
            ? "RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS"
            : "RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS",
      },
    ]);
  }
  return Object.freeze({ recentAuthenticationSeconds, requestWindowSeconds });
};

const stripeProductCodes = Object.freeze([
  "amethyst_guardian",
  "golden_intention_bowl",
  "mindful_incense",
  "moonlit_lotus",
] as const);

const parseStripePriceIds = (value: string): Readonly<Record<string, string>> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    const record = parsed as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (
      keys.join("\0") !== [...stripeProductCodes].sort().join("\0") ||
      keys.some(
        (key) =>
          typeof record[key] !== "string" ||
          !/^price_[A-Za-z0-9]{8,255}$/u.test(record[key] as string),
      )
    ) {
      throw new Error();
    }
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, record[key] as string])));
  } catch {
    throw new ConfigurationError("server", [{ code: "invalid", key: "RITUVIA_STRIPE_PRICE_IDS" }]);
  }
};

const parsePaymentConfiguration = (
  parsed: z.infer<typeof serverEnvironmentSchema>,
  deploymentEnvironment: DeploymentEnvironment,
): PaymentConfiguration | undefined => {
  if (parsed.RITUVIA_PAYMENT_PROVIDER === undefined) {
    const strayConfiguration = [
      parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1,
      parsed.RITUVIA_STRIPE_PRICE_IDS,
      parsed.STRIPE_SECRET_KEY,
      parsed.STRIPE_WEBHOOK_SECRET,
    ].some((value) => value !== undefined);
    if (strayConfiguration) {
      throw new ConfigurationError("server", [
        { code: "missing", key: "RITUVIA_PAYMENT_PROVIDER" },
      ]);
    }
    return undefined;
  }
  if (parsed.RITUVIA_PAYMENT_PROVIDER === "local") {
    if (
      deploymentEnvironment !== "local" ||
      parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1 === undefined ||
      parsed.RITUVIA_STRIPE_PRICE_IDS !== undefined ||
      parsed.STRIPE_SECRET_KEY !== undefined ||
      parsed.STRIPE_WEBHOOK_SECRET !== undefined
    ) {
      throw new ConfigurationError("server", [
        {
          code:
            parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1 === undefined ? "missing" : "invalid",
          key: "RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1",
        },
      ]);
    }
    return Object.freeze({
      localSigningSecret: decodeSecretKey(parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1),
      provider: "local",
    });
  }
  if (
    parsed.STRIPE_SECRET_KEY === undefined ||
    parsed.STRIPE_WEBHOOK_SECRET === undefined ||
    parsed.RITUVIA_STRIPE_PRICE_IDS === undefined ||
    parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1 !== undefined
  ) {
    throw new ConfigurationError("server", [
      ...(parsed.STRIPE_SECRET_KEY === undefined
        ? [{ code: "missing" as const, key: "STRIPE_SECRET_KEY" }]
        : []),
      ...(parsed.STRIPE_WEBHOOK_SECRET === undefined
        ? [{ code: "missing" as const, key: "STRIPE_WEBHOOK_SECRET" }]
        : []),
      ...(parsed.RITUVIA_STRIPE_PRICE_IDS === undefined
        ? [{ code: "missing" as const, key: "RITUVIA_STRIPE_PRICE_IDS" }]
        : []),
      ...(parsed.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1 !== undefined
        ? [{ code: "invalid" as const, key: "RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1" }]
        : []),
    ]);
  }
  return Object.freeze({
    priceIds: parseStripePriceIds(parsed.RITUVIA_STRIPE_PRICE_IDS),
    provider: "stripe",
    secretKey: parsed.STRIPE_SECRET_KEY,
    webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
  });
};

const parseTarotReadingIntegrityKeyring = (
  encodedKey: string | undefined,
): TarotReadingIntegrityKeyringConfiguration | undefined =>
  encodedKey === undefined
    ? undefined
    : Object.freeze({
        activeVersion: "tarot-integrity.v1",
        keys: Object.freeze([
          Object.freeze({ encodedKey, version: "tarot-integrity.v1" as const }),
        ]),
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
    PRIVACY_DELETION_DATABASE_URL: normalizeEnvironmentValue(
      environment.PRIVACY_DELETION_DATABASE_URL,
    ),
    RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH: normalizeEnvironmentValue(
      environment.RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH,
    ),
    RITUVIA_ACCOUNT_SESSION_TTL_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_ACCOUNT_SESSION_TTL_SECONDS,
    ),
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
    RITUVIA_AUTH_CHALLENGE_TTL_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_AUTH_CHALLENGE_TTL_SECONDS,
    ),
    RITUVIA_AUTH_DATA_KEY_V1: normalizeEnvironmentValue(environment.RITUVIA_AUTH_DATA_KEY_V1),
    RITUVIA_AUTH_START_GLOBAL_LIMIT: normalizeEnvironmentValue(
      environment.RITUVIA_AUTH_START_GLOBAL_LIMIT,
    ),
    RITUVIA_AUTH_START_IDENTIFIER_LIMIT: normalizeEnvironmentValue(
      environment.RITUVIA_AUTH_START_IDENTIFIER_LIMIT,
    ),
    RITUVIA_AUTH_START_WINDOW_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_AUTH_START_WINDOW_SECONDS,
    ),
    RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: normalizeEnvironmentValue(
      environment.RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1,
    ),
    RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1: normalizeEnvironmentValue(
      environment.RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1,
    ),
    RITUVIA_PAYMENT_PROVIDER: normalizeEnvironmentValue(environment.RITUVIA_PAYMENT_PROVIDER),
    RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS,
    ),
    RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS,
    ),
    RITUVIA_PRIVACY_EXPORT_KEY_V1: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_EXPORT_KEY_V1,
    ),
    RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS,
    ),
    RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS,
    ),
    RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVACY_EXPORT_TTL_SECONDS,
    ),
    RITUVIA_PRIVATE_CONTENT_KEY_V1: normalizeEnvironmentValue(
      environment.RITUVIA_PRIVATE_CONTENT_KEY_V1,
    ),
    RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: normalizeEnvironmentValue(
      environment.RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE,
    ),
    RITUVIA_REFLECTION_POLICY_VERSION: normalizeEnvironmentValue(
      environment.RITUVIA_REFLECTION_POLICY_VERSION,
    ),
    RITUVIA_REFLECTION_RETENTION_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_REFLECTION_RETENTION_SECONDS,
    ),
    RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS: normalizeEnvironmentValue(
      environment.RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS,
    ),
    RITUVIA_STRIPE_PRICE_IDS: normalizeEnvironmentValue(environment.RITUVIA_STRIPE_PRICE_IDS),
    RITUVIA_TAROT_INTEGRITY_KEY_V1: normalizeEnvironmentValue(
      environment.RITUVIA_TAROT_INTEGRITY_KEY_V1,
    ),
    STRIPE_SECRET_KEY: normalizeEnvironmentValue(environment.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: normalizeEnvironmentValue(environment.STRIPE_WEBHOOK_SECRET),
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

  const reflection = parseReflectionConfiguration(server);
  const accountIdentityPolicy = parseAccountIdentityPolicy(server);
  const privacyExport = parsePrivacyExportConfiguration(server);
  if (
    privacyExport !== undefined &&
    ((accountIdentityPolicy !== undefined &&
      Buffer.from(privacyExport.artifactKey).equals(
        Buffer.from(accountIdentityPolicy.emailEncryptionKey),
      )) ||
      (reflection.keyring !== undefined &&
        reflection.keyring.keys.some(({ key }) =>
          Buffer.from(privacyExport.artifactKey).equals(Buffer.from(key)),
        )))
  ) {
    throw new ConfigurationError("server", [
      { code: "invalid", key: "RITUVIA_PRIVACY_EXPORT_KEY_V1" },
    ]);
  }
  return Object.freeze({
    accountIdentityPolicy,
    anonymousSessionPolicy: parseAnonymousSessionPolicy(server, build.deploymentEnvironment),
    astrologyNativeBuildMetadataPath: server.RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH,
    brand: build.brand,
    client: build.client,
    databaseUrl: server.DATABASE_URL,
    deploymentEnvironment: build.deploymentEnvironment,
    payment: parsePaymentConfiguration(server, build.deploymentEnvironment),
    privateContentKeyring: reflection.keyring,
    privacyDeletionPolicy: parsePrivacyDeletionPolicy(server),
    privacyDeletionDatabaseUrl: server.PRIVACY_DELETION_DATABASE_URL,
    privacyExport,
    questionIntakeActivationReference,
    reflectionPolicy: reflection.policy,
    tarotReadingIntegrityKeyring: parseTarotReadingIntegrityKeyring(
      server.RITUVIA_TAROT_INTEGRITY_KEY_V1,
    ),
  });
};
