# Implement One Approved RITUVIA Task

Follow `automation/prompts/continue-next-task.md`. Work only on the single task identified in the triggering issue/input, or the highest-priority `Ready` task when the trigger explicitly permits automatic selection.

Create a focused branch/commit-ready diff. Do not push, merge, deploy, publish, alter production data, change payment/country/legal policy, or spend money. Return a result conforming to `automation/schemas/task-result.schema.json` and a PR-ready summary.
