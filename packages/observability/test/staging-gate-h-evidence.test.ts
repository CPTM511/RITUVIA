import { describe, expect, it } from "vitest";

import {
  parseStagingGateHEvidenceSnapshot,
  projectStagingGateHReport,
  renderStagingGateHMarkdown,
  stagingGateHControlIds,
  stagingGateHEvidenceSchemaVersion,
  StagingGateHContractError,
  type StagingGateHControlId,
  type StagingGateHEvidenceEnvironment,
  type StagingGateHEvidenceKind,
} from "../src/index.js";

const revision = "a".repeat(40);
const capturedAt = "2026-08-02T12:00:00.000Z";
const digest = (seed: number): string => `sha256:${seed.toString(16).padStart(64, "0")}`;

const environmentFor = (kind: StagingGateHEvidenceKind): StagingGateHEvidenceEnvironment => {
  if (kind === "owner_approved_record") return "repository";
  if (kind === "repository_verification") return "local";
  if (kind === "external_security_report") return "external";
  return "protected_staging";
};

const requirements = new Map<StagingGateHControlId, readonly StagingGateHEvidenceKind[]>([
  ["protected_staging_configuration", ["standing_staging_attestation"]],
  ["invite_ingress", ["owner_approved_record", "staging_drill"]],
  ["aggregate_monitoring_alerting", ["staging_operational_aggregate"]],
  ["provider_backup_pitr_restore", ["provider_restore_attestation"]],
  ["kill_switch_outage_rollback", ["staging_drill"]],
  ["independent_security_testing", ["external_security_report"]],
  ["support_refund_admin_audit", ["staging_drill"]],
  ["rollback", ["staging_drill"]],
]);

const completeSnapshot = () => {
  let evidenceIndex = 1;
  return {
    candidate: {
      artifactDigest: digest(90),
      configurationDigest: digest(91),
      correspondingSourceDigest: digest(92),
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
      lockfileDigest: digest(93),
      nodeVersion: "26.5.1",
      policyReference: "own-019.protected-beta-abuse.v1",
      pnpmVersion: "11.13.1",
      profile: "protected_english_anonymous_free_beta",
      revision,
      stagingProfile: {
        access: "team_allowlist",
        appEnvironment: "staging",
        data: "synthetic_or_dedicated_test_accounts",
        indexing: "noindex_disallow_no_sitemap",
        liveProviders: "disabled",
        resources: "isolated_non_production",
      },
      worktreeState: "clean",
    },
    capturedAt,
    controls: stagingGateHControlIds.map((id) => ({
      evidence: (requirements.get(id) ?? []).map((kind) => {
        const index = evidenceIndex;
        evidenceIndex += 1;
        return {
          approvalReference: kind === "owner_approved_record" ? "D-104" : null,
          digest: digest(index),
          environment: environmentFor(kind),
          kind,
          observedAt: capturedAt,
          outcome: "passed",
          path: `docs/reports/gate-h-${index}.md`,
          revision: kind === "owner_approved_record" ? null : revision,
        };
      }),
      id,
    })),
    schemaVersion: stagingGateHEvidenceSchemaVersion,
  };
};

const verifiedDigests = (snapshot: ReturnType<typeof completeSnapshot>): Record<string, string> =>
  Object.fromEntries(
    snapshot.controls.flatMap(({ evidence }) => evidence.map((item) => [item.path, item.digest])),
  );

const context = (snapshot: ReturnType<typeof completeSnapshot>, asOf = capturedAt) => ({
  asOf,
  inputDigest: digest(99),
  verifiedEvidenceDigests: verifiedDigests(snapshot),
});

describe("staging Gate H evidence contract", () => {
  it("requires all eight current external or protected-staging controls", () => {
    const snapshot = completeSnapshot();
    const report = projectStagingGateHReport(snapshot, context(snapshot));

    expect(report.controls.map(({ id }) => id)).toEqual(stagingGateHControlIds);
    expect(report.controls.every(({ state }) => state === "passed")).toBe(true);
    expect(report.decisionStatus).toBe("evidence_ready");
    expect(report.gateHState).toBe("evidence_ready_for_owner_review");
    expect(report.authorizationStatus).toBe("owner_gate_required");
    expect(report.deploymentAuthorized).toBe(false);

    snapshot.candidate.worktreeState = "dirty";
    const dirty = projectStagingGateHReport(snapshot, context(snapshot));
    expect(dirty.controls.every(({ state }) => state === "passed")).toBe(true);
    expect(dirty.gateHState).toBe("incomplete");
    expect(dirty.decisionStatus).toBe("blocked");
  });

  it("keeps local WORKTREE evidence incomplete", () => {
    const snapshot = completeSnapshot();
    snapshot.candidate.revision = "WORKTREE";
    snapshot.candidate.worktreeState = "dirty";
    snapshot.controls = snapshot.controls.map((control, index) => ({
      evidence:
        index === 0
          ? [
              {
                approvalReference: null,
                digest: digest(50),
                environment: "local",
                kind: "repository_verification",
                observedAt: capturedAt,
                outcome: "passed",
                path: "docs/21_ENVIRONMENT_CONTRACT.md",
                revision: "WORKTREE",
              },
            ]
          : [],
      id: control.id,
    }));
    const report = projectStagingGateHReport(snapshot, context(snapshot));

    expect(report.gateHState).toBe("incomplete");
    expect(report.decisionStatus).toBe("blocked");
    expect(report.controls.every(({ state }) => state === "blocked")).toBe(true);
  });

  it("treats stale required evidence as blocked and explicit failure as failed", () => {
    const staleSnapshot = completeSnapshot();
    const stale = projectStagingGateHReport(
      staleSnapshot,
      context(staleSnapshot, "2026-08-02T14:00:00.001Z"),
    );
    expect(stale.controls.find(({ id }) => id === "aggregate_monitoring_alerting")).toMatchObject({
      state: "blocked",
      unmetEvidenceKinds: ["staging_operational_aggregate"],
    });

    const failedSnapshot = completeSnapshot();
    failedSnapshot.controls[3]!.evidence[0]!.outcome = "failed";
    const failed = projectStagingGateHReport(failedSnapshot, context(failedSnapshot));
    expect(failed.decisionStatus).toBe("failed");
    expect(failed.gateHState).toBe("incomplete");
  });

  it("rejects unverified digests, local staging claims, unsafe paths, and extra fields", () => {
    const digestMismatch = completeSnapshot();
    expect(() =>
      projectStagingGateHReport(digestMismatch, {
        ...context(digestMismatch),
        verifiedEvidenceDigests: {},
      }),
    ).toThrow(StagingGateHContractError);

    const localClaim = completeSnapshot();
    localClaim.controls[0]!.evidence[0]!.environment = "local";
    expect(() => parseStagingGateHEvidenceSnapshot(localClaim)).toThrow(StagingGateHContractError);

    const unsafePath = completeSnapshot();
    unsafePath.controls[0]!.evidence[0]!.path = "docs/../private.json";
    expect(() => parseStagingGateHEvidenceSnapshot(unsafePath)).toThrow(StagingGateHContractError);

    expect(() =>
      parseStagingGateHEvidenceSnapshot({ ...completeSnapshot(), rawPrompt: "PRIVATE-CANARY" }),
    ).toThrow(StagingGateHContractError);

    const thresholdDrift = completeSnapshot();
    thresholdDrift.candidate.invitePolicy.maximumInvitedAdults = 26;
    expect(() => parseStagingGateHEvidenceSnapshot(thresholdDrift)).toThrow(
      StagingGateHContractError,
    );
  });

  it("does not invoke getters or render untrusted private fields", () => {
    const snapshot = completeSnapshot();
    let getterCalls = 0;
    Object.defineProperty(snapshot.controls[0]!.evidence[0]!, "outcome", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "passed";
      },
    });
    expect(() => parseStagingGateHEvidenceSnapshot(snapshot)).toThrow(StagingGateHContractError);
    expect(getterCalls).toBe(0);

    const safeSnapshot = completeSnapshot();
    const markdown = renderStagingGateHMarkdown(
      projectStagingGateHReport(safeSnapshot, context(safeSnapshot)),
    );
    expect(markdown).toContain("Gate H state: evidence_ready_for_owner_review");
    expect(markdown).not.toContain("PRIVATE-CANARY");
  });
});
