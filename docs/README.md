# Specification Index

Read `AGENTS.md` first. These files are canonical by concern:

For product, UI, wallet, Credits, payment, AI, security, database, API, testing, and release work
introduced or changed after 2026-07-23, first read the dated production source-of-truth pack at
`codex/rituvia-production-2026-07-23/00_START_HERE.md` and the Phase 0 reconciliation at
`reports/RITUVIA_PHASE_0_REALITY_AUDIT_2026-07-23.md`. D-045 records its precedence over older
conflicting product details while preserving stricter repository safety and approval gates.

1. `00_PROJECT_CHARTER.md` — why the product exists and its boundaries.
2. `01_PRODUCT_REQUIREMENTS.md` — complete launch behavior.
3. `02_USER_EXPERIENCE.md` — journeys, states, accessibility, commerce UX.
4. `03_DESIGN_SYSTEM.md` — brand/design tokens and component standards.
5. `04_ARCHITECTURE.md` — monorepo, modules, integrations, deployment.
6. `05_DATA_MODEL.md` — entities, sensitivity, retention, ledger.
7. `06_AI_INTERPRETATION_SAFETY.md` — model pipeline, schemas, evals, crises.
8. `07_PAYMENTS_COMPLIANCE.md` — orders, providers, crypto, policy, tax gates.
9. `08_I18N_SEO_GEO_GROWTH.md` — languages, search, GEO, growth.
10. `09_ANALYTICS_EXPERIMENTS.md` — metric tree, events, experiments.
11. `10_SECURITY_PRIVACY_RELIABILITY.md` — threat model, privacy, SLO, recovery.
12. `11_AUTONOMOUS_OPERATIONS.md` — one-person AI operating system.
13. `12_CONTENT_GOVERNANCE.md` — sources, culture, editorial workflow.
14. `13_API_CONTRACTS.md` — endpoint/adapter/job contracts.
15. `14_TEST_STRATEGY.md` — quality and release evidence.
16. `15_LAUNCH_RUNBOOK.md` — staged launch, go/no-go, rollback.
17. `16_COST_GUARDRAILS.md` — budgets and contribution economics.
18. `17_BRAND_NAMING.md` — RITUVIA decision and clearance requirements.
19. `18_REFERENCES.md` — retained sources and freshness policy.
20. `19_NAME_CLEARANCE_WORKSHEET.md` — operational trademark/domain/language clearance checklist.
21. `20_AI_GROWTH_ENGINE.md` — AI-native SEO/GEO/content/lifecycle/social/paid-growth operating system.
22. `21_ENVIRONMENT_CONTRACT.md` — testable local/preview/staging/production isolation, secret, data, indexing, promotion, recovery, and approval gates.
23. `22_BACKUP_RECOVERY.md` — PostgreSQL backup/PITR requirements, automated synthetic logical restore, production restore procedure, evidence, and owner gates.
24. `23_PRODUCT_FUNCTIONS_AND_USER_GUIDE_ZH.md` — plain-language Chinese user guide for the retained reflection loop, privacy, safety, accessibility, and recovery.
25. `24_OWNER_PRODUCT_CAPABILITY_MAP_ZH.md` — Owner-facing stage goal, capability status, Keep/Freeze/Delete candidates, gaps, and decision rules.
26. `25_PRODUCT_ENGINEERING_RUNBOOK.md` — engineering-only route/module map, frozen scope, local startup, verification, and safe-removal procedure.
27. `26_PRE_LAUNCH_EXECUTION_PLAN_ZH.md` — evidence-gated path from the current local state through protected English beta, external approvals, staging rehearsal, and Owner production go/no-go.
28. `27_DETAILED_PRODUCT_USER_MANUAL_ZH.md` — detailed Chinese route, control-location, workflow, implementation, privacy, recovery, and current-activation manual.
29. `reports/RITUVIA_RIT_162_DELETION_AUDIT_2026-07-31.md` — exact Keep/Consolidate/Quarantine/Remove evidence and rollback for RIT-162.
30. `reports/RITUVIA_RIT_121_PROTECTED_BETA_THREAT_MODEL_2026-08-01.md` — versioned protected-English-anonymous-free-Beta assets, boundaries, threat register, security-matrix disposition, findings, evidence gaps, and rollback.
31. `runbooks/RIT-124_BETA_OPERATIONS.md` — fixed protected-Beta SLO/alert contract, correlated Web read-only containment, dynamic kill-switch drill, rollback, and unimplemented external bindings.
32. `runbooks/RIT-125_CASE_OPERATIONS.md` — source-bound support, privacy, safety, and content-report case intake, role/passkey triage, fixed local SLA/draft rules, rollback, and intentionally absent user/admin buttons.
33. `runbooks/RIT-120_OWNER_OPERATIONS_DASHBOARD.md` — private eight-section Owner operations dashboard input, freshness, release-gate, command, failure, verification, button-location, and rollback contract.
34. `reports/RITUVIA_OWN_019_DECISION_REQUEST_2026-08-02.md` — D-104-approved exact protected-Beta cohort, ingress, abuse limits, observation, rollback, evidence, and recorded Owner response; approval does not authorize deployment.
35. `runbooks/RIT-127_COST_GUARDRAILS.md` — fixed-registry safe-off cost simulation, private command, allocation/reporting rules, essential-service protection, missing runtime contract, verification, and rollback.
36. `reports/RITUVIA_OWN_005_COST_BUDGET_DECISION_REQUEST_2026-08-02.md` — D-106-approved Option A safe-off decision and the exact Option B authority/evidence still required before RIT-127 completion.
37. `runbooks/RIT-128_INCIDENT_GAME_DAY.md` — fixed repository-local security, containment, AI, payment, notification, database, dependency, evidence, response, and rollback matrix with no Web/Admin Button.
38. `reports/RITUVIA_RIT_128_INCIDENT_GAME_DAY_2026-08-02.md` — executed RIT-128 scenario results, remediation, zero scoped Critical/High findings, remaining external Gate H gaps, and rollback evidence.
39. `runbooks/RIT-126_CODEX_AUTOMATIONS.md` — three paused Codex Desktop daily/weekly/monthly review cards, exact button locations, local prompt-enforced read-only boundary, structured result contract, failure recovery, and pause-first rollback.
40. `reports/RITUVIA_RIT_126_AUTOMATION_ACTIVATION_DECISION_REQUEST_2026-08-02.md` — D-108-approved Option A paused RIT-126 state; future activation or removal requires a new explicit Owner decision.
41. `runbooks/RIT-129_STAGING_GATE_H_EVIDENCE.md` — provider-free eight-control staging/Gate H evidence input, terminal entry, private outputs, derived state, current blockers, failure recovery, and rollback.
42. `reports/RITUVIA_RIT_129_STAGING_GATE_H_EVIDENCE_2026-08-02.md` — executed local contract result, independent review, eight blocked external/staging controls, zero deployment/provider actions, and remaining release gates.
43. `runbooks/RIT-075_PAYMENT_PROVIDER_CONTROLS.md` — exact country/fiat/crypto/provider/method safe-off, no-fallback proof, user/Button locations, settlement boundary, failure recovery, and rollback.
44. `runbooks/RIT-074_DISPUTE_SUPPORT.md` — existing payment-event dispute facts, asynchronous immutable metadata-only support-work-item projection, fixed local SLA/template, absent Button/provider actions, failure isolation, and rollback.
45. `runbooks/RIT-168_PROTECTED_BETA_INVITES.md` — exact 25-seat opaque invite admission, private `/en/beta` Button workflow, operator issuance/revocation, privacy, failure recovery, verification, and external release boundary.
46. `reports/RITUVIA_PRE_LAUNCH_BLOCKER_OWNER_DECISION_REQUEST_2026-08-03.md` — recommended exact Owner options for RIT-127 budget, standing staging/domain, invite waves, provider restore, monitoring, external security, Gate H, and deployment HOLD.

When a decision changes a specification, update the specification, tests/backlog, and append/supersede the decision in `DECISIONS.md` in the same change.
