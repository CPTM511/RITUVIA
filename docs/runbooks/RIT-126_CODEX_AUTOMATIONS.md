# RIT-126 Codex Recurring Review Automations

## 1. Purpose and current truth

RIT-126 binds the existing daily, weekly, and monthly review prompts to three paused Codex Desktop
automations for the saved RITUVIA project. They produce review artifacts only. They do not change
the backlog, accept a decision, satisfy an Owner gate, create a PR, deploy, contact a provider or
user, activate product AI, or use production/private product data.

Codex Desktop currently stores these project cron jobs with `execution_environment = "local"`.
That is not a hard read-only filesystem sandbox. The fixed runner therefore checks
`git status --porcelain` first and stops when the checkout is dirty. On a clean checkout it remains
prompt-enforced read-only. This limitation must stay visible and must not be described as worktree
isolation.

## 2. Button and entry point

There is no RITUVIA Web, Admin, or product Button for these automations.

In Codex Desktop:

1. Open **Automations** from the Codex sidebar.
2. Select one of the three cards listed below.
3. D-108 approves OWN-020 Option A, so the required Button state remains **Paused**. Do not use
   **Run now** or activate a schedule without a new explicit Owner decision. Use **Edit** only to
   inspect the schedule/prompt.

The automation cards are the only management surface. Scheduled results appear as separate Codex
tasks; they are not written into the product database or shown to RITUVIA users.

## 3. Fixed schedules

All times use `Asia/Shanghai` on the configured host.

| Automation ID | Card name | Schedule | Prompt |
| --- | --- | --- | --- |
| `rituvia-daily-maintenance` | RITUVIA daily maintenance | Every day at 08:30 | `automation/prompts/daily-maintenance.md` |
| `rituvia-weekly-product-review` | RITUVIA weekly product review | Monday at 09:30 | `automation/prompts/weekly-product-review.md` |
| `rituvia-monthly-risk-audit` | RITUVIA monthly risk audit | First day of each month at 10:30 | `automation/prompts/monthly-risk-audit.md` |

Each card is paused and configured for `gpt-5.6-terra`, `high` reasoning, local project execution,
and failed-run-only notifications. The exact repository contract is
`automation/rituvia-recurring-reviews.json`.

## 4. Run workflow

After explicit activation approval and only from a clean checkout:

1. The automation opens `automation/scheduled-read-only-runner.md` and its named review prompt.
2. It records revision, branch, time zone, and clean/dirty checkout state.
3. A dirty checkout returns a `review_only` unavailable result and stops without writing.
4. A clean checkout may inspect tracked repository content and already-available bounded aggregate
   evidence only.
5. Missing or stale evidence remains `unknown`; it cannot become a zero, healthy, approved,
   deployed, or Gate H claim.
6. The task ends with the human-readable review followed by exactly one JSON object conforming to
   `automation/schemas/task-result.schema.json`.

## 5. Forbidden actions

The recurring tasks may not modify/delete files, create branches/commits/PRs/issues/automations,
edit `BACKLOG.md`, `PROJECT_STATUS.md`, or `DECISIONS.md`, access production/private content, call a
paid product provider, send a message, spend money, rotate secrets, run a destructive command,
deploy, change DNS, or execute a release/rollback.

A report may propose a task or Owner decision. It cannot apply that proposal.

## 6. Verification

`pnpm check:records` validates the Git-indexed schedule manifest, exact three-card set, cadence,
model/reasoning, local execution truth, notification policy, runner/prompt/schema references, and
required no-production/no-private/no-network runner clauses. `tests/record-policy.test.ts` proves
that execution-environment, notification, tracked-reference, and runner-boundary drift fail closed.

The Codex automation cards and local automation records must also show the same IDs, schedules,
paused status, model, reasoning, notification policy, project, and runner/prompt binding. Repository
tests cannot prove that external app state has not changed after the review or that a live output is
valid.

## 7. Failure and recovery

- **Paused under D-108 Option A:** current expected state. Do not run.
- **Dirty checkout after approval:** expected safe stop. Complete or discard the separate
  human-reviewed work, return to a clean checkout, then use **Run now**.
- **Missing/stale evidence:** keep the section unknown; fix the source or freshness separately.
- **Malformed JSON result:** treat the run as failed; do not apply any recommendation.
- **Unexpected write or external action:** pause all three cards immediately, preserve the task
  evidence, inspect the diff/external state, and open an incident before reactivation.
- **Schedule/model drift:** pause the affected card, reconcile it to the manifest, then rerun the
  record contract.

## 8. Rollback

Use **Pause** on all three Codex automation cards. Pausing is preferred to deletion because it is
reversible and preserves the configuration for review. If the automation contract is intentionally
removed, delete the three app automations only after pause, then remove the manifest, runner,
verification code, runbook, task/decision records, and status references in one reviewed change.

No RITUVIA provider, database, customer, deployment, DNS, payment, or production state requires
rollback.
