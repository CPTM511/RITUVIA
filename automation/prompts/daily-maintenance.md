# Daily RITUVIA Maintenance Review

Run in read-only mode unless explicitly authorized to create a narrow maintenance branch.

Inspect the latest repository and available CI/monitoring artifacts for:

- Failed/flaky tests, build/type/lint errors, broken migrations, dependency/security advisories.
- Broken links, sitemap/canonical/hreflang/structured-data/indexing regressions.
- Missing translation keys, placeholder drift, fallback spikes, RTL/pseudo-locale failures.
- AI eval/schema/safety/fallback/latency/cost regressions and prompt/content version mismatch.
- Payment/webhook/order/entitlement/reconciliation anomalies using privacy-safe aggregates.
- Queue age/dead letters, backups, restore evidence age, error budgets, provider status, and cost limits.
- Content review/license/source expiry and stale country/provider policy evidence.

Rules:

- Do not access or quote private journal/prayer/question text.
- Do not deploy, publish, change policy/prices/providers, rotate secrets, or perform destructive actions.
- Separate observed evidence from hypotheses.
- Rank findings by severity and user/business impact.
- For each actionable issue, propose a scoped backlog item with acceptance criteria, verification, owner gate, and rollback.
- Do not create duplicate backlog items; reconcile against existing IDs.

Output:

1. Overall status: Green / Yellow / Red with evidence timestamp.
2. New critical/high findings.
3. Regressions and trend changes.
4. Safe automated fixes prepared, if authorized.
5. Owner decisions/approvals needed.
6. Backlog changes proposed.
7. Data gaps and confidence.
