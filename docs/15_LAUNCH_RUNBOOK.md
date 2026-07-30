# Launch, Release, and Rollback Runbook

## 1. Launch philosophy

Global-ready does not mean globally enabled. Launch in controlled cohorts and countries only after product, payment, legal, cultural, operational, and recovery gates pass.

## 2. Environments

The canonical [environment contract](21_ENVIRONMENT_CONTRACT.md) controls isolation, current
implementation status, secrets, data, indexing, promotion, recovery, and approvals. This runbook
does not override it or claim that external environments exist.

- Local: synthetic data and mocks/sandboxes.
- Preview: per-PR, non-indexable, isolated secrets/data.
- Staging: production-like, provider sandboxes, release rehearsal.
- Production: protected, monitored, backed up, owner-approved.

## 3. Release sequence

1. Code freeze for release candidate scope.
2. Reconcile backlog/status/decisions.
3. Build immutable artifact and record dependency/config versions.
4. Run full CI/release evidence suite.
5. Apply migrations in staging and rehearse rollback/roll-forward.
6. Run seed-free smoke/E2E against staging.
7. Verify provider sandbox/webhook/reconciliation.
8. Verify AI eval/prompt/content/model versions and fallback.
9. Verify SEO indexing controls, privacy, legal, support, status page, monitoring, backups.
10. Owner reviews go/no-go checklist.
11. Deploy progressively to production.
12. Run production smoke with non-destructive test accounts/orders where approved.
13. Monitor defined thresholds.
14. Record outcome and update status.

## 4. MVP launch waves

### Wave A — internal/owner

- Synthetic/test users.
- No public indexing or live payments.
- Validate complete loop, admin, exports, monitoring, backups.

### Wave B — closed English beta

- Invite-only adults in approved free-service countries.
- Free tarot/numerology loop; payment sandbox or tightly approved live test.
- Collect qualitative trust/safety/accessibility feedback.

### Wave C — limited paid English launch

- One or few explicitly approved countries.
- Fiat provider, tax, legal, support, refund, reconciliation operational.
- Conservative traffic and spend limits.

### Wave D — broader English and Tier 1 locales

- Expand only after retention, support, provider, chargeback, AI, and unit economics are stable.

### Wave E — crypto and regional traditions

- Separate approvals, pilots, and kill switches. Never bundled into the initial public launch by default.

## 5. Go/no-go checklist

### Product

- Anonymous first loop and account conversion pass.
- Free ritual remains complete and prominent.
- No blocked feature appears available.
- Mobile/desktop/RTL/reduced-motion states pass.

### AI/content

- Deterministic fact accuracy and schema validity pass.
- Zero critical release-set safety failures.
- Curated content/source/license status approved.
- AI label, report, fallback, and rollback work.

### Commerce

- Written provider approval for exact country/products.
- Tax/MoR and legal terms approved.
- Checkout/webhook/idempotency/reconciliation/refund/dispute rehearsal passes.
- Statement descriptor/support/receipt/cancel behavior verified.

### Privacy/security

- Threat model and high findings resolved.
- Admin MFA/least privilege/audit.
- Export/delete and retention behavior verified.
- Secrets, CSP/headers, authorization, rate limits, backups/restore.

### Operations

- Dashboards/alerts/runbooks/on-call owner channel.
- Queue/dead-letter/replay and provider kill switches.
- Status/support/refund/privacy process.
- Cost limits and emergency budget controls.

### Brand/legal

- Name/domain/asset rights cleared.
- Terms/privacy/cookies/accessibility/refund/legal entity details approved.
- Country policy activated with owner record.

## 6. Progressive rollout

- Use server feature flags and country policy.
- Start with a small eligible cohort.
- Monitor errors, latency, AI fallback/safety, payment success, entitlement lag, refunds, support, and cost.
- Increase only after a defined observation window and no stop threshold.
- Remove stale flags after full release.

## 7. Stop/rollback thresholds

Immediate halt or rollback for:

- Unauthorized private-data access/exposure.
- Money/entitlement mismatch or duplicate capture.
- Invalid legal/payment country exposure.
- Critical AI safety behavior at meaningful scale.
- Broken cancellation/refund or misleading purchase delivery.
- Severe core-loop outage/error rate.
- Unrecoverable migration/data corruption signal.
- Provider termination/suspension or security incident.

Define numeric operational thresholds before each release based on baseline traffic.

## 8. Rollback types

- Feature flag/kill switch.
- Provider/country route disable.
- Content/prompt/model version rollback.
- Application artifact rollback.
- Forward database fix preferred after irreversible migration; use tested rollback only when safe.
- Read-only/maintenance mode.
- Queue pause and controlled replay.

Do not roll back code in a way that cannot read newly written data without a compatibility plan.

## 9. Production smoke

Verify without exposing or altering real user data:

- Public pages, locale/canonical/robots.
- Anonymous free reading with test marker.
- AI generation/fallback.
- Intention/free ritual/journal save/delete.
- Auth and account merge.
- Approved payment test path and verified webhook where provider supports it.
- Entitlement and order view.
- Privacy/export request.
- Admin and audit.
- Alerts/trace correlation.

## 10. Launch monitoring window

During the initial window, review frequently:

- HTTP/server/client errors and latency.
- Database/queue saturation.
- AI schema/fallback/safety/cost.
- Payment success/webhook/reconciliation/entitlement lag.
- Refund/support/privacy/safety reports.
- Bot/abuse and account takeover.
- Core loop completion and abandonment.
- Search crawler/indexing anomalies.

## 11. Incident communication

Prepare templates for service outage, payment delay, security/privacy incident, incorrect content, and provider disruption. Communications must be factual, scoped, localized as needed, legally reviewed for material incidents, and never speculate.

## 12. Post-launch review

Within the first stable review period:

- Compare outcomes to launch hypotheses and thresholds.
- Analyze failures/support by funnel step and locale.
- Validate metric data quality.
- Review chargeback/refund and payment economics.
- Sample AI/content quality.
- Remove temporary access and test data.
- Record decisions and reprioritize backlog.
