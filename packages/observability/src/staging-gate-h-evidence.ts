import { snapshotOwnEnumerableData } from "./redaction.js";

export const stagingGateHEvidenceSchemaVersion = "staging-gate-h-evidence.v1" as const;
export const stagingGateHReportSchemaVersion = "staging-gate-h-report.v1" as const;

export const stagingGateHControlIds = Object.freeze([
  "protected_staging_configuration",
  "invite_ingress",
  "aggregate_monitoring_alerting",
  "provider_backup_pitr_restore",
  "kill_switch_outage_rollback",
  "independent_security_testing",
  "support_refund_admin_audit",
  "rollback",
] as const);

export type StagingGateHControlId = (typeof stagingGateHControlIds)[number];
export type StagingGateHEvidenceKind =
  | "external_security_report"
  | "owner_approved_record"
  | "provider_restore_attestation"
  | "repository_verification"
  | "staging_drill"
  | "staging_operational_aggregate"
  | "standing_staging_attestation";
export type StagingGateHEvidenceEnvironment =
  "ci" | "external" | "local" | "protected_staging" | "repository";
export type StagingGateHControlState = "blocked" | "failed" | "passed";

export type StagingGateHEvidenceReference = Readonly<{
  approvalReference: string | null;
  digest: string;
  environment: StagingGateHEvidenceEnvironment;
  kind: StagingGateHEvidenceKind;
  observedAt: string;
  outcome: "failed" | "passed";
  path: string;
  revision: string | null;
}>;

export type StagingGateHControlEvidence = Readonly<{
  evidence: readonly StagingGateHEvidenceReference[];
  id: StagingGateHControlId;
}>;

export type StagingGateHEvidenceSnapshot = Readonly<{
  candidate: Readonly<{
    artifactDigest: string;
    configurationDigest: string;
    correspondingSourceDigest: string;
    invitePolicy: Readonly<{
      adultOnly: true;
      automaticRetryAfterRateLimit: false;
      globalSessionLimit: 30;
      globalSessionWindowSeconds: 60;
      intakeLimit: 12;
      intakeWindowSeconds: 60;
      locale: "en";
      maximumInvitedAdults: 25;
      mutationLimit: 120;
      mutationWindowSeconds: 86_400;
      persistentNetworkOrDeviceIdentifiers: false;
      publicSignup: false;
      singleUseRevocableExpiringInvites: true;
    }>;
    lockfileDigest: string;
    nodeVersion: "26.5.1";
    policyReference: "own-019.protected-beta-abuse.v1";
    pnpmVersion: "11.13.1";
    profile: "protected_english_anonymous_free_beta";
    revision: string;
    stagingProfile: Readonly<{
      access: "team_allowlist";
      appEnvironment: "staging";
      data: "synthetic_or_dedicated_test_accounts";
      indexing: "noindex_disallow_no_sitemap";
      liveProviders: "disabled";
      resources: "isolated_non_production";
    }>;
    worktreeState: "clean" | "dirty";
  }>;
  capturedAt: string;
  controls: readonly StagingGateHControlEvidence[];
  schemaVersion: typeof stagingGateHEvidenceSchemaVersion;
}>;

export type StagingGateHControlReport = Readonly<{
  evidence: readonly StagingGateHEvidenceReference[];
  id: StagingGateHControlId;
  maximumAgeHours: number;
  requiredEvidenceKinds: readonly StagingGateHEvidenceKind[];
  state: StagingGateHControlState;
  title: string;
  unmetEvidenceKinds: readonly StagingGateHEvidenceKind[];
}>;

export type StagingGateHReport = Readonly<{
  authorizationStatus: "owner_gate_required";
  candidate: StagingGateHEvidenceSnapshot["candidate"];
  caveats: readonly string[];
  decisionStatus: "blocked" | "evidence_ready" | "failed";
  deploymentAuthorized: false;
  gateHState: "evidence_ready_for_owner_review" | "incomplete";
  generatedAt: string;
  inputDigest: string;
  schemaVersion: typeof stagingGateHReportSchemaVersion;
  controls: readonly StagingGateHControlReport[];
}>;

type ControlPolicy = Readonly<{
  maximumAgeHours: number;
  requiredEvidenceKinds: readonly StagingGateHEvidenceKind[];
  title: string;
}>;

const evidenceKinds = (...kinds: StagingGateHEvidenceKind[]): readonly StagingGateHEvidenceKind[] =>
  Object.freeze(kinds);

const controlPolicies = new Map<StagingGateHControlId, ControlPolicy>([
  [
    "protected_staging_configuration",
    Object.freeze({
      maximumAgeHours: 168,
      requiredEvidenceKinds: evidenceKinds("standing_staging_attestation"),
      title: "Protected staging configuration",
    }),
  ],
  [
    "invite_ingress",
    Object.freeze({
      maximumAgeHours: 168,
      requiredEvidenceKinds: evidenceKinds("owner_approved_record", "staging_drill"),
      title: "Invite and protected ingress",
    }),
  ],
  [
    "aggregate_monitoring_alerting",
    Object.freeze({
      maximumAgeHours: 1,
      requiredEvidenceKinds: evidenceKinds("staging_operational_aggregate"),
      title: "Aggregate monitoring and alerting",
    }),
  ],
  [
    "provider_backup_pitr_restore",
    Object.freeze({
      maximumAgeHours: 2_160,
      requiredEvidenceKinds: evidenceKinds("provider_restore_attestation"),
      title: "Provider backup, PITR, and isolated restore",
    }),
  ],
  [
    "kill_switch_outage_rollback",
    Object.freeze({
      maximumAgeHours: 720,
      requiredEvidenceKinds: evidenceKinds("staging_drill"),
      title: "Kill switch, provider outage, and rollback",
    }),
  ],
  [
    "independent_security_testing",
    Object.freeze({
      maximumAgeHours: 2_160,
      requiredEvidenceKinds: evidenceKinds("external_security_report"),
      title: "Independent DAST and penetration testing",
    }),
  ],
  [
    "support_refund_admin_audit",
    Object.freeze({
      maximumAgeHours: 168,
      requiredEvidenceKinds: evidenceKinds("staging_drill"),
      title: "Support, refund, admin, and audit workflow",
    }),
  ],
  [
    "rollback",
    Object.freeze({
      maximumAgeHours: 168,
      requiredEvidenceKinds: evidenceKinds("staging_drill"),
      title: "Release rollback and evidence preservation",
    }),
  ],
]);

const evidenceEnvironments = new Map<
  StagingGateHEvidenceKind,
  readonly StagingGateHEvidenceEnvironment[]
>([
  ["external_security_report", Object.freeze(["external"])],
  ["owner_approved_record", Object.freeze(["repository"])],
  ["provider_restore_attestation", Object.freeze(["protected_staging"])],
  ["repository_verification", Object.freeze(["ci", "local"])],
  ["staging_drill", Object.freeze(["protected_staging"])],
  ["staging_operational_aggregate", Object.freeze(["protected_staging"])],
  ["standing_staging_attestation", Object.freeze(["protected_staging"])],
]);

const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const revisionPattern = /^(?:[0-9a-f]{40}|WORKTREE)$/u;
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const approvalReferencePattern = /^(?:D|OWN)-[0-9]{3}$/u;
const evidencePathPattern = /^(?:docs|records)\/[A-Za-z0-9._/-]+\.(?:json|md)$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export class StagingGateHContractError extends Error {
  constructor() {
    super("The staging Gate H evidence contract is invalid.");
    this.name = "StagingGateHContractError";
  }
}

const invalid = (): never => {
  throw new StagingGateHContractError();
};

const ownDataRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  const snapshot = snapshotOwnEnumerableData(value);
  if (snapshot === null) return invalid();
  return Object.freeze(Object.fromEntries(snapshot));
};

const exact = (value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> => {
  const record = ownDataRecord(value);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    return invalid();
  }
  return record;
};

const parseInstant = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !utcInstantPattern.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return invalid();
  }
  return value;
};

const safeEvidencePath = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !evidencePathPattern.test(value) ||
    value.includes("//") ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    return invalid();
  }
  return value;
};

const parseControlId = (value: unknown): StagingGateHControlId => {
  if (
    value !== "protected_staging_configuration" &&
    value !== "invite_ingress" &&
    value !== "aggregate_monitoring_alerting" &&
    value !== "provider_backup_pitr_restore" &&
    value !== "kill_switch_outage_rollback" &&
    value !== "independent_security_testing" &&
    value !== "support_refund_admin_audit" &&
    value !== "rollback"
  ) {
    return invalid();
  }
  return value;
};

const parseEvidence = (
  value: unknown,
  capturedAt: string,
  candidateRevision: string,
): StagingGateHEvidenceReference => {
  const evidence = exact(value, [
    "approvalReference",
    "digest",
    "environment",
    "kind",
    "observedAt",
    "outcome",
    "path",
    "revision",
  ]);
  const kind = evidence.kind;
  if (
    kind !== "external_security_report" &&
    kind !== "owner_approved_record" &&
    kind !== "provider_restore_attestation" &&
    kind !== "repository_verification" &&
    kind !== "staging_drill" &&
    kind !== "staging_operational_aggregate" &&
    kind !== "standing_staging_attestation"
  ) {
    return invalid();
  }
  const environment = evidence.environment;
  if (
    environment !== "ci" &&
    environment !== "external" &&
    environment !== "local" &&
    environment !== "protected_staging" &&
    environment !== "repository"
  ) {
    return invalid();
  }
  if (!evidenceEnvironments.get(kind)?.includes(environment)) return invalid();
  const observedAt = parseInstant(evidence.observedAt);
  if (Date.parse(observedAt) > Date.parse(capturedAt)) return invalid();
  if (evidence.outcome !== "failed" && evidence.outcome !== "passed") return invalid();
  if (typeof evidence.digest !== "string" || !digestPattern.test(evidence.digest)) return invalid();
  const approvalReference = evidence.approvalReference;
  if (
    approvalReference !== null &&
    (typeof approvalReference !== "string" || !approvalReferencePattern.test(approvalReference))
  ) {
    return invalid();
  }
  if (kind === "owner_approved_record" && approvalReference === null) return invalid();
  const revision = evidence.revision;
  if (kind === "owner_approved_record") {
    if (revision !== null) return invalid();
  } else {
    if (typeof revision !== "string" || !revisionPattern.test(revision)) return invalid();
    if (revision !== candidateRevision) return invalid();
    if (
      [
        "external_security_report",
        "provider_restore_attestation",
        "staging_drill",
        "staging_operational_aggregate",
        "standing_staging_attestation",
      ].includes(kind) &&
      !exactRevisionPattern.test(revision)
    ) {
      return invalid();
    }
  }
  return Object.freeze({
    approvalReference,
    digest: evidence.digest,
    environment,
    kind,
    observedAt,
    outcome: evidence.outcome,
    path: safeEvidencePath(evidence.path),
    revision,
  });
};

export const parseStagingGateHEvidenceSnapshot = (value: unknown): StagingGateHEvidenceSnapshot => {
  const snapshot = exact(value, ["candidate", "capturedAt", "controls", "schemaVersion"]);
  if (snapshot.schemaVersion !== stagingGateHEvidenceSchemaVersion) return invalid();
  const capturedAt = parseInstant(snapshot.capturedAt);
  const candidate = exact(snapshot.candidate, [
    "artifactDigest",
    "configurationDigest",
    "correspondingSourceDigest",
    "invitePolicy",
    "lockfileDigest",
    "nodeVersion",
    "policyReference",
    "pnpmVersion",
    "profile",
    "revision",
    "stagingProfile",
    "worktreeState",
  ]);
  if (
    typeof candidate.artifactDigest !== "string" ||
    !digestPattern.test(candidate.artifactDigest) ||
    typeof candidate.configurationDigest !== "string" ||
    !digestPattern.test(candidate.configurationDigest) ||
    typeof candidate.correspondingSourceDigest !== "string" ||
    !digestPattern.test(candidate.correspondingSourceDigest) ||
    typeof candidate.lockfileDigest !== "string" ||
    !digestPattern.test(candidate.lockfileDigest) ||
    candidate.nodeVersion !== "26.5.1" ||
    candidate.policyReference !== "own-019.protected-beta-abuse.v1" ||
    candidate.pnpmVersion !== "11.13.1" ||
    candidate.profile !== "protected_english_anonymous_free_beta" ||
    typeof candidate.revision !== "string" ||
    !revisionPattern.test(candidate.revision) ||
    (candidate.worktreeState !== "clean" && candidate.worktreeState !== "dirty")
  ) {
    return invalid();
  }
  const invitePolicy = exact(candidate.invitePolicy, [
    "adultOnly",
    "automaticRetryAfterRateLimit",
    "globalSessionLimit",
    "globalSessionWindowSeconds",
    "intakeLimit",
    "intakeWindowSeconds",
    "locale",
    "maximumInvitedAdults",
    "mutationLimit",
    "mutationWindowSeconds",
    "persistentNetworkOrDeviceIdentifiers",
    "publicSignup",
    "singleUseRevocableExpiringInvites",
  ]);
  if (
    invitePolicy.adultOnly !== true ||
    invitePolicy.automaticRetryAfterRateLimit !== false ||
    invitePolicy.globalSessionLimit !== 30 ||
    invitePolicy.globalSessionWindowSeconds !== 60 ||
    invitePolicy.intakeLimit !== 12 ||
    invitePolicy.intakeWindowSeconds !== 60 ||
    invitePolicy.locale !== "en" ||
    invitePolicy.maximumInvitedAdults !== 25 ||
    invitePolicy.mutationLimit !== 120 ||
    invitePolicy.mutationWindowSeconds !== 86_400 ||
    invitePolicy.persistentNetworkOrDeviceIdentifiers !== false ||
    invitePolicy.publicSignup !== false ||
    invitePolicy.singleUseRevocableExpiringInvites !== true
  ) {
    return invalid();
  }
  const stagingProfile = exact(candidate.stagingProfile, [
    "access",
    "appEnvironment",
    "data",
    "indexing",
    "liveProviders",
    "resources",
  ]);
  if (
    stagingProfile.access !== "team_allowlist" ||
    stagingProfile.appEnvironment !== "staging" ||
    stagingProfile.data !== "synthetic_or_dedicated_test_accounts" ||
    stagingProfile.indexing !== "noindex_disallow_no_sitemap" ||
    stagingProfile.liveProviders !== "disabled" ||
    stagingProfile.resources !== "isolated_non_production"
  ) {
    return invalid();
  }
  if (
    !Array.isArray(snapshot.controls) ||
    snapshot.controls.length !== stagingGateHControlIds.length
  ) {
    return invalid();
  }
  const controls = snapshot.controls.map((value) => {
    const control = exact(value, ["evidence", "id"]);
    const id = parseControlId(control.id);
    if (!Array.isArray(control.evidence) || control.evidence.length > 8) {
      return invalid();
    }
    const evidence = control.evidence.map((item) =>
      parseEvidence(item, capturedAt, candidate.revision as string),
    );
    if (new Set(evidence.map(({ kind }) => kind)).size !== evidence.length) return invalid();
    return Object.freeze({ evidence: Object.freeze(evidence), id });
  });
  if (controls.map(({ id }) => id).join("|") !== stagingGateHControlIds.join("|")) {
    return invalid();
  }
  return Object.freeze({
    candidate: Object.freeze({
      artifactDigest: candidate.artifactDigest,
      configurationDigest: candidate.configurationDigest,
      correspondingSourceDigest: candidate.correspondingSourceDigest,
      invitePolicy: Object.freeze(invitePolicy),
      lockfileDigest: candidate.lockfileDigest,
      nodeVersion: candidate.nodeVersion,
      policyReference: candidate.policyReference,
      pnpmVersion: candidate.pnpmVersion,
      profile: candidate.profile,
      revision: candidate.revision,
      stagingProfile: Object.freeze(stagingProfile),
      worktreeState: candidate.worktreeState,
    }) as StagingGateHEvidenceSnapshot["candidate"],
    capturedAt,
    controls: Object.freeze(controls),
    schemaVersion: stagingGateHEvidenceSchemaVersion,
  });
};

const parseVerifiedDigests = (
  value: unknown,
  evidence: readonly StagingGateHEvidenceReference[],
): Readonly<Record<string, string>> => {
  const record = ownDataRecord(value);
  const paths = new Set(evidence.map(({ path }) => path));
  if (Object.keys(record).length !== paths.size) return invalid();
  for (const item of evidence) {
    if (
      !Object.entries(record).some(([path, digest]) => path === item.path && digest === item.digest)
    ) {
      return invalid();
    }
  }
  return Object.freeze(
    Object.fromEntries(Object.entries(record).map(([path, digest]) => [path, String(digest)])),
  );
};

const evidenceIsCurrent = (
  evidence: StagingGateHEvidenceReference,
  asOf: string,
  maximumAgeHours: number,
): boolean =>
  evidence.kind === "owner_approved_record" ||
  Date.parse(asOf) - Date.parse(evidence.observedAt) <= maximumAgeHours * 60 * 60 * 1_000;

export const projectStagingGateHReport = (
  value: unknown,
  context: Readonly<{
    asOf: string;
    inputDigest: string;
    verifiedEvidenceDigests: Readonly<Record<string, string>>;
  }>,
): StagingGateHReport => {
  const snapshot = parseStagingGateHEvidenceSnapshot(value);
  const generatedAt = parseInstant(context.asOf);
  if (Date.parse(snapshot.capturedAt) > Date.parse(generatedAt)) return invalid();
  if (!digestPattern.test(context.inputDigest)) return invalid();
  const allEvidence = snapshot.controls.flatMap(({ evidence }) => evidence);
  parseVerifiedDigests(context.verifiedEvidenceDigests, allEvidence);
  const controls = snapshot.controls.map((control) => {
    const policy = controlPolicies.get(control.id) ?? invalid();
    const byKind = new Map(control.evidence.map((item) => [item.kind, item]));
    const unmetEvidenceKinds = policy.requiredEvidenceKinds.filter((kind) => {
      const item = byKind.get(kind);
      return (
        item === undefined ||
        item.outcome !== "passed" ||
        !evidenceIsCurrent(item, generatedAt, policy.maximumAgeHours)
      );
    });
    const failed = policy.requiredEvidenceKinds.some(
      (kind) => byKind.get(kind)?.outcome === "failed",
    );
    return Object.freeze({
      evidence: control.evidence,
      id: control.id,
      maximumAgeHours: policy.maximumAgeHours,
      requiredEvidenceKinds: policy.requiredEvidenceKinds,
      state: failed
        ? ("failed" as const)
        : unmetEvidenceKinds.length === 0
          ? ("passed" as const)
          : ("blocked" as const),
      title: policy.title,
      unmetEvidenceKinds: Object.freeze(unmetEvidenceKinds),
    });
  });
  const failed = controls.some(({ state }) => state === "failed");
  const evidenceReady =
    exactRevisionPattern.test(snapshot.candidate.revision) &&
    snapshot.candidate.worktreeState === "clean" &&
    controls.every(({ state }) => state === "passed");
  return Object.freeze({
    authorizationStatus: "owner_gate_required",
    candidate: snapshot.candidate,
    caveats: Object.freeze([
      "Repository, local, and CI verification cannot establish protected staging or external provider state.",
      "Missing, stale, future, failed, or digest-mismatched evidence never becomes healthy or complete.",
      "Evidence readiness cannot deploy, change DNS, activate a provider, mutate production data, or approve launch.",
    ]),
    controls: Object.freeze(controls),
    decisionStatus: failed ? "failed" : evidenceReady ? "evidence_ready" : "blocked",
    deploymentAuthorized: false,
    gateHState: evidenceReady ? "evidence_ready_for_owner_review" : "incomplete",
    generatedAt,
    inputDigest: context.inputDigest,
    schemaVersion: stagingGateHReportSchemaVersion,
  });
};

export const renderStagingGateHMarkdown = (report: StagingGateHReport): string => {
  const lines = [
    "# RITUVIA Staging and Gate H Evidence",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Candidate revision: ${report.candidate.revision}`,
    `- Candidate worktree: ${report.candidate.worktreeState}`,
    `- Toolchain: Node.js ${report.candidate.nodeVersion}; pnpm ${report.candidate.pnpmVersion}`,
    `- Artifact digest: ${report.candidate.artifactDigest}`,
    `- Configuration digest: ${report.candidate.configurationDigest}`,
    `- Lockfile digest: ${report.candidate.lockfileDigest}`,
    `- Corresponding Source digest: ${report.candidate.correspondingSourceDigest}`,
    `- Decision status: ${report.decisionStatus}`,
    `- Gate H state: ${report.gateHState}`,
    `- Deployment authorization: ${report.authorizationStatus}`,
    `- Deployment authorized: ${String(report.deploymentAuthorized)}`,
    `- Input digest: ${report.inputDigest}`,
    "",
    "## Controls",
    "",
  ];
  for (const control of report.controls) {
    lines.push(
      `### ${control.title}`,
      "",
      `- Control ID: ${control.id}`,
      `- State: ${control.state}`,
      `- Maximum evidence age: ${control.maximumAgeHours} hours`,
      `- Required evidence: ${control.requiredEvidenceKinds.join(", ")}`,
      `- Unmet evidence: ${control.unmetEvidenceKinds.join(", ") || "none"}`,
      "- Evidence:",
    );
    if (control.evidence.length === 0) {
      lines.push("  - unavailable");
    } else {
      for (const evidence of control.evidence) {
        lines.push(
          `  - ${evidence.kind}: ${evidence.outcome}; ${evidence.environment}; ${evidence.path}; ${evidence.digest}; observed ${evidence.observedAt}; approval ${evidence.approvalReference ?? "none"}`,
        );
      }
    }
    lines.push("");
  }
  lines.push("## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");
  return `${lines.join("\n")}\n`;
};
