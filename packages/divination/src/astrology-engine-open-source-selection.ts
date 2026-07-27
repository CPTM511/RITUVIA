export const astrologyEngineOpenSourceSelectionSchemaVersion =
  "astrology-engine-selection.v2" as const;

export const astrologyEngineOpenSourceEvidenceCodes = Object.freeze([
  "owner_agpl_approval",
  "whole_project_agpl_license",
  "upstream_source_inventory",
  "ephemeris_data_inventory",
  "compiler_and_flags_inventory",
  "reproducible_native_build",
  "native_sbom",
  "abi_version",
  "engine_flag_runtime_verification",
  "reference_chart_tolerance",
  "supply_chain_and_license_review",
  "corresponding_source_dry_run",
  "staging_kill_switch_exercise",
] as const);

export type AstrologyEngineOpenSourceEvidenceCode =
  (typeof astrologyEngineOpenSourceEvidenceCodes)[number];

export type AstrologyEngineOpenSourceSelectionV2 = Readonly<{
  activationPolicy: Readonly<{
    allowAutomaticEphemerisFallback: false;
    featureFlag: "experience.astrology";
    localIntegrationAllowed: true;
    productionActivation: "forbidden_until_release_evidence";
    runtimeNetworkAllowed: false;
  }>;
  adapter: Readonly<{
    interfaceId: "rituvia.astrology.ephemeris-adapter";
    interfaceOwner: "@rituvia/divination";
    interfaceVersion: "1.0.0";
    nativeImplementationPackage: "@rituvia/astrology-engine-native";
    providerTypesForbiddenInPurePackage: true;
  }>;
  contentType: "astrology_engine_open_source_selection";
  dataPolicy: Readonly<{
    ephemerisFiles: readonly Readonly<{
      path: string;
      sha256: string;
    }>[];
    inventorySha256: string;
    runtimeDelivery: "checksum_pinned_read_only_build_artifact";
  }>;
  engine: Readonly<{
    libraryReleaseDate: "2022-08-27";
    libraryVersion: "2.10.03";
    name: "Swiss Ephemeris";
    sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f";
    sourceSnapshotTag: "v2.10.3final";
  }>;
  evidence: readonly Readonly<{
    code: AstrologyEngineOpenSourceEvidenceCode;
    reference: string;
    status: "verified";
  }>[];
  license: Readonly<{
    correspondingSource: Readonly<{
      buildAndInstallScriptsRequired: true;
      deployedVersionMatchRequired: true;
      networkSourceLinkRequired: true;
      upstreamArchivesRequiredAtRelease: true;
    }>;
    model: "GNU Affero General Public License";
    ownerApprovalReference: string;
    professionalContractRequired: false;
    spdx: "AGPL-3.0-only";
    wholeProjectLicense: "AGPL-3.0-only";
  }>;
  requiredReleaseEvidence: readonly AstrologyEngineOpenSourceEvidenceCode[];
  schemaVersion: typeof astrologyEngineOpenSourceSelectionSchemaVersion;
  selectionId: "rituvia.astrology.engine.swiss-ephemeris";
  status: "agpl_approved_local_integration";
  supersedes: Readonly<{
    schemaVersion: "astrology-engine-selection.v1";
    version: "1.0.0";
  }>;
  upstreamManifest: Readonly<{
    archiveSha256: string;
    manifestPath: "packages/astrology-engine-native/native/vendor-manifest.json";
    manifestSha256: string;
  }>;
  version: "2.0.0";
}>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new TypeError("The astrology open-source selection contract is invalid.");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) invalid();
};

const array = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : invalid());

const literal = <Value extends string | boolean>(value: unknown, expected: Value): Value =>
  value === expected ? expected : invalid();

const text = (value: unknown, maximumLength = 500): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u.test(
      value,
    )
  ) {
    invalid();
  }
  return value as string;
};

const sha256 = (value: unknown): string => {
  const parsed = text(value, 64);
  return /^[0-9a-f]{64}$/u.test(parsed) ? parsed : invalid();
};

const evidenceCode = (value: unknown): AstrologyEngineOpenSourceEvidenceCode =>
  astrologyEngineOpenSourceEvidenceCodes.includes(value as AstrologyEngineOpenSourceEvidenceCode)
    ? (value as AstrologyEngineOpenSourceEvidenceCode)
    : invalid();

export const parseAstrologyEngineOpenSourceSelectionV2 = (
  value: unknown,
): AstrologyEngineOpenSourceSelectionV2 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "activationPolicy",
    "adapter",
    "contentType",
    "dataPolicy",
    "engine",
    "evidence",
    "license",
    "requiredReleaseEvidence",
    "schemaVersion",
    "selectionId",
    "status",
    "supersedes",
    "upstreamManifest",
    "version",
  ]);

  const activationPolicy = record(parsed.activationPolicy);
  exactKeys(activationPolicy, [
    "allowAutomaticEphemerisFallback",
    "featureFlag",
    "localIntegrationAllowed",
    "productionActivation",
    "runtimeNetworkAllowed",
  ]);

  const adapter = record(parsed.adapter);
  exactKeys(adapter, [
    "interfaceId",
    "interfaceOwner",
    "interfaceVersion",
    "nativeImplementationPackage",
    "providerTypesForbiddenInPurePackage",
  ]);

  const engine = record(parsed.engine);
  exactKeys(engine, [
    "libraryReleaseDate",
    "libraryVersion",
    "name",
    "sourceCommit",
    "sourceSnapshotTag",
  ]);

  const license = record(parsed.license);
  exactKeys(license, [
    "correspondingSource",
    "model",
    "ownerApprovalReference",
    "professionalContractRequired",
    "spdx",
    "wholeProjectLicense",
  ]);
  const correspondingSource = record(license.correspondingSource);
  exactKeys(correspondingSource, [
    "buildAndInstallScriptsRequired",
    "deployedVersionMatchRequired",
    "networkSourceLinkRequired",
    "upstreamArchivesRequiredAtRelease",
  ]);

  const dataPolicy = record(parsed.dataPolicy);
  exactKeys(dataPolicy, ["ephemerisFiles", "inventorySha256", "runtimeDelivery"]);
  const rawEphemerisFiles = array(dataPolicy.ephemerisFiles);
  if (rawEphemerisFiles.length !== 2) invalid();
  const ephemerisFiles = rawEphemerisFiles.map((entry: unknown) => {
    const artifact = record(entry);
    exactKeys(artifact, ["path", "sha256"]);
    const artifactPath = text(artifact.path, 100);
    if (!/^ephe\/se(?:mo|pl)_18\.se1$/u.test(artifactPath)) invalid();
    return Object.freeze({ path: artifactPath, sha256: sha256(artifact.sha256) });
  });
  if (new Set(ephemerisFiles.map(({ path }) => path)).size !== ephemerisFiles.length) invalid();

  const upstreamManifest = record(parsed.upstreamManifest);
  exactKeys(upstreamManifest, ["archiveSha256", "manifestPath", "manifestSha256"]);

  const supersedes = record(parsed.supersedes);
  exactKeys(supersedes, ["schemaVersion", "version"]);

  const rawEvidence = array(parsed.evidence);
  const rawRequiredReleaseEvidence = array(parsed.requiredReleaseEvidence);
  const evidence = rawEvidence.map((entry: unknown) => {
    const evidenceRecord = record(entry);
    exactKeys(evidenceRecord, ["code", "reference", "status"]);
    return Object.freeze({
      code: evidenceCode(evidenceRecord.code),
      reference: text(evidenceRecord.reference),
      status: literal(evidenceRecord.status, "verified"),
    });
  });
  const requiredReleaseEvidence = rawRequiredReleaseEvidence.map(evidenceCode);
  if (
    new Set(evidence.map(({ code }) => code)).size !== evidence.length ||
    new Set(requiredReleaseEvidence).size !== requiredReleaseEvidence.length ||
    requiredReleaseEvidence.length !== astrologyEngineOpenSourceEvidenceCodes.length ||
    astrologyEngineOpenSourceEvidenceCodes.some((code) => !requiredReleaseEvidence.includes(code))
  ) {
    invalid();
  }

  return Object.freeze({
    activationPolicy: Object.freeze({
      allowAutomaticEphemerisFallback: literal(
        activationPolicy.allowAutomaticEphemerisFallback,
        false,
      ),
      featureFlag: literal(activationPolicy.featureFlag, "experience.astrology"),
      localIntegrationAllowed: literal(activationPolicy.localIntegrationAllowed, true),
      productionActivation: literal(
        activationPolicy.productionActivation,
        "forbidden_until_release_evidence",
      ),
      runtimeNetworkAllowed: literal(activationPolicy.runtimeNetworkAllowed, false),
    }),
    adapter: Object.freeze({
      interfaceId: literal(adapter.interfaceId, "rituvia.astrology.ephemeris-adapter"),
      interfaceOwner: literal(adapter.interfaceOwner, "@rituvia/divination"),
      interfaceVersion: literal(adapter.interfaceVersion, "1.0.0"),
      nativeImplementationPackage: literal(
        adapter.nativeImplementationPackage,
        "@rituvia/astrology-engine-native",
      ),
      providerTypesForbiddenInPurePackage: literal(
        adapter.providerTypesForbiddenInPurePackage,
        true,
      ),
    }),
    contentType: literal(parsed.contentType, "astrology_engine_open_source_selection"),
    dataPolicy: Object.freeze({
      ephemerisFiles: Object.freeze(ephemerisFiles),
      inventorySha256: sha256(dataPolicy.inventorySha256),
      runtimeDelivery: literal(
        dataPolicy.runtimeDelivery,
        "checksum_pinned_read_only_build_artifact",
      ),
    }),
    engine: Object.freeze({
      libraryReleaseDate: literal(engine.libraryReleaseDate, "2022-08-27"),
      libraryVersion: literal(engine.libraryVersion, "2.10.03"),
      name: literal(engine.name, "Swiss Ephemeris"),
      sourceCommit: literal(engine.sourceCommit, "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f"),
      sourceSnapshotTag: literal(engine.sourceSnapshotTag, "v2.10.3final"),
    }),
    evidence: Object.freeze(evidence),
    license: Object.freeze({
      correspondingSource: Object.freeze({
        buildAndInstallScriptsRequired: literal(
          correspondingSource.buildAndInstallScriptsRequired,
          true,
        ),
        deployedVersionMatchRequired: literal(
          correspondingSource.deployedVersionMatchRequired,
          true,
        ),
        networkSourceLinkRequired: literal(correspondingSource.networkSourceLinkRequired, true),
        upstreamArchivesRequiredAtRelease: literal(
          correspondingSource.upstreamArchivesRequiredAtRelease,
          true,
        ),
      }),
      model: literal(license.model, "GNU Affero General Public License"),
      ownerApprovalReference: text(license.ownerApprovalReference),
      professionalContractRequired: literal(license.professionalContractRequired, false),
      spdx: literal(license.spdx, "AGPL-3.0-only"),
      wholeProjectLicense: literal(license.wholeProjectLicense, "AGPL-3.0-only"),
    }),
    requiredReleaseEvidence: Object.freeze(requiredReleaseEvidence),
    schemaVersion: literal(parsed.schemaVersion, astrologyEngineOpenSourceSelectionSchemaVersion),
    selectionId: literal(parsed.selectionId, "rituvia.astrology.engine.swiss-ephemeris"),
    status: literal(parsed.status, "agpl_approved_local_integration"),
    supersedes: Object.freeze({
      schemaVersion: literal(supersedes.schemaVersion, "astrology-engine-selection.v1"),
      version: literal(supersedes.version, "1.0.0"),
    }),
    upstreamManifest: Object.freeze({
      archiveSha256: sha256(upstreamManifest.archiveSha256),
      manifestPath: literal(
        upstreamManifest.manifestPath,
        "packages/astrology-engine-native/native/vendor-manifest.json",
      ),
      manifestSha256: sha256(upstreamManifest.manifestSha256),
    }),
    version: literal(parsed.version, "2.0.0"),
  });
};

export const assessAstrologyEngineOpenSourceReleaseV2 = (
  selection: AstrologyEngineOpenSourceSelectionV2,
  independentlyVerifiedEvidence: ReadonlySet<AstrologyEngineOpenSourceEvidenceCode>,
): Readonly<{
  integrationAllowed: boolean;
  missingReleaseEvidence: readonly AstrologyEngineOpenSourceEvidenceCode[];
  productionActivationAllowed: boolean;
}> => {
  const catalogClaims = new Set(selection.evidence.map(({ code }) => code));
  const verified = new Set(
    [...independentlyVerifiedEvidence].filter((code) => catalogClaims.has(code)),
  );
  const missingReleaseEvidence = selection.requiredReleaseEvidence.filter(
    (code) => !verified.has(code),
  );
  const integrationAllowed =
    verified.has("owner_agpl_approval") && verified.has("whole_project_agpl_license");
  return Object.freeze({
    integrationAllowed,
    missingReleaseEvidence: Object.freeze(missingReleaseEvidence),
    productionActivationAllowed: integrationAllowed && missingReleaseEvidence.length === 0,
  });
};
