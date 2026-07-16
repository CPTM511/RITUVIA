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

Every run returns a structured summary compatible with `automation/schemas/task-result.schema.json`, plus human-readable Markdown. It must distinguish facts observed, changes made, tests run, assumptions, blockers, risks, approvals needed, and the next task.

## Scheduling suggestion

- Daily: maintenance/security/quality drift review.
- Weekly: product/growth/operations review and backlog proposal.
- Monthly: risk/compliance/restore/AI/content/vendor audit.
- On every PR: independent code review.
- Before every production release: release prompt plus owner checklist.

Never schedule autonomous production deployment until the owner has explicitly designed a narrow, reversible, monitored approval policy and documented it in `DECISIONS.md`.
