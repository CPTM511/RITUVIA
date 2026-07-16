#!/usr/bin/env python3
"""Build or verify checksums for regular files represented in the Git index."""

from __future__ import annotations

import argparse
import hashlib
import re
import stat
import subprocess
from pathlib import Path

from generated_evidence_io import write_regular_repository_file

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_NAME = "checksums.sha256"
OUTPUT = ROOT / OUTPUT_NAME

UNSAFE_PATH = re.compile(r"[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]")


def _safe_index_path(raw: bytes) -> str:
    try:
        rel = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise RuntimeError("Git index contains a non-UTF-8 path") from exc
    pure = Path(rel)
    if (
        not rel
        or rel.startswith("/")
        or "\\" in rel
        or pure.is_absolute()
        or any(part in {"", ".", ".."} for part in pure.parts)
        or UNSAFE_PATH.search(rel)
    ):
        raise RuntimeError(f"Git index contains an unsafe path: {rel!r}")
    path = ROOT / rel
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError as exc:
        raise RuntimeError(f"Git-indexed file is missing from worktree: {rel}") from exc
    if stat.S_ISLNK(mode) or not stat.S_ISREG(mode):
        raise RuntimeError(f"Checksum inputs must be regular non-symlink files: {rel}")
    try:
        path.resolve(strict=True).relative_to(ROOT.resolve(strict=True))
    except ValueError as exc:
        raise RuntimeError(f"Checksum input escapes repository: {rel}") from exc
    return rel


def package_files() -> set[str]:
    """Return regular files represented in the Git index, failing closed on Git/path errors."""
    try:
        result = subprocess.run(
            ["git", "ls-files", "-z", "--cached"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError("Git index is required to build canonical checksums") from exc
    return {_safe_index_path(raw) for raw in result.stdout.split(b"\0") if raw}


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

    write_regular_repository_file(ROOT, OUTPUT, rendered)
    print(f"Wrote {OUTPUT_NAME} with {len(package_files()) - 1} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
