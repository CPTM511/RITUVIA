import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AstrologyEngineSelectionError,
  assertAstrologyEngineIntegrationReady,
  assessAstrologyEngineReadiness,
  astrologyEngineEvidenceCodes,
  parseAstrologyEngineSelectionV1,
  verifyAstrologyEngineIntegrationReadiness,
  type AstrologyEngineEvidenceCode,
  type AstrologyEngineSelectionErrorCode,
} from "../src/index.js";

type SelectionFixture = {
  activationPolicy: {
    allowAutomaticEphemerisFallback: boolean;
    productionActivation: string;
    runtimeNetworkAllowed: boolean;
  };
  adapter: {
    nativeImplementationZone: string;
  };
  dataPolicy: {
    artifactIntegrityStatus: string;
    ephemerisFilesReference: string;
    sourceArchiveSha256: string | null;
    sourceSnapshotDate: string;
    sourceSnapshotTag: string;
    sourceCommit: string;
    verifiedDataArtifacts: Array<{ path: string; sha256: string }>;
    verifiedDataInventorySha256: string | null;
  };
  editorial: {
    approvalReference: string | null;
    reviewDueDate: string;
    reviewedDate: string | null;
    reviewerId: string | null;
    reviewerRole: string | null;
    status: string;
  };
  engine: {
    libraryReleaseDate: string;
    libraryVersion: string;
  };
  evidence: Array<{
    code: AstrologyEngineEvidenceCode;
    evidenceId: string;
    reference: string;
    reviewedDate: string;
    reviewerId: string;
    reviewerRole: string;
    sha256: string;
    status: string;
    subjectSha256: string;
  }>;
  exitPlan: {
    dualRunMigrationRequired: boolean;
    replacementTriggers: string[];
  };
  license: {
    contractEvidenceSha256: string | null;
    executionStatus: string;
    fee: {
      amount: number;
    };
    legalReviewStatus: string;
    legalReviewEvidenceSha256: string | null;
    licenseeLegalName: string | null;
    licenseeLegalNameEvidenceSha256: string | null;
    paymentEvidenceSha256: string | null;
  };
  privacyPolicy: {
    providerReceivesBirthData: boolean;
  };
  requiredEvidenceCodes: AstrologyEngineEvidenceCode[];
  schemaVersion: string;
  sources: Array<{
    claims: string[];
    sourceId: string;
    url: string;
    version: string;
  }>;
  status: string;
  unexpected?: string;
};

const fixturePath = new URL(
  "../../../content/sources/astrology/swiss-ephemeris-professional.v1.json",
  import.meta.url,
);
const packagePath = new URL("../package.json", import.meta.url);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as SelectionFixture;
const packageManifest = JSON.parse(await readFile(packagePath, "utf8")) as {
  dependencies: Record<string, string>;
};

const cloneFixture = (): SelectionFixture => structuredClone(fixture);
const checksum = (character: string): string => `sha256:${character.repeat(64)}`;
const manifestChecksum = (candidate: SelectionFixture): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(candidate)).digest("hex")}`;

const evidenceRoles: Record<AstrologyEngineEvidenceCode, string> = {
  abi_version: "architecture",
  compiler_and_flags_inventory: "architecture",
  complete_payment: "owner",
  counter_signed_contract: "legal",
  engine_flag_runtime_verification: "qa_security",
  ephemeris_data_inventory: "qa_security",
  legal_terms_review: "legal",
  licensee_legal_name: "owner",
  native_sbom: "qa_security",
  reference_chart_tolerance: "qa_security",
  reproducible_native_build: "qa_security",
  source_archive: "qa_security",
  staging_kill_switch_exercise: "operations",
  supply_chain_and_license_review: "qa_security",
};

const completeEvidence = (candidate: SelectionFixture): void => {
  candidate.status = "licensed_safe_off";
  candidate.editorial.status = "approved_licensed_safe_off";
  candidate.license.executionStatus = "effective";
  candidate.license.legalReviewStatus = "approved";
  candidate.license.licenseeLegalName = "Synthetic Licensee Ltd";
  candidate.dataPolicy.artifactIntegrityStatus = "verified";
  candidate.dataPolicy.verifiedDataArtifacts = [
    {
      path: "ephe/sepl_18.se1",
      sha256: checksum("b"),
    },
  ];
  candidate.evidence = astrologyEngineEvidenceCodes.map((code, index) => ({
    code,
    evidenceId: `rituvia.astrology.evidence.${code.replaceAll("_", "-")}`,
    reference: `private-evidence:${code.replaceAll("_", "-")}`,
    reviewedDate: "2026-07-25",
    reviewerId: `reviewer-${evidenceRoles[code].replaceAll("_", "-")}`,
    reviewerRole: evidenceRoles[code],
    sha256: checksum(((index % 6) + 4).toString(16)),
    status: "verified",
    subjectSha256: checksum(((index % 6) + 10).toString(16)),
  }));
  const subject = (code: AstrologyEngineEvidenceCode): string =>
    candidate.evidence.find((record) => record.code === code)?.subjectSha256 ??
    expect.unreachable(`Missing synthetic evidence for ${code}.`);
  candidate.license.licenseeLegalNameEvidenceSha256 = subject("licensee_legal_name");
  candidate.license.contractEvidenceSha256 = subject("counter_signed_contract");
  candidate.license.paymentEvidenceSha256 = subject("complete_payment");
  candidate.license.legalReviewEvidenceSha256 = subject("legal_terms_review");
  candidate.dataPolicy.sourceArchiveSha256 = subject("source_archive");
  candidate.dataPolicy.verifiedDataInventorySha256 = subject("ephemeris_data_inventory");
};

const expectSelectionError = (
  candidate: unknown,
  code: AstrologyEngineSelectionErrorCode,
): void => {
  try {
    parseAstrologyEngineSelectionV1(candidate);
    expect.unreachable("The invalid selection must be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(AstrologyEngineSelectionError);
    expect((error as AstrologyEngineSelectionError).code).toBe(code);
    expect((error as Error).message).not.toContain("private-canary");
  }
};

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

describe("astrology engine selection v1", () => {
  it("parses and freezes the exact owner-approved safe-off selection", () => {
    const before = JSON.stringify(fixture);
    const selection = parseAstrologyEngineSelectionV1(fixture);

    expect(JSON.stringify(fixture)).toBe(before);
    expectDeepFrozen(selection);
    expect(selection).toMatchObject({
      schemaVersion: "astrology-engine-selection.v1",
      selectionId: "rituvia.astrology.engine.swiss-ephemeris",
      status: "selected_pending_license",
      engine: {
        libraryReleaseDate: "2022-08-27",
        libraryVersion: "2.10.03",
        name: "Swiss Ephemeris",
        provider: "Astrodienst AG",
      },
      dataPolicy: {
        sourceSnapshotDate: "2026-04-14",
        sourceSnapshotTag: "v2.10.3final",
        sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
      },
      adapter: {
        interfaceOwner: "@rituvia/divination",
        nativeImplementationZone: "unassigned_requires_architecture_registration",
      },
    });
    expect(selection.activationPolicy.productionActivation).toBe("forbidden_in_selection_v1");
  });

  it("fails closed on missing external license, integrity, and native-build evidence", () => {
    expect(assessAstrologyEngineReadiness(fixture, "2026-07-25")).toEqual({
      asOf: "2026-07-25",
      evidenceAuthorityVerified: false,
      integrationReady: false,
      licenseEffective: false,
      productionActivationAllowed: false,
      reasons: [
        "LICENSE_NOT_EFFECTIVE",
        "LICENSEE_LEGAL_NAME_MISSING",
        "LEGAL_REVIEW_MISSING",
        "REQUIRED_EVIDENCE_MISSING",
        "SOURCE_ARCHIVE_INTEGRITY_MISSING",
        "EPHEMERIS_DATA_INTEGRITY_MISSING",
        "NATIVE_BUILD_EVIDENCE_MISSING",
        "EVIDENCE_AUTHORITY_NOT_VERIFIED",
        "PRODUCTION_ACTIVATION_FORBIDDEN",
      ],
      schemaVersion: "astrology-engine-readiness.v1",
      selected: true,
      selectionId: "rituvia.astrology.engine.swiss-ephemeris",
      selectionVersion: "1.0.0",
    });
  });

  it("requires an independent authority even when the catalog declares complete evidence", async () => {
    const candidate = cloneFixture();
    completeEvidence(candidate);
    const candidateManifestSha256 = manifestChecksum(candidate);

    expect(assessAstrologyEngineReadiness(candidate, "2026-07-25")).toMatchObject({
      evidenceAuthorityVerified: false,
      integrationReady: false,
      licenseEffective: false,
      productionActivationAllowed: false,
      reasons: ["EVIDENCE_AUTHORITY_NOT_VERIFIED", "PRODUCTION_ACTIVATION_FORBIDDEN"],
    });

    const accepted = await verifyAstrologyEngineIntegrationReadiness(
      candidate,
      "2026-07-25",
      candidateManifestSha256,
      ({ evidence, selection, selectionManifestSha256 }) =>
        selection.status === "licensed_safe_off" &&
        selectionManifestSha256 === candidateManifestSha256 &&
        evidence.reference.startsWith("private-evidence:") &&
        evidence.subjectSha256.startsWith("sha256:"),
    );
    expect(accepted).toMatchObject({
      evidenceAuthorityVerified: true,
      integrationReady: true,
      licenseEffective: true,
      productionActivationAllowed: false,
      reasons: ["PRODUCTION_ACTIVATION_FORBIDDEN"],
    });
    await expect(
      assertAstrologyEngineIntegrationReady(
        candidate,
        "2026-07-25",
        candidateManifestSha256,
        () => true,
      ),
    ).resolves.toMatchObject({
      status: "licensed_safe_off",
    });
  });

  it("rejects denied or failing external evidence without leaking authority errors", async () => {
    const candidate = cloneFixture();
    completeEvidence(candidate);
    const candidateManifestSha256 = manifestChecksum(candidate);

    await expect(
      verifyAstrologyEngineIntegrationReadiness(
        candidate,
        "2026-07-25",
        candidateManifestSha256,
        () => false,
      ),
    ).resolves.toMatchObject({
      evidenceAuthorityVerified: false,
      integrationReady: false,
      reasons: ["EVIDENCE_AUTHORITY_REJECTED", "PRODUCTION_ACTIVATION_FORBIDDEN"],
    });
    await expect(
      assertAstrologyEngineIntegrationReady(
        candidate,
        "2026-07-25",
        candidateManifestSha256,
        () => {
          throw new Error("private-canary");
        },
      ),
    ).rejects.toMatchObject({
      code: "ASTROLOGY_ENGINE_NOT_INTEGRATION_READY",
      message: "The astrology engine is not ready for integration.",
    });
  });

  it("pins library release separately from the 2026 source and data snapshot", () => {
    const selection = parseAstrologyEngineSelectionV1(fixture);

    expect(selection.engine).toMatchObject({
      libraryReleaseDate: "2022-08-27",
      libraryVersion: "2.10.03",
    });
    expect(selection.dataPolicy).toMatchObject({
      baseline: "compressed_swiss_ephemeris_de441",
      ephemerisFilesReference:
        "https://github.com/aloistr/swisseph/tree/af9823fe7b06ffefe3d3968fdc5680be8b5eec5f/ephe",
      sourceSnapshotDate: "2026-04-14",
      sourceSnapshotTag: "v2.10.3final",
      sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
    });
  });

  it("records no SLA, RITUVIA availability ownership, and unresolved legal review", () => {
    const selection = parseAstrologyEngineSelectionV1(fixture);

    expect(selection.license).toMatchObject({
      availabilityOwner: "rituvia",
      contractEdition: "June 2026",
      durationYears: 99,
      executionStatus: "pending_counter_signature_and_payment",
      fee: { amount: 700, billing: "one_time", currency: "CHF" },
      legalReviewStatus: "pending",
      privateSupportIncluded: false,
      serviceLevelAgreement: "none",
      supportChannel: "public_community_mailing_list",
      warranty: "as_is_without_correctness_or_fitness_guarantee",
    });
    expect(selection.license.legalQuestions).toHaveLength(2);
  });

  it("uses official sources and adds no native or AGPL dependency", () => {
    const selection = parseAstrologyEngineSelectionV1(fixture);

    expect(selection.sources.map(({ sourceId }) => sourceId)).toEqual([
      "astrodienst.swiss-ephemeris.licensing",
      "astrodienst.swiss-ephemeris.contract",
      "astrodienst.swiss-ephemeris.programming-history",
      "astrodienst.swiss-ephemeris.source-snapshot",
    ]);
    expect(
      selection.sources.every(
        ({ claims, sourceType, url }) =>
          claims.length > 0 && sourceType === "official_primary" && url.startsWith("https://"),
      ),
    ).toBe(true);
    expect(packageManifest.dependencies).toEqual({
      "@rituvia/domain": "workspace:*",
    });
  });

  it("detects approval, version, terms, exit, and unsafe-policy drift", () => {
    const approvalDrift = cloneFixture();
    approvalDrift.editorial.approvalReference = null;
    expect(assessAstrologyEngineReadiness(approvalDrift, "2026-07-25").reasons).toContain(
      "OWNER_APPROVAL_MISSING",
    );

    const versionDrift = cloneFixture();
    versionDrift.engine.libraryVersion = "2.10.04";
    expect(assessAstrologyEngineReadiness(versionDrift, "2026-07-25").reasons).toContain(
      "SELECTED_ENGINE_VERSION_MISMATCH",
    );

    const termsDrift = cloneFixture();
    termsDrift.license.fee.amount = 1;
    expect(assessAstrologyEngineReadiness(termsDrift, "2026-07-25").reasons).toContain(
      "LICENSE_TERMS_MISMATCH",
    );

    const sourceDrift = cloneFixture();
    sourceDrift.sources[0]!.claims[0] = "Changed same-version licensing claim.";
    expect(assessAstrologyEngineReadiness(sourceDrift, "2026-07-25").reasons).toContain(
      "SELECTED_ENGINE_VERSION_MISMATCH",
    );

    const exitDrift = cloneFixture();
    exitDrift.exitPlan.replacementTriggers.pop();
    expect(assessAstrologyEngineReadiness(exitDrift, "2026-07-25").reasons).toContain(
      "EXIT_PATH_MISSING",
    );

    const bindingDrift = cloneFixture();
    completeEvidence(bindingDrift);
    bindingDrift.evidence.find(({ code }) => code === "source_archive")!.subjectSha256 =
      checksum("f");
    expect(assessAstrologyEngineReadiness(bindingDrift, "2026-07-25").reasons).toContain(
      "EVIDENCE_ARTIFACT_BINDING_MISMATCH",
    );

    const roleDrift = cloneFixture();
    completeEvidence(roleDrift);
    roleDrift.evidence.find(({ code }) => code === "complete_payment")!.reviewerRole =
      "qa_security";
    expect(assessAstrologyEngineReadiness(roleDrift, "2026-07-25").reasons).toContain(
      "EVIDENCE_METADATA_INVALID",
    );

    const chronologyDrift = cloneFixture();
    completeEvidence(chronologyDrift);
    chronologyDrift.evidence[0]!.reviewedDate = "2026-07-26";
    expect(assessAstrologyEngineReadiness(chronologyDrift, "2026-07-25").reasons).toContain(
      "EVIDENCE_METADATA_INVALID",
    );

    const network = cloneFixture();
    network.activationPolicy.runtimeNetworkAllowed = true;
    expectSelectionError(network, "ASTROLOGY_ENGINE_SELECTION_INVALID");

    const fallback = cloneFixture();
    fallback.activationPolicy.allowAutomaticEphemerisFallback = true;
    expectSelectionError(fallback, "ASTROLOGY_ENGINE_SELECTION_INVALID");

    const providerData = cloneFixture();
    providerData.privacyPolicy.providerReceivesBirthData = true;
    expectSelectionError(providerData, "ASTROLOGY_ENGINE_SELECTION_INVALID");

    const production = cloneFixture() as SelectionFixture & {
      activationPolicy: SelectionFixture["activationPolicy"] & {
        allowProductionCalculation?: boolean;
      };
    };
    production.activationPolicy.allowProductionCalculation = true;
    expectSelectionError(production, "ASTROLOGY_ENGINE_SELECTION_INVALID");

    const schema = cloneFixture();
    schema.schemaVersion = "astrology-engine-selection.v2";
    expectSelectionError(schema, "ASTROLOGY_ENGINE_SELECTION_SCHEMA_UNSUPPORTED");

    const unknown = cloneFixture();
    unknown.unexpected = "private-canary";
    expectSelectionError(unknown, "ASTROLOGY_ENGINE_SELECTION_INVALID");
  });
});
