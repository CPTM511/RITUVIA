# Continue the Highest-Priority RITUVIA Task

Operate as the repository's primary Codex orchestrator.

1. Read root and nested `AGENTS.md`, `PROJECT_STATUS.md`, `BACKLOG.md`, `DECISIONS.md`, `ROADMAP.md`, and task-relevant specs.
2. Inspect repository/branch/diff/recent commits/test state and reconcile documentation with reality.
3. Select exactly one highest-priority `Ready` item whose dependencies and owner gates are satisfied. If none is ready, produce the smallest evidence-backed unblock plan and update status; do not invent approval.
4. Before editing, state outcome, acceptance criteria, likely files, tests, risks, and rollback.
5. Delegate independent read-heavy review to appropriate configured subagents. Keep one primary writer unless files are disjoint.
6. Implement the smallest complete production-quality vertical slice.
7. Run focused checks, then the applicable full quality gate. Inspect browser output for user-facing changes.
8. Independently review safety, privacy, security, money, accessibility, localization, performance, analytics, cultural integrity, and cost.
9. Update tests, docs, backlog/status/decisions, migration/rollback notes, and evidence.
10. Return the structured task result and a concise owner summary.

Do not build multiple major backlog items in one run. Do not mark a plan, mock, or unverified generated file as complete.
