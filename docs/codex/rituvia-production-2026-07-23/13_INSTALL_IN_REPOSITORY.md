# 13 — Install This Pack in the RITUVIA Repository

## Recommended placement

Copy the contents of this pack into the repository root under:

```text
docs/codex/rituvia-production-2026-07-23/
```

Then:

1. Copy or merge this pack's `AGENTS.md` rules into the repository's applicable root `AGENTS.md`. Do not overwrite existing repository rules blindly.
2. Keep the golden prototype and screenshot baselines under version control or approved large-file storage.
3. Keep `contracts/catalog.json`, `contracts/model-policy.json`, `contracts/requirements.json` and the OpenAPI file review-protected.
4. Add a CI step that runs `scripts/verify_pack.py` against the committed source manifest.
5. Open Codex at the repository root and paste `prompts/00_CODEX_MASTER_START_PROMPT.md`.
6. Permit Codex to inspect and test the repository, but do not provide production provider keys during initial phases.

## Do not do this

- Do not replace the production codebase with the single-file prototype.
- Do not treat the proposed SQL as a blind migration.
- Do not overwrite an existing architecture without the Phase 0 audit.
- Do not enable live Stripe, Coinbase or AI flags during development.
- Do not delete the old project documentation; reconcile it and mark stale claims explicitly.

## Recommended first commit

```text
docs(rituvia): add production build source-of-truth and security pack
```

The first Codex engineering commit should contain only the Phase 0 audit/status reconciliation unless a small test-only change is required to make the current repository verifiable.
