#!/usr/bin/env python3
"""Build or verify the deterministic single-file RITUVIA handoff manual."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from generated_evidence_io import require_regular_repository_file, write_regular_repository_file

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "RITUVIA_CODEX_BUILD_MANUAL.md"

SOURCE_FILES = [
    ".gitignore",
    ".gitattributes",
    "README.md",
    "MANIFEST.md",
    "QA_REPORT.md",
    "OWNER_OPERATING_GUIDE_ZH.md",
    "CODEX_MASTER_PROMPT.md",
    "AGENTS.md",
    "PROJECT_STATUS.md",
    "ENGINEERING_BASELINE.md",
    "DECISIONS.md",
    "ROADMAP.md",
    "BACKLOG.md",
    "CONTRIBUTING.md",
    "records/README.md",
    "records/INDEX.md",
    *[f"docs/{index:02d}_{name}.md" for index, name in enumerate([
        "PROJECT_CHARTER",
        "PRODUCT_REQUIREMENTS",
        "USER_EXPERIENCE",
        "DESIGN_SYSTEM",
        "ARCHITECTURE",
        "DATA_MODEL",
        "AI_INTERPRETATION_SAFETY",
        "PAYMENTS_COMPLIANCE",
        "I18N_SEO_GEO_GROWTH",
        "ANALYTICS_EXPERIMENTS",
        "SECURITY_PRIVACY_RELIABILITY",
        "AUTONOMOUS_OPERATIONS",
        "CONTENT_GOVERNANCE",
        "API_CONTRACTS",
        "TEST_STRATEGY",
        "LAUNCH_RUNBOOK",
        "COST_GUARDRAILS",
        "BRAND_NAMING",
        "REFERENCES",
        "NAME_CLEARANCE_WORKSHEET",
        "AI_GROWTH_ENGINE",
        "ENVIRONMENT_CONTRACT",
        "BACKUP_RECOVERY",
    ])],
    "docs/README.md",
    "apps/admin/AGENTS.md",
    "apps/web/AGENTS.md",
    "apps/worker/AGENTS.md",
    "packages/ai/AGENTS.md",
    "packages/country-policy/AGENTS.md",
    "packages/db/AGENTS.md",
    "packages/db/MIGRATIONS.md",
    "packages/divination/AGENTS.md",
    "packages/domain/AGENTS.md",
    "packages/i18n/AGENTS.md",
    "packages/payments/AGENTS.md",
    "packages/ui/AGENTS.md",
    "content/AGENTS.md",
    ".codex/config.toml",
    ".codex/agents/ai-safety.toml",
    ".codex/agents/architect.toml",
    ".codex/agents/backend.toml",
    ".codex/agents/frontend.toml",
    ".codex/agents/growth-seo.toml",
    ".codex/agents/localization.toml",
    ".codex/agents/operations.toml",
    ".codex/agents/payments-risk.toml",
    ".codex/agents/product.toml",
    ".codex/agents/qa-security.toml",
    ".codex/rules/default.rules",
    "automation/README.md",
    "automation/prompts/continue-next-task.md",
    "automation/prompts/daily-maintenance.md",
    "automation/prompts/monthly-risk-audit.md",
    "automation/prompts/release-readiness.md",
    "automation/prompts/weekly-product-review.md",
    "automation/schemas/task-result.schema.json",
    "automation/examples/task-result.example.json",
    ".github/codex/prompts/localization.md",
    ".github/codex/prompts/next-task.md",
    ".github/codex/prompts/release.md",
    ".github/codex/prompts/review.md",
    ".github/codex/prompts/security.md",
    ".github/codex/prompts/seo.md",
    ".github/workflows/README.md",
    ".github/workflows/ci.yml",
    ".github/codex/workflow-examples/codex-nightly.yml",
    ".github/codex/workflow-examples/codex-review.yml",
    "templates/ADR_TEMPLATE.md",
    "templates/EXPERIMENT_TEMPLATE.md",
    "templates/INCIDENT_TEMPLATE.md",
    "templates/RELEASE_CHECKLIST_TEMPLATE.md",
    "templates/TASK_TEMPLATE.md",
    "templates/VENDOR_APPROVAL_TEMPLATE.md",
    "scripts/README.md",
    "scripts/build_checksums.py",
    "scripts/build_compiled_manual.py",
    "scripts/build_record_index.py",
    "scripts/generated_evidence_io.py",
    "scripts/sync_generated_evidence.py",
    "scripts/validate_instruction_pack.py",
    "reference/README.md",
]

LANGUAGES = {
    ".gitignore": "gitignore",
    ".json": "json",
    ".py": "python",
    ".rules": "python",
    ".toml": "toml",
    ".yaml": "yaml",
    ".yml": "yaml",
}


def snapshot_date() -> str:
    status = (ROOT / "PROJECT_STATUS.md").read_text(encoding="utf-8")
    match = re.search(r"\*\*Last reconciled:\*\*\s*(\d{4}-\d{2}-\d{2})", status)
    if not match:
        raise ValueError("PROJECT_STATUS.md has no Last reconciled date")
    return match.group(1)


def render_manual() -> str:
    for item in SOURCE_FILES:
        require_regular_repository_file(ROOT, ROOT / item)

    lines = [
        "# RITUVIA — Complete Codex Build Manual",
        "",
        f"> Compiled repository snapshot generated {snapshot_date()}. The individual files in the repository are canonical; this single file is a convenient reading and handoff artifact.",
        "",
        "## Product definition",
        "",
        "**RITUVIA is a global platform for symbolic self-reflection, personal ritual, and a private digital sanctuary.**",
        "",
        "Core loop: **Question → Interpretation → Intention → Ritual → Journal → Revisit**.",
        "",
        "Working brand status: **preferred candidate, not legally cleared**. See `docs/17_BRAND_NAMING.md` and `docs/19_NAME_CLEARANCE_WORKSHEET.md`.",
        "",
        "## How to use this compilation",
        "",
        "1. Put the full repository package—not only this compilation—at the root of a private Git repository.",
        "2. Open the repository in Codex and submit `CODEX_MASTER_PROMPT.md`.",
        "3. Codex selects the one current executable backlog task, completes one verified task per run, and updates persistent project memory.",
        "4. Keep production deployment, payments, legal/policy, destructive data actions, budgets, and brand commitment behind owner approval.",
        "",
        "## Included files",
        "",
        *[f"- `{path}`" for path in SOURCE_FILES],
    ]

    for rel in SOURCE_FILES:
        path = ROOT / rel
        content = path.read_text(encoding="utf-8").rstrip()
        lines.extend(["", "---", "", f"# File: `{rel}`", ""])
        language = LANGUAGES.get(path.name) or LANGUAGES.get(path.suffix.lower())
        if language:
            lines.extend([f"```{language}", content, "```"])
        else:
            lines.append(content)

    lines.extend([
        "",
        "---",
        "",
        "# Retained binary/visual reference artifacts",
        "",
        "- `reference/lumora_business_plan_zh.html` — original Chinese strategy report.",
        "- `reference/lumora_interactive_prototype.html` — original interactive concept prototype.",
        "",
        "They are included in the repository/ZIP but not embedded in this Markdown compilation.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the committed manual differs from generated output")
    args = parser.parse_args()
    rendered = render_manual()

    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != rendered:
            print("Compiled manual is stale; run: python3 scripts/build_compiled_manual.py")
            return 1
        print(f"Compiled manual is current ({len(SOURCE_FILES)} embedded sources)")
        return 0

    write_regular_repository_file(ROOT, OUTPUT, rendered)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(SOURCE_FILES)} embedded sources")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
