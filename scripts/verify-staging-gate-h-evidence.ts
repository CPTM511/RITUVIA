import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  projectStagingGateHReport,
  renderStagingGateHMarkdown,
  stagingGateHControlIds,
  stagingGateHEvidenceSchemaVersion,
  type StagingGateHControlId,
  type StagingGateHEvidenceKind,
} from "../packages/observability/src/index.js";

const capturedAt = "2026-08-02T12:00:00.000Z";

const evidenceSources = new Map<
  StagingGateHControlId,
  Readonly<{
    approvalReference: string | null;
    kind: StagingGateHEvidenceKind;
    path: string;
  }>
>([
  [
    "protected_staging_configuration",
    {
      approvalReference: null,
      kind: "repository_verification",
      path: "docs/21_ENVIRONMENT_CONTRACT.md",
    },
  ],
  [
    "invite_ingress",
    {
      approvalReference: "D-104",
      kind: "owner_approved_record",
      path: "records/decisions/D-104.md",
    },
  ],
  [
    "aggregate_monitoring_alerting",
    {
      approvalReference: "D-101",
      kind: "repository_verification",
      path: "docs/runbooks/RIT-124_BETA_OPERATIONS.md",
    },
  ],
  [
    "provider_backup_pitr_restore",
    {
      approvalReference: null,
      kind: "repository_verification",
      path: "docs/22_BACKUP_RECOVERY.md",
    },
  ],
  [
    "kill_switch_outage_rollback",
    {
      approvalReference: null,
      kind: "repository_verification",
      path: "docs/runbooks/RIT-128_INCIDENT_GAME_DAY.md",
    },
  ],
  [
    "independent_security_testing",
    {
      approvalReference: null,
      kind: "repository_verification",
      path: "docs/reports/RITUVIA_RIT_121_PROTECTED_BETA_THREAT_MODEL_2026-08-01.md",
    },
  ],
  [
    "support_refund_admin_audit",
    {
      approvalReference: "D-102",
      kind: "repository_verification",
      path: "docs/runbooks/RIT-125_CASE_OPERATIONS.md",
    },
  ],
  [
    "rollback",
    {
      approvalReference: "D-104",
      kind: "repository_verification",
      path: "docs/15_LAUNCH_RUNBOOK.md",
    },
  ],
]);

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const verifiedEvidenceDigests: Record<string, string> = {};
const controls = [];
for (const id of stagingGateHControlIds) {
  const source = evidenceSources.get(id);
  assert.ok(source);
  const bytes = await readFile(source.path);
  const sourceDigest = digest(bytes);
  verifiedEvidenceDigests[source.path] = sourceDigest;
  controls.push({
    evidence: [
      {
        approvalReference: source.approvalReference,
        digest: sourceDigest,
        environment: source.kind === "owner_approved_record" ? "repository" : "local",
        kind: source.kind,
        observedAt: capturedAt,
        outcome: "passed",
        path: source.path,
        revision: source.kind === "owner_approved_record" ? null : "WORKTREE",
      },
    ],
    id,
  });
}

const snapshot = {
  candidate: {
    artifactDigest: digest(Buffer.from("provider-free-local-artifact")),
    configurationDigest: digest(await readFile("docs/21_ENVIRONMENT_CONTRACT.md")),
    correspondingSourceDigest: digest(await readFile("checksums.sha256")),
    invitePolicy: {
      adultOnly: true,
      automaticRetryAfterRateLimit: false,
      globalSessionLimit: 30,
      globalSessionWindowSeconds: 60,
      intakeLimit: 12,
      intakeWindowSeconds: 60,
      locale: "en",
      maximumInvitedAdults: 25,
      mutationLimit: 120,
      mutationWindowSeconds: 86_400,
      persistentNetworkOrDeviceIdentifiers: false,
      publicSignup: false,
      singleUseRevocableExpiringInvites: true,
    },
    lockfileDigest: digest(await readFile("pnpm-lock.yaml")),
    nodeVersion: "26.5.1",
    policyReference: "own-019.protected-beta-abuse.v1",
    pnpmVersion: "11.13.1",
    profile: "protected_english_anonymous_free_beta",
    revision: "WORKTREE",
    stagingProfile: {
      access: "team_allowlist",
      appEnvironment: "staging",
      data: "synthetic_or_dedicated_test_accounts",
      indexing: "noindex_disallow_no_sitemap",
      liveProviders: "disabled",
      resources: "isolated_non_production",
    },
    worktreeState: "dirty",
  },
  capturedAt,
  controls,
  schemaVersion: stagingGateHEvidenceSchemaVersion,
};
const report = projectStagingGateHReport(snapshot, {
  asOf: capturedAt,
  inputDigest: digest(Buffer.from(JSON.stringify(snapshot))),
  verifiedEvidenceDigests,
});

assert.equal(report.decisionStatus, "blocked");
assert.equal(report.gateHState, "incomplete");
assert.equal(report.deploymentAuthorized, false);
assert.ok(report.controls.every(({ state }) => state === "blocked"));
assert.deepEqual(
  report.controls.map(({ id, unmetEvidenceKinds }) => [id, unmetEvidenceKinds]),
  [
    ["protected_staging_configuration", ["standing_staging_attestation"]],
    ["invite_ingress", ["staging_drill"]],
    ["aggregate_monitoring_alerting", ["staging_operational_aggregate"]],
    ["provider_backup_pitr_restore", ["provider_restore_attestation"]],
    ["kill_switch_outage_rollback", ["staging_drill"]],
    ["independent_security_testing", ["external_security_report"]],
    ["support_refund_admin_audit", ["staging_drill"]],
    ["rollback", ["staging_drill"]],
  ],
);
const markdown = renderStagingGateHMarkdown(report);
assert.match(markdown, /Gate H state: incomplete/u);
assert.match(markdown, /Deployment authorized: false/u);

process.stdout.write(
  "Verified eight provider-free staging controls, digest binding, missing-evidence truth, and Owner-gated Gate H state.\n",
);
