# GitHub Actions workflows

`ci.yml` is the active least-privilege quality workflow. It runs on pull requests, pushes to
`main`, and manual dispatch, with top-level `contents: read` only. Its three independent jobs
cover:

- durable-record graph and generated-evidence integrity, formatting, lint, strict type checking,
  unit/contract tests, the fixed Tarot and numerology synthetic AI release evaluations, the production configuration
  boundary, architecture and migration policy, CI contract, production builds, and a pinned
  Chromium/axe accessibility plus pseudolocale and free-ritual smoke;
- Prisma generation, two idempotent migration deployments, two idempotent synthetic seeds,
  migration status/drift, constraints, transactions, and least-privilege attestation against a
  digest-pinned ephemeral PostgreSQL 17 service; and
- high-severity dependency audit, repository-current secret policy, full-history Gitleaks, and
  actionlint, plus checksum-pinned Swiss Ephemeris security, SCA, and Corresponding Source gates.
  The native security step verifies AGPL/source/header/SBOM closure, deterministic argument
  fuzzing, and ASan+UBSan on the pinned Linux runner; macOS developers run the same gate with UBSan
  because the bundled Apple Clang ASan runtime is not compatible with the current host OS. The SCA
  step queries the exact upstream commit, while the source rehearsal archives the exact source/data,
  extracts it, blocks curl, and proves an offline rebuild with matching engine evidence. A second
  release-source gate requires the exact clean checked-out revision, rejects symlinks, submodules,
  component/source drift, and checksum mismatch, then archives the complete Git source plus pinned
  native source/data and repeats the offline native rebuild. The resulting local CI archive is not
  uploaded or represented as a public production source offer.

Third-party actions use reviewed 40-character commit SHAs. The PostgreSQL service uses a reviewed
tag plus manifest-list digest. actionlint and Gitleaks archives are downloaded from their official
GitHub releases, SHA-256 verified, run from a temporary directory, and then deleted. No workflow
receives repository secrets, writes repository content, uploads artifacts, uses self-hosted runners,
or deploys an environment.

The repository-owned contract tests fail on mutable action references, credential persistence,
dangerous triggers, write permissions, event-data shell interpolation, a mutable database image,
removal or broadening of the exact Chromium install, mutation of the fixed AI evaluation command,
or removal/reordering of a required gate. The
accessibility smoke consumes the production artifacts built immediately before it and does not
activate a second locale or contact a remote origin. GitHub repository settings must still make the three jobs required
checks and restrict changes to this workflow; that owner-controlled configuration cannot be proven
until a remote repository exists.

The built accessibility inventory now includes the exact five approved English numerology
education routes. The narrower local diagnostic command is `pnpm test:numerology-seo-browser`;
the active workflow continues to use the broader production-artifact accessibility gate, so this
focused command does not weaken or replace required CI coverage.

## Inert Codex examples

Reference templates live under `.github/codex/workflow-examples/`, outside the directory GitHub
Actions loads. Move one into `.github/workflows` only after:

1. The repository is private/protected as intended.
2. The official Codex GitHub Action and current inputs are re-verified.
3. `OPENAI_API_KEY` is stored as a GitHub Actions secret with appropriate budget/restrictions.
4. Branch protection, permissions, path filters, concurrency, artifact retention, and untrusted-fork behavior are reviewed.
5. The prompt and sandbox/approval mode are tested on a non-production repository/branch.

The review workflow is read-only. The nightly workflow prepares a report only. Neither deploys production.
