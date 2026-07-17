import { access, readFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
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
  "packages/db/dist/interpretation-generation-persistence.d.ts",
  "packages/db/dist/interpretation-generation-persistence.js",
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
  "packages/ai/dist/generation.d.ts",
  "packages/ai/dist/generation.js",
  "packages/ai/dist/interpretation.d.ts",
  "packages/ai/dist/interpretation.js",
  "packages/ai/dist/provider.d.ts",
  "packages/ai/dist/provider.js",
  "packages/ai/dist/prompt.d.ts",
  "packages/ai/dist/prompt.js",
  "packages/ai/dist/retrieval.d.ts",
  "packages/ai/dist/retrieval.js",
  "packages/ai/dist/safety.d.ts",
  "packages/ai/dist/safety.js",
  "packages/ai/dist/verification.d.ts",
  "packages/ai/dist/verification.js",
  "packages/observability/dist/index.d.ts",
  "packages/observability/dist/index.js",
  "packages/observability/dist/redaction.d.ts",
  "packages/observability/dist/redaction.js",
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
  typeof aiModule.isTarotPromptAssemblyForInputV1 !== "function" ||
  typeof aiModule.isTarotPromptAssemblyForRetrievedContentV1 !== "function" ||
  typeof aiModule.isTarotPromptAssemblyV1 !== "function" ||
  typeof aiModule.loadApprovedTarotFallbackTemplateV1 !== "function" ||
  typeof aiModule.isApprovedTarotFallbackTemplateV1 !== "function" ||
  typeof aiModule.prepareTarotInterpretationGenerationV1 !== "function" ||
  typeof aiModule.executePreparedTarotInterpretationGenerationV1 !== "function" ||
  typeof aiModule.generateTarotInterpretationV1 !== "function" ||
  typeof aiModule.loadApprovedTarotVerificationPolicyV1 !== "function" ||
  typeof aiModule.loadApprovedTarotVerificationRuntimeV1 !== "function" ||
  typeof aiModule.prepareTarotInterpretationVerifierV1 !== "function" ||
  typeof aiModule.verifyTarotInterpretationCandidateV1 !== "function" ||
  typeof aiModule.isTarotInterpretationVerificationResultV1 !== "function" ||
  typeof aiModule.runPreGenerationSafetyGateV1 !== "function" ||
  typeof aiModule.evaluatePreGenerationSafetyV1 !== "function" ||
  typeof aiModule.isPreGenerationSafetyEvaluationV1 !== "function" ||
  typeof aiModule.isInterpretationGenerationAuthorizationV1 !== "function" ||
  aiModule.structuredGenerationProviderSchemaVersion !== "structured-generation-provider.v1" ||
  aiModule.tarotInterpretationInputSchemaVersion !== "tarot-interpretation-input.v1" ||
  aiModule.tarotInterpretationOutputSchemaVersion !== "1" ||
  aiModule.tarotContentRetrievalPolicyVersion !== "tarot-content-retrieval-policy.v1" ||
  aiModule.tarotPromptAssemblyPolicyVersion !== "tarot-prompt-assembly-policy.v1" ||
  aiModule.tarotFallbackTemplateSchemaVersion !== "tarot-fallback-template.v1" ||
  aiModule.tarotGenerationRuntimeSchemaVersion !== "tarot-generation-runtime.v1" ||
  aiModule.tarotGenerationOperationalMetadataSchemaVersion !==
    "tarot-generation-operational-metadata.v1" ||
  aiModule.tarotVerificationPolicySchemaVersion !== "tarot-verification-policy.v1" ||
  aiModule.tarotVerificationRuntimeSchemaVersion !== "tarot-verification-runtime.v1" ||
  aiModule.tarotInterpretationVerificationResultSchemaVersion !==
    "tarot-interpretation-verification-result.v1" ||
  aiModule.preGenerationSafetyPolicyVersion !== "pre-generation-safety.en.v1" ||
  aiModule.preGenerationSafetyIntakePolicyVersion !== "question-intake.en.v1" ||
  aiModule.preGenerationSafetyPolicyAuthoritySchemaVersion !==
    "pre-generation-safety-policy-authority.v1" ||
  typeof aiModule.issuePreGenerationSafetyAuthorizationV1 !== "undefined" ||
  typeof aiModule.issueInterpretationGenerationAuthorizationV1 !== "undefined"
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

const sha256Digest = (value) =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
const isRecursivelyFrozen = (value) =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isRecursivelyFrozen));
const publishSyntheticEditorial = (editorial, suffix) => {
  editorial.status = "published";
  editorial.reviewerRole = editorial.requiredApprovalRole;
  editorial.reviewerId = "test.compiled-content-reviewer";
  editorial.reviewedDate = "2026-07-17";
  editorial.approvalReference = `test:rit-033:${suffix}`;
  editorial.reviewDueDate = "2027-07-18";
};
const generationCatalog = structuredClone(tarotPlaceholder);
generationCatalog.usePolicy = {
  aiRetrievalAllowed: true,
  indexingAllowed: false,
  publicationAllowed: true,
};
generationCatalog.supportedThemeCodes = [...domainModule.questionIntakeThemeCodes];
publishSyntheticEditorial(generationCatalog.editorial, "catalog");
for (const [index, source] of generationCatalog.sources.entries()) {
  publishSyntheticEditorial(source.editorial, `source-${index}`);
  source.rights.status = "owned";
  source.rights.allowedUses = [
    "internal_validation",
    "public_display",
    "commercial_use",
    "derivative_use",
    "translation",
    "ai_retrieval",
  ];
  source.rights.materialTypes = [
    "structural_data",
    "spread_definition",
    "interpretive_text",
    "artwork",
  ];
}
const generationSource = generationCatalog.sources[0];
if (generationSource === undefined) {
  throw new TypeError("The compiled generation catalog source is unavailable.");
}
const generationArtworkSource = {
  id: generationSource.sourceId,
  version: generationSource.version,
};
for (const [index, deck] of generationCatalog.decks.entries()) {
  publishSyntheticEditorial(deck.editorial, `deck-${index}`);
  deck.artworkStatus = "assigned";
  deck.artworkRightsSource = generationArtworkSource;
  for (const card of deck.cards) {
    card.artwork = {
      altText: `Synthetic compiled-build artwork for ${card.title}.`,
      assetId: `test.compiled.${card.cardId}.artwork`,
      credit: "Synthetic RIT-033 compiled-build fixture",
      localizationNotes: "Test-only fixture; never publish.",
      source: generationArtworkSource,
      version: "1.0.0",
    };
  }
}
for (const [index, spread] of generationCatalog.spreads.entries()) {
  publishSyntheticEditorial(spread.editorial, `spread-${index}`);
}
for (const [index, content] of generationCatalog.cardContents.entries()) {
  publishSyntheticEditorial(content.editorial, `content-${index}`);
  content.translationStatus = "source_reviewed";
  content.themeReadings = domainModule.questionIntakeThemeCodes.map((themeCode) => ({
    text: `A bounded synthetic possibility for the ${themeCode.replaceAll("_", " ")} theme.`,
    themeCode,
  }));
}
const parsedGenerationCatalog = divinationModule.parseTarotCatalogV1(generationCatalog);
const generationCatalogChecksum = sha256Digest(JSON.stringify(parsedGenerationCatalog));
const generationFacts = {
  algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
  catalog: { id: parsedGenerationCatalog.catalogId, version: parsedGenerationCatalog.version },
  deck: {
    id: parsedGenerationCatalog.decks[0].deckId,
    version: parsedGenerationCatalog.decks[0].version,
  },
  engineName: "rituvia.tarot-draw",
  engineVersion: "1.0.0",
  method: "tarot",
  orientationPolicy: "upright_and_reversed",
  positions: [
    {
      cardId: "threshold",
      order: 1,
      orientation: "reversed",
      positionId: "perspective",
    },
  ],
  replacementPolicy: "without_replacement",
  rulesVersion: "tarot-draw-rules.v1",
  schemaVersion: "tarot-draw-facts.v1",
  spread: { id: "one-card-perspective", version: "1.0.0" },
};
const generationContent = await aiModule.retrieveApprovedTarotContentV1({
  asOf: "2026-07-18",
  authorizeRetrieval: () => true,
  catalogJson: JSON.stringify(generationCatalog),
  requestJson: JSON.stringify({
    catalog: {
      approvalReference: generationCatalog.editorial.approvalReference,
      checksum: generationCatalogChecksum,
      id: parsedGenerationCatalog.catalogId,
      version: parsedGenerationCatalog.version,
    },
    deterministicFacts: generationFacts,
    locale: "en",
    schemaVersion: aiModule.tarotContentRetrievalRequestSchemaVersion,
    themeCode: "open_reflection",
    tradition: "rituvia-original-secular-placeholder",
  }),
  verifyIntegrity: (canonicalJson, expectedChecksum) =>
    sha256Digest(canonicalJson) === expectedChecksum,
});
const generationPromptTemplate = {
  allowedTones: ["concise", "gentle", "grounded", "poetic-light"],
  approvalReference: "test:rit-033:prompt",
  authorId: "test.compiled-prompt-author",
  effectiveDate: "2026-07-18",
  evaluationVersion: "1.0.0",
  instructions: [...aiModule.tarotPromptMandatoryInstructions],
  locale: "en",
  modality: "tarot",
  outputSchema: {
    checksum: sha256Digest("tarot-interpretation-output-schema-v1"),
    id: "tarot.interpretation.output",
    version: aiModule.tarotInterpretationOutputSchemaVersion,
  },
  promptId: "test.compiled.tarot.reflective.en",
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewerId: "test.compiled-prompt-reviewer",
  reviewerRole: "ai_safety",
  schemaVersion: aiModule.tarotPromptTemplateSchemaVersion,
  status: "approved",
  toneInstructions: {
    concise: "Be brief while preserving every required boundary.",
    gentle: "Use calm, nonjudgmental, autonomy-supporting language.",
    grounded: "Prefer concrete observations and practical reflection.",
    "poetic-light": "Use restrained imagery without supernatural authority.",
  },
  tradition: "rituvia-original-secular-placeholder",
  version: "1.0.0",
};
const generationPromptRegistration = {
  approvalReference: generationPromptTemplate.approvalReference,
  checksum: sha256Digest(JSON.stringify(generationPromptTemplate)),
  id: generationPromptTemplate.promptId,
  version: generationPromptTemplate.version,
};
const generationPrompt = await aiModule.loadApprovedTarotPromptTemplateV1({
  asOf: "2026-07-18",
  authorizePrompt: () => true,
  registration: generationPromptRegistration,
  templateJson: JSON.stringify(generationPromptTemplate),
  verifyIntegrity: (canonicalJson, expectedChecksum) =>
    sha256Digest(canonicalJson) === expectedChecksum,
});
const generationRequestId = "33333333-3333-4333-8333-333333333333";
const generationInput = aiModule.parseTarotInterpretationInputJsonV1(
  JSON.stringify({
    approvedContent: generationContent.approvedContent,
    approvedRitualTemplateCodes: ["free.candle.v1"],
    deterministicFacts: generationContent.deterministicFacts,
    locale: generationContent.locale,
    modality: "tarot",
    prompt: {
      checksum: generationPrompt.checksum,
      id: generationPrompt.promptId,
      version: generationPrompt.version,
    },
    readingType: generationContent.readingType,
    requestId: generationRequestId,
    safetyDecision: {
      policyVersion: aiModule.preGenerationSafetyPolicyVersion,
      route: "allowed",
      schemaVersion: "interpretation-safety-decision.v1",
    },
    schemaVersion: aiModule.tarotInterpretationInputSchemaVersion,
    themeCode: generationContent.themeCode,
    tone: "grounded",
  }),
);
const generationPromptAssembly = aiModule.assembleTarotPromptV1(
  generationInput,
  generationContent,
  generationPrompt,
);
if (
  !aiModule.isTarotPromptAssemblyForInputV1(generationPromptAssembly, generationInput) ||
  !aiModule.isTarotPromptAssemblyForRetrievedContentV1(generationPromptAssembly, generationContent)
) {
  throw new TypeError("The compiled generation prompt identity binding is invalid.");
}
const generationFallbackTemplateJson = JSON.stringify({
  approvalReference: "test:rit-033:fallback",
  authorId: "test.compiled-fallback-author",
  copy: {
    boundaryNote: "This is a bounded symbolic reflection, not a prediction.",
    smallActionRationale: "A small reversible action can support reflection without certainty.",
    summary: "The published symbols offer a bounded perspective for reflection.",
    timeHorizon: "today",
    title: "A bounded reflective perspective",
  },
  effectiveDate: "2026-07-18",
  evaluationVersion: "1.0.0",
  fallbackId: "test.compiled.tarot.fallback.en",
  locale: "en",
  modality: "tarot",
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewerId: "test.compiled-fallback-reviewer",
  reviewerRole: "ai_safety",
  schemaVersion: aiModule.tarotFallbackTemplateSchemaVersion,
  status: "approved",
  tradition: "rituvia-original-secular-placeholder",
  version: "1.0.0",
});
const generationFallbackRegistration = {
  approvalReference: "test:rit-033:fallback",
  checksum: sha256Digest(generationFallbackTemplateJson),
  id: "test.compiled.tarot.fallback.en",
  version: "1.0.0",
};
const generationFallbackTemplate = await aiModule.loadApprovedTarotFallbackTemplateV1({
  asOf: "2026-07-18",
  authorizeFallback: () => true,
  outputSchema: generationPromptAssembly.provenance.outputSchema,
  registration: generationFallbackRegistration,
  templateJson: generationFallbackTemplateJson,
  verifyIntegrity: (canonicalJson, expectedChecksum) =>
    sha256Digest(canonicalJson) === expectedChecksum,
});
if (!aiModule.isApprovedTarotFallbackTemplateV1(generationFallbackTemplate)) {
  throw new TypeError("The compiled generation fallback trust boundary is invalid.");
}

let safetyContinuationCalls = 0;
const crisisSafetyGate = await aiModule.runPreGenerationSafetyGateV1(
  {
    asOf: "2026-07-18",
    readingType: "one_card",
    requestId: "32222222-2222-4222-8222-222222222222",
    requestJson: JSON.stringify({
      locale: "en",
      question: "I am planning to end my life.",
      schemaVersion: "1",
      themeCode: "grief",
    }),
  },
  () => {
    safetyContinuationCalls += 1;
    return "must-not-run";
  },
);
if (
  crisisSafetyGate.status !== "stopped" ||
  crisisSafetyGate.evaluation.route !== "crisis" ||
  crisisSafetyGate.evaluation.canContinue ||
  safetyContinuationCalls !== 0 ||
  aiModule.isPreGenerationSafetyEvaluationV1({ ...crisisSafetyGate.evaluation }) ||
  JSON.stringify(crisisSafetyGate).includes("planning to end my life")
) {
  throw new TypeError("The compiled pre-generation crisis boundary is invalid.");
}

const allowedSafetyGate = await aiModule.runPreGenerationSafetyGateV1(
  {
    asOf: "2026-07-18",
    authorizePolicy: () => true,
    policyApprovalReference: "test:rit-032:policy",
    readingType: "one_card",
    requestId: "32333333-3333-4333-8333-333333333333",
    requestJson: JSON.stringify({
      locale: "en",
      schemaVersion: "1",
      themeCode: "open_reflection",
    }),
  },
  ({ authorization }) => {
    safetyContinuationCalls += 1;
    return aiModule.isInterpretationGenerationAuthorizationV1(authorization, {
      intakePolicyVersion: "question-intake.en.v1",
      locale: "en",
      modality: "tarot",
      policyApprovalReference: "test:rit-032:policy",
      readingType: "one_card",
      requestId: "32333333-3333-4333-8333-333333333333",
      safetyPolicyVersion: "pre-generation-safety.en.v1",
      themeCode: "open_reflection",
    });
  },
);
if (
  allowedSafetyGate.status !== "continued" ||
  allowedSafetyGate.value !== true ||
  safetyContinuationCalls !== 1
) {
  throw new TypeError("The compiled pre-generation allowed boundary is invalid.");
}

const generationSafetyGate = await aiModule.runPreGenerationSafetyGateV1(
  {
    asOf: "2026-07-18",
    authorizePolicy: () => true,
    policyApprovalReference: "test:rit-033:generation-safety-policy",
    readingType: generationInput.readingType,
    requestId: generationRequestId,
    requestJson: JSON.stringify({
      locale: generationInput.locale,
      schemaVersion: "1",
      themeCode: generationInput.themeCode,
    }),
  },
  (context) => context,
);
if (
  generationSafetyGate.status !== "continued" ||
  !aiModule.isInterpretationGenerationAuthorizationV1(generationSafetyGate.value.authorization, {
    intakePolicyVersion: aiModule.preGenerationSafetyIntakePolicyVersion,
    locale: generationInput.locale,
    modality: "tarot",
    policyApprovalReference: "test:rit-033:generation-safety-policy",
    readingType: generationInput.readingType,
    requestId: generationRequestId,
    safetyPolicyVersion: aiModule.preGenerationSafetyPolicyVersion,
    themeCode: generationInput.themeCode,
  })
) {
  throw new TypeError("The compiled generation authorization binding is invalid.");
}
const generationContinuation = generationSafetyGate.value;

const generationRuntime = Object.freeze({
  approvalReference: "test:rit-033:runtime",
  attemptTimeoutMs: 500,
  currencyCode: "USD",
  eligibilityAsOf: "2026-07-18",
  fallbackTemplate: Object.freeze({ ...generationFallbackRegistration }),
  maximumAttempts: 2,
  maximumEstimatedCostMicros: 1_000,
  maxOutputTokens: 1_200,
  model: Object.freeze({ id: "test.compiled.model", version: "1.0.0" }),
  outputSchema: generationPromptAssembly.provenance.outputSchema,
  prompt: generationPromptAssembly.prompt,
  provider: Object.freeze({ id: "test.compiled.provider", version: "1.0.0" }),
  retryDelayMs: 0,
  schemaVersion: aiModule.tarotGenerationRuntimeSchemaVersion,
  totalTimeoutMs: 1_000,
});
const authorizeGenerationRuntime = (authority) =>
  Object.isFrozen(authority) &&
  authority.schemaVersion === aiModule.tarotGenerationAuthoritySchemaVersion &&
  isDeepStrictEqual(authority.registration, generationRuntime);
const generationProviderOutputJson = JSON.stringify({
  boundaryNote: "This synthetic provider result is a symbolic possibility, not a prediction.",
  perspectives: generationContent.positions.map(({ themeReading }) => themeReading),
  reflectionQuestions: generationContent.positions.flatMap(
    ({ reflectionQuestions }) => reflectionQuestions,
  ),
  safety: {
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  },
  schemaVersion: aiModule.tarotInterpretationOutputSchemaVersion,
  smallAction: {
    label: generationContent.positions[0].smallActions[0],
    rationale: "A reversible observation can support reflection without claiming certainty.",
    timeHorizon: "today",
  },
  sourceRefs: generationInput.approvedContent.map(({ sourceRef }) => sourceRef),
  summary: "The synthetic provider result offers one bounded lens on the published symbols.",
  symbols: generationContent.positions.map((position) => ({
    factRef: position.factRef,
    limitation: position.cannotDetermine,
    meaning: position.themeReading,
    possibility: position.constructivePossibilities[0],
  })),
  title: "A synthetic bounded lens",
});
const generationProviderSuccess = Object.freeze({
  finishReason: "stop",
  outputJson: generationProviderOutputJson,
  status: "succeeded",
  usage: Object.freeze({
    estimatedCost: Object.freeze({ amountMicros: 12, currencyCode: "USD" }),
    inputTokens: 30,
    outputTokens: 60,
    totalTokens: 90,
  }),
});
const createCompiledCancellation = () =>
  Object.freeze({
    aborted: false,
    subscribe: () => () => undefined,
  });
const settledGenerationRunner = Object.freeze({
  run: async ({ attempt, operation }) =>
    Object.freeze({
      elapsedMs: 1,
      status: "settled",
      value: await operation(
        Object.freeze({
          attempt,
          attemptId: `test.compiled-attempt-${attempt}`,
          cancellation: createCompiledCancellation(),
        }),
      ),
    }),
  wait: async () => Object.freeze({ elapsedMs: 0, status: "settled" }),
});
const compiledProviderDescriptor = Object.freeze({
  capabilities: Object.freeze(["structured_generation", "usage_reporting"]),
  provider: generationRuntime.provider,
  schemaVersion: aiModule.structuredGenerationProviderSchemaVersion,
});

let forgedBindingProviderCalls = 0;
const forgedBindingProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: async () => {
    forgedBindingProviderCalls += 1;
    return generationProviderSuccess;
  },
});
const commonGenerationInput = Object.freeze({
  authorizeRuntime: authorizeGenerationRuntime,
  continuation: generationContinuation,
  fallbackTemplate: generationFallbackTemplate,
  input: generationInput,
  prompt: generationPromptAssembly,
  provider: forgedBindingProvider,
  retrievedContent: generationContent,
  runtime: generationRuntime,
});
const separatelyParsedGenerationInput = aiModule.parseTarotInterpretationInputJsonV1(
  JSON.stringify(generationInput),
);
let rejectedForgedGenerationBinding = false;
try {
  await aiModule.generateTarotInterpretationV1({
    ...commonGenerationInput,
    input: separatelyParsedGenerationInput,
    mode: "provider_with_fallback",
    provider: forgedBindingProvider,
    runner: settledGenerationRunner,
  });
} catch (error) {
  rejectedForgedGenerationBinding =
    error instanceof aiModule.TarotGenerationError &&
    error.code === "AI_GENERATION_BINDING_MISMATCH";
}
if (!rejectedForgedGenerationBinding || forgedBindingProviderCalls !== 0) {
  throw new TypeError("The compiled generation identity boundary is forgeable.");
}

let retryProviderCalls = 0;
const retryProviderRequests = [];
const retryProviderContexts = [];
const retryProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: async (request, context) => {
    retryProviderCalls += 1;
    retryProviderRequests.push(request);
    retryProviderContexts.push(context);
    return retryProviderCalls === 1
      ? Object.freeze({
          code: "rate_limited",
          retryable: false,
          status: "failed",
        })
      : generationProviderSuccess;
  },
});
const candidateGeneration = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "provider_with_fallback",
  provider: retryProvider,
  runner: settledGenerationRunner,
});
if (
  retryProviderCalls !== 2 ||
  retryProviderRequests.length !== 2 ||
  retryProviderRequests[0] !== retryProviderRequests[1] ||
  retryProviderRequests[0]?.requestId !== generationRequestId ||
  !Object.isFrozen(retryProviderRequests[0]) ||
  retryProviderContexts.map(({ attempt }) => attempt).join(",") !== "1,2" ||
  candidateGeneration.status !== "pending_verification" ||
  candidateGeneration.displayable !== false ||
  candidateGeneration.metadata.attemptCount !== 2 ||
  candidateGeneration.metadata.retryReason !== "rate_limited" ||
  candidateGeneration.metadata.failureCode !== null ||
  Object.hasOwn(candidateGeneration, "output")
) {
  throw new TypeError("The compiled bounded retry or candidate boundary is invalid.");
}

const runCompiledTerminalProviderFailure = async (code, retryable) => {
  let providerCalls = 0;
  const provider = Object.freeze({
    descriptor: compiledProviderDescriptor,
    generateStructured: async () => {
      providerCalls += 1;
      return Object.freeze({ code, retryable, status: "failed" });
    },
  });
  const result = await aiModule.generateTarotInterpretationV1({
    ...commonGenerationInput,
    mode: "provider_with_fallback",
    provider,
    runner: settledGenerationRunner,
  });
  return Object.freeze({ providerCalls, result });
};
const configurationFailure = await runCompiledTerminalProviderFailure("configuration", false);
const invalidRequestFailure = await runCompiledTerminalProviderFailure("invalid_request", true);
const unknownFailure = await runCompiledTerminalProviderFailure("unknown", true);
for (const [expectedCode, failure] of [
  ["configuration", configurationFailure],
  ["invalid_request", invalidRequestFailure],
  ["unknown", unknownFailure],
]) {
  if (
    failure.providerCalls !== 1 ||
    failure.result.status !== "failed" ||
    failure.result.displayable !== false ||
    Object.hasOwn(failure.result, "output") ||
    failure.result.metadata.result !== "failed" ||
    failure.result.metadata.failureCode !== expectedCode ||
    failure.result.metadata.retryReason !== null ||
    failure.result.metadata.attemptCount !== 1 ||
    failure.result.metadata.tokenStatus !== "unavailable" ||
    failure.result.metadata.costStatus !== "unavailable" ||
    !isRecursivelyFrozen(failure.result) ||
    JSON.stringify(failure.result).includes(generationFallbackTemplate.copy.title)
  ) {
    throw new TypeError("The compiled provider configuration failure was disguised as a fallback.");
  }
}

let rejectedProviderCalls = 0;
const rejectedProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: async () => {
    rejectedProviderCalls += 1;
    throw new Error("private-canary synthetic provider rejection");
  },
});
const rejectedProviderFailure = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "provider_with_fallback",
  provider: rejectedProvider,
  runner: settledGenerationRunner,
});
if (
  rejectedProviderCalls !== 1 ||
  rejectedProviderFailure.status !== "failed" ||
  rejectedProviderFailure.displayable !== false ||
  Object.hasOwn(rejectedProviderFailure, "output") ||
  rejectedProviderFailure.metadata.result !== "failed" ||
  rejectedProviderFailure.metadata.failureCode !== "unknown" ||
  rejectedProviderFailure.metadata.retryReason !== null ||
  rejectedProviderFailure.metadata.attemptCount !== 1 ||
  !isRecursivelyFrozen(rejectedProviderFailure) ||
  JSON.stringify(rejectedProviderFailure).includes("private-canary") ||
  JSON.stringify(rejectedProviderFailure).includes(generationFallbackTemplate.copy.title)
) {
  throw new TypeError("The compiled rejected provider promise escaped the failed boundary.");
}

const safeOffPreparedGeneration =
  await aiModule.prepareTarotInterpretationGenerationV1(commonGenerationInput);
if (
  safeOffPreparedGeneration.schemaVersion !== "prepared-tarot-interpretation-generation.v1" ||
  !Object.isFrozen(safeOffPreparedGeneration) ||
  /messages|outputJson|providerOutput|question|journal|birth|email|session/iu.test(
    JSON.stringify(safeOffPreparedGeneration.provenance),
  )
) {
  throw new TypeError("The compiled safe-off preparation boundary is invalid.");
}
const fallbackGenerationOne = await aiModule.executePreparedTarotInterpretationGenerationV1({
  mode: "fallback_only",
  prepared: safeOffPreparedGeneration,
});
const fallbackGenerationTwo = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "fallback_only",
});
if (
  fallbackGenerationOne.status !== "fallback" ||
  fallbackGenerationOne.displayable !== true ||
  fallbackGenerationOne.metadata.attemptCount !== 0 ||
  fallbackGenerationOne.metadata.failureCode !== "aborted" ||
  forgedBindingProviderCalls !== 0 ||
  !isDeepStrictEqual(fallbackGenerationOne, fallbackGenerationTwo) ||
  !isDeepStrictEqual(
    aiModule.parseTarotInterpretationOutputForInputV1(
      generationInput,
      JSON.stringify(fallbackGenerationOne.output),
    ),
    fallbackGenerationOne.output,
  )
) {
  throw new TypeError("The compiled deterministic fallback boundary is invalid.");
}

const verificationHmac = (canonicalJson) =>
  `hmac-sha256:${createHmac("sha256", "rit-034-compiled-build-only-key")
    .update(canonicalJson, "utf8")
    .digest("hex")}`;
const verificationPolicyRaw = Object.freeze({
  approvalReference: "test:rit-034:compiled-verification-policy",
  authorId: "test.compiled-verification-policy-author",
  checks: Object.freeze([...aiModule.tarotVerificationCheckCodes]),
  effectiveDate: "2026-07-18",
  evaluationVersion: "1.0.0",
  locale: "en",
  maximumAggregateTextBytes: 65_536,
  modality: "tarot",
  normalization: "NFKC",
  policyId: "test.compiled.tarot.verification.en",
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewerId: "test.compiled-verification-policy-reviewer",
  reviewerRole: "ai_safety",
  schemaVersion: aiModule.tarotVerificationPolicySchemaVersion,
  status: "approved",
  tradition: generationContent.tradition,
  version: "1.0.0",
});
const verificationPolicyRegistration = Object.freeze({
  approvalReference: verificationPolicyRaw.approvalReference,
  checksum: sha256Digest(JSON.stringify(verificationPolicyRaw)),
  id: verificationPolicyRaw.policyId,
  version: verificationPolicyRaw.version,
});
const verificationPolicy = await aiModule.loadApprovedTarotVerificationPolicyV1({
  asOf: "2026-07-18",
  authorizePolicy: () => true,
  policyJson: JSON.stringify(verificationPolicyRaw),
  registration: verificationPolicyRegistration,
  verifyIntegrity: (canonicalJson, checksum) => sha256Digest(canonicalJson) === checksum,
});
const verificationReviewerRegistration = Object.freeze({
  approvalReference: "test:rit-034:compiled-semantic-reviewer",
  checksum: sha256Digest("compiled-semantic-reviewer-v1"),
  id: "test.compiled.tarot.semantic-reviewer",
  version: "1.0.0",
});
const verificationReviewerPolicyRegistration = Object.freeze({
  approvalReference: "test:rit-034:compiled-semantic-review-policy",
  checksum: sha256Digest("compiled-semantic-review-policy-v1"),
  id: "test.compiled.tarot.semantic-review-policy",
  version: "1.0.0",
});
const verificationReviewerProvider = Object.freeze({
  id: "test.compiled.reviewer-provider",
  version: "1.0.0",
});
const verificationReviewerModel = Object.freeze({
  id: "test.compiled.reviewer-model",
  version: "1.0.0",
});
const verificationRuntimeRaw = Object.freeze({
  approvalReference: "test:rit-034:compiled-verification-runtime",
  authorId: "test.compiled-verification-runtime-author",
  effectiveDate: "2026-07-18",
  evaluationVersion: "1.0.0",
  locale: "en",
  modality: "tarot",
  model: verificationReviewerModel,
  policy: verificationPolicyRegistration,
  provider: verificationReviewerProvider,
  requiredApprovalRole: "ai_safety",
  reviewDueDate: "2027-07-18",
  reviewedDate: "2026-07-17",
  reviewer: verificationReviewerRegistration,
  reviewerId: "test.compiled-verification-runtime-reviewer",
  reviewerPolicy: verificationReviewerPolicyRegistration,
  reviewerResultMaximumBytes: 8_192,
  reviewerRole: "ai_safety",
  reviewerTimeoutMs: 1_000,
  runtimeId: "test.compiled.tarot.verification-runtime.en",
  schemaVersion: aiModule.tarotVerificationRuntimeSchemaVersion,
  status: "approved",
  tradition: generationContent.tradition,
  version: "1.0.0",
});
const verificationRuntimeRegistration = Object.freeze({
  approvalReference: verificationRuntimeRaw.approvalReference,
  checksum: sha256Digest(JSON.stringify(verificationRuntimeRaw)),
  id: verificationRuntimeRaw.runtimeId,
  version: verificationRuntimeRaw.version,
});
const verificationRuntime = await aiModule.loadApprovedTarotVerificationRuntimeV1({
  asOf: "2026-07-18",
  authorizeRuntime: () => true,
  policy: verificationPolicy,
  registration: verificationRuntimeRegistration,
  runtimeJson: JSON.stringify(verificationRuntimeRaw),
  verifyIntegrity: (canonicalJson, checksum) => sha256Digest(canonicalJson) === checksum,
});
let verificationReviewerCalls = 0;
const verificationReviewer = Object.freeze({
  descriptor: Object.freeze({
    model: verificationReviewerModel,
    policy: Object.freeze({
      checksum: verificationReviewerPolicyRegistration.checksum,
      id: verificationReviewerPolicyRegistration.id,
      version: verificationReviewerPolicyRegistration.version,
    }),
    provider: verificationReviewerProvider,
    reviewer: Object.freeze({
      checksum: verificationReviewerRegistration.checksum,
      id: verificationReviewerRegistration.id,
      version: verificationReviewerRegistration.version,
    }),
    schemaVersion: aiModule.tarotSemanticReviewerSchemaVersion,
  }),
  review: async (reviewRequest) => {
    verificationReviewerCalls += 1;
    return JSON.stringify({
      candidateDigest: reviewRequest.candidateDigest,
      checks: aiModule.tarotVerificationCheckCodes.map((code) => ({ code, status: "safe" })),
      schemaVersion: aiModule.tarotSemanticReviewResultSchemaVersion,
      verdict: "safe",
    });
  },
});
const settledVerificationRunner = Object.freeze({
  run: async ({ operation }) =>
    Object.freeze({
      elapsedMs: 1,
      status: "settled",
      value: await operation(
        Object.freeze({
          attemptId: "test.compiled-verification-attempt-1",
          cancellation: createCompiledCancellation(),
        }),
      ),
    }),
});
const preparedVerifier = aiModule.prepareTarotInterpretationVerifierV1({
  digest: verificationHmac,
  generationProvider: generationRuntime.provider,
  policy: verificationPolicy,
  reviewer: verificationReviewer,
  runner: settledVerificationRunner,
  runtime: verificationRuntime,
  verifyDigest: (canonicalJson, digest) => verificationHmac(canonicalJson) === digest,
});
const authorizeVerificationCandidate = (authority) =>
  Object.isFrozen(authority) &&
  authority.schemaVersion === aiModule.tarotVerificationCandidateAuthoritySchemaVersion &&
  isDeepStrictEqual(authority.policy, preparedVerifier.policy) &&
  isDeepStrictEqual(authority.runtime, preparedVerifier.runtime);
const generationCallsBeforeSafeVerification = retryProviderCalls;
const expectedSafeVerificationOutput = aiModule.parseTarotInterpretationOutputForInputV1(
  generationInput,
  generationProviderOutputJson,
);
const safeVerification = await aiModule.verifyTarotInterpretationCandidateV1({
  authorizeCandidate: authorizeVerificationCandidate,
  candidate: candidateGeneration,
  verifier: preparedVerifier,
});

const unsafeOutput = JSON.parse(generationProviderOutputJson);
unsafeOutput.summary = "This guarantees a wealthy outcome.";
let unsafeProviderCalls = 0;
const unsafeProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: async () => {
    unsafeProviderCalls += 1;
    return Object.freeze({
      ...generationProviderSuccess,
      outputJson: JSON.stringify(unsafeOutput),
    });
  },
});
const unsafeCandidate = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "provider_with_fallback",
  provider: unsafeProvider,
  runner: settledGenerationRunner,
});
if (unsafeCandidate.status !== "pending_verification" || Object.hasOwn(unsafeCandidate, "output")) {
  throw new TypeError("The compiled unsafe candidate was not issued for verification.");
}
const unsafeVerification = await aiModule.verifyTarotInterpretationCandidateV1({
  authorizeCandidate: authorizeVerificationCandidate,
  candidate: unsafeCandidate,
  verifier: preparedVerifier,
});
const serializedVerificationEvidence = JSON.stringify({
  safe: { metadata: safeVerification.metadata, provenance: safeVerification.provenance },
  unsafe: { metadata: unsafeVerification.metadata, provenance: unsafeVerification.provenance },
});
if (
  safeVerification.status !== "verified" ||
  unsafeVerification.status !== "safe_replacement" ||
  !safeVerification.displayable ||
  !unsafeVerification.displayable ||
  !aiModule.isTarotInterpretationVerificationResultV1(safeVerification) ||
  !aiModule.isTarotInterpretationVerificationResultV1(unsafeVerification) ||
  !isRecursivelyFrozen(safeVerification) ||
  !isRecursivelyFrozen(unsafeVerification) ||
  !isDeepStrictEqual(safeVerification.output, expectedSafeVerificationOutput) ||
  !isDeepStrictEqual(unsafeVerification.output, fallbackGenerationOne.output) ||
  retryProviderCalls !== generationCallsBeforeSafeVerification ||
  unsafeProviderCalls !== 1 ||
  verificationReviewerCalls !== 1 ||
  safeVerification.provenance.candidateDigest === unsafeVerification.provenance.candidateDigest ||
  !/^hmac-sha256:[0-9a-f]{64}$/u.test(safeVerification.provenance.candidateDigest) ||
  !/^hmac-sha256:[0-9a-f]{64}$/u.test(safeVerification.provenance.outputDigest) ||
  serializedVerificationEvidence.includes(generationRequestId) ||
  serializedVerificationEvidence.includes(generationProviderOutputJson) ||
  /private-canary|question|journal|birth|email|session|reading(?:Id|_id)|raw|error|exception/iu.test(
    serializedVerificationEvidence,
  )
) {
  throw new TypeError("The compiled post-generation verification boundary is invalid.");
}

let unavailableProviderCalls = 0;
const unavailableProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: async () => {
    unavailableProviderCalls += 1;
    return Object.freeze({ code: "unavailable", retryable: false, status: "failed" });
  },
});
const unavailableFallback = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "provider_with_fallback",
  provider: unavailableProvider,
  runner: settledGenerationRunner,
});
if (
  unavailableProviderCalls !== 2 ||
  unavailableFallback.status !== "fallback" ||
  unavailableFallback.displayable !== true ||
  !Object.hasOwn(unavailableFallback, "output") ||
  unavailableFallback.metadata.result !== "fallback" ||
  unavailableFallback.metadata.failureCode !== "unavailable" ||
  unavailableFallback.metadata.retryReason !== "unavailable" ||
  unavailableFallback.metadata.attemptCount !== 2 ||
  !isDeepStrictEqual(unavailableFallback.output, fallbackGenerationOne.output) ||
  !isDeepStrictEqual(
    aiModule.parseTarotInterpretationOutputForInputV1(
      generationInput,
      JSON.stringify(unavailableFallback.output),
    ),
    unavailableFallback.output,
  )
) {
  throw new TypeError("The compiled unavailable-only fallback boundary is invalid.");
}

let timeoutProviderCalls = 0;
let timeoutCancellationCalls = 0;
let timeoutRunnerWaitCalls = 0;
let lateProviderSettlementConsumed = false;
let settleLateProvider;
const timeoutProvider = Object.freeze({
  descriptor: compiledProviderDescriptor,
  generateStructured: (_request, context) => {
    timeoutProviderCalls += 1;
    context.cancellation.subscribe(() => {
      timeoutCancellationCalls += 1;
    });
    return new Promise((resolve) => {
      settleLateProvider = resolve;
    });
  },
});
const timeoutGenerationRunner = Object.freeze({
  run: async ({ attempt, operation }) => {
    let aborted = false;
    const cancellationListeners = new Set();
    const cancellation = Object.freeze({
      get aborted() {
        return aborted;
      },
      subscribe(listener) {
        cancellationListeners.add(listener);
        return () => cancellationListeners.delete(listener);
      },
    });
    const pending = operation(
      Object.freeze({
        attempt,
        attemptId: `test.compiled-timeout-${attempt}`,
        cancellation,
      }),
    );
    void pending.then(
      () => {
        lateProviderSettlementConsumed = true;
      },
      () => {
        lateProviderSettlementConsumed = true;
      },
    );
    aborted = true;
    const cancellationAcknowledged = cancellationListeners.size > 0;
    for (const listener of cancellationListeners) listener();
    cancellationListeners.clear();
    return Object.freeze({
      cancellationAcknowledged,
      elapsedMs: 5,
      status: "timeout",
    });
  },
  wait: async () => {
    timeoutRunnerWaitCalls += 1;
    return Object.freeze({ elapsedMs: 0, status: "settled" });
  },
});
const timeoutGeneration = await aiModule.generateTarotInterpretationV1({
  ...commonGenerationInput,
  mode: "provider_with_fallback",
  provider: timeoutProvider,
  runner: timeoutGenerationRunner,
});
const timeoutGenerationSnapshot = JSON.stringify(timeoutGeneration);
settleLateProvider?.(generationProviderSuccess);
await Promise.resolve();
await Promise.resolve();
if (
  timeoutProviderCalls !== 1 ||
  timeoutCancellationCalls !== 1 ||
  timeoutRunnerWaitCalls !== 0 ||
  !lateProviderSettlementConsumed ||
  timeoutGeneration.status !== "fallback" ||
  timeoutGeneration.metadata.failureCode !== "timeout" ||
  timeoutGeneration.metadata.attemptCount !== 1 ||
  JSON.stringify(timeoutGeneration) !== timeoutGenerationSnapshot ||
  !isDeepStrictEqual(timeoutGeneration.output, fallbackGenerationOne.output)
) {
  throw new TypeError("The compiled timeout or late-settlement boundary is invalid.");
}

const generationMetadataKeys = Object.freeze([
  "attemptCount",
  "contentVersions",
  "costStatus",
  "currencyCode",
  "estimatedCostMicros",
  "failureCode",
  "fallbackTemplateVersion",
  "inputTokens",
  "latencyMs",
  "locale",
  "modality",
  "modelId",
  "modelVersion",
  "outputSchemaVersion",
  "outputTokens",
  "promptId",
  "promptVersion",
  "providerId",
  "providerVersion",
  "readingType",
  "result",
  "retryReason",
  "safetyPolicyVersion",
  "schemaVersion",
  "themeCode",
  "tokenStatus",
  "totalTokens",
]);
const serializedGenerationMetadata = JSON.stringify(candidateGeneration.metadata);
if (
  !isRecursivelyFrozen(candidateGeneration.metadata) ||
  !isDeepStrictEqual(Object.keys(candidateGeneration.metadata).sort(), generationMetadataKeys) ||
  serializedGenerationMetadata.includes(generationRequestId) ||
  serializedGenerationMetadata.includes(generationProviderOutputJson) ||
  serializedGenerationMetadata.includes(generationPromptAssembly.messages[0]?.content ?? "") ||
  /private-canary|question|journal|birth|email|session|reading(?:Id|_id)|raw|error|exception/iu.test(
    serializedGenerationMetadata,
  )
) {
  throw new TypeError("The compiled generation metadata allowlist is not privacy-safe.");
}

if (
  typeof databaseModule.assertDatabaseUrl !== "function" ||
  typeof databaseModule.assertAnonymousIdentityRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createAnonymousIdentityService !== "function" ||
  typeof databaseModule.assertFeatureFlagRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.assertTarotReadingRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.assertInterpretationGenerationRuntimeDatabasePrivileges !== "function" ||
  typeof databaseModule.createDatabaseClient !== "function" ||
  typeof databaseModule.createInterpretationGenerationPersistence !== "function" ||
  typeof databaseModule.createTarotReadingPersistence !== "function" ||
  typeof databaseModule.readFeatureFlagVersions !== "function" ||
  databaseModule.generationSchemaVersion !== "interpretation-generation.v1" ||
  databaseModule.generationProvenanceSchemaVersion !== "interpretation-generation-provenance.v1" ||
  !Array.isArray(databaseModule.interpretationGenerationPersistenceErrorCodes)
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
