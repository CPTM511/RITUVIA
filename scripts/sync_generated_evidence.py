#!/usr/bin/env python3
"""Synchronize record index, compiled manual, then tracked-file checksums."""

from __future__ import annotations

import argparse
import subprocess
import sys

sys.dont_write_bytecode = True

from build_checksums import OUTPUT as CHECKSUM_OUTPUT, ROOT, package_files, render_checksums
from build_compiled_manual import OUTPUT as MANUAL_OUTPUT, SOURCE_FILES, render_manual
from build_record_index import OUTPUT as INDEX_OUTPUT, records, render_index
from generated_evidence_io import (
    preflight_output,
    require_regular_repository_file,
    write_regular_repository_file,
)


def _check(path, rendered: str, label: str) -> bool:
    if path.is_symlink() or not path.is_file() or path.read_text(encoding="utf-8") != rendered:
        print(f"{label} is stale; run: python3 scripts/sync_generated_evidence.py")
        return False
    return True


def _unstaged_paths() -> set[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "-z", "--diff-filter=ACDMRTUXB", "--"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    try:
        return {raw.decode("utf-8", errors="strict") for raw in result.stdout.split(b"\0") if raw}
    except UnicodeDecodeError as exc:
        raise RuntimeError("Git reported a non-UTF-8 unstaged path") from exc


def _untracked_canonical_paths() -> set[str]:
    result = subprocess.run(
        [
            "git",
            "ls-files",
            "-z",
            "--others",
            "--exclude-standard",
            "--",
            "scripts",
            "tests",
            "automation",
            "records",
            ".github",
            "apps",
            "packages",
            "templates",
            "docs",
            "content",
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    try:
        return {raw.decode("utf-8", errors="strict") for raw in result.stdout.split(b"\0") if raw}
    except UnicodeDecodeError as exc:
        raise RuntimeError("Git reported a non-UTF-8 untracked canonical path") from exc


def _require_staged_sources(*, check_outputs: bool) -> None:
    outputs = {
        INDEX_OUTPUT.relative_to(ROOT).as_posix(),
        MANUAL_OUTPUT.relative_to(ROOT).as_posix(),
        CHECKSUM_OUTPUT.relative_to(ROOT).as_posix(),
    }
    unstaged = _unstaged_paths()
    untracked = sorted(_untracked_canonical_paths())
    if untracked:
        raise RuntimeError(f"canonical paths must be represented in the Git index: {untracked}")
    forbidden = sorted(unstaged if check_outputs else unstaged - outputs)
    if forbidden:
        if check_outputs:
            raise RuntimeError(f"generated outputs must be staged before verification: {forbidden}")
        raise RuntimeError(f"canonical input bytes must be staged before synchronization: {forbidden}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify all generated outputs without writing")
    args = parser.parse_args()

    if args.check:
        _require_staged_sources(check_outputs=True)
        index_ok = _check(INDEX_OUTPUT, render_index(), "Record index")
        manual_ok = index_ok and _check(MANUAL_OUTPUT, render_manual(), "Compiled manual")
        checksums_ok = manual_ok and _check(CHECKSUM_OUTPUT, render_checksums(), "Checksums")
        if not (index_ok and manual_ok and checksums_ok):
            return 1
        print("Generated evidence is current in index -> manual -> checksums order")
        return 0

    _require_staged_sources(check_outputs=False)
    for output in (INDEX_OUTPUT, MANUAL_OUTPUT, CHECKSUM_OUTPUT):
        preflight_output(ROOT, output)
    rendered_index = render_index()
    for item in SOURCE_FILES:
        require_regular_repository_file(ROOT, ROOT / item)
    indexed = package_files()
    required = set(SOURCE_FILES) | {item.path for item in records()} | {
        CHECKSUM_OUTPUT.relative_to(ROOT).as_posix(),
        MANUAL_OUTPUT.relative_to(ROOT).as_posix(),
    }
    missing = sorted(required - indexed)
    if missing:
        raise RuntimeError(f"canonical inputs must be staged before synchronization: {missing}")
    write_regular_repository_file(ROOT, INDEX_OUTPUT, rendered_index)
    write_regular_repository_file(ROOT, MANUAL_OUTPUT, render_manual())
    write_regular_repository_file(ROOT, CHECKSUM_OUTPUT, render_checksums())
    print("Synchronized records/INDEX.md -> RITUVIA_CODEX_BUILD_MANUAL.md -> checksums.sha256")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
