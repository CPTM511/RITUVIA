# Recovery Item 3 — Protected Staging Evidence

> Date: 2026-08-04
>
> Status: **BLOCKED — NO STANDING DEPLOYMENT**

## Scope and authority

The Owner approved Recovery Item 3, the push of
`codex/founder-acceptance-recovery`, the Vercel Git connection, and one temporary recovery-branch
Git Preview bootstrap with an immediate return to automatic deployment disabled. No production,
DNS, real-funds, Provider, unrestricted-AI, public-release, or Recovery Item 4 authority was
granted.

## Source identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Governance activation: `578b4a0f6da5498e392998f333ecd92f790e4730`.
- Item 3 repository foundation: `6299853fd0e72e9a695ef183710c8eed85ef73eb`.
- Deployment-boundary ignore rules: `bed3d53a316c4b4d32d424c84ae1b743d006934a`.
- Build-cache source binding: `03fbd15aa6a05ef03c3b0be9fc80b6fc4f0d86d9`.
- Temporary Git Preview bootstrap: `06dc194f1202b186545df68ea9fec23b0eedabf9`.
- Immediate bootstrap closure: `615cf5a1f17a046f84c5b522108ad64a6850145d`.
- GitHub ref: `refs/heads/codex/founder-acceptance-recovery` at
  `615cf5a1f17a046f84c5b522108ad64a6850145d` before this evidence update.

The final tracked `apps/web/vercel.json` state has `git.deploymentEnabled: false`. The temporary
enable and immediate disable remain in immutable Git history for auditability.

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
- Automatic custom domains: disabled; system environment exposure: disabled.
- Branch-only non-secret Preview variables: `APP_ENV=staging` and exact
  `RITUVIA_BUILD_SOURCE_SHA`.

Current external truth is `live=false`, `latestDeployment=null`, zero deployments, and zero
domains. Git connection exists, but no standing Preview, Staging, or Production deployment exists.

## Fail-closed deployment attempts

Every attempted first deployment was stopped and deleted after Vercel classified it as
`target=production` contrary to the approved scope:

| Deployment                         | Requested path                           | Observed target | Final state                |
| ---------------------------------- | ---------------------------------------- | --------------- | -------------------------- |
| `dpl_36BGAbxTpbJAteamAXfMukbCrBjf` | Initial CLI probe                        | Production      | Failed, deleted            |
| `dpl_BNLcmhuEwsYoyzGDYyp362kTEG1Z` | CLI probe after environment correction   | Production      | Canceled, deleted          |
| `dpl_8QiFNBixbAuDoy7M4vnWTRWtNzF8` | Git-source API, target omitted           | Production      | Deleted while initializing |
| `dpl_435eWvjsrFsa87KzTTU2gjxymbkw` | Git-source API, explicit `staging`       | Production      | Deleted while initializing |
| `dpl_H9oSQTbj6bWe4oCgNrCTLMnpTmTJ` | Git push from non-`main` recovery branch | Production      | Deleted while building     |

No attempt reached an accepted protected-staging URL, no alias was approved or retained, and no
production, DNS, Provider, funds, data, or public-release gate was activated.

## Material blocker and Owner decision

The Vercel Hobby project reports `hasDeployments=false` and coerces every first deployment path
tested—including a non-production Git branch and an explicit `staging` request—to Production.
Hobby also rejected creation of a custom staging environment. Item 3 therefore cannot satisfy its
objective acceptance test without a new Owner decision.

Owner options:

1. **Recommended:** authorize a Vercel plan change that supports a dedicated custom Staging
   environment, then create and verify that environment without any Production bootstrap.
2. Explicitly authorize one SSO-protected, provider-safe-off Production bootstrap deployment,
   create the real Preview, then delete the bootstrap. This conflicts with the current no-
   Production authority and is not recommended.
3. Authorize a different hosting path with preview-first semantics and retain the same Item 3
   acceptance controls.

Until one option is explicitly approved, Recovery Item 3 remains Blocked and Recovery Item 4 must
not start.

**STOP — NO PRODUCT IMPLEMENTATION OR RECOVERY ITEM 4 STARTED.**
