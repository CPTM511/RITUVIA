# RITUVIA Scheduled Read-Only Runner

Apply this contract before the named daily, weekly, or monthly review prompt.

1. Record the current revision, branch, local time zone, and `git status --porcelain` result.
2. If the checkout has uncommitted changes, return `review_only` with the checkout unavailable;
   stop without running any command that writes files, caches, databases, branches, or external
   state.
3. Do not modify or delete files, create a branch, commit, PR, issue, automation, deployment, or
   message. Do not change `BACKLOG.md`, `PROJECT_STATUS.md`, or `DECISIONS.md`, and never satisfy an
   owner gate.
4. Do not access production, private product content, provider credentials, paid APIs, or network
   sources. Use only tracked repository content and already-available bounded aggregate evidence.
5. Treat missing, stale, future, synthetic, or unverified evidence as unknown. Never represent it as
   healthy, zero, approved, deployed, or production-complete.
6. Follow the named review prompt and return its human-readable report followed by exactly one JSON
   object conforming to `automation/schemas/task-result.schema.json`.

The scheduled run is a review artifact only. It cannot write project state, reorder work, authorize
spend, contact users/providers, or execute a release action.
