# Durable record index

`BACKLOG.md`, `PROJECT_STATUS.md`, and `DECISIONS.md` remain the canonical queue, current snapshot,
and accepted-decision index. This directory holds linked detail that would otherwise make those
files unwieldy. See [CONTRIBUTING.md](../CONTRIBUTING.md) for lifecycle and source-of-truth rules.

Typed paths are fixed:

- `tasks/RIT-NNN.md`
- `decisions/D-NNN.md`
- `incidents/INC-NNN.md`
- `experiments/EXP-NNN.md`

[INDEX.md](./INDEX.md) is generated, compact, and embedded in the compiled handoff manual. Never
edit it by hand. Full record text remains individually checksummed but is not copied into the manual.
Absence of an incident or experiment entry is not evidence that no event occurred.
