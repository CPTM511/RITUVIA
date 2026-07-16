# Contributing to RITUVIA

Every change must preserve one authoritative location for each fact. Links connect records; copying
status, dependencies, evidence, or decisions into multiple hand-maintained summaries is not a
substitute for a source of truth.

## Sources of truth

| Concern | Canonical source | Supporting evidence |
| --- | --- | --- |
| Task priority, status, milestone, dependencies, owner gate, executable-next selection | `BACKLOG.md` | `records/tasks/RIT-NNN.md` stores scope, acceptance, verification, and rollback without copying queue fields. |
| Current project capabilities, blockers, environments, quality totals | `PROJECT_STATUS.md` | Tests, generated QA evidence, and the current commit. |
| Accepted decision index and supersession | `DECISIONS.md` | `records/decisions/D-NNN.md` contains detailed context, alternatives, validation, rollout, and approvals. |
| Incident facts, assessment, and corrective actions | `records/incidents/INC-NNN.md` | Safe evidence locations and linked backlog tasks. |
| Experiment design, guardrails, results, and decision | `records/experiments/EXP-NNN.md` | Approved analytics definitions and linked task/decision records. |
| Executable behavior | Tests and committed migrations | Task-record verification commands and CI results. |
| Historical implementation | Git commits and reviewed pull requests | Task-result output and linked records. |
| Reading bundle and file-integrity inventory | Generated `RITUVIA_CODEX_BUILD_MANUAL.md` and `checksums.sha256` | Their canonical source files; never edit generated output by hand. |

## One-task contribution flow

1. Select the single highest-priority `Ready` task whose dependencies and gates are complete.
2. Change only its `BACKLOG.md` status to `In Progress` before implementation.
3. Create or update `records/tasks/RIT-NNN.md` from `templates/TASK_TEMPLATE.md`. Do not copy priority,
   status, milestone, dependencies, or owner gates into the task record.
4. Add a detailed ADR only for a durable decision. Add the corresponding concise `DECISIONS.md`
   index entry and link both directions.
5. Create incident or experiment records only for real events or approved experiments. Never create
   fictional evidence to satisfy a template.
6. Implement and run focused checks, independent review, and the complete applicable quality gate.
7. Update the task record with exact verification evidence and resolved review findings. Then move
   the backlog task through `In Review` to `Done` and promote exactly one eligible next task.
8. Return a result conforming to `automation/schemas/task-result.schema.json`. Its `record_refs.task`
   must match the task ID, and decision/incident/experiment arrays list only records changed or used.

The task-result status is a run outcome, not a second backlog state. Use `completed` only when the
canonical task becomes Done, `partial` while approved work remains, `blocked` for an evidenced
impasse, `review_only` for a read-only review, and `no_change` when no repository state changed.

## Record rules

- Store durable records only in the typed paths defined by `records/README.md`; the heading ID must
  match the filename. Existing decisions use the canonical `D-NNN` namespace, not a parallel ADR ID.
- Regenerate `records/INDEX.md` in the same change. `pnpm check:records` rejects missing, duplicate,
  placeholder, stale-index, dangling, or cyclic records and active tasks without a task dossier.
- Keep record text bounded and evidence-linked. Never paste secrets, credentials, private user text,
  raw prompts, journals, prayers, birth data, payment payloads, access tokens, stack dumps, or
  unredacted incident exports.
- An ADR records a decision; it does not grant an owner approval. Payment, legal, country, language,
  cultural, safety, production, remote, destructive-data, and spending gates remain explicit.
- An experiment may move to Running only after a linked Done RIT dossier records checked
  safety/privacy/cultural review evidence, and after its instrumentation, assignment checks,
  stopping rule, rollback, and any directly dependent OWN gates are complete. Incident closure
  requires substantive minimized sections and the applicable owner/counsel/notification evidence;
  record status never manufactures that approval.

## Generated evidence

Canonical files are edited first and staged. Generated evidence is refreshed exactly once, after
all other changes:

```bash
python3 scripts/sync_generated_evidence.py
python3 scripts/sync_generated_evidence.py --check
```

The synchronizer renders the compact record index first, the compiled manual second, and hashes the
Git-indexed repository last. Running builders in another order produces stale evidence. Stage the
intended source files before synchronization, then stage `records/INDEX.md`,
`RITUVIA_CODEX_BUILD_MANUAL.md`, and `checksums.sha256` again before `--check` or the full gate.
The synchronizer rejects any other indexed path whose worktree bytes differ from the staged blob;
unrelated untracked personal files are never canonical checksum inputs. Never hand-edit any generated
artifact. A checksum proves byte consistency, not authenticity, review, or owner approval.

## Required verification before commit

```bash
pnpm check:records
pnpm check
python3 scripts/sync_generated_evidence.py --check
python3 scripts/validate_instruction_pack.py
shasum -a 256 -c checksums.sha256
git diff --check
```

Inspect the staged file list before committing. Until OWN-008 is complete, local checks do not prove
remote required-review or branch protection. Do not push, deploy, publish, mutate production,
activate a provider/country/language, alter legal or safety policy, spend money, or perform a
destructive action without the approval required by `AGENTS.md`.
