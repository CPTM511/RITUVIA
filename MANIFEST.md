# RITUVIA Codex Build System Manifest

**Generated:** 2026-07-17

**Purpose:** a repository-ready instruction and operating package for building RITUVIA as an AI-leveraged one-person company.

## Essential entry points

- `README.md` — package orientation and specification map.
- `OWNER_OPERATING_GUIDE_ZH.md` — Chinese owner operating manual.
- `CODEX_MASTER_PROMPT.md` — first-session and continuation prompts.
- `AGENTS.md` — top-level binding project instructions.
- `BACKLOG.md` — 128 sequenced tasks, including eight explicit owner gates.
- `ROADMAP.md` — 16 milestones from repository foundation through expansion.
- `PROJECT_STATUS.md` — current truth and blockers.
- `ENGINEERING_BASELINE.md` — observed repository reality, setup gaps, and exact M0 plan.
- `QA_REPORT.md` — local consistency checks, passed assertions, and validation limits.
- `DECISIONS.md` — persistent decision register.
- `RITUVIA_CODEX_BUILD_MANUAL.md` — generated reading/handoff compilation; individual files remain canonical.
- `checksums.sha256` — SHA-256 coverage for every tracked or non-ignored package file except the checksum file itself.

## Canonical specifications

- `docs/00_PROJECT_CHARTER.md`
- `docs/01_PRODUCT_REQUIREMENTS.md`
- `docs/02_USER_EXPERIENCE.md`
- `docs/03_DESIGN_SYSTEM.md`
- `docs/04_ARCHITECTURE.md`
- `docs/05_DATA_MODEL.md`
- `docs/06_AI_INTERPRETATION_SAFETY.md`
- `docs/07_PAYMENTS_COMPLIANCE.md`
- `docs/08_I18N_SEO_GEO_GROWTH.md`
- `docs/09_ANALYTICS_EXPERIMENTS.md`
- `docs/10_SECURITY_PRIVACY_RELIABILITY.md`
- `docs/11_AUTONOMOUS_OPERATIONS.md`
- `docs/12_CONTENT_GOVERNANCE.md`
- `docs/13_API_CONTRACTS.md`
- `docs/14_TEST_STRATEGY.md`
- `docs/15_LAUNCH_RUNBOOK.md`
- `docs/16_COST_GUARDRAILS.md`
- `docs/17_BRAND_NAMING.md`
- `docs/18_REFERENCES.md`
- `docs/19_NAME_CLEARANCE_WORKSHEET.md`
- `docs/20_AI_GROWTH_ENGINE.md`

## Codex configuration

- `.codex/config.toml` — model, approval, sandbox, multi-agent, and role configuration.
- `.codex/agents/*.toml` — 10 specialized read/review roles.
- `.codex/rules/default.rules` — prompts/blocks for remote, destructive, deploy, database, and publishing commands.
- Root plus nested `AGENTS.md` — global and area-specific engineering contracts.

## Persistent nested instructions

- `apps/web/AGENTS.md`
- `apps/worker/AGENTS.md`
- `apps/admin/AGENTS.md`
- `packages/domain/AGENTS.md`
- `packages/db/AGENTS.md`
- `packages/ui/AGENTS.md`
- `packages/divination/AGENTS.md`
- `packages/ai/AGENTS.md`
- `packages/payments/AGENTS.md`
- `packages/i18n/AGENTS.md`
- `packages/country-policy/AGENTS.md`
- `content/AGENTS.md`

## Automation and review

- `automation/prompts/continue-next-task.md`
- `automation/prompts/daily-maintenance.md`
- `automation/prompts/weekly-product-review.md`
- `automation/prompts/monthly-risk-audit.md`
- `automation/prompts/release-readiness.md`
- `automation/schemas/task-result.schema.json`
- `.github/codex/prompts/*.md`
- `.github/workflows/ci.yml` — active least-privilege quality, database, dependency, and security gates.
- `.github/codex/workflow-examples/*.yml` — intentionally inactive outside the Actions workflow directory until reviewed, moved, and secured.

## Local validation

- `scripts/build_compiled_manual.py` — deterministically rebuilds/checks the handoff compilation.
- `scripts/build_checksums.py` — deterministically hashes tracked and non-ignored repository artifacts.
- `scripts/validate_instruction_pack.py` — verifies syntax, dependency graph, instruction limits, links, generated manual, checksums, and package invariants.

## Reusable records

- `templates/ADR_TEMPLATE.md`
- `templates/TASK_TEMPLATE.md`
- `templates/INCIDENT_TEMPLATE.md`
- `templates/EXPERIMENT_TEMPLATE.md`
- `templates/RELEASE_CHECKLIST_TEMPLATE.md`
- `templates/VENDOR_APPROVAL_TEMPLATE.md`

## Retained prior work

- `reference/lumora_business_plan_zh.html`
- `reference/lumora_interactive_prototype.html`

`LUMORA` is historical only. Current working brand is `RITUVIA`, pending formal legal/domain/linguistic clearance.
