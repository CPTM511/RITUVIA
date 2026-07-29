import * as z from "zod";

import { ConfigurationError } from "./errors.js";
import { parseConfiguration } from "./parsing.js";

export const featureFlagRegistryVersion = 3 as const;

export const featureFlagKeys = Object.freeze([
  "content.regional_tradition",
  "experience.astrology",
  "market.country_activation",
  "payments.crypto_checkout",
  "payments.fiat_checkout",
] as const);

export type FeatureFlagKey = (typeof featureFlagKeys)[number];
export type FeatureFlagState = "off" | "on";
export type FeatureFlagApprovalGate = "OWN-002" | "OWN-004" | "OWN-006" | "OWN-007" | "OWN-015";
export type FeatureFlagRequiredScope = "country" | "country-and-locale" | "none";

export type FeatureFlagDefinition = Readonly<{
  approvalGate: FeatureFlagApprovalGate | null;
  cleanupReference: `RIT-${number}`;
  createdOn: string;
  defaultState: "off";
  lifecycle: "active" | "retired";
  owner: "payments_risk" | "product";
  purpose: string;
  removalOn: string;
  requiredScope: FeatureFlagRequiredScope;
}>;

export const featureFlagRegistry: Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>> =
  Object.freeze({
    "experience.astrology": Object.freeze({
      approvalGate: "OWN-015",
      cleanupReference: "RIT-093",
      createdOn: "2026-07-26",
      defaultState: "off",
      lifecycle: "active",
      owner: "product",
      purpose:
        "Kill-switch all natal calculation composition until release evidence and owner deployment approval pass.",
      removalOn: "2027-07-26",
      requiredScope: "none",
    }),
    "content.regional_tradition": Object.freeze({
      approvalGate: "OWN-007",
      cleanupReference: "RIT-157",
      createdOn: "2026-07-17",
      defaultState: "off",
      lifecycle: "active",
      owner: "product",
      purpose: "Gate any separately sourced and expert-reviewed regional tradition release.",
      removalOn: "2027-07-17",
      requiredScope: "country-and-locale",
    }),
    "market.country_activation": Object.freeze({
      approvalGate: "OWN-004",
      cleanupReference: "RIT-145",
      createdOn: "2026-07-17",
      defaultState: "off",
      lifecycle: "active",
      owner: "payments_risk",
      purpose: "Gate activation of a legally reviewed launch market.",
      removalOn: "2027-07-17",
      requiredScope: "country",
    }),
    "payments.crypto_checkout": Object.freeze({
      approvalGate: "OWN-006",
      cleanupReference: "RIT-155",
      createdOn: "2026-07-17",
      defaultState: "off",
      lifecycle: "active",
      owner: "payments_risk",
      purpose: "Gate approved hosted non-custodial cryptocurrency checkout.",
      removalOn: "2027-07-17",
      requiredScope: "country",
    }),
    "payments.fiat_checkout": Object.freeze({
      approvalGate: "OWN-002",
      cleanupReference: "RIT-145",
      createdOn: "2026-07-17",
      defaultState: "off",
      lifecycle: "active",
      owner: "payments_risk",
      purpose: "Gate approved provider-hosted fiat checkout.",
      removalOn: "2027-07-17",
      requiredScope: "country",
    }),
  });

export type FeatureFlagVersion = Readonly<{
  actorId: string;
  approvalReference: string | null;
  changeReference: string;
  countryCodes: readonly string[];
  createdAt: string;
  effectiveAt: string;
  expiresAt: string | null;
  flagKey: FeatureFlagKey;
  localeTags: readonly string[];
  registryVersion: typeof featureFlagRegistryVersion;
  state: FeatureFlagState;
  version: number;
}>;

export type FeatureFlagSnapshot = Readonly<{
  records: readonly FeatureFlagVersion[];
  registryVersion: typeof featureFlagRegistryVersion;
}>;

export type FeatureFlagEvaluationContext = Readonly<{
  countryCode?: string;
  locale?: string;
}>;

export type FeatureFlagEvaluationReason =
  | "configured-off"
  | "default-off"
  | "enabled"
  | "expired"
  | "registry-expired"
  | "retired"
  | "scope-mismatch";

export type FeatureFlagEvaluation = Readonly<{
  enabled: boolean;
  evaluatedAt: string;
  flagKey: FeatureFlagKey;
  reason: FeatureFlagEvaluationReason;
  registryVersion: typeof featureFlagRegistryVersion;
  source: "default" | "version";
  version: number | null;
}>;

export type FeatureFlagEvaluator = Readonly<{
  evaluate: (
    flagKey: FeatureFlagKey,
    context: FeatureFlagEvaluationContext,
  ) => FeatureFlagEvaluation;
}>;

export type FeatureFlagClock = () => string;

const instantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
  });
const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const localeTagSchema = z
  .string()
  .min(2)
  .max(64)
  .refine((value) => {
    try {
      const canonical = Intl.getCanonicalLocales(value);
      return canonical.length === 1 && canonical[0] === value;
    } catch {
      return false;
    }
  });
const referenceSchema = z.string().regex(/^[A-Z][A-Z0-9-]{1,63}(?::[A-Za-z0-9._-]{1,128})?$/);
const actorIdSchema = z.string().regex(/^[a-z][a-z0-9._:-]{2,99}$/);
const approvalReferenceSchema = z.union([
  z.null(),
  z.string().regex(/^OWN-\d{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
]);

const versionSchema = z
  .object({
    actorId: actorIdSchema,
    approvalReference: approvalReferenceSchema,
    changeReference: referenceSchema,
    countryCodes: z.array(countryCodeSchema).max(64),
    createdAt: instantSchema,
    effectiveAt: instantSchema,
    expiresAt: z.union([z.null(), instantSchema]),
    flagKey: z.enum(featureFlagKeys),
    localeTags: z.array(localeTagSchema).max(64),
    registryVersion: z.literal(featureFlagRegistryVersion),
    state: z.enum(["off", "on"]),
    version: z.number().int().positive().max(2_147_483_647),
  })
  .strict();

const snapshotSchema = z
  .object({
    records: z.array(versionSchema).max(10_000),
    registryVersion: z.literal(featureFlagRegistryVersion),
  })
  .strict();

const evaluationContextSchema = z
  .object({
    countryCode: countryCodeSchema.optional(),
    locale: localeTagSchema.optional(),
  })
  .strict();

const isStrictlySortedUnique = (values: readonly string[]): boolean => {
  let previous: string | undefined;
  for (const value of values) {
    if (previous !== undefined && previous >= value) return false;
    previous = value;
  }
  return true;
};

const configurationIssue = (key: string) => ({ code: "invalid" as const, key });

const definitionForFlag = (flagKey: FeatureFlagKey): FeatureFlagDefinition => {
  switch (flagKey) {
    case "content.regional_tradition":
      return featureFlagRegistry["content.regional_tradition"];
    case "experience.astrology":
      return featureFlagRegistry["experience.astrology"];
    case "market.country_activation":
      return featureFlagRegistry["market.country_activation"];
    case "payments.crypto_checkout":
      return featureFlagRegistry["payments.crypto_checkout"];
    case "payments.fiat_checkout":
      return featureFlagRegistry["payments.fiat_checkout"];
  }
};

const validateVersionInvariants = (
  records: readonly z.infer<typeof versionSchema>[],
): readonly z.infer<typeof versionSchema>[] => {
  const issues: ReturnType<typeof configurationIssue>[] = [];
  const seenVersions = new Set<string>();
  const byFlag = new Map<FeatureFlagKey, z.infer<typeof versionSchema>[]>();

  records.forEach((record, index) => {
    const definition = definitionForFlag(record.flagKey);
    const versionIdentity = `${record.flagKey}:${record.version}`;
    if (seenVersions.has(versionIdentity))
      issues.push(configurationIssue(`records.${index}.version`));
    seenVersions.add(versionIdentity);

    if (!isStrictlySortedUnique(record.countryCodes)) {
      issues.push(configurationIssue(`records.${index}.countryCodes`));
    }
    if (!isStrictlySortedUnique(record.localeTags)) {
      issues.push(configurationIssue(`records.${index}.localeTags`));
    }
    if (record.expiresAt !== null && record.expiresAt <= record.effectiveAt) {
      issues.push(configurationIssue(`records.${index}.expiresAt`));
    }
    if (record.effectiveAt < record.createdAt) {
      issues.push(configurationIssue(`records.${index}.effectiveAt`));
    }
    if (record.state === "on") {
      if (definition.lifecycle === "retired") {
        issues.push(configurationIssue(`records.${index}.state`));
      }
      if (
        definition.approvalGate !== null &&
        !record.approvalReference?.startsWith(`${definition.approvalGate}:`)
      ) {
        issues.push(configurationIssue(`records.${index}.approvalReference`));
      }
      if (
        (definition.requiredScope === "country" ||
          definition.requiredScope === "country-and-locale") &&
        record.countryCodes.length === 0
      ) {
        issues.push(configurationIssue(`records.${index}.countryCodes`));
      }
      if (definition.requiredScope === "country-and-locale" && record.localeTags.length === 0) {
        issues.push(configurationIssue(`records.${index}.localeTags`));
      }
    }

    const versions = byFlag.get(record.flagKey) ?? [];
    versions.push(record);
    byFlag.set(record.flagKey, versions);
  });

  for (const versions of byFlag.values()) {
    versions.sort((left, right) => left.version - right.version);
    let previous: z.infer<typeof versionSchema> | undefined;
    for (const current of versions) {
      if (!previous) {
        previous = current;
        continue;
      }
      if (current.createdAt <= previous.createdAt) {
        issues.push(configurationIssue(`records.${records.indexOf(current)}.createdAt`));
      }
      previous = current;
    }
  }

  if (issues.length > 0) throw new ConfigurationError("feature-flags", issues);

  return [...records].sort(
    (left, right) => left.flagKey.localeCompare(right.flagKey) || left.version - right.version,
  );
};

const freezeVersion = (record: z.infer<typeof versionSchema>): FeatureFlagVersion =>
  Object.freeze({
    ...record,
    countryCodes: Object.freeze([...record.countryCodes]),
    localeTags: Object.freeze([...record.localeTags]),
  });

export const parseFeatureFlagSnapshot = (input: unknown): FeatureFlagSnapshot => {
  const parsed = parseConfiguration("feature-flags", snapshotSchema, input);
  const records = validateVersionInvariants(parsed.records).map(freezeVersion);

  return Object.freeze({
    records: Object.freeze(records),
    registryVersion: parsed.registryVersion,
  });
};

const parseEvaluationContext = (input: FeatureFlagEvaluationContext) =>
  parseConfiguration("feature-flags", evaluationContextSchema, input);

const createEvaluation = (
  flagKey: FeatureFlagKey,
  evaluatedAt: string,
  source: FeatureFlagEvaluation["source"],
  version: number | null,
  reason: FeatureFlagEvaluationReason,
): FeatureFlagEvaluation =>
  Object.freeze({
    enabled: reason === "enabled",
    evaluatedAt,
    flagKey,
    reason,
    registryVersion: featureFlagRegistryVersion,
    source,
    version,
  });

export const createFeatureFlagEvaluator = (
  input: unknown,
  clock: FeatureFlagClock = () => new Date().toISOString(),
): FeatureFlagEvaluator => {
  const snapshot = parseFeatureFlagSnapshot(input);
  const recordsByFlag = new Map<FeatureFlagKey, readonly FeatureFlagVersion[]>();
  for (const flagKey of featureFlagKeys) {
    recordsByFlag.set(
      flagKey,
      Object.freeze(snapshot.records.filter((record) => record.flagKey === flagKey)),
    );
  }

  return Object.freeze({
    evaluate(flagKey, contextInput) {
      if (!featureFlagKeys.includes(flagKey)) {
        throw new ConfigurationError("feature-flags", [configurationIssue("flagKey")]);
      }
      const contextWithoutTime = parseEvaluationContext(contextInput);
      let now: string;
      try {
        now = parseConfiguration("feature-flags", instantSchema, clock());
      } catch {
        throw new ConfigurationError("feature-flags", [configurationIssue("clock")]);
      }
      const context = { ...contextWithoutTime, now };
      const selected = [...(recordsByFlag.get(flagKey) ?? [])]
        .filter((record) => record.effectiveAt <= context.now)
        .sort((left, right) => right.version - left.version)[0];

      const definition = definitionForFlag(flagKey);
      if (definition.lifecycle === "retired") {
        return createEvaluation(
          flagKey,
          context.now,
          selected ? "version" : "default",
          selected?.version ?? null,
          "retired",
        );
      }
      if (context.now > `${definition.removalOn}T23:59:59.999Z`) {
        return createEvaluation(
          flagKey,
          context.now,
          selected ? "version" : "default",
          selected?.version ?? null,
          "registry-expired",
        );
      }

      if (!selected) {
        return createEvaluation(flagKey, context.now, "default", null, "default-off");
      }
      if (selected.expiresAt !== null && selected.expiresAt <= context.now) {
        return createEvaluation(flagKey, context.now, "version", selected.version, "expired");
      }
      if (selected.state === "off") {
        return createEvaluation(
          flagKey,
          context.now,
          "version",
          selected.version,
          "configured-off",
        );
      }

      const countryMatches =
        selected.countryCodes.length === 0 ||
        (context.countryCode !== undefined && selected.countryCodes.includes(context.countryCode));
      const localeMatches =
        selected.localeTags.length === 0 ||
        (context.locale !== undefined && selected.localeTags.includes(context.locale));
      return createEvaluation(
        flagKey,
        context.now,
        "version",
        selected.version,
        countryMatches && localeMatches ? "enabled" : "scope-mismatch",
      );
    },
  });
};
