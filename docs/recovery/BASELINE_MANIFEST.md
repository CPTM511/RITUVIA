# Founder Acceptance Recovery Baseline Manifest

> Status: **ACTIVE**
>
> Authority: Owner approval on 2026-08-04. This manifest identifies the recovery baseline and
> preserved archival state; it does not nominate a production candidate.

## Recovery baseline

| Field | Exact value |
| --- | --- |
| Baseline commit | `f79fee6713670fdc12b33dd3182569a942782636` |
| Baseline tree | `113371ab1e4640fe2a41f3929049e7fb60fb8857` |
| Baseline subject | `test(config): approve payment startup adapter` |
| Recovery branch | `refs/heads/codex/founder-acceptance-recovery` |
| Required validation toolchain | Node.js `24.18.0`, pnpm `11.13.1` |
| Recovery status | Provisional baseline; NO-GO; not a production candidate |

The recovery branch must contain only explicitly approved recovery work reconstructed from this
baseline. It must not merge the archival staged-snapshot branch or PR #1 wholesale.

## Preserved original worktree

The following state was captured before any recovery checkout, reset, branch switch, or recovery
branch creation and remained unchanged after archive and governance operations:

| Field | Exact value |
| --- | --- |
| Original repository | `/Users/cptmao/Documents/Metaphysical project` |
| Original branch | `codex/rit-070-subscription-lifecycle` |
| Original HEAD | `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` |
| Original HEAD tree | `42e5fde0850a8bc1a44961dd774f84e323316c6d` |
| Staged files | 243: 104 added, 137 modified, 2 deleted |
| Staged diff | 25,138 insertions, 4,223 deletions |
| Unstaged/untracked | None |
| Original index SHA-256 | `d9cffd6da447da22d9003153740db6d48aaba7be8ceee97ceb0d1c732fba1e6e` |
| Staged tree | `d0d0bc53d6ce5391c09210a3de89ea8f270c2d0d` |
| Staged binary patch SHA-256 | `987bad7b504d396fa6c3657c937b6e650b8ef40ba24f0aa3ebed4bb0cb208cc4` |
| Full-index binary patch SHA-256 | `fb102a1eef8d770b53c936e64b26a6b43e689cf63d4d6a375f12ccd6cee941cc` |

## Archive identities

| Artifact | Exact identity |
| --- | --- |
| DO-NOT-MERGE ref | `refs/heads/codex/archive-do-not-merge-staged-20260803-6c0698b` |
| Archival commit | `582f76f9b27afb266a6bd5d550347bbf404a48e2` |
| Archival parent | `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` |
| Archival tree | `d0d0bc53d6ce5391c09210a3de89ea8f270c2d0d` |
| Archive directory | `/Users/cptmao/Documents/Metaphysical project/.git/recovery-archives/20260803-6c0698b-staged` |
| Git bundle SHA-256 | `3ab10646cd00da53ed6bbe4610279407f138fdb2ce34795e3023cfbd65446a9c` |
| Restore proof SHA-256 | `3fffb65c1de9581fa3bc115266de18ec7bcd0e113bb694575d0972e426ec0ba2` |
| Archive checksum manifest SHA-256 | `6cb133c261006665805e44a18a23954400912d1565dcbdb2a379f29cfea9cd0f` |

The bundle restored independently to archival commit `582f76f9...`, tree `d0d0bc53...`, clean
status, and parent-diff SHA-256 `987bad7b...`. The complete per-file checksum inventory remains in
the archive directory and must not be regenerated destructively.

## Candidate evidence comparison

| Candidate | Install | Check | Database migration/seed/restore | Production build | Real non-mocked core loop | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `f79fee6713670fdc12b33dd3182569a942782636` | PASS | PASS in retained clean-clone evidence | PASS: 32 migrations and recovery suites | PASS: 121 artifacts | FAIL at ritual completion 404 | Approved recovery baseline; reconstruct bounded fixes only. |
| `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` | PASS | FAIL: TS2554 at `tests/verify-commercial-subscription.ts:340` | PASS: 39 migrations and recovery suites | PASS: 121 artifacts | FAIL at ritual completion 404 | Not selected. |
| Archived staged snapshot `582f76f9...` | PASS under Node 24 | FAIL: declared Node 26 toolchain mismatch | PARTIAL/FAIL after 43 migrations and foundation restore due missing security build output | PASS: 123 artifacts | PASS through completion 200 and journal 201 | Donor evidence only; do not merge directly. |

## Governance branch separation

`refs/heads/codex/founder-acceptance-recovery-phase0` is a retained draft-evidence branch based on
the archival snapshot and must not be merged into the approved recovery branch. The active recovery
branch starts directly at f79 and contains only the four approved Prompt B governance files.

## License boundary

The repository remains AGPL-3.0-only. The approved recovery decision does not settle the separate
AGPL/Swiss Ephemeris Professional License path required before unrestricted public service.
