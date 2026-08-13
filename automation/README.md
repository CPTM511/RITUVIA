# Codex Automation Operating Guide

This directory contains prompts and output contracts for recurring Codex work. Automation is a review-and-preparation layer, not an unrestricted production operator.

## Recommended modes

- **Local interactive:** use `CODEX_MASTER_PROMPT.md` for the first session, then `automation/prompts/continue-next-task.md`.
- **Scheduled read-only:** run daily/weekly/monthly prompts with the read-only automation profile and save the final report as an artifact or issue.
- **PR review:** use `.github/codex/prompts/review.md` through the official Codex GitHub Action after adding the required secret and repository protections.
- **Implementation automation:** allow workspace writes on a branch, never direct writes to the protected default branch, and keep production deploy/manual approval separate.

## Safety envelope

Automations may inspect, test, draft, patch branches, update documentation, and prepare PRs. They may not:

- Deploy production or change DNS.
- Activate payment/crypto providers or countries.
- Change prices, tax, legal terms, privacy policy, refund rules, or safety policy.
- Spend money, buy ads, increase API budgets, or create paid vendors.
- Rotate/delete secrets, destroy infrastructure/data, issue material refunds, or send mass communications.
- Publish culturally sensitive, legal, safety, or medical/crisis content without required approval.

## Required result

Every run returns a structured summary compatible with `automation/schemas/task-result.schema.json`,
plus human-readable Markdown. It includes bounded run/time/revision trace metadata, a RIT task ID,
typed durable-record references, rollback notes, observed facts, changes, verification, assumptions,
blockers, risks, owner actions, and the next task. A result describes a run; it cannot change
`BACKLOG.md`, accept a decision in `DECISIONS.md`, or satisfy an owner gate.
The JSON Schema enforces portable shape and core completed-state constraints. Before accepting a real
result, run the repository-context validator (`pnpm check:records` or its `auditTaskResult` policy)
so task state, dependency readiness, exact record paths, and tracked evidence sources are checked.

## Scheduling suggestion

- Daily: maintenance/security/quality drift review.
- Weekly: product/growth/operations review and backlog proposal.
- Monthly: risk/compliance/restore/AI/content/vendor audit.
- On every PR: independent code review.
- Before every production release: release prompt plus owner checklist.

Never schedule autonomous production deployment until the owner has explicitly designed a narrow, reversible, monitored approval policy and documented it in `DECISIONS.md`.

## Prepared RITUVIA review schedules

| Automation | Local schedule (`Asia/Shanghai`) | Prompt |
| --- | --- | --- |
| `rituvia-daily-maintenance` | Daily at 08:30 | `automation/prompts/daily-maintenance.md` |
| `rituvia-weekly-product-review` | Monday at 09:30 | `automation/prompts/weekly-product-review.md` |
| `rituvia-monthly-risk-audit` | Day 1 at 10:30 | `automation/prompts/monthly-risk-audit.md` |

The three cards are paused pending OWN-020. The exact contract is
`automation/rituvia-recurring-reviews.json`. If activated, every card first applies
`automation/scheduled-read-only-runner.md`, uses failed-run-only notifications, and stops when the
local checkout is dirty. Codex project cron currently uses local execution, so this is
prompt-enforced read-only rather than a hard read-only sandbox. Review the cards in Codex Desktop
**Automations**; see `docs/runbooks/RIT-126_CODEX_AUTOMATIONS.md`.
