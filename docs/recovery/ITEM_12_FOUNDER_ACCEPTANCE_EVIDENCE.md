# Recovery Item 12 — Founder Acceptance, Security, Restore, and Source-Disclosure Evidence

> Date: 2026-08-10
>
> Result: **BLOCKED — NO-GO**

## Scope and Owner decision

The Owner explicitly approved Item 12 and amended D-098 so FJ-15 is not executed in this recovery.
Non-custodial crypto payment remains a future separately gated option. The in-scope Founder
journeys are FJ-00-FJ-14 and FJ-16-FJ-20. Production, DNS, public release, real funds/assets, live
Stripe, real crypto, production AI with private content, legal activation, unrestricted service,
and irreversible migration remain prohibited.

Item 12 is a factual gate, not a repair item. Its STOP condition requires the run to stop on any
mandatory workspace, journey, security, restore, rollback, source/license, Owner-gate, or staging
failure. No unrelated or discovered defect is repaired under this approval.

## Before-state evidence

The before-state was captured before Item 12 edits in a permission-`600` manifest outside Git.

| Field | Exact evidence |
| --- | --- |
| Recovery HEAD | `52cb6880c7de1037d46ed2787a8bc5974c756e12` |
| Recovery tree | `ea46c3008550c8c47592c1fe554b2bfcebe01c52` |
| Baseline | `f79fee6713670fdc12b33dd3182569a942782636`; verified ancestor |
| Archived snapshot commit | `582f76f9b27afb266a6bd5d550347bbf404a48e2`; verified not an ancestor |
| Original worktree | HEAD `6c0698b88dffce3535bac1e9f1cd9d6b3528062c`; 243 staged; 0 unstaged |
| Before-state manifest | `/private/tmp/rituvia-item12-before/MANIFEST.md` |
| Before-state SHA-256 | `c9672676a2f1c2c54cc6cfa16f37bad43c3f3b8c715193e183b531123a3139c6` |

The original worktree, archive ref, archival commit, bundle, patches, migrations, records, and
payment history were not modified or deleted.

## Protected Staging boundary

The last accepted application deployment remains Item 11 source
`5ffe98ef735d4031933873d4e443c8b74a34c677`, deployment
`dpl_GPxxRoDU6Hc5KFBXZh2Cb48dqJx2`, with stable Owner URL
`https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.

Read-only Vercel CLI `58.9.0` evidence reports:

- project `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`, root `apps/web`, Node `24.x`;
- deployment state `READY`, target `staging`, and only `.vercel.app` aliases for this project;
- SSO protection `prod_deployment_urls_and_all_previews`, Git-fork protection enabled, and one
  sealed automation bypass entry; and
- no Production promotion, DNS, domain, environment-variable, Provider, or resource mutation.

The current terminal network resolves the stable host to the local-network sinkhole
`64.13.192.74` and times out on port `443`. This is recorded as a local network evidence limitation,
not as an application pass or failure. The mandatory architecture failure below independently
triggered STOP before Item 12 browser verification or deployment.

## Automated gate results

All commands used exact Node.js `24.18.0` and pnpm `11.13.1`.

| Gate | Result | Evidence |
| --- | --- | --- |
| Frozen offline install | PASS; all 17 workspace projects already up to date | `/private/tmp/rituvia-item12-gates/install.log`; SHA-256 `fb8e5b50ff60f4c98995016d64200622644ba8dccc9588454f89b04a162b8295` |
| Focused Item 12 unit tests | PASS; 3 files, 14 tests | `recovery-staging`, Item 12 manifest, and runtime-truth guard tests |
| Focused lint and formatting | PASS | Changed TypeScript, TSX, JavaScript, and CSS files |
| Durable records | PASS; 149 records | D-098 and generated record index are consistent |
| Complete workspace command | FAIL at the first architecture boundary | `/private/tmp/rituvia-item12-gates/workspace-check.log`; SHA-256 `438ebba1258ee3255906e7ae8770638d13848dc011f7202649684c5ac92c5ac2` |

Exact architecture findings:

1. `internal-dependency-direction` for `@rituvia/country-policy` at
   `packages/db/scripts/repair-recovery-item-11-country-policy.mjs:3`.
2. `relative-cross-module-import` at the same location.
3. `unresolved-relative-import` for `../../country-policy/dist/index.js` at the same location.

The failing file is unchanged by Item 12. Its current bytes and the bytes at Item 12 before-state
HEAD have the same SHA-256:
`542c34ed47b4af834bbf2195d53857eb6bc047da0eb714820af7d4b312f58db8`. Git history identifies
`6edcd4e246c07123b3959e57690f9be037c17549` as its introducing commit.

## STOP effects

Because the complete workspace gate is mandatory, the run stopped immediately. The following
Item 12 acceptance evidence is therefore **not available** and must not be inferred from prior
items:

- remaining evidence, format, lint, type, unit, integration, AI-eval, and production-build matrix;
- complete desktop/mobile/accessibility Founder journey matrix on an Item 12 source SHA;
- FJ-18/FJ-19 privacy export/deletion revalidation for the Item 12 candidate;
- migration, non-empty backup restore, disaster recovery, and rollback revalidation;
- dependency, vulnerability, license, Corresponding Source, and final source-disclosure closure;
- final protected Staging deployment, manifest checksums, and Owner sign-off; and
- FJ-15, which remains intentionally excluded and was not executed.

No Item 12 source was deployed. The protected URL remains on the accepted Item 11 application
source. No Production, DNS, public, real-value, Coinbase, Stripe, AI-provider, database, or secret
mutation occurred in this gate run.

## Factual recommendation

Recovery Item 12 is **Blocked** and the repository remains **NO-GO**. The smallest next Owner
decision is whether to authorize a new bounded Item 12 remediation run that fixes only the three
architecture findings, captures a new before-state, and then reruns the complete Item 12 gate from
the beginning. That authority must not include FJ-15, Production, DNS, public release, real funds,
live Providers, or automatic follow-on work unless separately stated.

**STOP — ITEM 12 DID NOT PASS; NO PRODUCT DEPLOYMENT OR FJ-15 EXECUTION STARTED.**
