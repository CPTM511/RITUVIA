import { execFileSync, spawnSync } from "node:child_process";
import { cp, lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const python = execFileSync("which", ["python3"], { encoding: "utf8" }).trim();

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rituvia-evidence-"));
  roots.push(root);
  await mkdir(path.join(root, "scripts"));
  for (const name of ["build_checksums.py", "generated_evidence_io.py"]) {
    await cp(path.join(repositoryRoot, "scripts", name), path.join(root, "scripts", name));
  }
  await writeFile(path.join(root, "tracked.txt"), "tracked\n");
  await writeFile(path.join(root, "checksums.sha256"), "");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "scripts", "tracked.txt", "checksums.sha256"], { cwd: root });
  return root;
};

describe("generated evidence input boundary", () => {
  it("indexes all four record types bijectively and rejects stale, mismatched, or symlinked records", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rituvia-index-"));
    roots.push(root);
    await mkdir(path.join(root, "scripts"));
    for (const name of ["build_record_index.py", "generated_evidence_io.py"]) {
      await cp(path.join(repositoryRoot, "scripts", name), path.join(root, "scripts", name));
    }
    for (const directory of ["decisions", "experiments", "incidents", "tasks"]) {
      await mkdir(path.join(root, "records", directory), { recursive: true });
    }
    const fixtures = {
      "records/decisions/D-001.md": "# D-001: Decision fixture\n",
      "records/experiments/EXP-001.md": "# EXP-001: Experiment fixture\n",
      "records/incidents/INC-001.md": "# INC-001: Incident fixture\n",
      "records/tasks/RIT-009.md": "# RIT-009: Task fixture\n",
    };
    await Promise.all(
      Object.entries(fixtures).map(([name, content]) => writeFile(path.join(root, name), content)),
    );
    execFileSync(python, ["-B", "scripts/build_record_index.py"], { cwd: root });
    const index = await readFile(path.join(root, "records", "INDEX.md"), "utf8");
    const positions = ["D-001", "EXP-001", "INC-001", "RIT-009"].map((id) =>
      index.indexOf(`| ${id} |`),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    execFileSync(python, ["-B", "scripts/build_record_index.py", "--check"], { cwd: root });

    const nextDecision = path.join(root, "records", "decisions", "D-002.md");
    await writeFile(nextDecision, "# D-002: New decision\n");
    const stale = spawnSync(python, ["-B", "scripts/build_record_index.py", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(stale.status).not.toBe(0);
    expect(`${stale.stdout}${stale.stderr}`).toContain("stale");

    await writeFile(nextDecision, "# D-999: Wrong heading\n");
    const mismatched = spawnSync(python, ["-B", "scripts/build_record_index.py", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(mismatched.status).not.toBe(0);
    expect(`${mismatched.stdout}${mismatched.stderr}`).toContain("heading");

    await writeFile(nextDecision, "# D-002: New decision\n");
    const target = path.join(root, "outside-record.md");
    await writeFile(target, "# INC-002: Outside\n");
    await symlink(target, path.join(root, "records", "incidents", "INC-002.md"));
    const linked = spawnSync(python, ["-B", "scripts/build_record_index.py", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(linked.status).not.toBe(0);
    expect(`${linked.stdout}${linked.stderr}`).toContain("non-symlink");
  });

  it("hashes only Git-indexed files and excludes an untracked personal canary", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "private-personal-canary.md"), "must not be hashed\n");
    execFileSync(python, ["-B", "scripts/build_checksums.py"], { cwd: root });
    const checksums = await readFile(path.join(root, "checksums.sha256"), "utf8");
    expect(checksums).toContain("tracked.txt");
    expect(checksums).not.toContain("private-personal-canary.md");
  });

  it("fails closed when Git is unavailable instead of scanning the workspace", async () => {
    const root = await fixture();
    const result = spawnSync(python, ["-B", "scripts/build_checksums.py"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: "/nonexistent" },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Git index is required");
  });

  it("rejects tracked symlinks and control-character paths", async () => {
    const root = await fixture();
    const outside = path.join(root, "outside.txt");
    await writeFile(outside, "outside\n");
    await symlink(outside, path.join(root, "link.txt"));
    execFileSync("git", ["add", "link.txt"], { cwd: root });
    const symlinkResult = spawnSync(python, ["-B", "scripts/build_checksums.py"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(symlinkResult.status).not.toBe(0);
    expect(`${symlinkResult.stdout}${symlinkResult.stderr}`).toContain("non-symlink");

    execFileSync("git", ["rm", "--cached", "link.txt"], { cwd: root });
    await writeFile(path.join(root, "bad\nname.txt"), "bad\n");
    execFileSync("git", ["add", "bad\nname.txt"], { cwd: root });
    const controlResult = spawnSync(python, ["-B", "scripts/build_checksums.py"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(controlResult.status).not.toBe(0);
    expect(`${controlResult.stdout}${controlResult.stderr}`).toContain("unsafe path");
  });

  it("orchestrates writes strictly as index, manual, checksums and performs no writes in check mode", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rituvia-sync-"));
    roots.push(root);
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "records", "tasks"), { recursive: true });
    await cp(
      path.join(repositoryRoot, "scripts", "sync_generated_evidence.py"),
      path.join(root, "scripts", "sync_generated_evidence.py"),
    );
    await writeFile(path.join(root, "source.md"), "source\n");
    await writeFile(path.join(root, "records", "tasks", "RIT-009.md"), "task\n");
    await writeFile(path.join(root, "records", "INDEX.md"), "old\n");
    await writeFile(path.join(root, "RITUVIA_CODEX_BUILD_MANUAL.md"), "old\n");
    await writeFile(path.join(root, "checksums.sha256"), "old\n");
    await writeFile(
      path.join(root, "scripts", "generated_evidence_io.py"),
      [
        "from pathlib import Path",
        "def preflight_output(root, path): pass",
        "def require_regular_repository_file(root, path): pass",
        "def write_regular_repository_file(root, path, content):",
        "    with (root / 'events.log').open('a', encoding='utf-8') as handle: handle.write(f'write:{path.name}\\n')",
        "    path.write_text(content, encoding='utf-8')",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(root, "scripts", "build_checksums.py"),
      [
        "from pathlib import Path",
        "ROOT = Path(__file__).resolve().parents[1]",
        "OUTPUT = ROOT / 'checksums.sha256'",
        "def package_files(): return {'source.md', 'records/INDEX.md', 'records/tasks/RIT-009.md', 'RITUVIA_CODEX_BUILD_MANUAL.md', 'checksums.sha256'}",
        "def render_checksums(): return 'checksums\\n'",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(root, "scripts", "build_compiled_manual.py"),
      [
        "from build_checksums import ROOT",
        "OUTPUT = ROOT / 'RITUVIA_CODEX_BUILD_MANUAL.md'",
        "SOURCE_FILES = ['source.md', 'records/INDEX.md']",
        "def render_manual(): return 'manual\\n'",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(root, "scripts", "build_record_index.py"),
      [
        "from types import SimpleNamespace",
        "from build_checksums import ROOT",
        "OUTPUT = ROOT / 'records' / 'INDEX.md'",
        "def records(): return (SimpleNamespace(path='records/tasks/RIT-009.md'),)",
        "def render_index(): return 'index\\n'",
        "",
      ].join("\n"),
    );

    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });

    execFileSync(python, ["-B", "scripts/sync_generated_evidence.py"], { cwd: root });
    expect(await readFile(path.join(root, "events.log"), "utf8")).toBe(
      "write:INDEX.md\nwrite:RITUVIA_CODEX_BUILD_MANUAL.md\nwrite:checksums.sha256\n",
    );

    const outputs = [
      path.join(root, "records", "INDEX.md"),
      path.join(root, "RITUVIA_CODEX_BUILD_MANUAL.md"),
      path.join(root, "checksums.sha256"),
    ];
    const before = await Promise.all(
      outputs.map(async (file) => ({
        content: await readFile(file, "utf8"),
        modified: (await lstat(file)).mtimeMs,
      })),
    );
    execFileSync(
      "git",
      ["add", "records/INDEX.md", "RITUVIA_CODEX_BUILD_MANUAL.md", "checksums.sha256"],
      {
        cwd: root,
      },
    );
    await writeFile(path.join(root, "events.log"), "");
    execFileSync(python, ["-B", "scripts/sync_generated_evidence.py", "--check"], { cwd: root });
    const after = await Promise.all(
      outputs.map(async (file) => ({
        content: await readFile(file, "utf8"),
        modified: (await lstat(file)).mtimeMs,
      })),
    );
    expect(after).toEqual(before);
    expect(await readFile(path.join(root, "events.log"), "utf8")).toBe("");
  });

  it.each(["INDEX.md", "RITUVIA_CODEX_BUILD_MANUAL.md", "checksums.sha256"])(
    "rejects a symlinked generated output before writing: %s",
    async (name) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "rituvia-output-"));
      roots.push(root);
      const target = path.join(root, "target.txt");
      const output = path.join(root, name);
      await writeFile(target, "outside\n");
      await symlink(target, output);
      const result = spawnSync(
        python,
        [
          "-B",
          "-c",
          "import sys; from pathlib import Path; from generated_evidence_io import preflight_output; preflight_output(Path(sys.argv[1]), Path(sys.argv[2]))",
          root,
          output,
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, PYTHONPATH: path.join(repositoryRoot, "scripts") },
        },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("non-symlink");
      expect(await readFile(target, "utf8")).toBe("outside\n");
    },
  );
});
