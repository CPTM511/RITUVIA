import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { auditWebShellBuildArtifacts, verifyWebShellBuild } from "./web-shell-build-policy.mjs";

const requiredArtifacts = [
  "apps/web/.next/BUILD_ID",
  "apps/web/.next/server/app/en.html",
  "apps/web/.next/server/app/en/methodology.html",
  "apps/web/.next/server/app/en/privacy.html",
  "apps/web/.next/server/app/en/safety.html",
  "apps/web/.next/server/app/en/intake.html",
  "apps/web/.next/server/app/en/tarot/one-card.html",
  "apps/web/.next/server/app/en/tarot/three-card.html",
  "apps/web/.next/server/app/icon.svg.body",
  "apps/web/.next/server/app/api/v1/anonymous/session/route.js",
  "apps/web/.next/server/app/api/v1/intake/evaluate/route.js",
  "apps/web/.next/server/app/api/v1/readings/tarot/route.js",
  "apps/web/.next/server/app/api/v1/readings/[readingId]/route.js",
  "apps/web/.next/server/app/api/v1/readings/[readingId]/report/route.js",
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
  "packages/db/dist/tarot-reading-persistence.d.ts",
  "packages/db/dist/tarot-reading-persistence.js",
  "packages/domain/dist/index.d.ts",
  "packages/domain/dist/index.js",
  "packages/domain/dist/identity.d.ts",
  "packages/domain/dist/identity.js",
  "packages/domain/dist/question-intake.d.ts",
  "packages/domain/dist/question-intake.js",
  "packages/domain/dist/tarot-reading.d.ts",
  "packages/domain/dist/tarot-reading.js",
  "packages/domain/dist/tarot-reading-report.d.ts",
  "packages/domain/dist/tarot-reading-report.js",
  "packages/divination/dist/index.d.ts",
  "packages/divination/dist/index.js",
  "packages/divination/dist/tarot-draw.d.ts",
  "packages/divination/dist/tarot-draw.js",
  "packages/divination/dist/tarot-content.d.ts",
  "packages/divination/dist/tarot-content.js",
  "packages/divination/dist/tarot-publication.d.ts",
  "packages/divination/dist/tarot-publication.js",
  "packages/ai/dist/index.d.ts",
  "packages/ai/dist/index.js",
  "packages/ai/dist/interpretation.d.ts",
  "packages/ai/dist/interpretation.js",
  "packages/ai/dist/provider.d.ts",
  "packages/ai/dist/provider.js",
  "packages/ai/dist/prompt.d.ts",
  "packages/ai/dist/prompt.js",
  "packages/ai/dist/retrieval.d.ts",
  "packages/ai/dist/retrieval.js",
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
const icon = await readFile("apps/web/.next/server/app/icon.svg.body");
const auditPrivatePage = async (artifact, expectedPathname) => {
  const html = await readFile(artifact, "utf8");
  const references = [
    ...new Set(
      [...html.matchAll(/\b(?:href|src)="(\/_next\/static\/[^"?#]+)"/gu)].map((match) => match[1]),
    ),
  ];
  const assets = new Map(
    await Promise.all(
      references.map(async (reference) => [
        reference,
        await readFile(`apps/web/.next/${reference.replace(/^\/_next\//u, "")}`),
      ]),
    ),
  );
  return {
    audit: auditWebShellBuildArtifacts({ assets, expectedPathname, html, icon }),
    html,
  };
};
const privateIntake = await auditPrivatePage(
  "apps/web/.next/server/app/en/intake.html",
  "/en/intake",
);
const privateIntakeAudit = privateIntake.audit;
const privateIntakeHtml = privateIntake.html;
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

const privateTarotPages = await Promise.all(
  ["one-card", "three-card"].map(async (mode) => {
    const privateTarot = await auditPrivatePage(
      `apps/web/.next/server/app/en/tarot/${mode}.html`,
      `/en/tarot/${mode}`,
    );
    const { audit, html } = privateTarot;
    if (
      audit.findings.length > 0 ||
      !/<meta\b[^>]*name="robots"[^>]*content="noindex, nofollow"/u.test(html) ||
      /<link\b[^>]*rel="canonical"|<meta\b[^>]*property="og:/u.test(html) ||
      !/<main\b[^>]*id="main-content"/u.test(html) ||
      !/<form\b[^>]*action="\/api\/v1\/readings\/tarot"[^>]*method="post"/u.test(html) ||
      [...html.matchAll(/<input\b[^>]*name="tarot-theme-code"/gu)].length !== 10 ||
      !/<fieldset\b[^>]*disabled/u.test(html) ||
      /rituvia-placeholder|internal-only|auditDigest|entropyDigest|question(?:-|_)text/iu.test(
        html,
      ) ||
      html.includes("__next_error__")
    ) {
      throw new TypeError(
        `Private ${mode} tarot build policy failed: ${audit.findings.join(", ") || "private-contract"}`,
      );
    }
    return privateTarot;
  }),
);
const privateTarotAudits = privateTarotPages.map(({ audit }) => audit);

const domainModule = await import(pathToFileURL(`${process.cwd()}/packages/domain/dist/index.js`));
const databaseModule = await import(pathToFileURL(`${process.cwd()}/packages/db/dist/index.js`));
const divinationModule = await import(
  pathToFileURL(`${process.cwd()}/packages/divination/dist/index.js`)
);
const aiModule = await import(pathToFileURL(`${process.cwd()}/packages/ai/dist/index.js`));
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
  typeof domainModule.parseQuestionIntakeResponse !== "function" ||
  typeof domainModule.parseTarotReadingCreateRequestV1 !== "function" ||
  typeof domainModule.parseTarotReadingReportRequestV1 !== "function" ||
  domainModule.tarotReadingReportSchemaVersion !== "tarot-reading-report.v1" ||
  domainModule.tarotReadingCreateSchemaVersion !== "tarot-reading-create.v1"
) {
  throw new Error("The domain build omitted its anonymous identity and consent contracts.");
}

if (
  typeof divinationModule.parseTarotCatalogV1 !== "function" ||
  typeof divinationModule.assessTarotCatalogPublication !== "function" ||
  typeof divinationModule.assertTarotCatalogPublicationEligible !== "function" ||
  typeof divinationModule.parseTarotDrawExecutionV1 !== "function" ||
  typeof divinationModule.parseTarotDrawFactsV1 !== "function" ||
  typeof divinationModule.parseTarotDrawRequestV1 !== "function" ||
  typeof divinationModule.projectTarotDrawFactsV1 !== "function" ||
  typeof divinationModule.resolveTarotDrawV1 !== "function" ||
  divinationModule.tarotDrawAlgorithmVersion !== "partial-fisher-yates-rejection-uint8.v1" ||
  divinationModule.tarotDrawEngineVersion !== "1.0.0" ||
  divinationModule.tarotCatalogSchemaVersion !== "tarot-catalog.v1"
) {
  throw new TypeError(
    "The divination build omitted its versioned tarot content or draw boundaries.",
  );
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
const tarotDrawFixture = JSON.parse(
  await readFile("packages/divination/test/fixtures/tarot-draw-v1.json", "utf8"),
);
let tarotEntropyOffset = 0;
const tarotDrawExecution = divinationModule.resolveTarotDrawV1({
  catalog: tarotPlaceholder,
  entropy: {
    auditCommitment: () => tarotDrawFixture.execution.audit.entropy.commitment,
    readBytes: (length) => {
      if (length !== 1) throw new TypeError("The compiled draw requested an invalid byte count.");
      const value = tarotDrawFixture.entropyBytes[tarotEntropyOffset];
      tarotEntropyOffset += 1;
      if (!Number.isInteger(value)) {
        throw new TypeError("The compiled draw consumed beyond its fixed entropy vector.");
      }
      return Uint8Array.of(value);
    },
  },
  request: tarotDrawFixture.request,
});
const verifyTarotDrawExecution = (execution) =>
  JSON.stringify(execution) === JSON.stringify(tarotDrawFixture.execution);
const tarotDrawReplay = divinationModule.resolveTarotDrawV1({
  catalog: tarotPlaceholder,
  existingExecution: tarotDrawExecution,
  existingExecutionVerifier: verifyTarotDrawExecution,
  request: tarotDrawFixture.request,
});
const tarotDrawFacts = divinationModule.projectTarotDrawFactsV1(
  tarotDrawExecution,
  verifyTarotDrawExecution,
);
if (
  JSON.stringify(tarotDrawExecution) !== JSON.stringify(tarotDrawFixture.execution) ||
  JSON.stringify(tarotDrawReplay) !== JSON.stringify(tarotDrawExecution) ||
  JSON.stringify(tarotDrawFacts) !== JSON.stringify(tarotDrawFixture.execution.facts) ||
  /audit|commitment|digest|entropy|idempotency/iu.test(JSON.stringify(tarotDrawFacts))
) {
  throw new TypeError("The compiled deterministic tarot draw or public-fact projection drifted.");
}

if (
  typeof aiModule.parseTarotInterpretationInputJsonV1 !== "function" ||
  typeof aiModule.parseTarotInterpretationOutputForInputV1 !== "function" ||
  typeof aiModule.retrieveApprovedTarotContentV1 !== "function" ||
  typeof aiModule.loadApprovedTarotPromptTemplateV1 !== "function" ||
  typeof aiModule.assembleTarotPromptV1 !== "function" ||
  typeof aiModule.isTarotPromptAssemblyV1 !== "function" ||
  typeof aiModule.isInterpretationGenerationAuthorizationV1 !== "function" ||
  aiModule.structuredGenerationProviderSchemaVersion !== "structured-generation-provider.v1" ||
  aiModule.tarotInterpretationInputSchemaVersion !== "tarot-interpretation-input.v1" ||
  aiModule.tarotInterpretationOutputSchemaVersion !== "1" ||
  aiModule.tarotContentRetrievalPolicyVersion !== "tarot-content-retrieval-policy.v1" ||
  aiModule.tarotPromptAssemblyPolicyVersion !== "tarot-prompt-assembly-policy.v1"
) {
  throw new TypeError("The AI build omitted its versioned provider or tarot contracts.");
}
const tarotInterpretationFixture = JSON.parse(
  await readFile("packages/ai/test/fixtures/tarot-interpretation-v1.json", "utf8"),
);
const tarotInterpretationCase = tarotInterpretationFixture.cases[0];
const parsedTarotInterpretationInput = aiModule.parseTarotInterpretationInputJsonV1(
  JSON.stringify(tarotInterpretationCase.input),
);
const parsedTarotInterpretationOutput = aiModule.parseTarotInterpretationOutputForInputV1(
  parsedTarotInterpretationInput,
  JSON.stringify(tarotInterpretationCase.output),
);
if (
  !isDeepStrictEqual(parsedTarotInterpretationInput, tarotInterpretationCase.input) ||
  !isDeepStrictEqual(parsedTarotInterpretationOutput, tarotInterpretationCase.output) ||
  /audit|commitment|digest|entropy|question|journal|intention/iu.test(
    JSON.stringify(parsedTarotInterpretationInput),
  )
) {
  throw new TypeError("The compiled AI tarot contract is invalid or exposes private input.");
}

const placeholderChecksum = `sha256:${createHash("sha256")
  .update(JSON.stringify(parsedTarotPlaceholder), "utf8")
  .digest("hex")}`;
let rejectedUnpublishedRetrieval = false;
try {
  await aiModule.retrieveApprovedTarotContentV1({
    asOf: "2026-07-18",
    authorizeRetrieval: () => true,
    catalogJson: JSON.stringify(tarotPlaceholder),
    requestJson: JSON.stringify({
      catalog: {
        approvalReference: "test.placeholder.not-approved",
        checksum: placeholderChecksum,
        id: parsedTarotPlaceholder.catalogId,
        version: parsedTarotPlaceholder.version,
      },
      deterministicFacts: tarotDrawFacts,
      locale: "en",
      schemaVersion: "tarot-content-retrieval-request.v1",
      themeCode: "open_reflection",
      tradition: "rituvia-original-secular-placeholder",
    }),
    verifyIntegrity: (canonicalJson, expectedChecksum) =>
      `sha256:${createHash("sha256").update(canonicalJson, "utf8").digest("hex")}` ===
      expectedChecksum,
  });
} catch (error) {
  rejectedUnpublishedRetrieval =
    error instanceof aiModule.TarotContentRetrievalError &&
    ["AI_CONTENT_NOT_APPROVED", "AI_CONTENT_REFERENCE_MISMATCH"].includes(error.code);
}
if (!rejectedUnpublishedRetrieval || aiModule.isTarotPromptAssemblyV1({})) {
  throw new TypeError("The compiled AI retrieval or prompt trust boundary is invalid.");
}

if (
  typeof databaseModule.assertDatabaseUrl !== "function" ||
  typeof databaseModule.assertAnonymousIdentityRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createAnonymousIdentityService !== "function" ||
  typeof databaseModule.assertFeatureFlagRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.assertTarotReadingRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createDatabaseClient !== "function" ||
  typeof databaseModule.createTarotReadingPersistence !== "function" ||
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

const privateAudits = [privateIntakeAudit, ...privateTarotAudits];
console.log(
  `Verified ${requiredArtifacts.length} workspace build artifacts and runtime exports; ${webShellBuild.routes.length} public pages and three private experience pages; maximum gzip: HTML ${Math.max(webShellBuild.htmlGzipBytes, ...privateAudits.map(({ htmlGzipBytes }) => htmlGzipBytes))} B, CSS ${Math.max(webShellBuild.cssGzipBytes, ...privateAudits.map(({ cssGzipBytes }) => cssGzipBytes))} B, JS ${Math.max(webShellBuild.javascriptGzipBytes, ...privateAudits.map(({ javascriptGzipBytes }) => javascriptGzipBytes))} B.`,
);
