#!/usr/bin/env python3
"""Build or verify checksums for repository artifacts, excluding ignored files."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_NAME = "checksums.sha256"
OUTPUT = ROOT / OUTPUT_NAME

FALLBACK_IGNORED_DIRS = {
    ".git",
    ".next",
    ".turbo",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
FALLBACK_IGNORED_NAMES = {".DS_Store", ".env"}
FALLBACK_IGNORED_GLOBS = {".env.*", "*.log", "*.py[cod]", "*.tsbuildinfo"}


def _fallback_files() -> set[str]:
    files: set[str] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in FALLBACK_IGNORED_DIRS for part in rel.parts[:-1]):
            continue
        if rel.name in FALLBACK_IGNORED_NAMES:
            continue
        if rel.name != ".env.example" and any(fnmatch.fnmatch(rel.name, pattern) for pattern in FALLBACK_IGNORED_GLOBS):
            continue
        files.add(rel.as_posix())
    return files


def package_files() -> set[str]:
    """Return tracked and non-ignored untracked repository files."""
    try:
        result = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT,
            check=False,
            capture_output=True,
        )
    except OSError:
        return _fallback_files()

    if result.returncode != 0:
        return _fallback_files()

    files = {
        rel
        for raw in result.stdout.split(b"\0")
        if raw and (rel := raw.decode("utf-8")) and (ROOT / rel).is_file()
    }
    return files


def render_checksums() -> str:
    lines = []
    for rel in sorted(package_files() - {OUTPUT_NAME}):
        digest = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
        lines.append(f"{digest}  {rel}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the committed checksum file is stale")
    args = parser.parse_args()
    rendered = render_checksums()

    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != rendered:
            print("Checksums are stale; run: python3 scripts/build_checksums.py")
            return 1
        print(f"Checksums are current ({len(package_files()) - 1} entries)")
        return 0

    OUTPUT.write_text(rendered, encoding="utf-8")
    print(f"Wrote {OUTPUT_NAME} with {len(package_files()) - 1} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
