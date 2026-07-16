# RITUVIA Release Readiness Review

Review the proposed release, exact commit, environment, migration plan, feature flags, and release notes. Be independent from the implementation author where possible.

Verify:

- Scope matches approved backlog and no unrelated changes are hidden.
- Required tests, browser checks, accessibility, localization/RTL, security/privacy, performance, AI eval, payment/reconciliation, and deterministic vectors pass.
- New config/secrets/vendors/countries/products/models/content versions have documented evidence and owner approvals.
- Database and job changes are backward-compatible, observable, resumable, and reversible.
- Monitoring, alerts, dashboards, support notes, kill switches, rollout thresholds, and rollback commands are ready.
- Legal/privacy/payment descriptors and user copy match actual behavior.
- No private/sensitive data appears in logs, analytics, URLs, notifications, screenshots, fixtures, or generated artifacts.
- Cost and rate limits are set.

Return exactly one recommendation: `GO`, `GO_WITH_EXPLICIT_OWNER_ACCEPTANCE`, or `NO_GO`. List blockers separately from follow-ups. Never deploy the release.
