"""Fail-closed repository file I/O shared by generated-evidence builders."""

from __future__ import annotations

import os
import stat
import tempfile
from pathlib import Path


def require_regular_repository_file(root: Path, path: Path) -> None:
    root_real = root.resolve(strict=True)
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError as exc:
        raise ValueError(f"required repository file is missing: {path.relative_to(root)}") from exc
    if stat.S_ISLNK(mode) or not stat.S_ISREG(mode):
        raise ValueError(f"repository input must be a regular non-symlink file: {path.relative_to(root)}")
    try:
        path.resolve(strict=True).relative_to(root_real)
    except ValueError as exc:
        raise ValueError(f"repository input escapes root: {path}") from exc


def preflight_output(root: Path, path: Path) -> None:
    root_real = root.resolve(strict=True)
    parent = path.parent
    if parent.is_symlink() or not parent.is_dir():
        raise ValueError(f"generated output parent is unsafe: {parent}")
    try:
        parent.resolve(strict=True).relative_to(root_real)
    except ValueError as exc:
        raise ValueError(f"generated output parent escapes root: {parent}") from exc
    if not path.exists() and not path.is_symlink():
        return
    require_regular_repository_file(root, path)


def write_regular_repository_file(root: Path, path: Path, content: str) -> None:
    preflight_output(root, path)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=path.parent,
            encoding="utf-8",
            newline="",
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_name = handle.name
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
        temporary_name = None
    finally:
        if temporary_name is not None:
            try:
                Path(temporary_name).unlink()
            except FileNotFoundError:
                pass
