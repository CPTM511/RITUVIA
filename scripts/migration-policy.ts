import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type MigrationManifest = Readonly<{
  files: Readonly<Record<string, string>>;
  policyVersion: number;
}>;

export type MigrationPolicyFinding = Readonly<{
  path: string;
  rule: string;
}>;

const forbiddenSql: ReadonlyArray<Readonly<{ id: string; pattern: RegExp }>> = Object.freeze([
  { id: "drop-table", pattern: /\bDROP\s+TABLE\b/i },
  {
    id: "drop-database-object",
    pattern:
      /\bDROP\s+(?:SCHEMA|DATABASE|INDEX|VIEW|MATERIALIZED\s+VIEW|TYPE|FUNCTION|SEQUENCE)\b/i,
  },
  { id: "drop-column", pattern: /\bDROP\s+COLUMN\b/i },
  { id: "drop-constraint", pattern: /\bDROP\s+CONSTRAINT\b/i },
  { id: "truncate", pattern: /\bTRUNCATE\b/i },
  { id: "delete-data", pattern: /\bDELETE\s+FROM\b/i },
  { id: "update-data", pattern: /\bUPDATE\s+[^;]+\s+SET\b/i },
  { id: "alter-column-type", pattern: /\bALTER\s+COLUMN\s+[^;]+\s+TYPE\b/i },
  { id: "disable-trigger", pattern: /\bDISABLE\s+TRIGGER\b/i },
  { id: "cascade", pattern: /\bCASCADE\b/i },
  { id: "copy-program", pattern: /\bCOPY\b[^;]*\bPROGRAM\b/i },
  { id: "alter-system", pattern: /\bALTER\s+SYSTEM\b/i },
  {
    id: "role-administration",
    pattern: /\b(?:CREATE|ALTER|DROP)\s+(?:ROLE|USER)\b|\bSET\s+ROLE\b/i,
  },
  { id: "extension-administration", pattern: /\bCREATE\s+EXTENSION\b/i },
  {
    id: "routine-administration",
    pattern: /\b(?:CREATE(?:\s+OR\s+REPLACE)?|ALTER|DROP)\s+(?:FUNCTION|PROCEDURE)\b/i,
  },
  { id: "routine-execution", pattern: /\bCALL\b/i },
  { id: "privilege-administration", pattern: /\b(?:GRANT|REVOKE)\b|\bSECURITY\s+DEFINER\b/i },
  {
    id: "external-database-access",
    pattern: /\b(?:dblink|postgres_fdw|CREATE\s+SERVER|IMPORT\s+FOREIGN\s+SCHEMA)\b/i,
  },
  {
    id: "server-file-access",
    pattern: /\b(?:pg_read_file|pg_write_file|pg_ls_dir|lo_import|lo_export)\s*\(/i,
  },
  { id: "dynamic-procedural-sql", pattern: /\bDO\b|\bEXECUTE\s+/i },
  { id: "ownership-destruction", pattern: /\b(?:REASSIGN|DROP)\s+OWNED\b/i },
]);

const checksum = (content: string): string => createHash("sha256").update(content).digest("hex");

const policySql = (content: string): string =>
  content
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, " ")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");

export const parseMigrationManifest = (value: unknown): MigrationManifest => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Migration manifest must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.policyVersion !== 1 ||
    typeof candidate.files !== "object" ||
    candidate.files === null ||
    Array.isArray(candidate.files)
  ) {
    throw new Error("Migration manifest has an unsupported shape or version.");
  }

  const files = candidate.files as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [filePath, digest] of Object.entries(files)) {
    if (
      !/^migrations\/(?:[0-9]{12,14}_[a-z0-9_]+\/migration\.sql|migration_lock\.toml)$/.test(
        filePath,
      ) ||
      typeof digest !== "string" ||
      !/^[0-9a-f]{64}$/.test(digest)
    ) {
      throw new Error(`Migration manifest entry is invalid: ${filePath}`);
    }
    normalized[filePath] = digest;
  }
  if (Object.keys(normalized).length === 0) {
    throw new Error("Migration manifest must list at least one file.");
  }
  return Object.freeze({ files: Object.freeze(normalized), policyVersion: 1 });
};

export const auditMigrationFiles = (
  files: Readonly<Record<string, string>>,
  manifest: MigrationManifest,
): readonly MigrationPolicyFinding[] => {
  const findings: MigrationPolicyFinding[] = [];
  const actualPaths = Object.keys(files).sort();
  const expectedPaths = Object.keys(manifest.files).sort();

  for (const filePath of actualPaths.filter((entry) => !expectedPaths.includes(entry))) {
    findings.push({ path: filePath, rule: "unlisted-file" });
  }
  for (const filePath of expectedPaths.filter((entry) => !actualPaths.includes(entry))) {
    findings.push({ path: filePath, rule: "missing-file" });
  }
  for (const filePath of actualPaths.filter((entry) => expectedPaths.includes(entry))) {
    const content = files[filePath] ?? "";
    if (checksum(content) !== manifest.files[filePath]) {
      findings.push({ path: filePath, rule: "checksum-mismatch" });
    }
    if (filePath.endsWith("/migration.sql")) {
      const auditableSql = policySql(content);
      for (const rule of forbiddenSql) {
        if (rule.pattern.test(auditableSql)) findings.push({ path: filePath, rule: rule.id });
      }
      if (!/^\s*--[^\n]*\nBEGIN;/i.test(content) || !/COMMIT;\s*$/.test(content)) {
        findings.push({ path: filePath, rule: "transaction-boundary" });
      }
    }
  }
  return Object.freeze(findings);
};

export const auditHistoricalMigrations = (
  currentFiles: Readonly<Record<string, string>>,
  baselineFiles: Readonly<Record<string, string>>,
): readonly MigrationPolicyFinding[] => {
  const findings: MigrationPolicyFinding[] = [];
  for (const [filePath, baselineContent] of Object.entries(baselineFiles)) {
    if (!(filePath in currentFiles)) {
      findings.push({ path: filePath, rule: "historical-file-deleted" });
    } else if (currentFiles[filePath] !== baselineContent) {
      findings.push({ path: filePath, rule: "historical-file-modified" });
    }
  }
  return Object.freeze(findings);
};

export const migrationBaselineFromEvent = (
  eventName: string,
  event: unknown,
): string | undefined => {
  if (eventName === "workflow_dispatch") return "HEAD^1";
  if (typeof event !== "object" || event === null || Array.isArray(event)) return undefined;
  const payload = event as Record<string, unknown>;
  let candidate: unknown;
  if (eventName === "push") {
    candidate = payload.before;
  } else if (eventName === "pull_request") {
    const pullRequest = payload.pull_request;
    if (typeof pullRequest === "object" && pullRequest !== null && !Array.isArray(pullRequest)) {
      const base = (pullRequest as Record<string, unknown>).base;
      if (typeof base === "object" && base !== null && !Array.isArray(base)) {
        candidate = (base as Record<string, unknown>).sha;
      }
    }
  }
  return typeof candidate === "string" &&
    /^[0-9a-f]{40}$/.test(candidate) &&
    !/^0+$/.test(candidate)
    ? candidate
    : undefined;
};

const collectFiles = async (root: string, current = "migrations"): Promise<string[]> => {
  const directory = path.join(root, current);
  const entries = await readdir(directory, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(current, entry.name);
    if (entry.isDirectory()) result.push(...(await collectFiles(root, relativePath)));
    else if (entry.isFile()) result.push(relativePath);
    else result.push(relativePath);
  }
  return result;
};

const readBaselineFiles = (
  repositoryRoot: string,
  baselineRef: string,
): Readonly<Record<string, string>> => {
  const prefix = "packages/db/prisma/";
  const output = execFileSync(
    "git",
    ["ls-tree", "-r", "-z", "--name-only", baselineRef, "--", `${prefix}migrations`],
    { cwd: repositoryRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  const baseline: Record<string, string> = {};
  for (const repositoryPath of output.toString("utf8").split("\0").filter(Boolean).sort()) {
    if (!repositoryPath.startsWith(prefix)) continue;
    const filePath = repositoryPath.slice(prefix.length);
    baseline[filePath] = execFileSync("git", ["show", `${baselineRef}:${repositoryPath}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  }
  return Object.freeze(baseline);
};

export const verifyMigrationPolicy = async (prismaRoot: string): Promise<number> => {
  const manifestPath = path.join(prismaRoot, "migration-manifest.json");
  const manifest = parseMigrationManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const filePaths = await collectFiles(prismaRoot);
  const files: Record<string, string> = {};
  for (const filePath of filePaths) {
    files[filePath] = await readFile(path.join(prismaRoot, filePath), "utf8");
  }
  const repositoryRoot = path.resolve(prismaRoot, "../../..");
  let findings = [...auditMigrationFiles(files, manifest)];
  let baselineRef = "HEAD";
  if (process.env.GITHUB_ACTIONS === "true") {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventName === undefined || eventPath === undefined) {
      findings.push({ path: "migrations", rule: "historical-event-unavailable" });
    } else {
      try {
        baselineRef =
          migrationBaselineFromEvent(eventName, JSON.parse(await readFile(eventPath, "utf8"))) ??
          "";
      } catch {
        baselineRef = "";
      }
      if (baselineRef === "") {
        findings.push({ path: "migrations", rule: "historical-event-invalid" });
      }
    }
  }
  if (baselineRef !== "") {
    try {
      findings = [
        ...findings,
        ...auditHistoricalMigrations(files, readBaselineFiles(repositoryRoot, baselineRef)),
      ];
    } catch {
      findings.push({ path: "migrations", rule: "historical-baseline-unavailable" });
    }
  }
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(
        `Migration policy failure: path=${JSON.stringify(finding.path)} rule=${finding.rule}\n`,
      );
    }
    return 1;
  }
  process.stdout.write(`Migration policy passed for ${filePaths.length} immutable files.\n`);
  return 0;
};
