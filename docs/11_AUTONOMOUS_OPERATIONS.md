# One-Person Company and Autonomous Operations

## 1. Operating model

The owner controls mission, capital, risk, legal/payment decisions, and production release. Codex and automation perform most research, implementation, testing, documentation, content drafting, SEO/GEO operations, analytics preparation, support triage, and maintenance.

The goal is high automation with accountable intervention—not a falsely “human-free” regulated business.

## 2. Virtual organization

| Role | Codex configuration | Primary outputs |
|---|---|---|
| Product lead | `product` | PRD interpretation, priority, acceptance criteria, UX risks |
| Architect | `architect` | Boundaries, ADRs, migration/scaling review |
| Frontend/accessibility | `frontend` | UI implementation review, performance, a11y, RTL |
| Backend/data | `backend` | APIs, domain, database, jobs, correctness |
| AI safety | `ai_safety` | prompts, schemas, evals, red-team, cultural/safety boundaries |
| Payments/risk | `payments_risk` | order/ledger/provider/webhook/country review |
| Growth/SEO | `growth_seo` | content architecture, SEO/GEO, ethical lifecycle |
| Localization | `localization` | locale/RTL/translation/cultural QA |
| QA/security | `qa_security` | independent test, threat, release blocker review |
| Operations | `operations` | monitoring, runbooks, cost, incident/reconciliation review |

The main Codex session is the orchestrator and primary writer. Subagents should mostly inspect and report. Parallel writes are limited to disjoint files with an explicit merge plan.

## 3. Persistent project memory

- `BACKLOG.md`: executable task queue and dependencies.
- `PROJECT_STATUS.md`: current truth, blockers, environments, quality state.
- `DECISIONS.md`: accepted decisions and supersessions.
- Tests and fixtures: executable product memory.
- Git commits/PRs: implementation history.
- `records/tasks/RIT-NNN.md`: scope, acceptance, verification, risk, and rollback without copied queue state.
- `records/decisions/D-NNN.md`: detailed rationale linked from the accepted `DECISIONS.md` register.
- `records/incidents/INC-NNN.md` and `records/experiments/EXP-NNN.md`: minimized facts and learning linked to backlog work.

Every run begins by reconciling these sources with reality and ends by updating them.
The generated compact `records/INDEX.md` aids discovery but is never an authority for state or approval.

## 4. Task state machine

```text
Planned -> Ready -> In Progress -> In Review -> Done
             |          |             |
             v          v             v
           Blocked <----+---------- Changes Requested
```

Rules:

- Only one main implementation item is `In Progress` per worktree.
- A task becomes `Ready` only when dependencies and owner gates are satisfied.
- Every task has acceptance criteria and verification.
- A blocked task states the exact missing input/approval and does not use a fake substitute.
- Codex promotes the next eligible highest-priority task after completion.

## 5. Daily automated maintenance

Automation may run read-only checks and open an issue/PR for:

- CI failures, flaky tests, dependency/security advisories.
- Broken links, sitemap/canonical/hreflang/schema problems.
- Translation drift, missing keys, placeholder and RTL failures.
- AI eval regression, schema/fallback rate, prompt/content version mismatch.
- Provider error, webhook backlog, entitlement lag, reconciliation difference.
- Queue age/dead letters, backup status, SLO/error-budget anomalies.
- Cost/token/storage/egress anomalies.
- Content staleness and source/license review dates.

It must not auto-deploy production, change prices/legal/policy, issue material refunds, rotate secrets, or publish sensitive content.

## 6. Weekly product review

Codex prepares a concise owner brief:

- WMRS and core-loop funnel.
- New/returning/D7 and paid conversion.
- Trust/safety/accessibility/privacy issues.
- Payment success/refund/dispute and provider health.
- SEO/GEO/locale performance.
- AI quality/cost and top failure clusters.
- Infrastructure/support cost and anomalies.
- Experiment status and one recommended next decision.
- Backlog reprioritization proposal.

All conclusions state source, time window, denominator, and data-quality caveats.

## 7. Monthly risk review

- Country/payment underwriting and policy freshness.
- Tax/legal/privacy document versions and changes requiring counsel.
- Security threat model, admin permissions, secrets, dependencies, incidents.
- Backup restore evidence.
- AI red-team and model/content drift.
- Translation/cultural/content audit.
- Unit economics and vendor concentration.
- Domain/brand/IP and asset-license inventory.

## 8. Content production pipeline

1. Demand/content-gap brief from privacy-safe data.
2. Source research and rights check.
3. Structured outline and claim inventory.
4. Draft with explicit tradition/method/boundary.
5. Source/citation, originality, safety, SEO/GEO, accessibility, and locale QA.
6. Human/qualified approval for spiritual/cultural/legal/safety/payment content.
7. Feature-flagged publication.
8. Performance/report monitoring and scheduled review.

AI may automate drafts and checks but does not become the source or final approver for sensitive traditions.

## 9. Support automation

Automation may:

- Classify and prioritize tickets.
- Retrieve approved help content and draft responses.
- Detect order references and assemble a payment timeline.
- Translate drafts with warnings.
- Suggest refund eligibility.

Owner approval is required for legal/privacy/safety escalation, account suspension, fraud accusation, high-value refund, chargeback response, or any response using sensitive private evidence. Never expose journal/prayer content to support by default.

## 10. Approval matrix

| Action | Automation | Codex preparation | Owner approval/execution |
|---|---:|---:|---:|
| Code implementation in branch | Yes | Yes | Merge policy |
| Tests/docs/PR creation | Yes | Yes | Optional review except protected areas |
| Production deploy | No | Yes | Yes |
| Price/tax/refund/legal change | No | Yes | Yes |
| New country/language paid launch | No | Yes | Yes |
| Low-risk content draft | Yes | Yes | Publication policy |
| Cultural/safety/legal content publish | No | Yes | Yes/qualified reviewer |
| Provider sandbox integration | Yes | Yes | Credential/setup approval |
| Provider production activation | No | Yes | Yes |
| Low-value refund within approved policy | Optional later | Yes | Policy-defined |
| Material refund/dispute | No | Yes | Yes |
| Security containment kill switch | Preapproved narrow automation | Yes | Immediate notification |
| Destructive migration/data action | No | Yes | Yes |
| Marketing spend/mass outbound | No | Yes | Yes |

## 11. Production change process

1. Backlog item and acceptance criteria.
2. Implementation branch and tests.
3. Independent Codex review.
4. Staging deployment and automated smoke/E2E.
5. Risk-specific checklist.
6. Owner approval for gated changes.
7. Progressive production rollout.
8. Monitor and verify business outcome.
9. Roll back if thresholds fail.
10. Update status/decision/runbook.

## 12. Incident automation

Automation may detect, page, collect safe evidence, disable a preapproved feature/provider via kill switch, or enter a safe read-only mode. It must not destroy evidence, silently delete data, contact regulators/users, accuse a party, or make legal conclusions without owner review.

## 13. Cost autonomy

- Every paid API has a configurable daily/monthly budget and alert.
- Expensive jobs have concurrency and token/output limits.
- Use deterministic/cache/template paths where quality permits.
- No automation may create a new paid vendor, increase a budget, buy ads, or choose a higher-cost production model without owner approval.
- Cost savings may not weaken safety, privacy, calculation correctness, backups, or payment integrity.

## 14. Codex session discipline

- Continue in the same context for a milestone when possible.
- Use one highest-priority task per run.
- Preserve a clean diff and runnable state.
- Do not let subagents recursively spawn deep agent trees; depth one is sufficient initially.
- Ask subagents for evidence and actionable review, not broad duplicated implementation.
- If work is too large, split the backlog item before coding and complete one slice.
- Do not mark work done from a plan or generated file list; run and inspect it.

## 15. Owner dashboard

The owner should have one daily surface showing:

- Service health and incidents.
- Revenue/payment/refund/dispute snapshot.
- Core loop and retention.
- AI cost/quality/safety.
- Queue/reconciliation/backups.
- Support/privacy/safety queue.
- Current release/PR and next approval.
- Budget against limits.

This is an operations dashboard, not a replacement for detailed source systems.
