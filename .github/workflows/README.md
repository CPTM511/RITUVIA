# GitHub Actions workflows

`ci.yml` is the active least-privilege quality workflow. It runs on pull requests, pushes to
`main`, and manual dispatch, with top-level `contents: read` only. Its three independent jobs
cover:

- formatting, lint, strict type checking, unit/contract tests, the production configuration
  boundary, migration policy, CI contract, and production builds;
- Prisma generation, two idempotent migration deployments, two idempotent synthetic seeds,
  migration status/drift, constraints, transactions, and least-privilege attestation against a
  digest-pinned ephemeral PostgreSQL 17 service; and
- high-severity dependency audit, repository-current secret policy, full-history Gitleaks, and
  actionlint.

Third-party actions use reviewed 40-character commit SHAs. The PostgreSQL service uses a reviewed
tag plus manifest-list digest. actionlint and Gitleaks archives are downloaded from their official
GitHub releases, SHA-256 verified, run from a temporary directory, and then deleted. No workflow
receives repository secrets, writes repository content, uploads artifacts, uses self-hosted runners,
or deploys an environment.

The repository-owned contract tests fail on mutable action references, credential persistence,
dangerous triggers, write permissions, event-data shell interpolation, a mutable database image,
or removal of a required gate. GitHub repository settings must still make the three jobs required
checks and restrict changes to this workflow; that owner-controlled configuration cannot be proven
until a remote repository exists.

## Inert Codex examples

Reference templates live under `.github/codex/workflow-examples/`, outside the directory GitHub
Actions loads. Move one into `.github/workflows` only after:

1. The repository is private/protected as intended.
2. The official Codex GitHub Action and current inputs are re-verified.
3. `OPENAI_API_KEY` is stored as a GitHub Actions secret with appropriate budget/restrictions.
4. Branch protection, permissions, path filters, concurrency, artifact retention, and untrusted-fork behavior are reviewed.
5. The prompt and sandbox/approval mode are tested on a non-production repository/branch.

The review workflow is read-only. The nightly workflow prepares a report only. Neither deploys production.
