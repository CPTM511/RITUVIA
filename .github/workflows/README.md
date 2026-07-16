# Example Codex Workflows

Files ending in `.example.yml` are intentionally inert reference templates. Copy/rename only after:

1. The repository is private/protected as intended.
2. The official Codex GitHub Action and current inputs are re-verified.
3. `OPENAI_API_KEY` is stored as a GitHub Actions secret with appropriate budget/restrictions.
4. Branch protection, permissions, path filters, concurrency, artifact retention, and untrusted-fork behavior are reviewed.
5. The prompt and sandbox/approval mode are tested on a non-production repository/branch.

The review workflow is read-only. The nightly workflow prepares a report only. Neither deploys production.
