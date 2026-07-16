# Validation Scripts

Run from the repository root:

```bash
python3 scripts/build_compiled_manual.py --check
python3 scripts/build_checksums.py --check
python3 scripts/validate_instruction_pack.py
shasum -a 256 -c checksums.sha256
```

The manual builder deterministically compiles the explicit source set. The checksum builder hashes tracked and non-ignored untracked repository artifacts, excluding the checksum file itself; it respects `.gitignore` and has a conservative fallback outside Git. The validator checks required files, TOML/JSON syntax, YAML when PyYAML is available, backlog IDs/dependencies/cycles/executable-task state, Codex agent contracts, instruction-size limits, command-rule structure, local Markdown links, reference artifacts, generated-manual freshness, checksum coverage/content, and legacy-brand placement.

If PyYAML is unavailable, the validator prints a warning instead of claiming YAML was parsed. Validate workflow YAML in CI with a pinned parser before activation.

RIT-004 adds three fail-closed repository evidence commands:

```bash
pnpm check:ci-contract
pnpm check:migrations
pnpm scan:secrets
```

The CI contract parses the active workflow with the exact locked YAML parser and enforces triggers,
permissions, runners, immutable actions/service image, database isolation, and required commands.
The migration policy checks the complete migration directory against
`packages/db/prisma/migration-manifest.json` and rejects checksum drift, unlisted files, missing
files, transaction loss, and destructive SQL. The current-tree secret policy scans every tracked or
unignored file without following symlinks and emits only path, line, rule, and a non-secret
fingerprint. CI additionally runs checksum-pinned actionlint and full-history Gitleaks through
`run-pinned-ci-tool.mjs`, plus a fail-closed high-severity pnpm dependency audit.

It does not replace current Codex CLI validation, legal/trademark review, provider underwriting, security testing, or product implementation tests. Re-run official Codex documentation/config checks whenever the CLI/action version changes.
