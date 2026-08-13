# RIT-129 Provider-Free Staging and Gate H Evidence

## 1. Purpose and current truth

RIT-129 defines one strict, provider-neutral evidence contract for protected staging and Gate H.
It verifies evidence metadata and file digests locally; it does not create staging, choose a host,
install a secret, contact a provider, run DAST, perform a penetration test, restore a managed
database, deploy, change DNS, or approve Beta/production launch.

Passing `pnpm check:staging-gate-h` means the contract and its current missing-evidence projection
work. The current Gate H result is `incomplete`, not passed. A future complete evidence package can
reach only `evidence_ready_for_owner_review`; deployment authorization remains false until the
separate Owner gate is recorded.

## 2. Button and entry point

There is no RITUVIA Web/Admin Button and no HTTP route for this engineering evidence tool.

Run the provider-free contract check from the repository:

```bash
pnpm check:staging-gate-h
```

To evaluate a reviewed manifest and create private reports:

```bash
pnpm report:staging-gate-h -- \
  --as-of 2026-08-02T12:00:00.000Z \
  --input /absolute/private/path/staging-gate-h-input.json \
  --output-json /absolute/private/path/staging-gate-h-report.json \
  --output-markdown /absolute/private/path/staging-gate-h-report.md
```

The output files are new mode-`0600` files and are never overwritten. Open the Markdown output in
the Codex right sidebar. Keep unredacted external reports outside the repository; reference only a
reviewed, bounded, non-secret evidence file and its SHA-256.

## 3. Candidate binding

The manifest fixes all of the following as one release-candidate identity:

- exact 40-character Git revision, or `WORKTREE` for local contract verification only;
- clean/dirty worktree state;
- Node.js `26.5.1` and pnpm `11.13.1`;
- application artifact, configuration, lockfile, and Corresponding Source SHA-256 values;
- candidate `protected_english_anonymous_free_beta`;
- D-104 policy `own-019.protected-beta-abuse.v1`;
- isolated `APP_ENV=staging`, team allowlist, synthetic/dedicated test accounts, noindex/full robots
  deny/no sitemap, no live providers, and non-production resources.

`WORKTREE`, a dirty candidate, a toolchain mismatch, a policy/profile drift, or a malformed digest
can never reach evidence-ready state.

## 4. Fixed invite and abuse profile

The contract accepts only the exact D-104 values:

- maximum 25 invited adults; English only;
- single-use, revocable, expiring invitations; no public signup;
- at most 30 new anonymous sessions per 60 seconds across the deployment;
- at most 12 intake checks per session per 60 seconds;
- at most 120 protected mutations per session per 86,400 seconds;
- no automatic retry after `429`;
- no persistent IP, User-Agent, device identifier, or fingerprint.

Any changed value rejects the complete input rather than producing a weaker report.

## 5. Eight evidence controls

| Control | Required evidence | Maximum age | Current truth |
| --- | --- | ---: | --- |
| Protected staging configuration | standing-staging attestation | 168 hours | unavailable |
| Invite and protected ingress | D-104 Owner record plus staging drill | 168 hours | Owner record only |
| Aggregate monitoring and alerting | staging operational aggregate | 1 hour | local SLO evaluator only |
| Provider backup/PITR/restore | provider restore attestation | 2,160 hours | local logical restore only |
| Kill switch/provider outage | staging drill | 720 hours | local Game Day only |
| Independent security testing | external security report | 2,160 hours | threat model only; no DAST/pentest |
| Support/refund/admin/audit | staging drill | 168 hours | local metadata kernel only |
| Release rollback/evidence preservation | staging drill | 168 hours | documented local procedure only |

Repository/local/CI evidence can be attached as context, but it cannot satisfy a required
protected-staging, provider-restore, operational-aggregate, or external-security evidence kind.

## 6. Evidence envelope

Each bounded evidence reference contains only:

- fixed evidence kind and source environment;
- `passed` or `failed` outcome;
- UTC observation time;
- repository-relative `docs/` or `records/` JSON/Markdown path;
- SHA-256 digest;
- candidate revision, except an Owner decision record uses `null`;
- optional `D-###` or `OWN-###` approval reference.

Unknown fields, private text, URLs, credentials, arbitrary labels, duplicate evidence kinds,
unsafe paths, symbolic links, files over 5 MiB, digest mismatch, future evidence, and malformed
timestamps are rejected. The generator also rejects an input over 1 MiB and refuses existing
output paths.

## 7. Derived state

The caller cannot submit a Gate H completion flag. The projector derives:

- `failed` when required current evidence reports failure;
- `blocked` and `incomplete` when evidence is missing, stale, local-only, dirty, or unbound;
- `evidence_ready` and `evidence_ready_for_owner_review` only when every fixed control passes for
  one clean immutable revision with verified evidence digests.

Every report always has `authorizationStatus=owner_gate_required` and
`deploymentAuthorized=false`. It cannot satisfy Gate I/J, RIT-127, RIT-130, provider activation,
deployment, DNS, or launch.

## 8. Operating workflow

1. Build one clean immutable candidate under the pinned toolchain.
2. Record only redacted, bounded evidence files; keep credentials and raw external reports outside
   the repository.
3. Bind every file digest and candidate revision in the manifest.
4. Run `pnpm report:staging-gate-h` with new private output paths.
5. Stop on any invalid input, missing digest, failed/stale control, or `incomplete` result.
6. Review the Markdown blockers and remediate the named environment/control; never edit the result.
7. Rerun with a new input/output pair. Preserve prior evidence according to the incident/change
   record.
8. If the result becomes `evidence_ready_for_owner_review`, submit it for explicit Owner review;
   do not deploy or activate anything from the report.

## 9. Failure and recovery

- **Digest/path/symlink failure:** obtain a new reviewed redacted artifact and recompute its digest.
- **Revision/config drift:** rebuild and retest one exact candidate; do not combine evidence from
  multiple revisions.
- **Missing/stale monitoring:** restore the approved aggregate source and real alert-delivery path;
  missing remains unknown, never healthy.
- **Restore failure:** keep release blocked, preserve provider audit evidence, and repeat against a
  new isolated target after remediation.
- **Critical/High external finding:** stop the candidate, remediate, and attach independent retest
  evidence. A suppression cannot convert Critical/High to passed.
- **Invite/ingress or rollback failure:** stop invitations, revoke admission, apply reviewed
  containment where safe, preserve evidence, and require Owner re-approval before resumption.

## 10. Rollback

Repository rollback removes the staging evidence module/export, generator/verifier, package
commands, tests, this runbook, task/decision/report records, and their status references. Generated
private reports are not repository state and must follow their approved evidence retention. No
provider, staging, production, customer, payment, DNS, or deployment state requires reversal.
