# Release checklist: VERSION / COMMIT

## Scope and approvals

- [ ] Exact commit and change scope reviewed.
- [ ] Backlog/decision/owner gates satisfied.
- [ ] Legal/payment/country/content/model/vendor approvals attached where applicable.

## Quality

- [ ] Build, type, lint, format, unit, integration, E2E pass.
- [ ] Browser/mobile, WCAG, RTL/locales, SEO/noindex, performance checked.
- [ ] Deterministic vectors and AI eval/safety checks pass.
- [ ] Payment/webhook/entitlement/reconciliation checks pass.
- [ ] Security/privacy/authorization/log-redaction review passes.

## Operations

- [ ] Migration/backfill compatibility and rollback/forward-fix verified.
- [ ] Feature flags, canary/progressive rollout, kill switch configured.
- [ ] Dashboards, alerts, support notes, runbook, incident contacts ready.
- [ ] Backups/restore evidence current; cost/rate limits configured.

## Deployment

- [ ] Owner approves production action.
- [ ] Start time and observer recorded.
- [ ] Smoke tests and business invariants pass.
- [ ] Rollout thresholds remain healthy.
- [ ] Release/status/decision documentation updated.
