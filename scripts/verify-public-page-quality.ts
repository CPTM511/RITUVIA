import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { assertPublicPageQuality } from "../packages/content/src/index.js";
import { collectPublicPageQualityInputs } from "./public-page-quality-source.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const inventoryPath = path.join(
  repositoryRoot,
  "content",
  "editorial",
  "public-page-inventory.v1.json",
);
const verificationDate = new Date().toISOString().slice(0, 10);
const records = assertPublicPageQuality(await collectPublicPageQualityInputs(), verificationDate);
const generated = {
  generatedDate: "2026-07-29",
  policyVersion: "rituvia-public-page-quality.v1",
  records,
  schemaVersion: "rituvia-public-page-inventory.v1",
};

if (process.argv.includes("--write")) {
  await writeFile(inventoryPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
} else {
  const actual = JSON.parse(await readFile(inventoryPath, "utf8"));
  if (!isDeepStrictEqual(actual, generated)) {
    throw new Error("Public-page inventory is stale or does not match reviewed source content.");
  }
}

const families = new Set(records.map(({ contentFamily }) => contentFamily));
console.log(
  `Verified ${records.length} public pages across ${families.size} content families with deterministic uniqueness, substance, intent, authority, and exposure evidence.`,
);
