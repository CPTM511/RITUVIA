import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { auditWebShellBuildArtifacts, verifyWebShellBuild } from "./web-shell-build-policy.mjs";

const requiredArtifacts = [
  "apps/web/.next/BUILD_ID",
  "apps/web/.next/server/app/en.html",
  "apps/web/.next/server/app/en/methodology.html",
  "apps/web/.next/server/app/en/privacy.html",
  "apps/web/.next/server/app/en/safety.html",
  "apps/web/.next/server/app/en/intake.html",
  "apps/web/.next/server/app/icon.svg.body",
  "apps/web/.next/server/app/api/v1/anonymous/session/route.js",
  "apps/web/.next/server/app/api/v1/intake/evaluate/route.js",
  "apps/worker/dist/main.js",
  "apps/worker/dist/runtime.d.ts",
  "apps/worker/dist/runtime.js",
  "packages/config/dist/brand.d.ts",
  "packages/config/dist/brand.js",
  "packages/config/dist/client.js",
  "packages/config/dist/feature-flags.d.ts",
  "packages/config/dist/feature-flags.js",
  "packages/config/dist/server.js",
  "packages/db/dist/client.d.ts",
  "packages/db/dist/client.js",
  "packages/db/dist/anonymous-identity.d.ts",
  "packages/db/dist/anonymous-identity.js",
  "packages/db/dist/feature-flags.d.ts",
  "packages/db/dist/feature-flags.js",
  "packages/db/dist/index.d.ts",
  "packages/db/dist/index.js",
  "packages/domain/dist/index.d.ts",
  "packages/domain/dist/index.js",
  "packages/domain/dist/identity.d.ts",
  "packages/domain/dist/identity.js",
  "packages/domain/dist/question-intake.d.ts",
  "packages/domain/dist/question-intake.js",
  "packages/divination/dist/index.d.ts",
  "packages/divination/dist/index.js",
  "packages/divination/dist/tarot-content.d.ts",
  "packages/divination/dist/tarot-content.js",
  "packages/divination/dist/tarot-publication.d.ts",
  "packages/divination/dist/tarot-publication.js",
  "packages/observability/dist/index.d.ts",
  "packages/observability/dist/index.js",
  "packages/observability/dist/worker.d.ts",
  "packages/observability/dist/worker.js",
  "packages/ui/dist/index.d.ts",
  "packages/ui/dist/index.js",
  "packages/ui/dist/styles.css",
  "packages/ui/dist/styles.js",
];

await Promise.all(requiredArtifacts.map((artifact) => access(artifact)));
const webShellBuild = await verifyWebShellBuild(process.cwd());
const privateIntakeHtml = await readFile("apps/web/.next/server/app/en/intake.html", "utf8");
const privateIntakeReferences = [
  ...new Set(
    [...privateIntakeHtml.matchAll(/\b(?:href|src)="(\/_next\/static\/[^"?#]+)"/gu)].map(
      (match) => match[1],
    ),
  ),
];
const privateIntakeAssets = new Map(
  await Promise.all(
    privateIntakeReferences.map(async (reference) => [
      reference,
      await readFile(`apps/web/.next/${reference.replace(/^\/_next\//u, "")}`),
    ]),
  ),
);
const privateIntakeAudit = auditWebShellBuildArtifacts({
  assets: privateIntakeAssets,
  expectedPathname: "/en/intake",
  html: privateIntakeHtml,
  icon: await readFile("apps/web/.next/server/app/icon.svg.body"),
});
if (
  privateIntakeAudit.findings.length > 0 ||
  !/<meta\b[^>]*name="robots"[^>]*content="noindex, nofollow"/u.test(privateIntakeHtml) ||
  /<link\b[^>]*rel="canonical"|<meta\b[^>]*property="og:/u.test(privateIntakeHtml) ||
  !/<main\b[^>]*id="main-content"/u.test(privateIntakeHtml) ||
  !/<form\b[^>]*action="\/api\/v1\/intake\/evaluate"[^>]*method="post"/u.test(privateIntakeHtml) ||
  !/<textarea\b[^>]*(?:maxLength|maxlength)="600"/u.test(privateIntakeHtml) ||
  privateIntakeHtml.includes("__next_error__")
) {
  throw new TypeError(
    `Private intake build policy failed: ${privateIntakeAudit.findings.join(", ") || "private-contract"}`,
  );
}

const domainModule = await import(pathToFileURL(`${process.cwd()}/packages/domain/dist/index.js`));
const databaseModule = await import(pathToFileURL(`${process.cwd()}/packages/db/dist/index.js`));
const divinationModule = await import(
  pathToFileURL(`${process.cwd()}/packages/divination/dist/index.js`)
);
const configBrandModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/brand.js`)
);
const configClientModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/client.js`)
);
const configFeatureFlagModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/feature-flags.js`)
);
const configServerModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/server.js`)
);
const workerModule = await import(pathToFileURL(`${process.cwd()}/apps/worker/dist/runtime.js`));
const observabilityModule = await import(
  pathToFileURL(`${process.cwd()}/packages/observability/dist/index.js`)
);
const observabilityWorkerModule = await import(
  pathToFileURL(`${process.cwd()}/packages/observability/dist/worker.js`)
);
const uiModule = await import(pathToFileURL(`${process.cwd()}/packages/ui/dist/index.js`));

if (
  typeof domainModule.parseAnonymousSubjectId !== "function" ||
  typeof domainModule.parsePersistedAnonymousSessionV1 !== "function" ||
  typeof domainModule.resolveAnonymousSessionState !== "function" ||
  typeof domainModule.allowsConsentPurpose !== "function" ||
  typeof domainModule.evaluateQuestionIntake !== "function" ||
  typeof domainModule.parseQuestionIntakeResponse !== "function"
) {
  throw new Error("The domain build omitted its anonymous identity and consent contracts.");
}

if (
  typeof divinationModule.parseTarotCatalogV1 !== "function" ||
  typeof divinationModule.assessTarotCatalogPublication !== "function" ||
  typeof divinationModule.assertTarotCatalogPublicationEligible !== "function" ||
  divinationModule.tarotCatalogSchemaVersion !== "tarot-catalog.v1"
) {
  throw new TypeError("The divination build omitted its versioned tarot content boundaries.");
}
const tarotPlaceholder = JSON.parse(
  await readFile("content/traditions/tarot/rituvia-placeholder.v1.json", "utf8"),
);
const parsedTarotPlaceholder = divinationModule.parseTarotCatalogV1(tarotPlaceholder);
const tarotPublicationAssessment = divinationModule.assessTarotCatalogPublication(
  parsedTarotPlaceholder,
  "2026-07-17",
);
if (
  parsedTarotPlaceholder.decks.length !== 1 ||
  parsedTarotPlaceholder.decks[0]?.cards.length !== 3 ||
  parsedTarotPlaceholder.cardContents.length !== 6 ||
  tarotPublicationAssessment.eligible ||
  !tarotPublicationAssessment.reasons.includes("PUBLICATION_POLICY_DISABLED")
) {
  throw new TypeError("The rights-safe tarot placeholder build contract is invalid.");
}

if (
  typeof databaseModule.assertDatabaseUrl !== "function" ||
  typeof databaseModule.assertAnonymousIdentityRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createAnonymousIdentityService !== "function" ||
  typeof databaseModule.assertFeatureFlagRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createDatabaseClient !== "function" ||
  typeof databaseModule.readFeatureFlagVersions !== "function"
) {
  throw new TypeError(
    "The database build does not expose its injected, connection-free adapter boundary.",
  );
}

if (typeof workerModule.createWorkerRuntime !== "function") {
  throw new TypeError("The worker build does not export createWorkerRuntime.");
}

if (
  typeof observabilityModule.createObservability !== "function" ||
  typeof observabilityModule.isTraceparent !== "function"
) {
  throw new TypeError("The observability build does not expose its safe runtime boundaries.");
}
if (
  "continueTrustedJob" in observabilityModule ||
  "createJsonLinesSink" in observabilityModule ||
  "isTraceCarrier" in observabilityModule
) {
  throw new TypeError("The observability build exposed a raw sink or trust-ambiguous carrier API.");
}
if (typeof observabilityWorkerModule.continueTrustedJob !== "function") {
  throw new TypeError("The observability worker build omitted its isolated continuation boundary.");
}

if (
  typeof uiModule.ActionLink !== "function" ||
  typeof uiModule.Button !== "function" ||
  typeof uiModule.createLocalActionHref !== "function" ||
  typeof uiModule.resolveThemeMode !== "function"
) {
  throw new TypeError("The UI build does not expose its reviewed primitive and theme contracts.");
}
if (
  (await readFile("packages/ui/dist/styles.css", "utf8")) !==
  (await readFile("packages/ui/src/styles.css", "utf8"))
) {
  throw new TypeError("The UI build stylesheet is absent or differs from its reviewed source.");
}

if (
  typeof configBrandModule.createBrandConfiguration !== "function" ||
  typeof configClientModule.parseClientConfiguration !== "function" ||
  typeof configFeatureFlagModule.createFeatureFlagEvaluator !== "function" ||
  !Array.isArray(configFeatureFlagModule.featureFlagKeys) ||
  configFeatureFlagModule.featureFlagRegistryVersion !== 1 ||
  typeof configServerModule.parseServerConfiguration !== "function"
) {
  throw new TypeError("The config build does not expose its typed runtime boundaries.");
}
if (
  "createFeatureFlagEvaluator" in configServerModule ||
  "parseFeatureFlagSnapshot" in configServerModule
) {
  throw new TypeError(
    "The general server configuration build exposed raw feature-flag construction.",
  );
}
if (
  "createFeatureFlagEvaluator" in configClientModule ||
  "featureFlagKeys" in configClientModule ||
  "featureFlagRegistry" in configClientModule
) {
  throw new TypeError("The client configuration build exposed server-side feature flags.");
}

console.log(
  `Verified ${requiredArtifacts.length} workspace build artifacts and runtime exports; ${webShellBuild.routes.length} public pages and one private intake page; maximum gzip: HTML ${Math.max(webShellBuild.htmlGzipBytes, privateIntakeAudit.htmlGzipBytes)} B, CSS ${Math.max(webShellBuild.cssGzipBytes, privateIntakeAudit.cssGzipBytes)} B, JS ${Math.max(webShellBuild.javascriptGzipBytes, privateIntakeAudit.javascriptGzipBytes)} B.`,
);
