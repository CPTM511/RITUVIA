# Environment Isolation and Deployment Contract

This is the canonical RITUVIA contract for local, preview, staging, and production environments.
It consolidates requirements already distributed across configuration, architecture, security,
search, migration, and launch specifications. It documents required authority and evidence; it
does not claim that external preview, staging, or production infrastructure currently exists.

## 1. Authority and current state

The status vocabulary is closed:

| Status | Meaning |
| --- | --- |
| `implemented` | The repository currently implements and verifies the stated local control. |
| `verified rehearsal` | A bounded, recorded rehearsal proved the pattern; no standing service is implied. |
| `required before use` | The control must exist and be verified before that environment may be used. |

Current state: no standing preview, staging, or production hosting environment exists. RIT-016 is
a `verified rehearsal` of one isolated loopback staging compatibility window, not a reusable or
standing staging service. Recovery Item 3 created a dedicated Vercel project and connected its
GitHub source, SSO protection, non-production variables, safe domain settings, and exact recovery
branch, but Vercel Hobby coerced every first deployment path tested to Production. Every attempt
was deleted; the project remains `live=false` with zero deployments and zero domains. The public
GitHub repository in D-090 is source hosting, not product hosting, production deployment, DNS,
indexing activation, or public product launch.

## 2. Environment matrix

| Environment | `APP_ENV` | Current status | Purpose | Data | Access and network | Lifetime | Promotion source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Local | `local` | `implemented` | Developer build and focused verification | Synthetic or developer-created local test data only | Loopback by default; developer access | Developer controlled and disposable except explicitly retained local test data | Clean tracked source |
| Preview | `preview` | `required before use` | Per-PR product and browser review | Synthetic fixtures only | Protected, authenticated, least-privilege access; no unrestricted crawler access | Ephemeral and deleted after review | Protected PR head with required CI |
| Staging | `staging` | `verified rehearsal` | Production-like release, migration, recovery, DAST, and provider-sandbox rehearsal | Synthetic or explicitly consented dedicated test accounts only | Team/allowlist access, protected ingress, audited privileged access | Persistent only when an approved isolated service is provisioned | Immutable release candidate that passed required CI |
| Production | `production` | `required before use` | Owner-approved customer service | Real customer data only after legal, privacy, security, and launch gates | Public application ingress; private administrative and service access | Durable, monitored, backed up, and recoverable | Exact staging-approved immutable release |

Preview cannot promote directly to production. Staging is the required release rehearsal boundary.
An artifact promoted between environments must retain the exact Git revision, dependency lock,
compiled artifact digest, configuration schema version, and Corresponding Source identity.

## 3. Isolation and data flow

Every non-local environment must have independently addressable and independently revocable
resources. A naming convention or logical schema alone is not isolation.

| Resource | Preview | Staging | Production |
| --- | --- | --- | --- |
| PostgreSQL | Per-preview database or equivalent isolated cluster/database with synthetic data | Dedicated production-like database with test data | Dedicated production system of record |
| Redis/cache | Per-preview namespace plus credentials, or disabled | Dedicated staging instance and credentials | Dedicated production instance and credentials |
| Object storage | Per-preview bucket/prefix plus credentials, or disabled | Dedicated staging bucket and credentials | Dedicated production bucket and credentials |
| Encryption/signing keys | Unique ephemeral test keys | Unique staging keys | Unique versioned production KMS keys |
| Payment/crypto | Mock, CLI fixture, or approved sandbox only | Separate provider test-mode account/project and webhook endpoint | Live account only after provider/legal/owner gates |
| AI | Disabled, recorded fixture, or dedicated test account | Approved test account with non-production data | Live provider only after privacy, safety, budget, and owner gates |
| Email/auth | Sink, local capture, or dedicated test tenant | Dedicated test tenant/domain with allowlisted recipients | Approved production tenant/domain and reviewed templates |
| Analytics/observability | Dedicated non-production destination with synthetic identifiers | Dedicated staging destination and retention | Dedicated production destination with approved retention/access |

Production data MUST NOT be copied, sampled, restored, replayed, or exported into local, preview, or
staging. Production secrets MUST NOT flow downward. Preview and staging credentials MUST NOT grant
production authority. Private questions, journals, intentions, birth data, authentication material,
payment payloads, or customer exports are never acceptable test fixtures.

Cross-environment network access is denied by default. Preview and staging services may not connect
to production databases, caches, buckets, queues, KMS keys, webhooks, provider projects, analytics
destinations, or administrative endpoints.

## 4. Secrets and privileged access

- `.env*` files remain uncommitted. `.env.example` contains names and descriptions only.
- Non-local secrets come from the environment's managed secret store, never source, images,
  workflow files, build arguments, CI artifacts, screenshots, logs, tickets, or chat.
- `NEXT_PUBLIC_*` remains denied; browser code receives only the validated non-secret projection.
- Every environment uses unique database credentials, session/auth keys, HMAC keys, encryption
  keys, signing keys, webhook secrets, provider credentials, and service identities.
- Service identities receive least privilege for one environment and purpose. Human production
  access requires named identity, MFA, short-lived elevation, reason, and audit evidence.
- Rotation creates a versioned overlap window only where the data format supports it, verifies
  read-old/write-new behavior, then revokes the prior version. Rotation must be rehearsed outside
  production before launch.
- Break-glass access is disabled by default, time-bounded, independently logged, reviewed after use,
  and revoked immediately after the incident.
- A suspected exposure requires environment-scoped revocation, incident handling, affected-data
  analysis, and verification that no copied secret remains in source, artifacts, caches, or logs.

## 5. Indexing and public exposure

Local, preview, and staging MUST emit `noindex, nofollow`, serve disallow-all robots, and publish no sitemap.
Authentication or an unguessable preview URL is not an indexing control.

Production remains disallow-all and publishes no sitemap until all of the following are true:

1. `APP_ENV=production` passes typed startup validation.
2. The canonical origin is an approved HTTPS origin with approved DNS.
3. The exact public-page inventory and editorial/source authority are current.
4. Private, account, reading, checkout, journal, Sanctuary, and framework representations remain
   noindex and private/no-store where required.
5. Legal, country, locale, support, security, and operational launch gates are complete.
6. The owner separately approves production deployment and indexing activation.

Repository visibility, a successful production build, or a staging rehearsal never satisfies the
production indexing gate.

## 6. Schema change, backup, and recovery

- Preview may apply migrations only to disposable isolated databases. It never uses production
  backups or production connection strings.
- Staging applies the exact candidate migration set before application promotion and rehearses
  compatibility, rollback or forward-fix, seed-free smoke, and isolated restore.
- Production migrations require an exact revision, reviewed migration manifest, backup/PITR
  readiness, compatibility plan, rollback or forward-fix plan, maintenance/read-only strategy,
  monitoring, and explicit owner approval.
- Destructive migrations, production data mutation, backup deletion, key destruction, and
  irreversible retention changes remain separate human approval gates.
- Backups are encrypted with environment-specific authority. Restore tests use an isolated target
  and verify integrity, authorization, application compatibility, and cleanup.
- Application rollback is forbidden when the old application cannot safely read data written by
  the new version. Prefer a tested forward fix after an irreversible schema change.

The repository automates a synthetic custom-format logical backup and isolated-database restore
through RIT-123. No standing production backup automation, production PITR, approved retention, or
external provider-level isolated restore is currently claimed; those controls remain required
before production use under the [backup and recovery runbook](22_BACKUP_RECOVERY.md).

## 7. Build, promotion, and deployment gates

A candidate cannot be promoted unless evidence binds all of these inputs:

- exact Git revision and clean source state;
- locked Node, pnpm, dependencies, action revisions, and service image digests;
- required protected `Quality`, `PostgreSQL integration`, and `Security scans` results;
- immutable application artifact and complete Corresponding Source identity;
- environment-specific typed configuration validation with no secret values in evidence;
- migration compatibility and restore/rollback evidence applicable to the change;
- seed-free HTTP/browser smoke, accessibility, authorization, privacy, and security checks;
- provider sandbox/webhook/reconciliation evidence when an integration is in scope;
- open critical/high security findings: zero; and
- every applicable owner approval reference.

Preview deployment may be automated only after its hosting project, authentication, fork/secrets
policy, retention, cleanup, and cost limits are reviewed. Staging deployment may be automated only
after isolated resources and audit/rollback controls exist. Production deployment and rollback that affect customers always require explicit owner approval.

Environment variables do not grant product authority by themselves. Country policy, feature flags,
provider approval, content/locale approval, and owner gates remain server-authoritative and
fail-closed.

## 8. Evidence and current implementation state

`implemented` repository evidence:

- typed `APP_ENV` accepts only local, preview, staging, and production;
- production startup requires complete HTTPS brand configuration and approved policy references;
- `NEXT_PUBLIC_*` variables are rejected;
- local authentication and local checkout adapters are rejected outside local;
- non-production metadata, robots, and sitemap behavior fail closed;
- migrations, architecture, records, generated evidence, secrets, build artifacts, and three hosted
  CI jobs have repository gates; and
- public `main` is protected under D-090.

`verified rehearsal` evidence:

- RIT-016 used loopback-only PostgreSQL 17 and Web processes, random Basic authentication,
  private/no-store responses, disallow-all robots, synthetic data, and forward/rollback/
  roll-forward registry compatibility probes.

`required before use` and not currently claimed:

- standing external preview, staging, or production hosting;
- cloud databases, caches, buckets, KMS, queues, provider projects, or environment secret stores;
- production credentials, customer data, DNS, public product indexing, or provider activation;
- production automated encrypted backup/PITR and provider-level isolated restore; and
- production monitoring, alerting, support, status, on-call, and independent penetration evidence.

Recovery Item 3 evidence is recorded in
`docs/recovery/ITEM_3_PROTECTED_STAGING_EVIDENCE.md`. Its Vercel first-deployment blocker requires a
new Owner hosting decision before Preview or Staging can be claimed.

## 9. Rollback and emergency actions

Use the narrowest safe action: feature/provider/country kill switch, queue pause, read-only mode,
artifact rollback, tested migration rollback, or forward fix. Preserve idempotency and audit
evidence. Never delete or rewrite history to conceal a failed deployment.

Emergency production action requires the owner or recorded delegate, a reason, exact affected
environment/revision, start time, expected user impact, rollback or forward-fix plan, and
post-action review. Restoring service does not waive incident, privacy, payment, or disclosure
obligations.

## 10. Owner approvals

The following remain explicit human gates:

- creating or changing production hosting, deployment, rollback, DNS, domains, or indexing;
- installing, rotating, or revoking production secrets and provider credentials;
- production migrations, data mutation, backup deletion, key destruction, or retention changes;
- live payment, crypto, email, AI, analytics, country, locale, content, or age-policy activation;
- legal terms, privacy, consent, refund, tax, merchant, support, and public-launch decisions; and
- weakening branch, CI, security, privacy, recovery, or environment-isolation controls.

Codex may prepare configurations, scripts, evidence, and protected preview/staging plans, but it
must not execute these owner-gated production actions without a new explicit approval.
