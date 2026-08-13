# RITUVIA RIT-126 Automation Activation Decision Request

> Status: Option A approved in D-108; all three cards remain paused
> Date: 2026-08-02
> Product/provider/production actions: 0

## 1. Why a decision is required

The repository now contains the exact daily, weekly, and monthly prompts, shared scheduled
read-only runner, schedule manifest, tests, and operating runbook. Three matching Codex Desktop
automation cards also exist.

Two facts prevent honest activation/completion:

1. Codex project cron currently executes against the saved local checkout. It does not expose a
   hard read-only/worktree execution mode, so read-only is prompt-enforced.
2. D-106 Option A keeps non-essential paid AI safe-off and no exact recurring Codex model-use
   allowance has been recorded. No daily/weekly/monthly live output has therefore been accepted as
   runtime evidence.

The three cards are paused. They make no scheduled model call while paused.

## 2. Option A — keep paused (recommended)

Keep the three configured cards paused. Preserve the repository contract and wait until both an
approved operational model-use allowance and a technically isolated/read-only execution mode exist.

Effect:

- zero scheduled Codex model use;
- zero checkout-collision risk;
- RIT-126 remains Blocked, not Done;
- manual review prompts remain available;
- the cards can be activated later without rebuilding the contract.

## 3. Option B — accept local prompt-enforced activation

Explicitly accept the residual local-execution risk and authorize the three exact schedules with
`gpt-5.6-terra`/`high` reasoning:

- daily 08:30;
- Monday 09:30;
- month day 1 at 10:30;
- Asia/Shanghai;
- failed-run-only notifications.

Before RIT-126 can close, each card must then complete one Owner-observed **Run now** execution from
a clean checkout. The three outputs must pass the task-result schema/repository-context validator,
and before/after Git state must match. Any write, external access, malformed output, or authority
claim pauses all cards immediately.

Option B does not authorize RITUVIA product AI, providers, production/private data, deployment,
messaging, spend changes, DNS, or launch.

## 4. Option C — delete the cards

Delete the paused cards and retain manual prompts only. This removes external automation state but
leaves RIT-126 incomplete and gives up the prepared schedule configuration.

## 5. Recorded Owner response

On 2026-08-02 the Owner approved OWN-020 after Codex disclosed that an unqualified approval would
be recorded as the recommended Option A unless corrected. No correction was provided. D-108
therefore approves Option A exactly.

All three cards stay paused, make no scheduled model call, and RIT-126 stays Blocked. Option B or C
requires a new explicit Owner decision.
