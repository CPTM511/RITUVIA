declare const astrologySelectionValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [astrologySelectionValueBrand]: Brand;
};

type AstrologySelectionIdentifier = Branded<string, "AstrologySelectionIdentifier">;
type AstrologySelectionVersion = Branded<string, "AstrologySelectionVersion">;
type AstrologySelectionDate = Branded<string, "AstrologySelectionDate">;

export const astrologyEngineSelectionSchemaVersion = "astrology-engine-selection.v1" as const;
export const astrologyEngineReadinessSchemaVersion = "astrology-engine-readiness.v1" as const;

export const astrologyEngineSelectionStatuses = Object.freeze([
  "selected_pending_license",
  "licensed_safe_off",
] as const);
export type AstrologyEngineSelectionStatus = (typeof astrologyEngineSelectionStatuses)[number];

export const astrologyEngineLicenseExecutionStatuses = Object.freeze([
  "pending_counter_signature_and_payment",
  "effective",
] as const);
export type AstrologyEngineLicenseExecutionStatus =
  (typeof astrologyEngineLicenseExecutionStatuses)[number];

export const astrologyEngineEvidenceCodes = Object.freeze([
  "licensee_legal_name",
  "counter_signed_contract",
  "complete_payment",
  "legal_terms_review",
  "source_archive",
  "ephemeris_data_inventory",
  "compiler_and_flags_inventory",
  "reproducible_native_build",
  "native_sbom",
  "abi_version",
  "engine_flag_runtime_verification",
  "reference_chart_tolerance",
  "supply_chain_and_license_review",
  "staging_kill_switch_exercise",
] as const);
export type AstrologyEngineEvidenceCode = (typeof astrologyEngineEvidenceCodes)[number];

export const astrologyEngineReadinessReasonCodes = Object.freeze([
  "OWNER_APPROVAL_MISSING",
  "SELECTED_ENGINE_VERSION_MISMATCH",
  "LICENSE_TERMS_MISMATCH",
  "LICENSE_NOT_EFFECTIVE",
  "LICENSEE_LEGAL_NAME_MISSING",
  "LEGAL_REVIEW_MISSING",
  "REQUIRED_EVIDENCE_MISSING",
  "SOURCE_ARCHIVE_INTEGRITY_MISSING",
  "EPHEMERIS_DATA_INTEGRITY_MISSING",
  "NATIVE_BUILD_EVIDENCE_MISSING",
  "EVIDENCE_ARTIFACT_BINDING_MISMATCH",
  "EVIDENCE_METADATA_INVALID",
  "UNSAFE_RUNTIME_POLICY",
  "EXIT_PATH_MISSING",
  "EVIDENCE_AUTHORITY_NOT_VERIFIED",
  "EVIDENCE_AUTHORITY_REJECTED",
  "PRODUCTION_ACTIVATION_FORBIDDEN",
] as const);
export type AstrologyEngineReadinessReasonCode =
  (typeof astrologyEngineReadinessReasonCodes)[number];

export const astrologyEngineSelectionErrorCodes = Object.freeze([
  "ASTROLOGY_ENGINE_SELECTION_INVALID",
  "ASTROLOGY_ENGINE_SELECTION_SCHEMA_UNSUPPORTED",
  "ASTROLOGY_ENGINE_NOT_INTEGRATION_READY",
] as const);
export type AstrologyEngineSelectionErrorCode = (typeof astrologyEngineSelectionErrorCodes)[number];

const errorMessage = (code: AstrologyEngineSelectionErrorCode): string => {
  switch (code) {
    case "ASTROLOGY_ENGINE_SELECTION_INVALID":
      return "The astrology engine selection contract is invalid.";
    case "ASTROLOGY_ENGINE_SELECTION_SCHEMA_UNSUPPORTED":
      return "The astrology engine selection schema version is unsupported.";
    case "ASTROLOGY_ENGINE_NOT_INTEGRATION_READY":
      return "The astrology engine is not ready for integration.";
  }
};

export class AstrologyEngineSelectionError extends Error {
  readonly code: AstrologyEngineSelectionErrorCode;

  constructor(code: AstrologyEngineSelectionErrorCode) {
    super(errorMessage(code));
    this.name = "AstrologyEngineSelectionError";
    this.code = code;
  }
}

export type AstrologyEngineEditorialMetadataV1 = Readonly<{
  approvalReference: string | null;
  authorId: AstrologySelectionIdentifier;
  changeReason: string;
  effectiveDate: AstrologySelectionDate;
  requiredApprovalRole: "owner";
  reviewDueDate: AstrologySelectionDate;
  reviewedDate: AstrologySelectionDate | null;
  reviewerId: AstrologySelectionIdentifier | null;
  reviewerRole: "owner" | null;
  status: "approved_selection_pending_license" | "approved_licensed_safe_off";
  supersedes: Readonly<{
    id: AstrologySelectionIdentifier;
    version: AstrologySelectionVersion;
  }> | null;
}>;

export type AstrologyEngineSourceRecordV1 = Readonly<{
  claims: readonly string[];
  retrievedDate: AstrologySelectionDate;
  sourceId: AstrologySelectionIdentifier;
  sourceType: "official_primary";
  title: string;
  url: string;
  version: string;
}>;

export type AstrologyEngineEvidenceRecordV1 = Readonly<{
  code: AstrologyEngineEvidenceCode;
  evidenceId: AstrologySelectionIdentifier;
  reference: string;
  reviewedDate: AstrologySelectionDate;
  reviewerId: AstrologySelectionIdentifier;
  reviewerRole: "architecture" | "legal" | "operations" | "owner" | "qa_security";
  sha256: string;
  status: "verified";
  subjectSha256: string;
}>;

export type AstrologyEngineSelectionV1 = Readonly<{
  activationPolicy: Readonly<{
    allowAutomaticEphemerisFallback: false;
    failureMode: "unavailable_without_placements";
    featureFlag: "astrology_enabled";
    productionActivation: "forbidden_in_selection_v1";
    runtimeNetworkAllowed: false;
  }>;
  adapter: Readonly<{
    capabilities: readonly (
      | "planetary_positions"
      | "lunar_nodes"
      | "house_cusps_and_angles"
      | "julian_date_and_time_conversion"
      | "engine_metadata"
    )[];
    interfaceId: AstrologySelectionIdentifier;
    interfaceOwner: "@rituvia/divination";
    interfaceVersion: AstrologySelectionVersion;
    nativeImplementationZone: "unassigned_requires_architecture_registration";
    providerTypesForbidden: true;
  }>;
  audience: "internal_engineering_and_operations";
  contentType: "astrology_engine_selection";
  dataPolicy: Readonly<{
    artifactIntegrityStatus: "pending" | "verified";
    baseline: "compressed_swiss_ephemeris_de441";
    dataGenerationBaseline: string;
    ephemerisFilesReference: string;
    fallbackBehavior: "reject_unexpected_engine_flag";
    runtimeDelivery: "vendored_checksum_pinned_read_only";
    sourceArchiveSha256: string | null;
    sourceSnapshotDate: AstrologySelectionDate;
    sourceSnapshotTag: string;
    sourceCommit: string;
    verifiedDataArtifacts: readonly Readonly<{
      path: string;
      sha256: string;
    }>[];
    verifiedDataInventorySha256: string | null;
  }>;
  editorial: AstrologyEngineEditorialMetadataV1;
  engine: Readonly<{
    implementationLanguage: "C";
    libraryReleaseDate: AstrologySelectionDate;
    libraryVersion: string;
    name: "Swiss Ephemeris";
    networkRequired: false;
    provider: "Astrodienst AG";
    repository: string;
    runtimeModel: "self_hosted_compiled_library";
  }>;
  evidence: readonly AstrologyEngineEvidenceRecordV1[];
  exitPlan: Readonly<{
    abiVersionRequired: true;
    dualRunMigrationRequired: true;
    exactDataInventoryRequired: true;
    historicalReplayPolicy: "retain_exact_engine_and_data_versions";
    providerDataExportRequired: false;
    replacementBoundary: "rituvia_astrology_ephemeris_adapter_v1";
    replacementTriggers: readonly string[];
    reproducibleBuildRecordRequired: true;
    runtimeEngineFlagVerification: "SEFLG_SWIEPH_required";
    sbomRequired: true;
    sourceAndDataArchiveRequired: true;
    successorPolicy: "new_calculations_use_a_new_adapter_version_without_rewriting_historical_facts";
  }>;
  license: Readonly<{
    availabilityOwner: "rituvia";
    bugFixCommitment: "reasonable_effort_only";
    compiledDistributionAllowed: true;
    contractEvidenceSha256: string | null;
    contractEdition: string;
    durationYears: number;
    executionStatus: AstrologyEngineLicenseExecutionStatus;
    fee: Readonly<{
      amount: number;
      billing: "one_time";
      currency: "CHF";
    }>;
    legalQuestions: readonly string[];
    legalReviewEvidenceSha256: string | null;
    legalReviewStatus: "pending" | "approved";
    licenseType: "unlimited";
    licenseeLegalName: string | null;
    licenseeLegalNameEvidenceSha256: string | null;
    model: "Swiss Ephemeris Professional License";
    paymentEvidenceSha256: string | null;
    privateSupportIncluded: false;
    publicAttributionPolicy: string;
    serverUseAllowed: true;
    serviceLevelAgreement: "none";
    sourceDistributionPolicy: string;
    supportChannel: "public_community_mailing_list";
    validOnlyAfter: readonly ["complete_payment", "provider_counter_signature"];
    warranty: "as_is_without_correctness_or_fitness_guarantee";
  }>;
  locale: "en";
  method: "western_astrology";
  privacyPolicy: Readonly<{
    analyticsBirthDataAllowed: false;
    birthDataClassification: "sensitive";
    logsBirthDataAllowed: false;
    providerReceivesBirthData: false;
    runtimeNetworkAllowed: false;
  }>;
  requiredEvidenceCodes: readonly AstrologyEngineEvidenceCode[];
  riskClassification: "licensed_deterministic_engine";
  schemaVersion: typeof astrologyEngineSelectionSchemaVersion;
  selectionId: AstrologySelectionIdentifier;
  sources: readonly AstrologyEngineSourceRecordV1[];
  status: AstrologyEngineSelectionStatus;
  version: AstrologySelectionVersion;
}>;

export type AstrologyEngineReadinessAssessment = Readonly<{
  asOf: string;
  evidenceAuthorityVerified: boolean;
  integrationReady: boolean;
  licenseEffective: boolean;
  productionActivationAllowed: false;
  reasons: readonly AstrologyEngineReadinessReasonCode[];
  schemaVersion: typeof astrologyEngineReadinessSchemaVersion;
  selected: boolean;
  selectionId: string;
  selectionVersion: string;
}>;

export type AstrologyEngineEvidenceAuthorityInputV1 = Readonly<{
  evidence: AstrologyEngineEvidenceRecordV1;
  selection: AstrologyEngineSelectionV1;
  selectionId: string;
  selectionManifestSha256: string;
  selectionVersion: string;
}>;

export type AstrologyEngineEvidenceAuthorityVerifierV1 = (
  input: AstrologyEngineEvidenceAuthorityInputV1,
) => boolean | Promise<boolean>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new AstrologyEngineSelectionError("ASTROLOGY_ENGINE_SELECTION_INVALID");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) invalid();
};

const text = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_000 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u.test(
      value,
    )
  ) {
    invalid();
  }
  return value as string;
};

const literal = <Value extends string | number | boolean>(
  value: unknown,
  expected: Value,
): Value => {
  if (value !== expected) invalid();
  return expected;
};

const oneOf = <Value extends string>(value: unknown, values: readonly Value[]): Value => {
  if (typeof value !== "string" || !values.includes(value as Value)) invalid();
  return value as Value;
};

const identifier = (value: unknown): AstrologySelectionIdentifier => {
  const parsed = text(value);
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(parsed)) invalid();
  return parsed as AstrologySelectionIdentifier;
};

const version = (value: unknown): AstrologySelectionVersion => {
  const parsed = text(value);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(parsed)) invalid();
  return parsed as AstrologySelectionVersion;
};

const date = (value: unknown): AstrologySelectionDate => {
  const parsed = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed)) invalid();
  const candidate = new Date(`${parsed}T00:00:00.000Z`);
  if (Number.isNaN(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== parsed) {
    invalid();
  }
  return parsed as AstrologySelectionDate;
};

const checksum = (value: unknown): string => {
  const parsed = text(value);
  if (!/^sha256:[0-9a-f]{64}$/u.test(parsed)) invalid();
  return parsed;
};

const nullableChecksum = (value: unknown): string | null =>
  value === null ? null : checksum(value);

const httpsUrl = (value: unknown): string => {
  const parsed = text(value);
  if (
    !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]*)?$/u.test(parsed) ||
    parsed.includes("@") ||
    parsed.includes("?") ||
    parsed.includes("#")
  ) {
    invalid();
  }
  return parsed;
};

const stringArray = (value: unknown, minimum = 1): readonly string[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > 32) invalid();
  const parsed = (value as unknown[]).map(text);
  if (new Set(parsed).size !== parsed.length) invalid();
  return Object.freeze(parsed);
};

const editorial = (value: unknown): AstrologyEngineEditorialMetadataV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approvalReference",
    "authorId",
    "changeReason",
    "effectiveDate",
    "requiredApprovalRole",
    "reviewDueDate",
    "reviewedDate",
    "reviewerId",
    "reviewerRole",
    "status",
    "supersedes",
  ]);
  const supersedes =
    parsed.supersedes === null
      ? null
      : (() => {
          const reference = record(parsed.supersedes);
          exactKeys(reference, ["id", "version"]);
          return Object.freeze({
            id: identifier(reference.id),
            version: version(reference.version),
          });
        })();
  return Object.freeze({
    approvalReference: parsed.approvalReference === null ? null : text(parsed.approvalReference),
    authorId: identifier(parsed.authorId),
    changeReason: text(parsed.changeReason),
    effectiveDate: date(parsed.effectiveDate),
    requiredApprovalRole: literal(parsed.requiredApprovalRole, "owner"),
    reviewDueDate: date(parsed.reviewDueDate),
    reviewedDate: parsed.reviewedDate === null ? null : date(parsed.reviewedDate),
    reviewerId: parsed.reviewerId === null ? null : identifier(parsed.reviewerId),
    reviewerRole: parsed.reviewerRole === null ? null : literal(parsed.reviewerRole, "owner"),
    status: oneOf(parsed.status, [
      "approved_selection_pending_license",
      "approved_licensed_safe_off",
    ] as const),
    supersedes,
  });
};

const source = (value: unknown): AstrologyEngineSourceRecordV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "claims",
    "retrievedDate",
    "sourceId",
    "sourceType",
    "title",
    "url",
    "version",
  ]);
  return Object.freeze({
    claims: stringArray(parsed.claims),
    retrievedDate: date(parsed.retrievedDate),
    sourceId: identifier(parsed.sourceId),
    sourceType: literal(parsed.sourceType, "official_primary"),
    title: text(parsed.title),
    url: httpsUrl(parsed.url),
    version: text(parsed.version),
  });
};

const evidence = (value: unknown): AstrologyEngineEvidenceRecordV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "code",
    "evidenceId",
    "reference",
    "reviewedDate",
    "reviewerId",
    "reviewerRole",
    "sha256",
    "status",
    "subjectSha256",
  ]);
  const reference = text(parsed.reference);
  if (!/^private-evidence:[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(reference)) invalid();
  return Object.freeze({
    code: oneOf(parsed.code, astrologyEngineEvidenceCodes),
    evidenceId: identifier(parsed.evidenceId),
    reference,
    reviewedDate: date(parsed.reviewedDate),
    reviewerId: identifier(parsed.reviewerId),
    reviewerRole: oneOf(parsed.reviewerRole, [
      "architecture",
      "legal",
      "operations",
      "owner",
      "qa_security",
    ] as const),
    sha256: checksum(parsed.sha256),
    status: literal(parsed.status, "verified"),
    subjectSha256: checksum(parsed.subjectSha256),
  });
};

const activationPolicy = (value: unknown): AstrologyEngineSelectionV1["activationPolicy"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "allowAutomaticEphemerisFallback",
    "failureMode",
    "featureFlag",
    "productionActivation",
    "runtimeNetworkAllowed",
  ]);
  return Object.freeze({
    allowAutomaticEphemerisFallback: literal(parsed.allowAutomaticEphemerisFallback, false),
    failureMode: literal(parsed.failureMode, "unavailable_without_placements"),
    featureFlag: literal(parsed.featureFlag, "astrology_enabled"),
    productionActivation: literal(parsed.productionActivation, "forbidden_in_selection_v1"),
    runtimeNetworkAllowed: literal(parsed.runtimeNetworkAllowed, false),
  });
};

const adapter = (value: unknown): AstrologyEngineSelectionV1["adapter"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "capabilities",
    "interfaceId",
    "interfaceOwner",
    "interfaceVersion",
    "nativeImplementationZone",
    "providerTypesForbidden",
  ]);
  const allowed = [
    "planetary_positions",
    "lunar_nodes",
    "house_cusps_and_angles",
    "julian_date_and_time_conversion",
    "engine_metadata",
  ] as const;
  const capabilityValues = parsed.capabilities;
  if (!Array.isArray(capabilityValues)) invalid();
  const capabilities = (capabilityValues as unknown[]).map((capability) =>
    oneOf(capability, allowed),
  );
  if (capabilities.join("\u0000") !== allowed.join("\u0000")) invalid();
  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    interfaceId: identifier(parsed.interfaceId),
    interfaceOwner: literal(parsed.interfaceOwner, "@rituvia/divination"),
    interfaceVersion: version(parsed.interfaceVersion),
    nativeImplementationZone: literal(
      parsed.nativeImplementationZone,
      "unassigned_requires_architecture_registration",
    ),
    providerTypesForbidden: literal(parsed.providerTypesForbidden, true),
  });
};

const dataPolicy = (value: unknown): AstrologyEngineSelectionV1["dataPolicy"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "artifactIntegrityStatus",
    "baseline",
    "dataGenerationBaseline",
    "ephemerisFilesReference",
    "fallbackBehavior",
    "runtimeDelivery",
    "sourceArchiveSha256",
    "sourceSnapshotDate",
    "sourceSnapshotTag",
    "sourceCommit",
    "verifiedDataArtifacts",
    "verifiedDataInventorySha256",
  ]);
  const artifactValues = parsed.verifiedDataArtifacts;
  if (!Array.isArray(artifactValues)) invalid();
  const verifiedDataArtifacts = (artifactValues as unknown[]).map((artifact) => {
    const candidate = record(artifact);
    exactKeys(candidate, ["path", "sha256"]);
    const path = text(candidate.path);
    if (
      path.startsWith("/") ||
      path.includes("..") ||
      path.includes("\\") ||
      !/^[a-zA-Z0-9._/-]+$/u.test(path)
    ) {
      invalid();
    }
    return Object.freeze({ path, sha256: checksum(candidate.sha256) });
  });
  if (
    new Set(verifiedDataArtifacts.map(({ path }) => path)).size !== verifiedDataArtifacts.length
  ) {
    invalid();
  }
  const sourceCommit = text(parsed.sourceCommit);
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) invalid();
  return Object.freeze({
    artifactIntegrityStatus: oneOf(parsed.artifactIntegrityStatus, [
      "pending",
      "verified",
    ] as const),
    baseline: literal(parsed.baseline, "compressed_swiss_ephemeris_de441"),
    dataGenerationBaseline: text(parsed.dataGenerationBaseline),
    ephemerisFilesReference: httpsUrl(parsed.ephemerisFilesReference),
    fallbackBehavior: literal(parsed.fallbackBehavior, "reject_unexpected_engine_flag"),
    runtimeDelivery: literal(parsed.runtimeDelivery, "vendored_checksum_pinned_read_only"),
    sourceArchiveSha256: nullableChecksum(parsed.sourceArchiveSha256),
    sourceSnapshotDate: date(parsed.sourceSnapshotDate),
    sourceSnapshotTag: text(parsed.sourceSnapshotTag),
    sourceCommit,
    verifiedDataArtifacts: Object.freeze(verifiedDataArtifacts),
    verifiedDataInventorySha256: nullableChecksum(parsed.verifiedDataInventorySha256),
  });
};

const engine = (value: unknown): AstrologyEngineSelectionV1["engine"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "implementationLanguage",
    "libraryReleaseDate",
    "libraryVersion",
    "name",
    "networkRequired",
    "provider",
    "repository",
    "runtimeModel",
  ]);
  return Object.freeze({
    implementationLanguage: literal(parsed.implementationLanguage, "C"),
    libraryReleaseDate: date(parsed.libraryReleaseDate),
    libraryVersion: text(parsed.libraryVersion),
    name: literal(parsed.name, "Swiss Ephemeris"),
    networkRequired: literal(parsed.networkRequired, false),
    provider: literal(parsed.provider, "Astrodienst AG"),
    repository: httpsUrl(parsed.repository),
    runtimeModel: literal(parsed.runtimeModel, "self_hosted_compiled_library"),
  });
};

const exitPlan = (value: unknown): AstrologyEngineSelectionV1["exitPlan"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "abiVersionRequired",
    "dualRunMigrationRequired",
    "exactDataInventoryRequired",
    "historicalReplayPolicy",
    "providerDataExportRequired",
    "replacementBoundary",
    "replacementTriggers",
    "reproducibleBuildRecordRequired",
    "runtimeEngineFlagVerification",
    "sbomRequired",
    "sourceAndDataArchiveRequired",
    "successorPolicy",
  ]);
  return Object.freeze({
    abiVersionRequired: literal(parsed.abiVersionRequired, true),
    dualRunMigrationRequired: literal(parsed.dualRunMigrationRequired, true),
    exactDataInventoryRequired: literal(parsed.exactDataInventoryRequired, true),
    historicalReplayPolicy: literal(
      parsed.historicalReplayPolicy,
      "retain_exact_engine_and_data_versions",
    ),
    providerDataExportRequired: literal(parsed.providerDataExportRequired, false),
    replacementBoundary: literal(
      parsed.replacementBoundary,
      "rituvia_astrology_ephemeris_adapter_v1",
    ),
    replacementTriggers: stringArray(parsed.replacementTriggers),
    reproducibleBuildRecordRequired: literal(parsed.reproducibleBuildRecordRequired, true),
    runtimeEngineFlagVerification: literal(
      parsed.runtimeEngineFlagVerification,
      "SEFLG_SWIEPH_required",
    ),
    sbomRequired: literal(parsed.sbomRequired, true),
    sourceAndDataArchiveRequired: literal(parsed.sourceAndDataArchiveRequired, true),
    successorPolicy: literal(
      parsed.successorPolicy,
      "new_calculations_use_a_new_adapter_version_without_rewriting_historical_facts",
    ),
  });
};

const license = (value: unknown): AstrologyEngineSelectionV1["license"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "availabilityOwner",
    "bugFixCommitment",
    "compiledDistributionAllowed",
    "contractEvidenceSha256",
    "contractEdition",
    "durationYears",
    "executionStatus",
    "fee",
    "legalQuestions",
    "legalReviewEvidenceSha256",
    "legalReviewStatus",
    "licenseType",
    "licenseeLegalName",
    "licenseeLegalNameEvidenceSha256",
    "model",
    "paymentEvidenceSha256",
    "privateSupportIncluded",
    "publicAttributionPolicy",
    "serverUseAllowed",
    "serviceLevelAgreement",
    "sourceDistributionPolicy",
    "supportChannel",
    "validOnlyAfter",
    "warranty",
  ]);
  const fee = record(parsed.fee);
  exactKeys(fee, ["amount", "billing", "currency"]);
  if (!Number.isSafeInteger(fee.amount) || (fee.amount as number) <= 0) invalid();
  if (!Number.isSafeInteger(parsed.durationYears) || (parsed.durationYears as number) <= 0) {
    invalid();
  }
  const validOnlyAfterValues = parsed.validOnlyAfter;
  if (!Array.isArray(validOnlyAfterValues)) invalid();
  const validOnlyAfter = (validOnlyAfterValues as unknown[]).map((condition) =>
    oneOf(condition, ["complete_payment", "provider_counter_signature"] as const),
  );
  if (
    validOnlyAfter.join("\u0000") !==
    ["complete_payment", "provider_counter_signature"].join("\u0000")
  ) {
    invalid();
  }
  return Object.freeze({
    availabilityOwner: literal(parsed.availabilityOwner, "rituvia"),
    bugFixCommitment: literal(parsed.bugFixCommitment, "reasonable_effort_only"),
    compiledDistributionAllowed: literal(parsed.compiledDistributionAllowed, true),
    contractEvidenceSha256: nullableChecksum(parsed.contractEvidenceSha256),
    contractEdition: text(parsed.contractEdition),
    durationYears: parsed.durationYears as number,
    executionStatus: oneOf(parsed.executionStatus, astrologyEngineLicenseExecutionStatuses),
    fee: Object.freeze({
      amount: fee.amount as number,
      billing: literal(fee.billing, "one_time"),
      currency: literal(fee.currency, "CHF"),
    }),
    legalQuestions: stringArray(parsed.legalQuestions),
    legalReviewEvidenceSha256: nullableChecksum(parsed.legalReviewEvidenceSha256),
    legalReviewStatus: oneOf(parsed.legalReviewStatus, ["pending", "approved"] as const),
    licenseType: literal(parsed.licenseType, "unlimited"),
    licenseeLegalName: parsed.licenseeLegalName === null ? null : text(parsed.licenseeLegalName),
    licenseeLegalNameEvidenceSha256: nullableChecksum(parsed.licenseeLegalNameEvidenceSha256),
    model: literal(parsed.model, "Swiss Ephemeris Professional License"),
    paymentEvidenceSha256: nullableChecksum(parsed.paymentEvidenceSha256),
    privateSupportIncluded: literal(parsed.privateSupportIncluded, false),
    publicAttributionPolicy: text(parsed.publicAttributionPolicy),
    serverUseAllowed: literal(parsed.serverUseAllowed, true),
    serviceLevelAgreement: literal(parsed.serviceLevelAgreement, "none"),
    sourceDistributionPolicy: text(parsed.sourceDistributionPolicy),
    supportChannel: literal(parsed.supportChannel, "public_community_mailing_list"),
    validOnlyAfter: Object.freeze(validOnlyAfter) as readonly [
      "complete_payment",
      "provider_counter_signature",
    ],
    warranty: literal(parsed.warranty, "as_is_without_correctness_or_fitness_guarantee"),
  });
};

const privacyPolicy = (value: unknown): AstrologyEngineSelectionV1["privacyPolicy"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "analyticsBirthDataAllowed",
    "birthDataClassification",
    "logsBirthDataAllowed",
    "providerReceivesBirthData",
    "runtimeNetworkAllowed",
  ]);
  return Object.freeze({
    analyticsBirthDataAllowed: literal(parsed.analyticsBirthDataAllowed, false),
    birthDataClassification: literal(parsed.birthDataClassification, "sensitive"),
    logsBirthDataAllowed: literal(parsed.logsBirthDataAllowed, false),
    providerReceivesBirthData: literal(parsed.providerReceivesBirthData, false),
    runtimeNetworkAllowed: literal(parsed.runtimeNetworkAllowed, false),
  });
};

export const parseAstrologyEngineSelectionV1 = (value: unknown): AstrologyEngineSelectionV1 => {
  const parsed = record(value);
  if (parsed.schemaVersion !== astrologyEngineSelectionSchemaVersion) {
    throw new AstrologyEngineSelectionError("ASTROLOGY_ENGINE_SELECTION_SCHEMA_UNSUPPORTED");
  }
  exactKeys(parsed, [
    "activationPolicy",
    "adapter",
    "audience",
    "contentType",
    "dataPolicy",
    "editorial",
    "engine",
    "evidence",
    "exitPlan",
    "license",
    "locale",
    "method",
    "privacyPolicy",
    "requiredEvidenceCodes",
    "riskClassification",
    "schemaVersion",
    "selectionId",
    "sources",
    "status",
    "version",
  ]);
  const sourceValues = parsed.sources;
  const evidenceValues = parsed.evidence;
  if (!Array.isArray(sourceValues) || !Array.isArray(evidenceValues)) invalid();
  const sources = (sourceValues as unknown[]).map(source);
  const evidenceRecords = (evidenceValues as unknown[]).map(evidence);
  if (
    sources.length !== 4 ||
    new Set(sources.map(({ sourceId }) => sourceId)).size !== sources.length ||
    new Set(evidenceRecords.map(({ code }) => code)).size !== evidenceRecords.length ||
    new Set(evidenceRecords.map(({ evidenceId }) => evidenceId)).size !== evidenceRecords.length
  ) {
    invalid();
  }
  const requiredEvidenceCodeValues = parsed.requiredEvidenceCodes;
  if (!Array.isArray(requiredEvidenceCodeValues)) invalid();
  const requiredEvidenceCodes = (requiredEvidenceCodeValues as unknown[]).map((code) =>
    oneOf(code, astrologyEngineEvidenceCodes),
  );
  if (requiredEvidenceCodes.join("\u0000") !== astrologyEngineEvidenceCodes.join("\u0000")) {
    invalid();
  }
  return Object.freeze({
    activationPolicy: activationPolicy(parsed.activationPolicy),
    adapter: adapter(parsed.adapter),
    audience: literal(parsed.audience, "internal_engineering_and_operations"),
    contentType: literal(parsed.contentType, "astrology_engine_selection"),
    dataPolicy: dataPolicy(parsed.dataPolicy),
    editorial: editorial(parsed.editorial),
    engine: engine(parsed.engine),
    evidence: Object.freeze(evidenceRecords),
    exitPlan: exitPlan(parsed.exitPlan),
    license: license(parsed.license),
    locale: literal(parsed.locale, "en"),
    method: literal(parsed.method, "western_astrology"),
    privacyPolicy: privacyPolicy(parsed.privacyPolicy),
    requiredEvidenceCodes: Object.freeze(requiredEvidenceCodes),
    riskClassification: literal(parsed.riskClassification, "licensed_deterministic_engine"),
    schemaVersion: astrologyEngineSelectionSchemaVersion,
    selectionId: identifier(parsed.selectionId),
    sources: Object.freeze(sources),
    status: oneOf(parsed.status, astrologyEngineSelectionStatuses),
    version: version(parsed.version),
  });
};

type StructuralReadiness = Readonly<{
  ownerApproved: boolean;
  reasons: Set<AstrologyEngineReadinessReasonCode>;
  selection: AstrologyEngineSelectionV1;
}>;

const nativeEvidenceCodes = new Set<AstrologyEngineEvidenceCode>([
  "compiler_and_flags_inventory",
  "reproducible_native_build",
  "native_sbom",
  "abi_version",
  "engine_flag_runtime_verification",
  "reference_chart_tolerance",
  "supply_chain_and_license_review",
  "staging_kill_switch_exercise",
]);

const approvedLegalQuestions = [
  "Confirm rights and obligations for affiliates, contractors, assignment, transfer, and merger or acquisition.",
  "Confirm the exact effect of the modified-source AGPL condition on RITUVIA build, patch, archive, and distribution practices.",
] as const;

const approvedReplacementTriggers = [
  "license_terms_change",
  "unresolved_calculation_defect",
  "unsupported_runtime_or_architecture",
  "unacceptable_supply_chain_risk",
] as const;

const approvedSourceInventory = [
  {
    claims: [
      "Swiss Ephemeris uses a dual AGPL or Professional License model and requires the license choice before distribution or public service activation.",
      "The Professional License requires purchase and a signed contract.",
    ],
    retrievedDate: "2026-07-25",
    sourceId: "astrodienst.swiss-ephemeris.licensing",
    sourceType: "official_primary",
    title: "Swiss Ephemeris licensing information",
    url: "https://www.astro.com/swisseph/swephinfo_e.htm",
    version: "2026-07-25",
  },
  {
    claims: [
      "The June 2026 unlimited Professional License is CHF 700 and valid for 99 years.",
      "Server use and compiled distribution are allowed, the software is provided as-is, and support is through the public community mailing list.",
    ],
    retrievedDate: "2026-07-25",
    sourceId: "astrodienst.swiss-ephemeris.contract",
    sourceType: "official_primary",
    title: "Swiss Ephemeris Professional License contract",
    url: "https://www.astro.com/swisseph/secont_e.pdf",
    version: "June 2026",
  },
  {
    claims: [
      "Swiss Ephemeris library version 2.10.03 was released on 2022-08-27.",
      "Version 2.10.03 fixed a lunar eclipse calculation defect and improved Moon magnitude calculation.",
    ],
    retrievedDate: "2026-07-25",
    sourceId: "astrodienst.swiss-ephemeris.programming-history",
    sourceType: "official_primary",
    title: "Swiss Ephemeris programming interface and release history",
    url: "https://www.astro.com/swisseph/swephprg.htm",
    version: "2.10.03",
  },
  {
    claims: [
      "The selected official source and data snapshot is tag v2.10.3final at commit af9823fe7b06ffefe3d3968fdc5680be8b5eec5f.",
      "The official source and compressed ephemeris data are published in the Astrodienst GitHub repository.",
    ],
    retrievedDate: "2026-07-25",
    sourceId: "astrodienst.swiss-ephemeris.source-snapshot",
    sourceType: "official_primary",
    title: "Swiss Ephemeris official source repository",
    url: "https://github.com/aloistr/swisseph",
    version: "v2.10.3final",
  },
] as const;

const evidenceReviewerRole = (
  code: AstrologyEngineEvidenceCode,
): AstrologyEngineEvidenceRecordV1["reviewerRole"] => {
  switch (code) {
    case "abi_version":
    case "compiler_and_flags_inventory":
      return "architecture";
    case "complete_payment":
    case "licensee_legal_name":
      return "owner";
    case "counter_signed_contract":
    case "legal_terms_review":
      return "legal";
    case "staging_kill_switch_exercise":
      return "operations";
    case "engine_flag_runtime_verification":
    case "ephemeris_data_inventory":
    case "native_sbom":
    case "reference_chart_tolerance":
    case "reproducible_native_build":
    case "source_archive":
    case "supply_chain_and_license_review":
      return "qa_security";
  }
};

const structuralReadiness = (value: unknown, asOfInput: unknown): StructuralReadiness => {
  const selection = parseAstrologyEngineSelectionV1(value);
  const asOf = date(asOfInput);
  const reasons = new Set<AstrologyEngineReadinessReasonCode>();
  const evidenceCodes = new Set(selection.evidence.map(({ code }) => code));
  const licenseDeclaredEffective =
    selection.license.executionStatus === "effective" &&
    selection.status === "licensed_safe_off" &&
    selection.editorial.status === "approved_licensed_safe_off" &&
    selection.license.licenseeLegalNameEvidenceSha256 !== null &&
    selection.license.contractEvidenceSha256 !== null &&
    selection.license.paymentEvidenceSha256 !== null &&
    selection.license.legalReviewEvidenceSha256 !== null;
  const ownerApproved =
    selection.editorial.approvalReference === "OWN-003:authorized-selection:2026-07-25" &&
    selection.editorial.reviewerId === "owner" &&
    selection.editorial.reviewerRole === "owner" &&
    selection.editorial.reviewedDate !== null &&
    selection.editorial.reviewedDate <= asOf &&
    selection.editorial.effectiveDate <= asOf &&
    selection.editorial.reviewDueDate >= asOf;

  if (!ownerApproved) reasons.add("OWNER_APPROVAL_MISSING");
  if (
    selection.selectionId !== "rituvia.astrology.engine.swiss-ephemeris" ||
    selection.engine.libraryVersion !== "2.10.03" ||
    selection.engine.libraryReleaseDate !== "2022-08-27" ||
    selection.engine.repository !== "https://github.com/aloistr/swisseph" ||
    selection.dataPolicy.sourceSnapshotTag !== "v2.10.3final" ||
    selection.dataPolicy.sourceSnapshotDate !== "2026-04-14" ||
    selection.dataPolicy.sourceCommit !== "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f" ||
    selection.dataPolicy.ephemerisFilesReference !==
      "https://github.com/aloistr/swisseph/tree/af9823fe7b06ffefe3d3968fdc5680be8b5eec5f/ephe" ||
    selection.dataPolicy.dataGenerationBaseline !==
      "Official v2.10.3final source snapshot and its DE441-based compressed Swiss Ephemeris data generation state; exact acquired files remain unverified." ||
    JSON.stringify(selection.sources) !== JSON.stringify(approvedSourceInventory)
  ) {
    reasons.add("SELECTED_ENGINE_VERSION_MISMATCH");
  }
  if (
    selection.license.contractEdition !== "June 2026" ||
    selection.license.fee.amount !== 700 ||
    selection.license.durationYears !== 99 ||
    selection.license.licenseType !== "unlimited" ||
    selection.license.serviceLevelAgreement !== "none" ||
    selection.license.availabilityOwner !== "rituvia" ||
    selection.license.privateSupportIncluded ||
    selection.license.bugFixCommitment !== "reasonable_effort_only" ||
    !selection.license.serverUseAllowed ||
    !selection.license.compiledDistributionAllowed ||
    selection.license.supportChannel !== "public_community_mailing_list" ||
    selection.license.warranty !== "as_is_without_correctness_or_fitness_guarantee" ||
    selection.license.publicAttributionPolicy !==
      "preserve_copyright_notices_and_do_not_use_provider_or_author_names_for_promotion" ||
    selection.license.sourceDistributionPolicy !==
      "optional_complete_source_only_modified_source_subject_to_agpl_conditions" ||
    JSON.stringify(selection.license.legalQuestions) !== JSON.stringify(approvedLegalQuestions)
  ) {
    reasons.add("LICENSE_TERMS_MISMATCH");
  }
  if (!licenseDeclaredEffective) reasons.add("LICENSE_NOT_EFFECTIVE");
  if (selection.license.licenseeLegalName === null) {
    reasons.add("LICENSEE_LEGAL_NAME_MISSING");
  }
  if (
    selection.license.legalReviewStatus !== "approved" ||
    !selection.evidence.some(
      ({ code, reviewerRole }) => code === "legal_terms_review" && reviewerRole === "legal",
    )
  ) {
    reasons.add("LEGAL_REVIEW_MISSING");
  }
  if (selection.requiredEvidenceCodes.some((code) => !evidenceCodes.has(code))) {
    reasons.add("REQUIRED_EVIDENCE_MISSING");
  }
  if (selection.dataPolicy.sourceArchiveSha256 === null || !evidenceCodes.has("source_archive")) {
    reasons.add("SOURCE_ARCHIVE_INTEGRITY_MISSING");
  }
  if (
    selection.dataPolicy.artifactIntegrityStatus !== "verified" ||
    selection.dataPolicy.verifiedDataArtifacts.length === 0 ||
    selection.dataPolicy.verifiedDataInventorySha256 === null ||
    !evidenceCodes.has("ephemeris_data_inventory")
  ) {
    reasons.add("EPHEMERIS_DATA_INTEGRITY_MISSING");
  }
  if ([...nativeEvidenceCodes].some((code) => !evidenceCodes.has(code))) {
    reasons.add("NATIVE_BUILD_EVIDENCE_MISSING");
  }
  const boundSubjects = new Map<AstrologyEngineEvidenceCode, string | null>([
    ["licensee_legal_name", selection.license.licenseeLegalNameEvidenceSha256],
    ["counter_signed_contract", selection.license.contractEvidenceSha256],
    ["complete_payment", selection.license.paymentEvidenceSha256],
    ["legal_terms_review", selection.license.legalReviewEvidenceSha256],
    ["source_archive", selection.dataPolicy.sourceArchiveSha256],
    ["ephemeris_data_inventory", selection.dataPolicy.verifiedDataInventorySha256],
  ]);
  if (
    selection.evidence.some(({ code, subjectSha256 }) => {
      const expectedSubject = boundSubjects.get(code);
      return expectedSubject !== undefined && expectedSubject !== subjectSha256;
    })
  ) {
    reasons.add("EVIDENCE_ARTIFACT_BINDING_MISMATCH");
  }
  if (
    selection.evidence.some(
      ({ code, reviewedDate, reviewerId, reviewerRole }) =>
        reviewerRole !== evidenceReviewerRole(code) ||
        reviewerId === selection.editorial.authorId ||
        reviewedDate < selection.editorial.effectiveDate ||
        reviewedDate > asOf,
    )
  ) {
    reasons.add("EVIDENCE_METADATA_INVALID");
  }
  if (
    selection.activationPolicy.productionActivation !== "forbidden_in_selection_v1" ||
    selection.activationPolicy.runtimeNetworkAllowed ||
    selection.activationPolicy.allowAutomaticEphemerisFallback ||
    selection.engine.networkRequired ||
    selection.privacyPolicy.runtimeNetworkAllowed ||
    selection.privacyPolicy.providerReceivesBirthData ||
    selection.adapter.nativeImplementationZone !==
      "unassigned_requires_architecture_registration" ||
    selection.dataPolicy.fallbackBehavior !== "reject_unexpected_engine_flag"
  ) {
    reasons.add("UNSAFE_RUNTIME_POLICY");
  }
  if (
    JSON.stringify(selection.exitPlan.replacementTriggers) !==
      JSON.stringify(approvedReplacementTriggers) ||
    !selection.exitPlan.sourceAndDataArchiveRequired ||
    !selection.exitPlan.reproducibleBuildRecordRequired ||
    !selection.exitPlan.sbomRequired ||
    !selection.exitPlan.dualRunMigrationRequired ||
    !selection.exitPlan.abiVersionRequired ||
    !selection.exitPlan.exactDataInventoryRequired ||
    selection.exitPlan.runtimeEngineFlagVerification !== "SEFLG_SWIEPH_required"
  ) {
    reasons.add("EXIT_PATH_MISSING");
  }

  return { ownerApproved, reasons, selection };
};

const assessment = (
  structural: StructuralReadiness,
  asOf: string,
  evidenceAuthorityVerified: boolean,
  evidenceAuthorityRejected: boolean,
): AstrologyEngineReadinessAssessment => {
  const reasons = new Set(structural.reasons);
  if (!evidenceAuthorityVerified) {
    reasons.add(
      evidenceAuthorityRejected ? "EVIDENCE_AUTHORITY_REJECTED" : "EVIDENCE_AUTHORITY_NOT_VERIFIED",
    );
  }
  reasons.add("PRODUCTION_ACTIVATION_FORBIDDEN");
  const integrationReady = structural.reasons.size === 0 && evidenceAuthorityVerified;
  return Object.freeze({
    asOf,
    evidenceAuthorityVerified,
    integrationReady,
    licenseEffective:
      integrationReady &&
      structural.selection.license.executionStatus === "effective" &&
      structural.selection.status === "licensed_safe_off",
    productionActivationAllowed: false,
    reasons: Object.freeze(
      astrologyEngineReadinessReasonCodes.filter((reason) => reasons.has(reason)),
    ),
    schemaVersion: astrologyEngineReadinessSchemaVersion,
    selected:
      structural.ownerApproved && !structural.reasons.has("SELECTED_ENGINE_VERSION_MISMATCH"),
    selectionId: structural.selection.selectionId,
    selectionVersion: structural.selection.version,
  });
};

export const assessAstrologyEngineReadiness = (
  value: unknown,
  asOfInput: unknown,
): AstrologyEngineReadinessAssessment => {
  const asOf = date(asOfInput);
  return assessment(structuralReadiness(value, asOf), asOf, false, false);
};

export const verifyAstrologyEngineIntegrationReadiness = async (
  value: unknown,
  asOfInput: unknown,
  selectionManifestSha256Input: unknown,
  verifyEvidenceAuthority: AstrologyEngineEvidenceAuthorityVerifierV1,
): Promise<AstrologyEngineReadinessAssessment> => {
  const asOf = date(asOfInput);
  const selectionManifestSha256 = checksum(selectionManifestSha256Input);
  const structural = structuralReadiness(value, asOf);
  let evidenceAuthorityVerified = structural.selection.evidence.length > 0;
  try {
    for (const evidenceRecord of structural.selection.evidence) {
      if (
        !(await verifyEvidenceAuthority({
          evidence: evidenceRecord,
          selection: structural.selection,
          selectionId: structural.selection.selectionId,
          selectionManifestSha256,
          selectionVersion: structural.selection.version,
        }))
      ) {
        evidenceAuthorityVerified = false;
      }
    }
  } catch {
    evidenceAuthorityVerified = false;
  }
  return assessment(structural, asOf, evidenceAuthorityVerified, !evidenceAuthorityVerified);
};

export const assertAstrologyEngineIntegrationReady = async (
  value: unknown,
  asOfInput: unknown,
  selectionManifestSha256Input: unknown,
  verifyEvidenceAuthority: AstrologyEngineEvidenceAuthorityVerifierV1,
): Promise<AstrologyEngineSelectionV1> => {
  const selection = parseAstrologyEngineSelectionV1(value);
  const readiness = await verifyAstrologyEngineIntegrationReadiness(
    selection,
    asOfInput,
    selectionManifestSha256Input,
    verifyEvidenceAuthority,
  );
  if (!readiness.integrationReady) {
    throw new AstrologyEngineSelectionError("ASTROLOGY_ENGINE_NOT_INTEGRATION_READY");
  }
  return selection;
};
