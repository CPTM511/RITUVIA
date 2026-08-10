# Recovery Item 12 — Founder Acceptance, Security, Restore, and Source-Disclosure Evidence

> Date: 2026-08-10; bounded remediation rerun 2026-08-11
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

| Field                    | Exact evidence                                                          |
| ------------------------ | ----------------------------------------------------------------------- |
| Recovery HEAD            | `52cb6880c7de1037d46ed2787a8bc5974c756e12`                              |
| Recovery tree            | `ea46c3008550c8c47592c1fe554b2bfcebe01c52`                              |
| Baseline                 | `f79fee6713670fdc12b33dd3182569a942782636`; verified ancestor           |
| Archived snapshot commit | `582f76f9b27afb266a6bd5d550347bbf404a48e2`; verified not an ancestor    |
| Original worktree        | HEAD `6c0698b88dffce3535bac1e9f1cd9d6b3528062c`; 243 staged; 0 unstaged |
| Before-state manifest    | `/private/tmp/rituvia-item12-before/MANIFEST.md`                        |
| Before-state SHA-256     | `c9672676a2f1c2c54cc6cfa16f37bad43c3f3b8c715193e183b531123a3139c6`      |

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

| Gate                        | Result                                             | Evidence                                                                                                                            |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Frozen offline install      | PASS; all 17 workspace projects already up to date | `/private/tmp/rituvia-item12-gates/install.log`; SHA-256 `fb8e5b50ff60f4c98995016d64200622644ba8dccc9588454f89b04a162b8295`         |
| Focused Item 12 unit tests  | PASS; 3 files, 14 tests                            | `recovery-staging`, Item 12 manifest, and runtime-truth guard tests                                                                 |
| Focused lint and formatting | PASS                                               | Changed TypeScript, TSX, JavaScript, and CSS files                                                                                  |
| Durable records             | PASS; 149 records                                  | D-098 and generated record index are consistent                                                                                     |
| Complete workspace command  | FAIL at the first architecture boundary            | `/private/tmp/rituvia-item12-gates/workspace-check.log`; SHA-256 `438ebba1258ee3255906e7ae8770638d13848dc011f7202649684c5ac92c5ac2` |

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

## Bounded remediation rerun — 2026-08-11

The Owner approved only the three recorded architecture remediations and required Item 12 to restart
from a new before-state. The recovery worktree was restored to exact HEAD after an external
`/private/tmp` cleanup removed 35 tracked worktree files without changing Git history or the index.
The deleted-path list, binary diff, restoration evidence, and checksums are retained in the
permission-`600` preflight manifest. The original worktree remained at 243 staged and 0 unstaged
files throughout.

| Field                           | Exact evidence                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rerun before-state HEAD / tree  | `943556fad3811713b16ecda0bf1e4d5c789deaf8` / `e7c9b530eda4d5d183af8799d634b9fd20d99c10`                                                        |
| Rerun before-state manifest     | `/private/tmp/rituvia-item12-rerun-before/MANIFEST.md`; SHA-256 `281096405c0c61ff87576f0810dae172a0eb7e3a8c8b70822b93391fc959da4b`             |
| Preflight anomaly manifest      | `/private/tmp/rituvia-item12-rerun-before/PREFLIGHT_ANOMALY.md`; SHA-256 `b95d15a8417ecefc424960323e95627f9b03ae7f41b460b042168ae5816a0a3b`    |
| Reproduced architecture failure | `/private/tmp/rituvia-item12-rerun-before/architecture-before.log`; SHA-256 `7703f84da9de48b3287dfc5f8745a0802d49eb9838cffff35457fa1b2d068251` |

The minimal repair removed the DB-to-Country Policy built-output import without adding an
architecture exception, package dependency, migration, runtime path, Provider action, or product
behavior. The one-time repair script now accepts only the exact known invalid policy document and
the exact corrected policy document by canonical SHA-256, preserving its transaction, exact-row
lock, JSONB precondition, and post-update verification. Its source-bound test now asserts those
document digests and rejects the former cross-package parser import.

| Repair evidence                                                   | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/db/scripts/repair-recovery-item-11-country-policy.mjs`  | `d95b95c1f3a3ca66e28d41f48ebe0be5e362de2415039cb504f1d5138f687717` |
| `packages/db/test/recovery-item-11-country-policy-repair.test.ts` | `5bdf4942de1a0b1c9463a93c1b17ce8876597e31e4d0424f35adf651ba5bab65` |

Focused architecture, unit, lint, formatting, and diff checks passed. The exact full-gate rerun used
Node `24.18.0` and pnpm `11.13.1`. An initial attempt selected a drifted Homebrew pnpm entry and
failed before a project gate; the exact pnpm wrapper was restored and the valid attempt restarted
from frozen offline install.

| Rerun gate                                                                                    | Result                                         | Evidence                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Frozen offline install                                                                        | PASS; 17 workspace projects already up to date | `/private/tmp/rituvia-item12-rerun-gates/install-attempt2.log`; SHA-256 `ce798610ee1955081f5e53370450f40a3a80fbf555298777988ebf0dc17fa120` |
| Architecture policy                                                                           | PASS; 610 source files across 16 modules       | Included in the valid full-gate log                                                                                                        |
| Environment, AI operations, localization, editorial, public-page, and search operations gates | PASS through the next policy boundary          | Included in the valid full-gate log                                                                                                        |
| Complete workspace command                                                                    | FAIL at `check:rtl` with one finding           | `/private/tmp/rituvia-item12-rerun-gates/check-attempt2.log`; SHA-256 `734321e5e2b8c700350c10701db633fc725e6a1e9df7e84f9c63924d56a68084`   |

The exact new finding is `physical-directional-css` at
`apps/web/app/(recovery)/recovery/recovery.css:40`. That file is unchanged by this remediation; its
working-tree and HEAD Git blob are both `72b698eeb502c124d27dc08af957eabcae8f9fc3`, its SHA-256 is
`192b1deb38ea2f070aa36fbb6a606dcce1cdb87b7193f83ccbf4c8dea77dcaf4`, and Git blame traces the
finding to pre-rerun commit `6299853f`.

The finding is outside the Owner's authorization to repair exactly three architecture violations.
The Item 12 STOP condition therefore ended the rerun. No remaining workspace, privacy/export,
deletion, restore, rollback, dependency/license, Corresponding Source, browser, staging deployment,
Provider, database, secret, FJ-15, Production, DNS, public, or real-value action was executed.

## Factual recommendation

Recovery Item 12 is **Blocked** and the repository remains **NO-GO**. The smallest next Owner
decision is whether to authorize one bounded remediation of the single recorded RTL finding,
capture another new before-state, and rerun the complete Item 12 gate from the beginning. That
authority must not include FJ-15, Production, DNS, public release, real funds, live Providers, or
automatic follow-on work unless separately stated.

**STOP — ITEM 12 DID NOT PASS; NO PRODUCT DEPLOYMENT OR FJ-15 EXECUTION STARTED.**
