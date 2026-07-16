import { createHash } from "node:crypto";
import path from "node:path";

export type SecretFinding = Readonly<{
  fingerprint: string;
  line: number;
  path: string;
  rule: string;
}>;

type SecretRule = Readonly<{
  id: string;
  pattern: RegExp;
}>;

const rules: readonly SecretRule[] = Object.freeze([
  {
    id: "private-key",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  },
  {
    id: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g,
  },
  {
    id: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    id: "openai-api-key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "credentialed-database-url",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:/]+:(?!\$\{|PASSWORD@|password@)[^\s@/]{8,}@[^\s]+/g,
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    id: "npm-auth",
    pattern: /(?:_authToken|_password)\s*=\s*(?!\$\{)[^\s]{8,}/gi,
  },
]);

const sensitiveBasenames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
]);

const lineForOffset = (content: string, offset: number): number => {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
};

const fingerprint = (rule: string, filePath: string, line: number): string =>
  createHash("sha256").update(`${rule}\0${filePath}\0${line}`).digest("hex").slice(0, 16);

export const isSensitiveFilePath = (filePath: string): boolean => {
  const normalized = filePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);
  return (
    (basename.startsWith(".env") && basename !== ".env.example") ||
    sensitiveBasenames.has(basename) ||
    /(?:^|\/)(?:credentials|secrets?)\.(?:json|ya?ml)$/i.test(normalized) ||
    /\.(?:key|p12|pfx|pem)$/i.test(basename)
  );
};

export const createSecretFinding = (rule: string, filePath: string, line = 1): SecretFinding => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  return Object.freeze({
    fingerprint: fingerprint(rule, normalizedPath, line),
    line,
    path: normalizedPath,
    rule,
  });
};

export const scanSecretText = (filePath: string, content: string): readonly SecretFinding[] => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const findings: SecretFinding[] = [];

  if (isSensitiveFilePath(normalizedPath)) {
    findings.push(createSecretFinding("sensitive-file", normalizedPath));
  }

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const line = lineForOffset(content, match.index);
      findings.push(createSecretFinding(rule.id, normalizedPath, line));
    }
  }

  return Object.freeze(findings);
};

export const scanSecretBuffer = (
  filePath: string,
  content: Uint8Array,
): readonly SecretFinding[] => {
  const buffer = Buffer.from(content);
  if (buffer.includes(0)) return [createSecretFinding("binary-content", filePath)];
  return scanSecretText(filePath, buffer.toString("utf8"));
};
