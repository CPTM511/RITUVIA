# Monthly RITUVIA Risk Audit

Run as an independent, skeptical reviewer. Use current primary evidence and repository/runtime artifacts. Do not interpret absence of evidence as proof of safety.

Audit:

- Country/payment/crypto underwriting approvals, restrictions, descriptors, policy versions, and review dates.
- Legal/privacy/consent/age/tax/refund/subscription documents and implementation consistency.
- Authentication, admin authorization, secrets, dependencies, threat model, audit logs, incidents, and vulnerability remediation.
- Backup success plus a recent restore test; retention/deletion/export workflows.
- AI prompt/model/content drift, red-team results, crisis/dependency/prohibited-claim handling, and multilingual safety.
- Deterministic divination vectors, ephemeris/content/artwork/font licenses, and cultural review evidence.
- Translation, RTL, accessibility, SEO/schema, lifecycle, support, and notification compliance.
- Vendor concentration, outage fallback, costs/budgets, data-processing inventory, and exit plan.
- Domain, trademark, company-name, app-store, social-handle, and brand/IP status.

For every issue include severity, evidence, affected users/countries/features, exploit/failure path, existing controls, remediation, owner gate, and verification. Create no legal conclusion; flag matters for qualified counsel/reviewer.

Output:

1. Release-blocking findings.
2. New or worsened high risks.
3. Controls verified with evidence.
4. Controls not verified and why.
5. Policy/vendor/source items needing refresh.
6. Remediation backlog proposal.
7. Owner/qualified-review decisions.
8. Residual risk statement.

After those sections, emit one JSON object conforming exactly to
`automation/schemas/task-result.schema.json`. For this read-only audit use `task_id: null`,
`status: review_only` or `no_change`, and `record_refs.task: null`; reference only tracked files or
opaque safe evidence IDs actually inspected. The result cannot update `BACKLOG.md`, accept a
decision, or satisfy an owner gate.
