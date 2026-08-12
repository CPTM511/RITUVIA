import { createHash } from "node:crypto";

const DIRECTION = "from-config-datasource-to-prisma-schema";
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export interface SchemaDriftBaseline {
  direction: typeof DIRECTION;
  normalizedBytes: number;
  normalizedLines: number;
  prismaVersion: string;
  schemaVersion: 1;
  sha256: string;
}

export interface SchemaDriftFingerprint {
  normalizedBytes: number;
  normalizedLines: number;
  sha256: string;
}

const parseBaseline = (value: unknown, expectedPrismaVersion: string): SchemaDriftBaseline => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Schema drift baseline must be an object.");
  }
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "direction",
    "normalizedBytes",
    "normalizedLines",
    "prismaVersion",
    "schemaVersion",
    "sha256",
  ];
  if (Object.keys(record).sort().join("\0") !== [...expectedKeys].sort().join("\0")) {
    throw new Error("Schema drift baseline keys are invalid.");
  }
  if (
    record.schemaVersion !== 1 ||
    record.direction !== DIRECTION ||
    record.prismaVersion !== expectedPrismaVersion ||
    typeof record.sha256 !== "string" ||
    !SHA256_PATTERN.test(record.sha256) ||
    !Number.isSafeInteger(record.normalizedBytes) ||
    Number(record.normalizedBytes) <= 0 ||
    !Number.isSafeInteger(record.normalizedLines) ||
    Number(record.normalizedLines) <= 0
  ) {
    throw new Error("Schema drift baseline values are invalid.");
  }
  return record as unknown as SchemaDriftBaseline;
};

export const normalizeSchemaDriftOutput = (output: string): string => {
  const normalizedNewlines = output.replace(/\r\n?/gu, "\n");
  const firstStatement = normalizedNewlines.indexOf("-- ");
  if (firstStatement < 0) {
    throw new Error("Prisma schema drift output contains no SQL diff.");
  }
  return `${normalizedNewlines.slice(firstStatement).trimEnd()}\n`;
};

export const verifySchemaDriftBaseline = (
  output: string,
  baselineValue: unknown,
  expectedPrismaVersion: string,
): SchemaDriftFingerprint => {
  const baseline = parseBaseline(baselineValue, expectedPrismaVersion);
  const normalized = normalizeSchemaDriftOutput(output);
  const fingerprint = {
    normalizedBytes: Buffer.byteLength(normalized),
    normalizedLines: normalized.split("\n").length - 1,
    sha256: createHash("sha256").update(normalized).digest("hex"),
  };
  if (
    fingerprint.sha256 !== baseline.sha256 ||
    fingerprint.normalizedBytes !== baseline.normalizedBytes ||
    fingerprint.normalizedLines !== baseline.normalizedLines
  ) {
    throw new Error(
      `Schema drift differs from the reviewed baseline: actual bytes=${fingerprint.normalizedBytes} lines=${fingerprint.normalizedLines} sha256=${fingerprint.sha256}.`,
    );
  }
  return Object.freeze(fingerprint);
};
