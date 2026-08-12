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

## Bounded RTL remediation rerun — 2026-08-11

The Owner separately approved only the single recorded RTL remediation and required Item 12 to
restart from another new before-state. The before-state was clean at local commit
`e0627d2064ae498d54e806475c3e9c914110e25a`, tree
`397b3f91e26ba68a4c4379198abc37bdde205e67`. The baseline remained an ancestor, the archive commit
remained excluded, and the original worktree remained at 243 staged and 0 unstaged files.

| Field                           | Exact evidence                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| RTL rerun before-state manifest | `/private/tmp/rituvia-item12-rtl-rerun-before/MANIFEST.md`; SHA-256 `4ad166bff26bd296fc33d3e51a514f0c9f7b551d7cef3c95565eccd0d1d70402`    |
| Reproduced RTL failure          | `/private/tmp/rituvia-item12-rtl-rerun-before/rtl-before.log`; SHA-256 `8f4fb88604800b8402ac411a039698177e4b58c242bcc64dfeb83ea6e8c30dd3` |
| Before CSS                      | Git blob `72b698eeb502c124d27dc08af957eabcae8f9fc3`; SHA-256 `192b1deb38ea2f070aa36fbb6a606dcce1cdb87b7193f83ccbf4c8dea77dcaf4`           |
| Corrected CSS                   | SHA-256 `4633a06a8aa6e6542ef6cbb3579e18c16cad02245bc0c53f3164cf97e11dc32d`                                                                |

The minimal repair changed only two physical inline-direction declarations in
`apps/web/app/(recovery)/recovery/recovery.css` to their logical equivalents. It did not change
copy, layout dimensions, business logic, Provider behavior, data, routes, license, or environment
authority. The repository-mandated compiled manual and checksum outputs were mechanically
resynchronized.

Focused `check:rtl`, its four policy tests, Prettier, and diff checks passed. The full-gate attempts
then handled three non-product execution prerequisites: staging the authorized source for the
generated-evidence policy, synchronizing generated evidence, and rerunning outside the filesystem
sandbox so Prisma could update its existing local engine cache. The fourth attempt is the valid
complete-gate evidence.

| Valid rerun gate             | Result                                                                              | Evidence                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen offline install       | PASS; 17 workspace projects already up to date                                      | `/private/tmp/rituvia-item12-rtl-rerun-gates/install-attempt4.log`; SHA-256 `173be2b0172c9f71177608902bbe96513990c89a39e2acec2bf97775a1a15f16`                                                                          |
| Evidence through secret scan | PASS                                                                                | CI authority, architecture, environment, AI operations, localization, editorial, public-page, search, RTL, writing systems, 149 records, 37 migrations, generated evidence, instruction pack, and 1181-file secret scan |
| Formatting and lint          | PASS                                                                                | Complete configured workspace scope                                                                                                                                                                                     |
| Type checking                | PASS                                                                                | 16 of 16 packages plus root TypeScript                                                                                                                                                                                  |
| Unit matrix                  | FAIL; 209 files passed, 2 skipped, 2 failed; 2370 tests passed, 6 skipped, 5 failed | `/private/tmp/rituvia-item12-rtl-rerun-gates/check-attempt4.log`; SHA-256 `a8b7615f6f61d7cf76bf01330bfd81f177686e336586a2ecdbbcb464026fe055`                                                                            |

The five failures are all source-contract assertions:

1. `.env.example` no longer satisfies the test's all-empty-value expectation.
2. `turbo.json` includes `RITUVIA_BUILD_SOURCE_SHA` beyond the test's expected build environment.
3. The process-environment reader allowlist differs from the existing recovery adapters and
   one-time database scripts.
4. `apps/web/next.config.ts` no longer contains the environment-loader calls expected by the test.
5. `apps/web/app/[locale]/page.tsx` uses `parseGoldenShellLocale` while the test still requires the
   literal `parseLocale` contract.

Both failing test files and all compared source files have identical working-tree and HEAD Git
blobs. They were not changed by this RTL remediation. No conclusion is made here about whether the
tests or implementations should change; that decision and repair are outside the Owner's current
authorization.

The mandatory unit failure triggered STOP. No privacy export/deletion, backup restore, disaster
recovery, rollback, dependency/license, Corresponding Source, browser, protected Staging
deployment, Provider, database, secret, FJ-15, Production, DNS, public, or real-value action was
executed after the failure.

## Bounded contract remediation rerun — 2026-08-11

The Owner separately approved only a truth audit and repair of the five recorded assertions in
`tests/configuration-contract.test.ts` and `tests/web-shell-contract.test.ts`, followed by another
new-before-state Item 12 rerun. The recovery branch remained descended from the approved baseline,
the archival snapshot commit remained excluded, and the original worktree remained at 243 staged
and 0 unstaged files.

| Field                       | Exact evidence                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract rerun HEAD / tree  | `c87fa802e81a1e90d85f79735cb2d277aeb3b36d` / `6b239a21084a9f8c20f9c5212ec2960da15c272d`                                                     |
| New before-state manifest   | `/private/tmp/rituvia-item12-contract-rerun-before/MANIFEST.md`; SHA-256 `c08f30eaf4f8fe2db9951bbbc0bb7910127e4f4ebb6d22e2700f044f0c19a061` |
| Reproduced contract failure | 2 files, 13 tests; 8 passed, 5 failed; SHA-256 `3c11050c3d8ad1cfbbcc595efa108f0416d7e544aa62b2c996adfa5fd7a39f52`                           |
| Corrected contract result   | 2 files, 13 tests; 13 passed; SHA-256 `a8a467f2b95096670eb222b2d552a9e81db8eacb1d967e791baace6022e1dd3d`                                    |
| Frozen offline install      | PASS; SHA-256 `e9d4eef0c6ba14dbde0d54975e3b0dc89c020165ead1dc9a86cacb83dff024ce`                                                            |
| Formal workspace command    | FAIL at secret scan; SHA-256 `2abcdf384c36a5866c28831a34ac4706da171163985dd395cf1ce0ef5ec6e302`                                             |

The truth audit classified and repaired the five recorded areas without changing business logic,
Provider behavior, routes, locale availability, deployment authority, or license:

1. `.env.example` violated the canonical empty-value contract; the Item 11 self-reference was
   removed. Corrected SHA-256: `7f920a1885e4f5645a83f884b75de9dffb41ff49aa1ddb7bfa943662628c5346`.
2. `RITUVIA_BUILD_SOURCE_SHA` is a deliberate non-secret build-cache identity input; the stale
   exact-list assertion now permits that one additional value while continuing to reject database
   secrets.
3. The process-environment adapter list now exactly includes the approved recovery observability
   adapters and bounded Item 9–11 database scripts rather than silently excluding them.
4. D-016 was not superseded by recovery governance; `apps/web/next.config.ts` again loads the
   repository-root `@next/env` set and validates build configuration. Corrected SHA-256:
   `dc366b29d8549b6e52e450e4f328a94978a28d00ad1c1445410256a0c3b00d1b`.
5. The Web-shell contract now names the Item 6 `parseGoldenShellLocale` / `goldenShellLocales`
   boundary in both the page and layout assertions rather than the superseded generic parser.

The focused environment contract passed for four environments, ten control sections, and ten
repository references. The formal `pnpm check` then passed CI authority, architecture across 610
source files and 16 modules, environment, AI operations, localization, editorial, public-page,
search, RTL, writing-system, 149-record, 37-migration, and generated-evidence gates. The first
mandatory failure was the repository secret scan:

`path=".env.example" line=22 rule=npm-auth fingerprint=f22ae124b099a0da`

The unchanged `npm-auth` expression in `scripts/secret-policy.ts` uses `\s*` after `=`, so an empty
password assignment can consume the newline and classify text from the following line as a secret.
Its source SHA-256 is
`a679bf7fa3875c1c385808324a338185b2d9325664003d3e0baec882c363eb7c`. This new scanner finding is
outside the five-assertion authorization and was not repaired.

Before the formal run, the unchanged `test:configuration-boundary` preflight independently failed
its isolated Next.js build because `apps/web/node_modules` was symlinked outside the temporary
Turbopack filesystem root. The harness source SHA-256 is
`51022c7b9fbcb0027fdf1d67a1e323a0dffb94c0176e527f0f7ac74f3b740b7f`. This second new finding was
also not repaired. The formal STOP occurred earlier at the secret scan, so no later workspace,
privacy, restore, rollback, source/license, browser, or protected-Staging gate was executed.

No deployment, Vercel setting, database, secret, Provider, webhook, DNS, Production, public,
real-value, or FJ-15 action occurred. Protected Staging remains on the accepted Item 11 source.

## Factual recommendation

Recovery Item 12 is **Blocked** and the repository remains **NO-GO**. The smallest next Owner
decision is whether to authorize a bounded audit and repair of only the newline-crossing
`npm-auth` scanner rule and the isolated configuration-boundary dependency layout, capture another
new before-state, and rerun Item 12 from the beginning. That authority must not include FJ-15,
Production, DNS, public release, real funds, live Providers, or automatic follow-on work unless
separately stated.

**STOP — ITEM 12 DID NOT PASS; NO PRODUCT DEPLOYMENT OR FJ-15 EXECUTION STARTED.**
