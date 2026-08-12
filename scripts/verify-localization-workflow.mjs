import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = "content/localization/manifest.v1.json";
const maximumFileBytes = 512 * 1024;
const findings = [];

const boundedFile = async (filePath) => {
  const bytes = await readFile(path.join(root, filePath));
  if (bytes.byteLength < 1 || bytes.byteLength > maximumFileBytes) {
    throw new Error(`Localization input is outside the bounded size: ${filePath}`);
  }
  return bytes;
};

const parseJson = async (filePath) => {
  const bytes = await boundedFile(filePath);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`Localization input is not strict UTF-8 JSON: ${filePath}`);
  }
};

const manifest = await parseJson(manifestPath);
if (
  manifest === null ||
  typeof manifest !== "object" ||
  Array.isArray(manifest) ||
  manifest.schemaVersion !== "rituvia-localization-manifest.v1" ||
  !Array.isArray(manifest.files) ||
  manifest.files.length !== 5
) {
  throw new Error("Localization manifest has an invalid exact inventory.");
}

const expectedPaths = [
  "content/localization/rituvia-core-ui.en.v1.json",
  "content/localization/rituvia-core-ui.en.v1.runtime.json",
  "content/localization/rituvia-core-glossary.en.v1.json",
  "content/localization/rituvia-lifecycle-messages.en.v1.json",
  "content/localization/rituvia-lifecycle-messages.en.v1.runtime.json",
];
for (const [index, expectedPath] of expectedPaths.entries()) {
  const entry = manifest.files[index];
  if (
    entry === null ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    Object.keys(entry).sort().join("\u0000") !== ["path", "sha256"].join("\u0000") ||
    entry.path !== expectedPath ||
    typeof entry.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(entry.sha256)
  ) {
    findings.push(`manifest-entry:${expectedPath}`);
    continue;
  }
  const digest = createHash("sha256")
    .update(await boundedFile(expectedPath))
    .digest("hex");
  if (digest !== entry.sha256) findings.push(`checksum:${expectedPath}`);
}

for (const [sourceIndex, runtimeIndex] of [
  [0, 1],
  [3, 4],
]) {
  const sourceCatalog = await parseJson(expectedPaths[sourceIndex]);
  const runtimeCatalog = await parseJson(expectedPaths[runtimeIndex]);
  const sourceManifestEntry = manifest.files[sourceIndex];
  if (
    sourceCatalog === null ||
    typeof sourceCatalog !== "object" ||
    Array.isArray(sourceCatalog) ||
    runtimeCatalog === null ||
    typeof runtimeCatalog !== "object" ||
    Array.isArray(runtimeCatalog) ||
    Object.keys(runtimeCatalog).sort().join("\u0000") !==
      [
        "catalogId",
        "contentType",
        "locale",
        "messages",
        "schemaVersion",
        "sourceChecksum",
        "sourceVersion",
      ]
        .sort()
        .join("\u0000") ||
    runtimeCatalog.schemaVersion !== "rituvia-message-runtime.v1" ||
    runtimeCatalog.catalogId !== sourceCatalog.catalogId ||
    runtimeCatalog.contentType !== sourceCatalog.contentType ||
    runtimeCatalog.locale !== sourceCatalog.locale ||
    runtimeCatalog.sourceVersion !== sourceCatalog.version ||
    runtimeCatalog.sourceChecksum !== sourceManifestEntry.sha256 ||
    runtimeCatalog.messages === null ||
    typeof runtimeCatalog.messages !== "object" ||
    Array.isArray(runtimeCatalog.messages) ||
    sourceCatalog.messages === null ||
    typeof sourceCatalog.messages !== "object" ||
    Array.isArray(sourceCatalog.messages)
  ) {
    findings.push(`runtime-projection:metadata:${expectedPaths[sourceIndex]}`);
    continue;
  }
  const sourceMessages = Object.fromEntries(
    Object.entries(sourceCatalog.messages).map(([key, value]) => [
      key,
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? value.message
        : undefined,
    ]),
  );
  if (
    JSON.stringify(Object.keys(runtimeCatalog.messages).sort()) !==
      JSON.stringify(Object.keys(sourceMessages).sort()) ||
    Object.entries(runtimeCatalog.messages).some(
      ([key, message]) => sourceMessages[key] !== message,
    )
  ) {
    findings.push(`runtime-projection:messages:${expectedPaths[sourceIndex]}`);
  }
}

const reviewedWebFiles = [
  "apps/web/app/_components/account-experience.tsx",
  "apps/web/app/_components/astrology-natal-result.tsx",
  "apps/web/app/_components/public-site-frame.tsx",
  "apps/web/app/_components/sanctuary-flow.tsx",
  "apps/web/app/_components/sanctuary-ritual-experience.tsx",
  "apps/web/app/_components/tarot-one-card-flow.tsx",
  "apps/web/app/_components/tarot-reading-report.tsx",
];
for (const filePath of reviewedWebFiles) {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(await boundedFile(filePath));
  if (/\.replace\(\s*["'`]\{[A-Za-z][A-Za-z0-9]*\}/u.test(source)) {
    findings.push(`manual-placeholder:${filePath}`);
  }
  if (/new Intl\.[A-Za-z]+Format\(\s*["'`]en(?:-[A-Za-z0-9]+)?["'`]/u.test(source)) {
    findings.push(`fixed-english-formatter:${filePath}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Localization workflow boundary failed: ${findings.join(", ")}`);
}

console.log(
  `Verified ${expectedPaths.length} checksummed localization records and ${reviewedWebFiles.length} locale-aware Web files.`,
);
