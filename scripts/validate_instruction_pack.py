#!/usr/bin/env python3
"""Validate the RITUVIA Codex instruction pack using only local evidence."""

from __future__ import annotations

import json
import hashlib
import re
import sys
import tomllib
from collections import defaultdict, deque
from pathlib import Path

sys.dont_write_bytecode = True

from build_checksums import package_files
from build_compiled_manual import SOURCE_FILES, render_manual
from build_record_index import records

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None

ROOT = Path(__file__).resolve().parents[1]

EXPECTED = SOURCE_FILES + [
    "RITUVIA_CODEX_BUILD_MANUAL.md",
    "checksums.sha256",
    "reference/lumora_business_plan_zh.html",
    "reference/lumora_interactive_prototype.html",
]

ALLOWED_STATUSES = {
    "Planned",
    "Ready",
    "In Progress",
    "In Review",
    "Blocked",
    "Changes Requested",
    "Done",
}

TASK_RESULT_REQUIRED = {
    "schema_version",
    "run_id",
    "as_of",
    "repository_revision",
    "branch",
    "task_id",
    "status",
    "summary",
    "observed_evidence",
    "changes",
    "verification",
    "assumptions",
    "blockers",
    "risks",
    "owner_actions",
    "record_refs",
    "rollback_notes",
    "next_recommended_task",
}
TASK_RESULT_STATUSES = {"completed", "partial", "blocked", "review_only", "no_change"}


def fail(message: str, failures: list[str]) -> None:
    failures.append(message)


def validate_expected(failures: list[str]) -> None:
    for rel in EXPECTED:
        if not (ROOT / rel).is_file():
            fail(f"Missing required file: {rel}", failures)


def validate_canonical_inputs_are_indexed(failures: list[str]) -> None:
    indexed = package_files()
    required = set(SOURCE_FILES) | {record.path for record in records()} | {
        "RITUVIA_CODEX_BUILD_MANUAL.md",
        "checksums.sha256",
    }
    missing = sorted(required - indexed)
    if missing:
        fail(f"Canonical inputs are absent from the Git index: {missing}", failures)


def package_paths() -> list[Path]:
    return [ROOT / rel for rel in sorted(package_files())]


def validate_toml_json_yaml(failures: list[str], warnings: list[str]) -> None:
    paths = package_paths()
    for path in (item for item in paths if item.suffix == ".toml"):
        try:
            with path.open("rb") as handle:
                tomllib.load(handle)
        except Exception as exc:  # noqa: BLE001
            fail(f"Invalid TOML {path.relative_to(ROOT)}: {exc}", failures)

    for path in (item for item in paths if item.suffix == ".json"):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(f"Invalid JSON {path.relative_to(ROOT)}: {exc}", failures)

    yaml_paths = [item for item in paths if item.suffix in {".yml", ".yaml"}]
    if yaml is None:
        if yaml_paths:
            warnings.append("PyYAML is unavailable; YAML syntax was not parsed by this command")
    else:
        for path in yaml_paths:
            try:
                yaml.safe_load(path.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                fail(f"Invalid YAML {path.relative_to(ROOT)}: {exc}", failures)


def parse_backlog(failures: list[str]) -> tuple[dict[str, list[str]], dict[str, str]]:
    text = (ROOT / "BACKLOG.md").read_text(encoding="utf-8")
    task_re = re.compile(
        r"^\|\s*((?:RIT|OWN)-\d{3})\s*\|\s*([^|]+?)\s*\|\s*(P\d|Owner)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|",
        re.MULTILINE,
    )
    rows = task_re.findall(text)
    if not rows:
        fail("No backlog task rows parsed", failures)
        return {}, {}

    ids = [row[0] for row in rows]
    if len(ids) != len(set(ids)):
        duplicates = sorted({task for task in ids if ids.count(task) > 1})
        fail(f"Duplicate backlog IDs: {duplicates}", failures)

    known = set(ids)
    deps: dict[str, list[str]] = {}
    statuses: dict[str, str] = {}
    for task_id, _milestone, priority, status, _task, dependency_text in rows:
        status = status.strip()
        statuses[task_id] = status
        if status not in ALLOWED_STATUSES:
            fail(f"Unknown status {status!r} for {task_id}", failures)
        expected_priorities = {"P0", "P1", "P2"}
        if priority not in expected_priorities:
            fail(f"Invalid priority {priority!r} for {task_id}", failures)
        raw = dependency_text.strip()
        task_deps = [] if raw in {"None", "—", "-"} else [item.strip() for item in raw.split(",") if item.strip()]
        deps[task_id] = task_deps
        for dep in task_deps:
            if dep not in known:
                fail(f"Unknown dependency {dep} referenced by {task_id}", failures)

    if len(ids) < 122:
        fail(f"Expected at least the 122 baseline backlog items, found {len(ids)}", failures)
    if sum(task.startswith("OWN-") for task in ids) < 7:
        fail("Expected at least the seven baseline owner-gate tasks", failures)

    # Detect cycles over known dependencies.
    indegree = {task: 0 for task in known}
    children: dict[str, list[str]] = defaultdict(list)
    for task, task_deps in deps.items():
        for dep in task_deps:
            if dep in known:
                indegree[task] += 1
                children[dep].append(task)
    queue = deque(task for task, degree in indegree.items() if degree == 0)
    visited = 0
    while queue:
        task = queue.popleft()
        visited += 1
        for child in children[task]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    if visited != len(known):
        cycle_nodes = sorted(task for task, degree in indegree.items() if degree > 0)
        fail(f"Backlog dependency cycle detected: {cycle_nodes}", failures)

    return deps, statuses


def validate_backlog_readiness(deps: dict[str, list[str]], statuses: dict[str, str], failures: list[str]) -> None:
    for task, status in statuses.items():
        if status == "Ready":
            incomplete = [dep for dep in deps.get(task, []) if statuses.get(dep) != "Done"]
            if incomplete:
                fail(f"Ready task {task} has incomplete dependencies: {incomplete}", failures)

    active_statuses = {"Ready", "In Progress", "In Review", "Changes Requested"}
    active = [task for task, status in statuses.items() if task.startswith("RIT-") and status in active_statuses]
    unfinished = [task for task, status in statuses.items() if task.startswith("RIT-") and status != "Done"]
    if unfinished and len(active) != 1:
        fail(f"Expected exactly one executable RIT task, found {len(active)}: {active}", failures)
    in_progress = [task for task, status in statuses.items() if status == "In Progress"]
    if len(in_progress) > 1:
        fail(f"Expected at most one In Progress task, found: {in_progress}", failures)


def validate_agents_size(failures: list[str]) -> None:
    config_path = ROOT / ".codex/config.toml"
    with config_path.open("rb") as handle:
        config = tomllib.load(handle)
    limit = int(config.get("project_doc_max_bytes", 32768))
    root_size = (ROOT / "AGENTS.md").stat().st_size
    if root_size > limit:
        fail(f"Root AGENTS.md ({root_size}) exceeds configured limit ({limit})", failures)
    for nested in (path for path in package_paths() if path.name == "AGENTS.md"):
        if nested == ROOT / "AGENTS.md":
            continue
        combined = root_size + nested.stat().st_size
        if combined > limit:
            fail(
                f"Combined root+nested instructions exceed limit for {nested.relative_to(ROOT)}: {combined}>{limit}",
                failures,
            )


def validate_codex_agents(failures: list[str]) -> None:
    required = {"name", "description", "developer_instructions"}
    agents = sorted((ROOT / ".codex/agents").glob("*.toml"))
    if len(agents) != 10:
        fail(f"Expected 10 custom agent files, found {len(agents)}", failures)
    names: set[str] = set()
    for path in agents:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
        missing = required - data.keys()
        if missing:
            fail(f"Custom agent {path.name} missing {sorted(missing)}", failures)
        name = str(data.get("name", ""))
        if name in names:
            fail(f"Duplicate custom-agent name: {name}", failures)
        names.add(name)


def validate_rules(failures: list[str]) -> None:
    path = ROOT / ".codex/rules/default.rules"
    text = path.read_text(encoding="utf-8")
    if text.count("prefix_rule(") < 10:
        fail("Command rules file contains too few protections", failures)
    if text.count("prefix_rule(") != text.count("\n)"):
        fail("Command rules file has unbalanced prefix_rule blocks", failures)
    for decision in re.findall(r'decision\s*=\s*"([^"]+)"', text):
        if decision not in {"allow", "prompt", "forbidden"}:
            fail(f"Unsupported rule decision: {decision}", failures)


def validate_line_ending_policy(failures: list[str]) -> None:
    if (ROOT / ".gitattributes").read_text(encoding="utf-8") != "* text=auto eol=lf\n":
        fail(".gitattributes must enforce deterministic LF worktree text", failures)


def validate_task_result_schema(failures: list[str]) -> None:
    path = ROOT / "automation/schemas/task-result.schema.json"
    schema = json.loads(path.read_text(encoding="utf-8"))
    required = set(schema.get("required", []))
    property_map = schema.get("properties", {})
    properties = set(property_map)
    missing = required - properties
    if missing:
        fail(f"Task-result schema requires undefined properties: {sorted(missing)}", failures)
    if not schema.get("$schema", "").endswith("2020-12/schema"):
        fail("Task-result schema must declare JSON Schema draft 2020-12", failures)
    if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        fail("Task-result schema root must be a closed object", failures)
    if required != TASK_RESULT_REQUIRED:
        fail(f"Task-result required fields drifted: {sorted(required ^ TASK_RESULT_REQUIRED)}", failures)
    if set(property_map.get("status", {}).get("enum", [])) != TASK_RESULT_STATUSES:
        fail("Task-result status enum drifted", failures)
    task_definition = property_map.get("task_id", {})
    if set(task_definition.get("type", [])) != {"string", "null"} or task_definition.get("pattern") != "^RIT-[0-9]{3}$":
        fail("Task-result task_id must allow only a RIT task ID or null", failures)
    next_definition = property_map.get("next_recommended_task", {})
    if set(next_definition.get("type", [])) != {"string", "null"} or next_definition.get("pattern") != "^(?:RIT|OWN)-[0-9]{3}$":
        fail("Task-result next_recommended_task pattern drifted", failures)
    if property_map.get("schema_version", {}).get("const") != 1:
        fail("Task-result schema_version must remain 1", failures)
    if property_map.get("record_refs", {}).get("additionalProperties") is not False:
        fail("Task-result record_refs must remain a closed object", failures)
    risk_status = property_map.get("risks", {}).get("items", {}).get("properties", {}).get("status", {}).get("enum", [])
    if set(risk_status) != {"open", "mitigated"}:
        fail("Task-result risk status must remain open or mitigated", failures)
    for field in ("assumptions", "blockers"):
        if property_map.get(field, {}).get("type") != "array":
            fail(f"Task-result {field} must remain an array", failures)


def validate_local_markdown_links(failures: list[str]) -> None:
    link_re = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
    for path in (item for item in package_paths() if item.suffix == ".md"):
        if path.name == "RITUVIA_CODEX_BUILD_MANUAL.md":
            continue
        text = path.read_text(encoding="utf-8")
        for raw in link_re.findall(text):
            target = raw.split()[0].strip("<>")
            if not target or target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target_path = target.split("#", 1)[0]
            resolved = (path.parent / target_path).resolve()
            try:
                resolved.relative_to(ROOT.resolve())
            except ValueError:
                fail(f"Markdown link escapes repository in {path.relative_to(ROOT)}: {target}", failures)
                continue
            if not resolved.exists():
                fail(f"Broken local Markdown link in {path.relative_to(ROOT)}: {target}", failures)


def validate_brand_legacy(failures: list[str]) -> None:
    allowed = {
        Path("docs/17_BRAND_NAMING.md"),
        Path("docs/18_REFERENCES.md"),
        Path("docs/19_NAME_CLEARANCE_WORKSHEET.md"),
        Path("reference/README.md"),
        Path("MANIFEST.md"),
        Path("QA_REPORT.md"),
        Path("ENGINEERING_BASELINE.md"),
        Path("RITUVIA_CODEX_BUILD_MANUAL.md"),
        Path("scripts/validate_instruction_pack.py"),
    }
    for path in package_paths():
        if path.suffix.lower() in {".html", ".zip"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(ROOT)
        if "LUMORA" in text and rel not in allowed:
            fail(f"Unexpected legacy brand outside allowlist: {rel}", failures)


def validate_reference_integrity(failures: list[str]) -> None:
    for name in ["lumora_business_plan_zh.html", "lumora_interactive_prototype.html"]:
        path = ROOT / "reference" / name
        if not path.exists() or path.stat().st_size < 10_000:
            fail(f"Reference artifact missing or unexpectedly small: {name}", failures)


def validate_compiled_manual(failures: list[str]) -> None:
    path = ROOT / "RITUVIA_CODEX_BUILD_MANUAL.md"
    if path.is_file() and path.read_text(encoding="utf-8") != render_manual():
        fail("Compiled manual is stale; run python3 scripts/build_compiled_manual.py", failures)


def validate_checksums(failures: list[str]) -> None:
    checksum_path = ROOT / "checksums.sha256"
    entries: dict[str, str] = {}
    line_re = re.compile(r"^([0-9a-f]{64})  (.+)$")
    for line_number, line in enumerate(checksum_path.read_text(encoding="utf-8").splitlines(), start=1):
        match = line_re.fullmatch(line)
        if not match:
            fail(f"Malformed checksum line {line_number}", failures)
            continue
        digest, rel = match.groups()
        if rel in entries:
            fail(f"Duplicate checksum entry: {rel}", failures)
            continue
        entries[rel] = digest

    expected = package_files() - {"checksums.sha256"}
    actual = set(entries)
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing:
        fail(f"Files missing from checksums.sha256: {missing}", failures)
    if extra:
        fail(f"Checksum entries without files: {extra}", failures)

    for rel in sorted(expected & actual):
        digest = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
        if digest != entries[rel]:
            fail(f"Checksum mismatch: {rel}", failures)


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []
    validate_expected(failures)
    if failures:
        print("RITUVIA instruction-pack validation FAILED", file=sys.stderr)
        for item in failures:
            print(f"- {item}", file=sys.stderr)
        return 1

    validate_canonical_inputs_are_indexed(failures)
    validate_toml_json_yaml(failures, warnings)
    if failures:
        print("RITUVIA instruction-pack validation FAILED", file=sys.stderr)
        for item in failures:
            print(f"- {item}", file=sys.stderr)
        return 1

    deps, statuses = parse_backlog(failures)
    validate_backlog_readiness(deps, statuses, failures)
    validate_agents_size(failures)
    validate_codex_agents(failures)
    validate_rules(failures)
    validate_line_ending_policy(failures)
    validate_task_result_schema(failures)
    validate_local_markdown_links(failures)
    validate_brand_legacy(failures)
    validate_reference_integrity(failures)
    validate_compiled_manual(failures)
    validate_checksums(failures)

    if failures:
        print("RITUVIA instruction-pack validation FAILED", file=sys.stderr)
        for item in failures:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("RITUVIA instruction-pack validation PASSED")
    for item in warnings:
        print(f"WARNING: {item}")
    print(f"Root: {ROOT}")
    print(f"Package files (excluding .git): {len(package_files())}")
    print(f"Backlog items: {len(statuses)}")
    print(f"Ready items: {sum(status == 'Ready' for status in statuses.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
