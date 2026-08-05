# Recovery Item 3 — Protected Staging Evidence

> Date: 2026-08-05
>
> Status: **COMPLETE — STANDING PROTECTED STAGING**

## Scope and authority

The Owner approved Recovery Item 3, the push of
`codex/founder-acceptance-recovery`, the Vercel Git connection, the Vercel Pro upgrade, and a
temporary recovery-branch Git Preview bootstrap with an immediate return to automatic deployment
disabled. The Owner explicitly accepted Vercel's legacy `target=production` field only when both
the deployment OIDC claim and `customEnvironment` identify `staging`, no production domain exists,
and Vercel Authentication protects the deployment. No production, DNS, real-funds, Provider,
unrestricted-AI, public-release, Recovery Item 4, or product-implementation authority was granted.

## Source identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Governance activation: `578b4a0f6da5498e392998f333ecd92f790e4730`.
- Item 3 repository foundation: `6299853fd0e72e9a695ef183710c8eed85ef73eb`.
- Deployment-boundary ignore rules: `bed3d53a316c4b4d32d424c84ae1b743d006934a`.
- Build-cache source binding: `03fbd15aa6a05ef03c3b0be9fc80b6fc4f0d86d9`.
- Accepted deployment source: `cc3ebec5101802e8b5116bab29a6f8883d66bebc`.
- Final Git Preview closure: `6a6d62f00673709b7156a0a925994048827b0a29`.
- GitHub ref: `refs/heads/codex/founder-acceptance-recovery` at
  `6a6d62f00673709b7156a0a925994048827b0a29` before this evidence update.

The accepted deployment intentionally remains source-bound to `cc3ebec5...`; the later closure
commit only returns tracked `apps/web/vercel.json` to `git.deploymentEnabled: false` and was not
deployed. The temporary enable and immediate disable remain in immutable Git history.

## Repository foundation implemented

The Item 3 repository slice implements a source-SHA-visible safe acceptance shell and fail-closed
non-production boundary without adding product journeys. It includes protected-staging access,
noindex/no-store behavior, a readiness projection, safe-off production Providers, route exposure
guards, source-identity checks, and focused browser/environment/security evidence.

Previously completed local evidence under exact Node `24.18.0` and pnpm `11.13.1` includes 167
focused tests, formatting, lint, typecheck, architecture and secret checks, a 14-package clean
production build, desktop/mobile safe-shell browser acceptance, and an isolated synthetic backup
restore. The restore report SHA-256 is
`b7f7c572a3bec08164b391e30a8a73f9b5e8f09c84cd4534b094fdea65151a25`; its backup artifact
SHA-256 is `2aa3016c15173b687216f51cf2b5e03d5dc2578f26cee17c5f192db047aa7577`.

## Git and Vercel connection

- GitHub repository: `https://github.com/CPTM511/RITUVIA`.
- Vercel user: `liumao8844-2883`, GitHub namespace owner `CPTM511`.
- Vercel team: `team_f6TQU7mloG5OnQGNmtXwFkOi` (`cptm-111-s-projects`).
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`
  (`rituvia-founder-acceptance-recovery`).
- Git production branch: `main`; recovery branch is non-production.
- Root directory: `apps/web`; Node setting: `24.x`.
- Deployment protection: Vercel Authentication for production deployment URLs and all previews.
- Automatic custom domains: disabled; system environment exposure: disabled; Observability Plus:
  disabled.
- Custom environment: `env_IpAngjZlPXtMM1A5GGuYDCAGZF66` (`staging`, type `preview`) with exact
  branch matcher `codex/founder-acceptance-recovery`.
- Custom-environment-only non-secret variables: `APP_ENV=staging`, exact
  `RITUVIA_BUILD_SOURCE_SHA`, and empty `AWS_REGION` / `AWS_DEFAULT_REGION` overrides. Vercel
  presets the last two non-credential runtime values even without project configuration; blanking
  them prevents the repository's broad `AWS_*` Provider safe-off detector from mistaking platform
  location metadata for Provider authority. No AWS credential or Provider variable exists.
- Project-only build command removes Vercel's automatically injected
  `VERCEL_OBSERVABILITY_CLIENT_CONFIG` and public aliases before `turbo run build`; no product code
  was changed for this platform compatibility boundary.

Current external truth is `live=false`, zero project domains, no production alias, two retained
custom-staging deployments for rollback evidence, and one standing protected Staging alias. Git
automatic deployment is disabled.

## Standing protected Staging

- Owner URL:
  `https://rituvia-founder-acceptance-recov-git-d9b7e8-cptm-111-s-projects.vercel.app/recovery`.
- Accepted deployment: `dpl_9KoP39Be17B4RUijhayXgpChYjLY` at unique deployment host
  `rituvia-founder-acceptance-recovery-fojr5mabb.vercel.app`.
- Deployment state: `READY`; `public=false`; `target=null`; `customEnvironment.slug=staging`.
- OIDC environment: `staging`; OIDC custom environment:
  `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`.
- Alias assignment: one RITUVIA recovery alias, assigned to the accepted deployment. The stale
  system alias that pointed to the pre-correction deployment was removed.
- Final build: exact Node `24.x`, pnpm `11.13.1`, standard build purchase type, one `iad1` runtime
  region, 14 of 14 Turbo tasks cached, 2.102 seconds of task time, and 12 seconds reported build
  output time. No enhanced build machine, multi-region runtime, database, storage, paid
  observability, Provider, or production service was added.

## Fail-closed deployment attempts

The following unsuccessful or unauthorized bootstrap attempts were stopped and deleted; none
remains addressable:

| Deployment                         | Requested path                           | Observed target | Final state                |
| ---------------------------------- | ---------------------------------------- | --------------- | -------------------------- |
| `dpl_36BGAbxTpbJAteamAXfMukbCrBjf` | Initial CLI probe                        | Production      | Failed, deleted            |
| `dpl_BNLcmhuEwsYoyzGDYyp362kTEG1Z` | CLI probe after environment correction   | Production      | Canceled, deleted          |
| `dpl_8QiFNBixbAuDoy7M4vnWTRWtNzF8` | Git-source API, target omitted           | Production      | Deleted while initializing |
| `dpl_435eWvjsrFsa87KzTTU2gjxymbkw` | Git-source API, explicit `staging`       | Production      | Deleted while initializing |
| `dpl_H9oSQTbj6bWe4oCgNrCTLMnpTmTJ` | Git push from non-`main` recovery branch | Production      | Deleted while building     |
| `dpl_9z1uBPFXLDAnrR6SjBRGyRicnia5` | Pro CLI custom target                    | Production      | Build failed, deleted      |
| `dpl_CFYFJGFVYafTFdrncLPK5omqPQzH` | Explicit custom environment              | Production*     | Build failed, deleted      |

`Production*` is Vercel's legacy field; that deployment's OIDC and custom-environment metadata did
identify `staging`, but its build failed before acceptance. No deleted attempt activated a
production domain, DNS, Provider, funds, data, or public-release gate.

## Hosted acceptance evidence

- An unauthenticated request to the unique deployment URL received a Vercel SSO redirect before
  the application. Acceptance then used a temporary expiring Vercel access link only to establish
  an isolated browser cookie; the exact acceptance paths contained no query string.
- `/recovery` rendered `Protected Staging | RITUVIA`, environment `staging`, Recovery Item `3`,
  source `cc3ebec5101802e8b5116bab29a6f8883d66bebc`, baseline
  `f79fee6713670fdc12b33dd3182569a942782636`, and the green Item 3 readiness statement.
- `/api/recovery/health` returned `200`, `status=alive`, the exact source SHA, and environment
  `staging`.
- `/api/recovery/readiness` returned `200`, `status=ready`, database and object storage
  `not-connected`, indexing `disabled`, and production Providers `disabled`.
- `/robots.txt` returned `200` with `Disallow: /`. `/sitemap.xml`, `/en`, `/api/v1/catalog`, and
  `/recovery?canary=1` returned `404`.
- All tested application responses emitted `private, no-store, max-age=0`,
  `noindex, nofollow, noarchive`, the exact environment and source headers, strict CSP,
  no-referrer, no-sniff, and disabled camera, geolocation, microphone, payment, and USB policies.
- Vercel's Preview Comments script was blocked by the repository CSP. The remaining browser console
  errors were the intentional route-canary `404` responses; no application runtime error occurred.
- Vercel runtime error scan returned no errors for the selected hour. A full-text runtime log scan
  for `canary` returned no results, proving the query canary was not echoed into runtime logs.

Desktop and mobile acceptance used a real isolated Playwright Chromium session against the
protected deployment:

| Viewport   | Local evidence file                                 | SHA-256                                                            |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| 1440 x 900 | `.playwright-cli/page-2026-08-05T01-19-11-061Z.png` | `987341c8bdfec48d3bf1f3a265a32efb9d05870147bd0d15a8e337d754de47cf` |
| 390 x 844  | `.playwright-cli/page-2026-08-05T01-19-39-769Z.png` | `da211d028ceeb9c985ba62d9b9956cb60fcb8fbd0ec9d11a5248293b68f163b8` |

The page retained its skip link, semantic heading, source/baseline identity, ready status,
connectivity status, safe-off boundaries, and diagnostic links in both viewports. Prior exact-toolchain
local evidence retains the offline/degraded, keyboard/focus, accessibility, secret, restore, and
private-log checks.

## Rollback and forward drill

The prior custom-staging deployment `dpl_HqMWezWMgunm6J4cWZ7cGv7tjEWH` was retained as a rollback
candidate. It is source-identical but predates the Vercel runtime-region safe-off overrides and
therefore fails closed with readiness `503/not-ready`.

1. The stable protected alias initially returned `200/ready` from accepted deployment
   `dpl_9KoP39Be17B4RUijhayXgpChYjLY`.
2. Alias-only rollback moved it to `dpl_HqMWezWMgunm6J4cWZ7cGv7tjEWH`; readiness returned
   `503/not-ready` as expected.
3. Alias-only forward restoration moved it back to `dpl_9KoP39Be17B4RUijhayXgpChYjLY`;
   readiness returned `200/ready`.
4. The stale second system alias was removed. No rebuild, production alias, DNS change, Provider,
   data, or funds action occurred during the drill.

## Direct Owner test

1. Sign in to the Vercel team account authorized for this project.
2. Open
   `https://rituvia-founder-acceptance-recov-git-d9b7e8-cptm-111-s-projects.vercel.app/recovery`.
3. Confirm environment `staging`, Recovery Item `3`, source `cc3ebec5...`, baseline `f79fee6...`,
   and the green ready statement.
4. Open `/api/recovery/health` and `/api/recovery/readiness` from the page; both must return `200`.
5. Confirm `/en` returns `404`. Stop immediately if access works without Vercel Authentication,
   readiness is not `ready`, the source differs, or any product journey becomes reachable.

## Remaining authority

Recovery Item 3 is complete. Recovery Item 4 is now dependency-ready but remains unapproved and
unstarted. Production, DNS, real funds, public indexing, product journeys, Providers,
unrestricted AI, and public release remain separate Owner gates.

**STOP — NO PRODUCT IMPLEMENTATION OR RECOVERY ITEM 4 STARTED.**
