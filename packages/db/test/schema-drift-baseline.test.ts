import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeSchemaDriftOutput,
  verifySchemaDriftBaseline,
} from "../scripts/schema-drift-baseline.js";

const baseline = JSON.parse(
  readFileSync(path.resolve("packages/db/prisma/schema-drift-baseline.json"), "utf8"),
) as Record<string, unknown>;
const databasePackage = JSON.parse(
  readFileSync(path.resolve("packages/db/package.json"), "utf8"),
) as { devDependencies?: { prisma?: unknown } };

describe("schema drift baseline", () => {
  it("normalizes Prisma preamble and platform newlines", () => {
    expect(
      normalizeSchemaDriftOutput(
        'Loaded Prisma config\r\n\r\n-- DropIndex\r\nDROP INDEX "example";\r\n\r\n',
      ),
    ).toBe('-- DropIndex\nDROP INDEX "example";\n');
  });

  it("accepts only the exact reviewed fingerprint", () => {
    const output = "-- Reviewed\nSELECT repeat('x', 17599);\n";
    const exactBaseline = {
      direction: "from-config-datasource-to-prisma-schema",
      normalizedBytes: 39,
      normalizedLines: 2,
      prismaVersion: "7.8.0",
      schemaVersion: 1,
      sha256: "9fd1612168b150dc9269cb38d7ea8e7ededb538e8e416a2db37c5d6f8cd995dd",
    };
    expect(verifySchemaDriftBaseline(output, exactBaseline, "7.8.0")).toEqual({
      normalizedBytes: 39,
      normalizedLines: 2,
      sha256: "9fd1612168b150dc9269cb38d7ea8e7ededb538e8e416a2db37c5d6f8cd995dd",
    });
    expect(() => verifySchemaDriftBaseline(`${output}-- Added\n`, exactBaseline, "7.8.0")).toThrow(
      /differs from the reviewed baseline/u,
    );
  });

  it("pins the baseline to the declared Prisma version", () => {
    expect(baseline.prismaVersion).toBe(databasePackage.devDependencies?.prisma);
  });

  it("rejects missing SQL, unknown keys, and version drift", () => {
    expect(() => normalizeSchemaDriftOutput("No difference detected.")).toThrow(
      /contains no SQL diff/u,
    );
    expect(() =>
      verifySchemaDriftBaseline("-- Reviewed\n", { ...baseline, extra: true }, "7.8.0"),
    ).toThrow(/keys are invalid/u);
    expect(() => verifySchemaDriftBaseline("-- Reviewed\n", baseline, "7.9.0")).toThrow(
      /values are invalid/u,
    );
  });
});
