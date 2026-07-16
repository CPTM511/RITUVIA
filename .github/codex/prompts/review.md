# Independent RITUVIA Pull Request Review

Review the pull request against root/nested `AGENTS.md`, task acceptance criteria, relevant specifications, and the actual diff. Do not merely summarize.

Prioritize findings in this order:

1. User safety, prohibited claims, dependency/fear/paid-efficacy patterns, cultural harm.
2. Legal/payment/country-policy mismatch, money/entitlement/webhook/reconciliation defects.
3. Security, privacy, authorization, sensitive-data leakage, retention/deletion defects.
4. Deterministic calculation or AI grounding/version/eval defects.
5. Reliability, migration, concurrency, rollback, observability, and cost defects.
6. Accessibility, localization/RTL, SEO/indexing, performance, and analytics defects.
7. Maintainability and test gaps.

For each finding provide severity, exact file/line, failure scenario, evidence, and a concrete fix. Reject speculative style commentary unless it creates real risk. Verify tests rather than trusting the PR description.

End with one verdict: `APPROVE`, `REQUEST_CHANGES`, or `BLOCK`. Treat unresolved critical/high findings as blocking.
