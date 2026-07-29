import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
  accessibilityAxeTags,
  accessibilitySmokeRoutes,
  auditAxeResult,
  countReviewedAxeIncompleteNodes,
  pseudoLocalizeText,
  privateAccessibilitySmokeRoutes,
  publicAccessibilitySmokeRoutes,
  resolveAccessibilityArtifactRequest,
} from "../apps/web/test/accessibility-policy.mjs";
import {
  auditTarotBrowserAcceptanceLedger,
  tarotBrowserAcceptanceScenarioIds,
} from "../apps/web/test/tarot-browser-acceptance-policy.mjs";
import { verifyWebShellBuild } from "./web-shell-build-policy.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nextRoot = path.join(repositoryRoot, "apps/web/.next");
const deterministicTarotAcceptanceArtifactDirectory = path.join(
  repositoryRoot,
  "output/playwright/rit028",
);
const tarotAcceptanceArtifactDirectory = path.join(repositoryRoot, "output/playwright/rit035");
const currentAccountPath = "/api/v1/me";
const currentRevisitRemindersPath = "/api/v1/me/revisit-reminders";
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const artifactContentSecurityPolicy = [
  "base-uri 'none'",
  "connect-src 'self'",
  "default-src 'self'",
  "font-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' blob:",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
  "worker-src 'none'",
].join("; ");
const homeContrastTargets = Object.freeze([
  Object.freeze([".brand-link"]),
  Object.freeze(['.navigation-link[aria-current="page"][href="/en"]']),
  Object.freeze(['.navigation-link[href$="methodology"]']),
  Object.freeze(['.navigation-link[href$="safety"]']),
  Object.freeze(['.navigation-link[href$="sanctuary"]']),
  Object.freeze(["label"]),
  Object.freeze([".hero-copy > .eyebrow"]),
  Object.freeze(["#home-heading"]),
  Object.freeze([".hero-introduction"]),
  Object.freeze([".hero-boundary"]),
  Object.freeze(["#practice > .section-heading > .eyebrow"]),
  Object.freeze(["#practice-heading"]),
  Object.freeze(["#practice > .section-heading > .section-introduction"]),
  Object.freeze(["#availability-title"]),
  Object.freeze([".availability-section .rvt-state-pattern__message"]),
  Object.freeze([".availability-section .rvt-state-pattern__icon"]),
  Object.freeze(['.availability-section .rvt-action[href="/en/methodology"]']),
  Object.freeze(['.availability-section .rvt-action[href="/en/safety"]']),
  Object.freeze([".oracle-heading > .eyebrow"]),
  Object.freeze(["#oracle-heading"]),
  Object.freeze([".oracle-heading > .section-introduction"]),
  Object.freeze([".oracle-card-featured > .eyebrow"]),
  Object.freeze([".oracle-card-featured > h3"]),
  Object.freeze([".oracle-card-featured > p:nth-child(3)"]),
  Object.freeze([".oracle-card-featured > .oracle-note"]),
  Object.freeze([".oracle-card:nth-child(2) > .eyebrow"]),
  Object.freeze([".oracle-card:nth-child(2) > h3"]),
  Object.freeze([".oracle-card:nth-child(2) > p:nth-child(3)"]),
  Object.freeze([".oracle-card:nth-child(2) > .oracle-note"]),
  Object.freeze([".oracle-card:nth-child(3) > .eyebrow"]),
  Object.freeze([".oracle-card:nth-child(3) > h3"]),
  Object.freeze([".oracle-card:nth-child(3) > p:nth-child(3)"]),
  Object.freeze([".oracle-card:nth-child(3) > .oracle-note"]),
  Object.freeze([".oracle-card:nth-child(4) > .eyebrow"]),
  Object.freeze([".oracle-card:nth-child(4) > h3"]),
  Object.freeze([".oracle-card:nth-child(4) > p:nth-child(3)"]),
  Object.freeze([".oracle-card:nth-child(4) > .oracle-note"]),
]);
const offlineContrastTargets = Object.freeze([
  ...homeContrastTargets,
  Object.freeze(["#connection-notice-title"]),
  Object.freeze([".connection-notice .rvt-state-pattern__message"]),
  Object.freeze([".connection-notice .rvt-state-pattern__icon"]),
]);
const informationContrastTargets = Object.freeze({
  "/en/methodology": Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="sanctuary"]']),
    Object.freeze(['.navigation-link[aria-current="page"][href$="methodology"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
  "/en/privacy": Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="sanctuary"]']),
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze(['.footer-link[aria-current="page"][href$="privacy"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
  "/en/safety": Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="sanctuary"]']),
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['.navigation-link[aria-current="page"][href$="safety"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
  ...Object.fromEntries(
    [
      "/en/numerology",
      "/en/numerology/life-path-number",
      "/en/numerology/birthday-number",
      "/en/numerology/personal-year-number",
      "/en/numerology/master-numbers",
    ].map((pathname) => [
      pathname,
      Object.freeze([
        Object.freeze([".brand-link"]),
        Object.freeze(['.navigation-link[href="/en"]']),
        Object.freeze(['.navigation-link[href$="sanctuary"]']),
        Object.freeze(['.navigation-link[href$="methodology"]']),
        Object.freeze(['.navigation-link[href$="safety"]']),
        Object.freeze(["label"]),
        Object.freeze([".eyebrow"]),
        Object.freeze(["h1"]),
        Object.freeze([".numerology-library-answer"]),
        Object.freeze([".numerology-library-boundary"]),
        Object.freeze(["#numerology-guide-list-heading"]),
      ]),
    ]),
  ),
  ...Object.fromEntries(
    [
      "/en/astrology",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/birth-time-uncertainty",
      "/en/astrology/houses-and-major-aspects",
      "/en/astrology/sources-and-methodology",
    ].map((pathname) => [
      pathname,
      Object.freeze([
        Object.freeze([".brand-link"]),
        Object.freeze(['.navigation-link[href="/en"]']),
        Object.freeze(['.navigation-link[href$="sanctuary"]']),
        Object.freeze(['.navigation-link[href$="methodology"]']),
        Object.freeze(['.navigation-link[href$="safety"]']),
        Object.freeze(["label"]),
        Object.freeze([".eyebrow"]),
        Object.freeze(["h1"]),
        Object.freeze([".numerology-library-answer"]),
        Object.freeze([".numerology-library-boundary"]),
        Object.freeze(["#astrology-guide-list-heading"]),
        Object.freeze(["caption"]),
        Object.freeze(['th[scope="col"]:nth-child(2)']),
        Object.freeze(['th[scope="col"]:nth-child(3)']),
        Object.freeze(["tr:nth-child(1) > td:nth-child(2)"]),
        Object.freeze(["tr:nth-child(1) > td:nth-child(3)"]),
        Object.freeze(["tr:nth-child(2) > td:nth-child(2)"]),
        Object.freeze(["tr:nth-child(2) > td:nth-child(3)"]),
        Object.freeze(["tr:nth-child(3) > td:nth-child(2)"]),
        Object.freeze(["tr:nth-child(3) > td:nth-child(3)"]),
        Object.freeze(["tr:nth-child(4) > td:nth-child(2)"]),
        Object.freeze(["tr:nth-child(4) > td:nth-child(3)"]),
        Object.freeze(["tr:nth-child(5) > td:nth-child(2)"]),
        Object.freeze(["tr:nth-child(5) > td:nth-child(3)"]),
      ]),
    ]),
  ),
});
const intakeContrastTargets = Object.freeze([
  Object.freeze([".brand-link"]),
  Object.freeze(['.navigation-link[href="/en"]']),
  Object.freeze(['.navigation-link[href$="sanctuary"]']),
  Object.freeze(['.navigation-link[href$="methodology"]']),
  Object.freeze(['.navigation-link[href$="safety"]']),
  Object.freeze([".locale-label"]),
  Object.freeze([".eyebrow"]),
  Object.freeze(["h1"]),
  Object.freeze([".question-intake-introduction"]),
  Object.freeze([".question-intake-boundary"]),
  Object.freeze([".question-intake-privacy"]),
]);
const tarotReadingContrastTargets = (headingSelector) =>
  Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="sanctuary"]']),
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze([".locale-label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze([headingSelector]),
    Object.freeze([".tarot-reading-introduction"]),
    Object.freeze([".tarot-reading-boundary"]),
    Object.freeze([".tarot-reading-privacy"]),
  ]);
const tarotAcceptanceContrastTargets = (headingSelector, flowSlug, cardCount) =>
  Object.freeze([
    ...tarotReadingContrastTargets(headingSelector),
    Object.freeze(["figcaption > strong"]),
    Object.freeze(["figcaption > span"]),
    Object.freeze(["strong"]),
    Object.freeze([".rvt-icon"]),
    Object.freeze([".tarot-reading-heading > .eyebrow"]),
    ...Array.from({ length: cardCount }, (_, index) =>
      Object.freeze([
        `article[aria-labelledby="tarot-${flowSlug}-card-${index + 1}-title"] > figure > figcaption > strong`,
      ]),
    ),
    ...Array.from({ length: cardCount }, (_, index) =>
      Object.freeze([
        `article[aria-labelledby="tarot-${flowSlug}-card-${index + 1}-title"] > figure > figcaption > span`,
      ]),
    ),
  ]);
const contrastScanStates = Object.freeze(["dark", "english", "expanded", "rtl"]);
const reviewedContrastTargetsByScan = new Map([
  ...contrastScanStates.map((state) => [`${state}:/en`, homeContrastTargets]),
  ["offline:/en", offlineContrastTargets],
  ...Object.entries(informationContrastTargets).flatMap(([pathname, targets]) =>
    contrastScanStates.map((state) => [`${state}:${pathname}`, targets]),
  ),
  ...contrastScanStates.map((state) => [`${state}:/en/intake`, intakeContrastTargets]),
  ...contrastScanStates.map((state) => [
    `${state}:/en/tarot/one-card`,
    tarotReadingContrastTargets("#tarot-one-card-heading"),
  ]),
  ...contrastScanStates.map((state) => [
    `${state}:/en/tarot/three-card`,
    tarotReadingContrastTargets("#tarot-three-card-heading"),
  ]),
  ["acceptance:one-card", tarotAcceptanceContrastTargets("#tarot-one-card-heading", "one-card", 1)],
  [
    "acceptance:three-card",
    tarotAcceptanceContrastTargets("#tarot-three-card-heading", "three-card", 3),
  ],
  [
    "deterministic:one-card",
    tarotAcceptanceContrastTargets("#tarot-one-card-heading", "one-card", 1),
  ],
  [
    "deterministic:one-card-offline",
    tarotAcceptanceContrastTargets("#tarot-one-card-heading", "one-card", 1),
  ],
  [
    "deterministic:one-card-limit",
    tarotAcceptanceContrastTargets("#tarot-one-card-heading", "one-card", 1),
  ],
  [
    "deterministic:one-card-stale-resume",
    tarotAcceptanceContrastTargets("#tarot-one-card-heading", "one-card", 1),
  ],
  [
    "deterministic:three-card",
    tarotAcceptanceContrastTargets("#tarot-three-card-heading", "three-card", 3),
  ],
  [
    "deterministic:three-card-error",
    tarotAcceptanceContrastTargets("#tarot-three-card-heading", "three-card", 3),
  ],
]);

const tarotAcceptanceReadingIds = Object.freeze({
  one_card: "33333333-3333-4333-8333-333333333333",
  three_card: "44444444-4444-4444-8444-444444444444",
});

const tarotAcceptanceCards = Object.freeze({
  one_card: Object.freeze([
    Object.freeze({
      cannotDetermine: "This symbol cannot determine an outcome.",
      cardId: "lantern",
      cardTitle: "The Lantern",
      constructivePossibility: "A small source of clarity may be enough for the next step.",
      coreThemes: Object.freeze(["clarity", "attention"]),
      invitation: "Notice what becomes visible when you narrow your attention.",
      order: 1,
      orientation: "upright",
      positionId: "perspective",
      positionTitle: "Perspective",
      reflectionQuestion: "What deserves a little more light today?",
      smallAction: "Write down one next step you can complete in ten minutes.",
      tension: "Seeking total certainty can obscure the useful detail already present.",
    }),
  ]),
  three_card: Object.freeze([
    Object.freeze({
      cannotDetermine: "This symbol cannot determine what will happen.",
      cardId: "lantern",
      cardTitle: "The Lantern",
      constructivePossibility: "A useful detail may already be visible.",
      coreThemes: Object.freeze(["clarity", "attention"]),
      invitation: "Notice what deserves attention in the present situation.",
      order: 1,
      orientation: "upright",
      positionId: "situation",
      positionTitle: "Situation",
      reflectionQuestion: "What detail matters most right now?",
      smallAction: "Name one fact you can observe without guessing.",
      tension: "Seeking total certainty can hide the useful detail already present.",
    }),
    Object.freeze({
      cannotDetermine: "This symbol cannot choose an action for you.",
      cardId: "mirror",
      cardTitle: "The Mirror",
      constructivePossibility: "A brief pause may reveal what remains within your control.",
      coreThemes: Object.freeze(["reflection", "choice"]),
      invitation: "Consider one response that respects your own agency.",
      order: 2,
      orientation: "reversed",
      positionId: "action",
      positionTitle: "Action",
      reflectionQuestion: "Which response is both small and within your control?",
      smallAction: "Write one ten-minute step and decide whether it still feels useful tomorrow.",
      tension: "Reflection can become delay when it avoids a manageable next step.",
    }),
    Object.freeze({
      cannotDetermine: "This symbol cannot predict an outcome.",
      cardId: "threshold",
      cardTitle: "The Threshold",
      constructivePossibility: "A new option may become visible after a careful first step.",
      coreThemes: Object.freeze(["transition", "possibility"]),
      invitation: "Hold one possible direction lightly without treating it as promised.",
      order: 3,
      orientation: "upright",
      positionId: "possibility",
      positionTitle: "Possibility",
      reflectionQuestion: "What possibility is worth exploring without needing certainty?",
      smallAction: "List one low-risk way to learn more before deciding.",
      tension: "Possibility is not evidence that a particular future will occur.",
    }),
  ]),
});
const wholeReadingSafetyReportBody = Object.freeze({
  category: "safety",
  schemaVersion: "tarot-reading-report.v1",
  target: Object.freeze({ kind: "reading" }),
});
const actionPositionTranslationReportBody = Object.freeze({
  category: "translation",
  schemaVersion: "tarot-reading-report.v1",
  target: Object.freeze({ kind: "position", positionId: "action" }),
});

const createTarotAcceptanceReading = (readingType) => {
  const oneCard = readingType === "one_card";
  const cards = tarotAcceptanceCards[readingType];
  return Object.freeze({
    createdAt: "2026-07-17T12:00:00.000Z",
    facts: Object.freeze({
      algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
      catalog: Object.freeze({ id: "test.catalog", version: "1.0.0" }),
      deck: Object.freeze({ id: "test.deck", version: "1.0.0" }),
      engineName: "rituvia.tarot-draw",
      engineVersion: "1.0.0",
      method: "tarot",
      orientationPolicy: "upright_and_reversed",
      positions: Object.freeze(
        cards.map(({ cardId, order, orientation, positionId }) =>
          Object.freeze({ cardId, order, orientation, positionId }),
        ),
      ),
      replacementPolicy: "without_replacement",
      rulesVersion: "tarot-draw-rules.v1",
      schemaVersion: "tarot-draw-facts.v1",
      spread: Object.freeze({
        id: oneCard ? "one-card-perspective" : "situation-action-possibility",
        version: "1.0.0",
      }),
    }),
    locale: "en",
    presentation: Object.freeze({
      cards,
      schemaVersion: "tarot-reading-presentation.v1",
    }),
    readingId: tarotAcceptanceReadingIds[readingType],
    readingPolicyVersion: "test.tarot-reading.v1",
    readingType,
    schemaVersion: "tarot-reading-response.v2",
    status: "facts_ready",
    themeCode: "open_reflection",
  });
};

const tarotAcceptanceInterpretationOutput = Object.freeze({
  boundaryNote:
    "This interpretation offers reflective possibilities and cannot determine an outcome.",
  perspectives: Object.freeze([
    "A smaller source of clarity may be more useful than complete certainty.",
    "The next helpful choice may be one that remains within your control.",
  ]),
  reflectionQuestions: Object.freeze([
    "What already feels clear enough for one small next step?",
    "Which uncertainty can remain open without stopping you today?",
  ]),
  ritualSuggestion: Object.freeze({
    reason: "Pause with a free virtual candle while naming the one detail you want to notice.",
  }),
  smallAction: Object.freeze({
    label: "Write one ten-minute next step.",
    rationale: "A bounded action keeps the reflection grounded in your own judgment.",
    timeHorizon: "today",
  }),
  summary:
    "The fixed symbols invite attention to a manageable source of clarity, while leaving the outcome open.",
  symbols: Object.freeze([
    Object.freeze({
      limitation: "A symbol cannot promise what will happen next.",
      meaning: "The lantern can represent focused attention in an uncertain moment.",
      possibility: "One visible detail may be enough to choose a low-risk next step.",
    }),
  ]),
  title: "Acceptance-ready reflective perspective",
});

const jsonFulfill = async (route, status, body, contentType = "application/json") => {
  const serialized = JSON.stringify(body);
  await route.fulfill({
    body: serialized,
    headers: {
      "cache-control": "no-store",
      "content-length": String(Buffer.byteLength(serialized)),
      "content-type": contentType,
    },
    status,
  });
};

const installTarotAcceptanceRoutes = async (
  page,
  { failFirstInterpretationStart = false, finalStatus, readingType },
) => {
  const readingId = tarotAcceptanceReadingIds[readingType];
  let observeInterpretationGet;
  let releaseInterpretationGet;
  const interpretationGetObserved = new Promise((resolve) => {
    observeInterpretationGet = resolve;
  });
  const interpretationGetReleased = new Promise((resolve) => {
    releaseInterpretationGet = resolve;
  });
  const requests = {
    accountGets: 0,
    interpretationGets: 0,
    interpretationOperationIds: [],
    interpretationReportBodies: [],
    interpretationReportOperationIds: [],
    interpretationReports: 0,
    interpretationStarts: 0,
    readingStarts: 0,
    releaseInterpretationGet: () => releaseInterpretationGet(),
    sessionStarts: 0,
    unexpected: [],
    waitForInterpretationGet: () => interpretationGetObserved,
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === currentAccountPath) {
      requests.accountGets += 1;
      await route.fallback();
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/anonymous/session") {
      requests.sessionStarts += 1;
      await route.fulfill({
        headers: { "cache-control": "no-store" },
        status: 204,
      });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/readings/tarot") {
      requests.readingStarts += 1;
      await jsonFulfill(route, 201, createTarotAcceptanceReading(readingType));
      return;
    }
    if (request.method() === "POST" && url.pathname === `/api/v1/readings/${readingId}/report`) {
      requests.interpretationReports += 1;
      requests.interpretationReportOperationIds.push(
        request.headers()["idempotency-key"] ?? "missing",
      );
      try {
        requests.interpretationReportBodies.push(request.postDataJSON());
      } catch {
        requests.unexpected.push("POST:malformed-interpretation-report");
      }
      await route.fulfill({
        headers: { "cache-control": "no-store" },
        status: 204,
      });
      return;
    }
    if (url.pathname === `/api/v1/readings/${readingId}/interpretation`) {
      if (request.method() === "POST") {
        requests.interpretationStarts += 1;
        requests.interpretationOperationIds.push(request.headers()["idempotency-key"] ?? "missing");
        if (failFirstInterpretationStart && requests.interpretationStarts === 1) {
          await jsonFulfill(
            route,
            503,
            {
              code: "TAROT_INTERPRETATION_UNAVAILABLE",
              detail:
                "PRIVATE_PROBLEM_CANARY The enhanced interpretation is temporarily unavailable.",
              fields: [],
              instance: url.pathname,
              requestId: "req_00000000000000000000000000000000",
              status: 503,
              title: "The interpretation could not be completed",
              type: "urn:rituvia:problem:tarot-interpretation-unavailable",
            },
            "application/problem+json",
          );
          return;
        }
        const processing = {
          displayable: false,
          pollAfterMs: 250,
          readingId,
          schemaVersion: "tarot-interpretation-response.v1",
          status: "processing",
        };
        const serialized = JSON.stringify(processing);
        await route.fulfill({
          body: serialized,
          headers: {
            "cache-control": "no-store",
            "content-length": String(Buffer.byteLength(serialized)),
            "content-type": "application/json",
            "retry-after": "1",
          },
          status: 202,
        });
        return;
      }
      if (request.method() === "GET") {
        requests.interpretationGets += 1;
        observeInterpretationGet();
        await interpretationGetReleased;
        await jsonFulfill(route, 200, {
          displayable: true,
          output: tarotAcceptanceInterpretationOutput,
          readingId,
          schemaVersion: "tarot-interpretation-response.v1",
          status: finalStatus,
        });
        return;
      }
    }
    requests.unexpected.push(`${request.method()}:${url.pathname}`);
    await route.abort("blockedbyclient");
  });

  return requests;
};

const installDeterministicTarotRoutes = async (
  page,
  { readingFailures = [], readingType, resumeStatus = 200 },
) => {
  const readingId = tarotAcceptanceReadingIds[readingType];
  const requests = {
    accountGets: 0,
    readingBodies: [],
    readingGets: 0,
    readingOperationIds: [],
    readingStarts: 0,
    reportBodies: [],
    reportOperationIds: [],
    reports: 0,
    sessionBodies: [],
    sessionOperationIds: [],
    sessionStarts: 0,
    unexpected: [],
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === currentAccountPath) {
      requests.accountGets += 1;
      await route.fallback();
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/anonymous/session") {
      requests.sessionStarts += 1;
      requests.sessionBodies.push(request.postData());
      requests.sessionOperationIds.push(request.headers()["idempotency-key"] ?? "missing");
      await route.fulfill({
        headers: { "cache-control": "no-store", "content-length": "0" },
        status: 204,
      });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/readings/tarot") {
      requests.readingStarts += 1;
      requests.readingOperationIds.push(request.headers()["idempotency-key"] ?? "missing");
      try {
        requests.readingBodies.push(request.postDataJSON());
      } catch {
        requests.unexpected.push("POST:malformed-reading");
      }
      const failureStatus = readingFailures[requests.readingStarts - 1];
      if (failureStatus !== undefined) {
        await route.fulfill({
          headers: {
            "cache-control": "no-store",
            "content-length": "0",
            ...(failureStatus === 429 ? { "retry-after": "60" } : {}),
          },
          status: failureStatus,
        });
        return;
      }
      await jsonFulfill(route, 201, createTarotAcceptanceReading(readingType));
      return;
    }
    if (request.method() === "GET" && url.pathname === `/api/v1/readings/${readingId}`) {
      requests.readingGets += 1;
      if (resumeStatus === 404) {
        await route.fulfill({
          headers: { "cache-control": "no-store", "content-length": "0" },
          status: 404,
        });
        return;
      }
      await jsonFulfill(route, 200, createTarotAcceptanceReading(readingType));
      return;
    }
    if (request.method() === "POST" && url.pathname === `/api/v1/readings/${readingId}/report`) {
      requests.reports += 1;
      requests.reportOperationIds.push(request.headers()["idempotency-key"] ?? "missing");
      try {
        requests.reportBodies.push(request.postDataJSON());
      } catch {
        requests.unexpected.push("POST:malformed-report");
      }
      await route.fulfill({
        headers: { "cache-control": "no-store", "content-length": "0" },
        status: 204,
      });
      return;
    }
    requests.unexpected.push(`${request.method()}:${url.pathname}`);
    await route.abort("blockedbyclient");
  });

  return requests;
};

const loadReviewedArtifacts = async () => {
  const artifacts = new Map();
  const add = async (requestTarget) => {
    if (artifacts.has(requestTarget)) return;
    const descriptor = resolveAccessibilityArtifactRequest(requestTarget);
    if (descriptor === null) {
      throw new Error("Reviewed Web build emitted an invalid accessibility artifact reference.");
    }
    const artifactRoot =
      descriptor.type === "public-image" ? path.join(repositoryRoot, "apps/web/public") : nextRoot;
    const body = await readFile(path.join(artifactRoot, descriptor.relativePath));
    artifacts.set(requestTarget, Object.freeze({ body, descriptor }));
    if (descriptor.type !== "document") return;
    const html = body.toString("utf8");
    const references = [
      ...html.matchAll(/\b(?:href|src)="(\/_next\/static\/[^"]+|\/icon\.svg[^"]*)"/gu),
    ].map(([, reference]) => reference);
    references.push(
      ...[...html.matchAll(/\/_next\/image\?url=[^"'\s,>]+/gu)].map(([reference]) =>
        reference.replaceAll("&amp;", "&"),
      ),
    );
    await Promise.all(references.map(add));
  };
  await Promise.all(accessibilitySmokeRoutes.map(add));
  const chunkEntries = await readdir(path.join(nextRoot, "static/chunks"), {
    withFileTypes: true,
  });
  await Promise.all(
    chunkEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => add(`/_next/static/chunks/${entry.name}`)),
  );
  return artifacts;
};

const createArtifactServer = async (artifacts) => {
  const serverErrors = [];
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { allow: "GET, HEAD", "cache-control": "no-store" });
        response.end();
        return;
      }
      const artifact = artifacts.get(request.url ?? "");
      if (artifact === undefined) {
        response.writeHead(404, {
          "cache-control": "no-store",
          "content-length": "0",
          "x-content-type-options": "nosniff",
          "x-robots-tag": "noindex, nofollow, noarchive",
        });
        response.end();
        return;
      }
      const headers = {
        "cache-control": "no-store",
        "content-length": String(artifact.body.byteLength),
        "content-security-policy": artifactContentSecurityPolicy,
        "content-type": artifact.descriptor.contentType,
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
      };
      if (artifact.descriptor.type === "document") headers["content-language"] = "en";
      response.writeHead(200, headers);
      response.end(request.method === "HEAD" ? undefined : artifact.body);
    } catch (error) {
      serverErrors.push(error instanceof Error ? error.name : "UnknownError");
      if (!response.headersSent) {
        response.writeHead(500, { "cache-control": "no-store", "content-length": "0" });
      }
      response.end();
    }
  });
  server.on("clientError", (error, socket) => {
    if ("code" in error && error.code === "ECONNRESET") {
      socket.destroy();
      return;
    }
    serverErrors.push("code" in error && typeof error.code === "string" ? error.code : error.name);
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    throw new TypeError("Accessibility server did not expose a loopback TCP address.");
  }
  return Object.freeze({
    close: async () => {
      await new Promise((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    },
    origin: `http://127.0.0.1:${address.port}`,
    serverErrors,
  });
};

const collectTextNodes = async (page) =>
  page.locator("body").evaluate((body) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const values = [];
    let node = walker.nextNode();
    while (node !== null) {
      const parent = node.parentElement;
      if (parent !== null && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
        values.push(node.nodeValue ?? "");
      }
      node = walker.nextNode();
    }
    return values;
  });

const applyPseudolocale = async (page, direction) => {
  const values = await collectTextNodes(page);
  const pseudolocale = direction === "rtl" ? "ar-XB" : "en-XA";
  const replacements = values.map((value) => pseudoLocalizeText(value, pseudolocale));
  if (!replacements.some((value, index) => value !== values[index])) {
    throw new Error("Pseudolocale smoke found no transformable public text.");
  }
  await page.locator("body").evaluate(
    (body, input) => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let replacementIndex = 0;
      let node = walker.nextNode();
      while (node !== null) {
        const parent = node.parentElement;
        if (parent !== null && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
          node.nodeValue = input.replacements[replacementIndex] ?? "";
          replacementIndex += 1;
        }
        node = walker.nextNode();
      }
      document.documentElement.lang = input.direction === "rtl" ? "ar-XB" : "en-XA";
      document.documentElement.dir = input.direction;
    },
    { direction, replacements },
  );
};

const assertLayout = async (page, label) => {
  const failures = await page.locator("body").evaluate((body) => {
    const viewportWidth = document.documentElement.clientWidth;
    const problems = [];
    if (document.documentElement.scrollWidth > viewportWidth + 1) {
      problems.push(`document-overflow:${document.documentElement.scrollWidth}:${viewportWidth}`);
    }
    for (const [index, element] of [...body.querySelectorAll("*")].entries()) {
      const style = getComputedStyle(element);
      const rectangle = element.getBoundingClientRect();
      if (
        element.hidden ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        rectangle.width === 0 ||
        rectangle.height === 0 ||
        element.classList.contains("visually-hidden")
      ) {
        continue;
      }
      const approvedInlineScroller = element.closest(".astrology-reference-table-wrap");
      if (
        (rectangle.left < -1 || rectangle.right > viewportWidth + 1) &&
        approvedInlineScroller === null
      ) {
        problems.push(`viewport:${index}:${element.tagName.toLowerCase()}`);
      }
      if (
        ["clip", "hidden"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1
      ) {
        problems.push(`inline-clip:${index}:${element.tagName.toLowerCase()}`);
      }
      if (
        ["clip", "hidden"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1
      ) {
        problems.push(`block-clip:${index}:${element.tagName.toLowerCase()}`);
      }
    }
    return problems.slice(0, 12);
  });
  if (failures.length > 0) {
    throw new Error(`${label} layout failures: ${failures.join(", ")}`);
  }
};

const assertTouchTargets = async (page, label) => {
  const failures = await page
    .locator('a[href], button, input, select, summary, textarea, [tabindex]:not([tabindex="-1"])')
    .evaluateAll((elements) =>
      elements.flatMap((element, index) => {
        const style = getComputedStyle(element);
        const rectangle = element.getBoundingClientRect();
        if (
          element.matches(":disabled") ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          return [];
        }
        return rectangle.width >= 44 && rectangle.height >= 44
          ? []
          : [`${index}:${element.tagName.toLowerCase()}:${rectangle.width}x${rectangle.height}`];
      }),
    );
  if (failures.length > 0) {
    throw new Error(`${label} touch-target failures: ${failures.slice(0, 12).join(", ")}`);
  }
};

const assertSelectedOptionFits = async (page, label) => {
  const result = await page.locator(".locale-select").evaluate((select) => {
    if (!(select instanceof HTMLSelectElement)) return null;
    const style = getComputedStyle(select);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) return null;
    context.font = style.font;
    const selectedText = select.selectedOptions[0]?.text ?? "";
    const requiredWidth =
      context.measureText(selectedText).width +
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth);
    return { availableWidth: select.getBoundingClientRect().width, requiredWidth };
  });
  if (
    result === null ||
    !Number.isFinite(result.requiredWidth) ||
    result.requiredWidth > result.availableWidth + 1
  ) {
    throw new Error(`${label} locale option is clipped.`);
  }
};

const assertReducedMotion = async (page, label) => {
  const result = await page.evaluate(() => {
    const durationInMilliseconds = (value) =>
      value.split(",").map((duration) => {
        const normalized = duration.trim();
        return normalized.endsWith("ms")
          ? Number.parseFloat(normalized)
          : Number.parseFloat(normalized) * 1000;
      });
    const excessive = [document.body, ...document.body.querySelectorAll("*")].flatMap(
      (element, index) => {
        const styles = [
          getComputedStyle(element),
          getComputedStyle(element, "::before"),
          getComputedStyle(element, "::after"),
        ];
        return styles.some((style) => {
          const durations = [
            ...durationInMilliseconds(style.animationDuration),
            ...durationInMilliseconds(style.transitionDuration),
          ];
          return durations.some((duration) => !Number.isFinite(duration) || duration > 0.011);
        })
          ? [index]
          : [];
      },
    );
    return {
      excessive: excessive.slice(0, 12),
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  if (result.matches !== true || result.scrollBehavior !== "auto" || result.excessive.length > 0) {
    throw new Error(`${label} did not honor reduced motion.`);
  }
};

const assertPseudolocaleBoundary = async (page, pathname, direction) => {
  const result = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    lang: document.documentElement.lang,
    pseudoLinks: [...document.querySelectorAll("a[href]")].filter((link) =>
      /\/(?:en-XA|ar-XB)(?:\/|$)/u.test(link.getAttribute("href") ?? ""),
    ).length,
    pathname: location.pathname,
  }));
  const expectedLanguage = direction === "rtl" ? "ar-XB" : "en-XA";
  if (
    result.pathname !== pathname ||
    result.lang !== expectedLanguage ||
    result.direction !== direction ||
    result.pseudoLinks !== 0
  ) {
    throw new Error(`${direction}:${pathname} escaped the test-only pseudolocale boundary.`);
  }
};

const assertReviewedIncompleteScope = async (page, label, reviewedTargets) => {
  const reviewed = new Set(reviewedTargets.map((target) => JSON.stringify(target)));
  if (!reviewed.has('["strong"]') && !reviewed.has('[".rvt-icon"]')) return;
  const scope = await page.evaluate(() => {
    const strongElements = [...document.querySelectorAll("strong")];
    const iconElements = [...document.querySelectorAll(".rvt-icon")];
    return {
      iconCount: iconElements.length,
      iconOutsideReviewedComponents: iconElements.filter(
        (element) => element.closest(".rvt-alert, .rvt-state-pattern") === null,
      ).length,
      strongCount: strongElements.length,
      strongOutsideReviewedComponents: strongElements.filter(
        (element) =>
          element.closest(".tarot-result-cards figcaption, .principles-section, .tarot-report") ===
          null,
      ).length,
    };
  });
  if (
    scope.iconCount > 2 ||
    scope.iconOutsideReviewedComponents !== 0 ||
    scope.strongCount > 5 ||
    scope.strongOutsideReviewedComponents !== 0
  ) {
    throw new Error(`${label} broad reviewed contrast scope drifted: ${JSON.stringify(scope)}`);
  }
};

const assertAxe = async (page, label) => {
  const result = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags([...accessibilityAxeTags])
    .analyze();
  const reviewedTargets = reviewedContrastTargetsByScan.get(label) ?? [];
  await assertReviewedIncompleteScope(page, label, reviewedTargets);
  const findings = auditAxeResult(result, reviewedTargets);
  if (findings.length > 0) {
    throw new Error(
      `${label} axe findings: ${findings
        .map(({ id, impact, state }) => `${state}:${id}:${impact ?? "unknown"}`)
        .join(", ")}`,
    );
  }
  return countReviewedAxeIncompleteNodes(result, reviewedTargets);
};

const waitForReviewedPageReady = async (page) => {
  await page.waitForFunction(() => {
    if (document.readyState !== "complete") return false;
    const noScriptNotice = document.querySelector(".no-script-note");
    if (
      noScriptNotice instanceof HTMLElement &&
      getComputedStyle(noScriptNotice).display !== "none"
    ) {
      return true;
    }
    if (document.querySelector(".account-navigation-link:not([aria-busy])") === null) {
      return false;
    }
    if (document.querySelector('[aria-busy="true"]') !== null) return false;
    const tarotFlow = document.querySelector(".tarot-flow");
    return (
      tarotFlow === null ||
      tarotFlow.querySelector(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
      ) !== null
    );
  });
  if (await page.locator(".no-script-note").isVisible()) return;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))),
      ),
  );
};

const assertKeyboard = async (page, label, { resetPage = true, verifySkipLink = true } = {}) => {
  if (resetPage) {
    await page.goto(page.url().split("#", 1)[0], { waitUntil: "load" });
    await waitForReviewedPageReady(page);
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const tabbableRadioByGroup = new Map();
    for (const element of candidates) {
      if (!(element instanceof HTMLInputElement) || element.type !== "radio") continue;
      const key = `${element.form?.id ?? ""}:${element.name}`;
      const current = tabbableRadioByGroup.get(key);
      if (current === undefined || element.checked) {
        tabbableRadioByGroup.set(key, element);
      }
    }
    const focusable = candidates.filter((element) => {
      const style = getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        element.getClientRects().length === 0 ||
        element.matches(":disabled")
      ) {
        return false;
      }
      if (!(element instanceof HTMLInputElement) || element.type !== "radio") return true;
      const key = `${element.form?.id ?? ""}:${element.name}`;
      return tabbableRadioByGroup.get(key) === element;
    });
    focusable.forEach((element, index) => {
      element.setAttribute("data-rituvia-smoke-focus-index", String(index));
    });
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  const expectedCount = await page.locator("[data-rituvia-smoke-focus-index]").count();
  if (expectedCount === 0) throw new Error(`${label} exposes no keyboard controls.`);
  const settleFocus = async (expectedIndex = null) => {
    if (expectedIndex === null) {
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))),
          ),
      );
      return;
    }
    try {
      await page.waitForFunction(
        (index) => {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) return false;
          const rectangle = active.getBoundingClientRect();
          return (
            active.getAttribute("data-rituvia-smoke-focus-index") === String(index) &&
            active.matches(":focus-visible") &&
            rectangle.left >= -1 &&
            rectangle.right <= document.documentElement.clientWidth + 1 &&
            rectangle.top >= -1 &&
            rectangle.bottom <= document.documentElement.clientHeight + 1
          );
        },
        expectedIndex,
        { timeout: 2_000 },
      );
    } catch {
      const diagnostic = await page.evaluate((index) => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return null;
        const expected = document.querySelector(`[data-rituvia-smoke-focus-index="${index}"]`);
        const rectangle = active.getBoundingClientRect();
        return {
          ariaLabel: active.getAttribute("aria-label"),
          expected:
            expected instanceof HTMLElement
              ? {
                  tagName: expected.tagName,
                  text: expected.textContent?.trim().slice(0, 80) ?? "",
                  ...(expected instanceof HTMLInputElement
                    ? {
                        checked: expected.checked,
                        formId: expected.form?.id ?? "",
                        name: expected.name,
                        tabIndex: expected.tabIndex,
                        type: expected.type,
                      }
                    : {}),
                }
              : null,
          focusIndex: active.getAttribute("data-rituvia-smoke-focus-index"),
          focusVisible: active.matches(":focus-visible"),
          rectangle: {
            bottom: rectangle.bottom,
            left: rectangle.left,
            right: rectangle.right,
            top: rectangle.top,
          },
          tagName: active.tagName,
          text: active.textContent?.trim().slice(0, 80) ?? "",
        };
      }, expectedIndex);
      throw new Error(
        `${label} keyboard focus did not settle at index ${expectedIndex}: ${JSON.stringify(diagnostic)}`,
      );
    }
  };
  const focusedState = async () =>
    page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const style = getComputedStyle(active);
      const rectangle = active.getBoundingClientRect();
      return {
        clipped:
          rectangle.left < -1 ||
          rectangle.right > document.documentElement.clientWidth + 1 ||
          rectangle.top < -1 ||
          rectangle.bottom > document.documentElement.clientHeight + 1,
        focusIndex: active.getAttribute("data-rituvia-smoke-focus-index"),
        focusVisible: active.matches(":focus-visible"),
        outlineWidth: Number.parseFloat(style.outlineWidth),
        rectangle: {
          bottom: rectangle.bottom,
          left: rectangle.left,
          right: rectangle.right,
          top: rectangle.top,
        },
        transform: style.transform,
      };
    });
  const assertFocus = (focus, index, direction) => {
    if (
      focus?.focusIndex !== String(index) ||
      focus.focusVisible !== true ||
      focus.clipped !== false ||
      !Number.isFinite(focus.outlineWidth) ||
      focus.outlineWidth < 3
    ) {
      throw new Error(
        `${label} ${direction} keyboard focus failed at index ${index}: ${JSON.stringify(focus)}`,
      );
    }
  };
  for (let index = 0; index < expectedCount; index += 1) {
    await page.keyboard.press("Tab");
    await settleFocus(index);
    assertFocus(await focusedState(), index, "forward");
  }
  await page.keyboard.press("Tab");
  await settleFocus();
  const boundary = await focusedState();
  if (boundary?.focusIndex !== null) {
    throw new Error(`${label} keyboard sequence did not leave the final target.`);
  }
  await page.keyboard.press("Shift+Tab");
  await settleFocus(expectedCount - 1);
  assertFocus(await focusedState(), expectedCount - 1, "boundary-reverse");
  for (let index = expectedCount - 2; index >= 0; index -= 1) {
    await page.keyboard.press("Shift+Tab");
    await settleFocus(index);
    assertFocus(await focusedState(), index, "reverse");
  }
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("[data-rituvia-smoke-focus-index]")) {
      element.removeAttribute("data-rituvia-smoke-focus-index");
    }
  });

  if (!verifySkipLink) return;
  await page.goto(page.url().split("#", 1)[0], { waitUntil: "load" });
  await waitForReviewedPageReady(page);
  await page.keyboard.press("Tab");
  const skipLink = page.locator(".skip-link");
  if (!(await skipLink.isVisible())) throw new Error(`${label} skip link is not visible on focus.`);
  await page.keyboard.press("Enter");
  const skipResult = await page.evaluate(() => ({
    activeId: document.activeElement?.id ?? "",
    hash: location.hash,
  }));
  if (skipResult.activeId !== "main-content" || skipResult.hash !== "#main-content") {
    throw new Error(`${label} skip link did not focus the main landmark.`);
  }
};

const assertRtlGeometry = async (page, label) => {
  const geometry = await page.evaluate(() => {
    const brand = document.querySelector(".brand-link")?.getBoundingClientRect();
    const actions = document.querySelector(".header-actions")?.getBoundingClientRect();
    const boundary = document.querySelector(
      ".hero-boundary, .information-status, .numerology-library-boundary, .question-intake-boundary, .tarot-reading-boundary",
    );
    const boundaryStyle = boundary === null ? null : getComputedStyle(boundary);
    return {
      actionsCenter: actions === undefined ? null : actions.left + actions.width / 2,
      borderLeft: boundaryStyle === null ? null : Number.parseFloat(boundaryStyle.borderLeftWidth),
      borderRight:
        boundaryStyle === null ? null : Number.parseFloat(boundaryStyle.borderRightWidth),
      brandCenter: brand === undefined ? null : brand.left + brand.width / 2,
      directions: [
        document.documentElement,
        document.body,
        ...document.querySelectorAll("header, main, footer"),
      ].map((element) => getComputedStyle(element).direction),
      viewportCenter: document.documentElement.clientWidth / 2,
    };
  });
  if (
    geometry.directions.some((direction) => direction !== "rtl") ||
    geometry.brandCenter === null ||
    geometry.actionsCenter === null ||
    geometry.borderLeft !== 0 ||
    geometry.borderRight === null ||
    geometry.borderRight < 3 ||
    geometry.brandCenter <= geometry.viewportCenter ||
    geometry.actionsCenter >= geometry.viewportCenter
  ) {
    throw new Error(`${label} did not mirror the header geometry: ${JSON.stringify(geometry)}`);
  }
};

const assertRadioKeyboard = async (page, label, name) => {
  const first = page.locator(`input[name="${name}"]`).first();
  const second = page.locator(`input[name="${name}"]`).nth(1);
  await first.focus();
  await page.keyboard.press("ArrowDown");
  if (
    !(await second.isChecked()) ||
    !(await second.evaluate((input) => input === document.activeElement))
  ) {
    throw new Error(`${label} did not preserve native radio arrow-key behavior.`);
  }
  await page.keyboard.press("ArrowUp");
  if (
    !(await first.isChecked()) ||
    !(await first.evaluate((input) => input === document.activeElement))
  ) {
    throw new Error(`${label} did not restore the previous radio with ArrowUp.`);
  }
};

const attachBrowserBoundary = async (
  context,
  page,
  origin,
  failures,
  {
    allowDisabledScriptCsp = false,
    allowFulfilledSessionAbort = false,
    allowInterpretationUnavailable = false,
    expectedApiFailures = [],
  } = {},
) => {
  const expectedFailure = (url, status, method) =>
    url.origin === origin &&
    expectedApiFailures.some(
      ({ method: expectedMethod, pathname, status: expectedStatus }) =>
        status === expectedStatus &&
        url.pathname === pathname &&
        (expectedMethod === undefined || method === expectedMethod),
    );
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.origin === origin &&
      request.method() === "GET" &&
      url.pathname === currentAccountPath
    ) {
      await jsonFulfill(route, 200, {
        ageAttested: true,
        displayName: null,
        emailVerified: true,
        id: "55555555-5555-4555-8555-555555555555",
        locale: "en",
        profileVersion: 1,
        schemaVersion: 1,
        status: "active",
        timeZone: "UTC",
      });
      return;
    }
    if (
      url.origin === origin &&
      request.method() === "GET" &&
      url.pathname === currentRevisitRemindersPath
    ) {
      await jsonFulfill(route, 200, {
        accountAvailable: true,
        reminders: [],
        schemaVersion: 1,
      });
      return;
    }
    if (url.origin === origin) {
      await route.continue();
      return;
    }
    failures.push("nonlocal-request");
    await route.abort("blockedbyclient");
  });
  page.on("console", (message) => {
    const expectedFailureStatus = expectedApiFailures.some(({ status }) =>
      message.text().includes(`status of ${status} (`),
    );
    if (
      allowInterpretationUnavailable &&
      message.type() === "error" &&
      /status of 503 \(Service Unavailable\)/u.test(message.text())
    ) {
      return;
    }
    if (message.type() === "error" && expectedFailureStatus) return;
    if (message.type() === "error" || message.type() === "warning") {
      failures.push(`console:${message.type()}:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`pageerror:${error.name}`));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? "unknown";
    if (
      failure === "net::ERR_ABORTED" &&
      url.origin === origin &&
      expectedApiFailures.some(
        ({ method, pathname }) =>
          url.pathname === pathname && (method === undefined || method === request.method()),
      )
    ) {
      return;
    }
    if (
      allowFulfilledSessionAbort &&
      request.method() === "POST" &&
      url.origin === origin &&
      url.pathname === "/api/v1/anonymous/session" &&
      failure === "net::ERR_ABORTED"
    ) {
      return;
    }
    if (
      allowDisabledScriptCsp &&
      request.resourceType() === "script" &&
      failure === "csp" &&
      url.origin === origin
    ) {
      return;
    }
    if (
      failure === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      url.origin === origin &&
      resolveAccessibilityArtifactRequest(`${url.pathname}${url.search}`)?.type === "public-image"
    ) {
      return;
    }
    if (url.origin === origin) {
      failures.push(`local-request-failed:${url.pathname}:${failure}`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (expectedFailure(url, response.status(), response.request().method())) return;
    if (
      allowInterpretationUnavailable &&
      response.status() === 503 &&
      url.origin === origin &&
      /^\/api\/v1\/readings\/[0-9a-f-]+\/interpretation$/u.test(url.pathname)
    ) {
      return;
    }
    if (response.status() >= 400) failures.push(`http:${response.status()}:${url.pathname}`);
  });
};

const gotoReviewedPage = async (page, url, label) => {
  const response = await page.goto(url, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error(`${label} did not return HTTP 200.`);
  await waitForReviewedPageReady(page);
  if ((await page.locator("h1").count()) !== 1 || (await page.locator("main").count()) !== 1) {
    throw new Error(`${label} does not expose one H1 and one main landmark.`);
  }
};

const scrollToElementTop = async (locator) => {
  await locator.evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top - 24;
    window.scrollTo(0, Math.max(0, top));
  });
};

const assertDeterministicCards = async (page, readingType) => {
  const expectedCards = tarotAcceptanceCards[readingType];
  const cards = page.locator("ol.tarot-result-cards > li");
  if ((await cards.count()) !== expectedCards.length) {
    throw new Error(`${readingType} did not reveal the exact fixed card count.`);
  }
  for (const [index, expected] of expectedCards.entries()) {
    const card = cards.nth(index);
    for (const text of [
      expected.positionTitle,
      expected.cardTitle,
      expected.orientation === "upright" ? "Upright" : "Reversed",
      expected.cannotDetermine,
      expected.reflectionQuestion,
      expected.smallAction,
    ]) {
      if ((await card.getByText(text, { exact: true }).count()) === 0) {
        throw new Error(`${readingType} card ${index + 1} is missing ${JSON.stringify(text)}.`);
      }
    }
  }
  await page.waitForFunction(
    () =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      ),
    null,
    { timeout: 5_000 },
  );
};

const assertDeterministicStorage = async (page, readingType) => {
  const expectedKey =
    readingType === "one_card"
      ? "rituvia.tarot.resume.v1.one_card"
      : "rituvia.tarot.resume.v1.three_card";
  const expectedReadingId = tarotAcceptanceReadingIds[readingType];
  const snapshot = await page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
        .filter((key) => key !== null)
        .map((key) => [key, sessionStorage.getItem(key)]),
    ),
  );
  if (JSON.stringify(snapshot) !== JSON.stringify({ [expectedKey]: expectedReadingId })) {
    throw new Error(
      `${readingType} stored more than its exact resume UUID: ${JSON.stringify(snapshot)}`,
    );
  }
};

const submitDeterministicReadingReport = async (page, { category, target }) => {
  const report = page.locator("details").filter({
    hasText: "Report an issue with this reading",
  });
  await report.locator("summary").click();
  await report.getByRole("combobox", { name: "Issue category" }).selectOption(category);
  await report.getByRole("combobox", { name: "Report target" }).selectOption(target);
  await report.getByRole("button", { name: "Send report" }).click();
  await report
    .getByText(
      "Thank you. The report was recorded without your private question or journal text.",
      { exact: true },
    )
    .waitFor({ state: "visible" });
};

const assertScreenshot = async (page, fileName, expectedSize) => {
  const pageText = await page.locator("body").innerText();
  if (
    /PRIVATE_[A-Z0-9_]*CANARY|authorization:\s*bearer|(?:^|\s)sk-[A-Za-z0-9_-]+/iu.test(pageText)
  ) {
    throw new Error(`${fileName} page contains forbidden private or credential-bearing text.`);
  }
  const screenshot = await page.screenshot({
    path: path.join(deterministicTarotAcceptanceArtifactDirectory, fileName),
  });
  if (screenshot.byteLength < 10_000) {
    throw new Error(`${fileName} is not a substantive deterministic screenshot.`);
  }
  const signature = screenshot.subarray(0, 8).toString("hex");
  const dimensions = {
    height: screenshot.readUInt32BE(20),
    width: screenshot.readUInt32BE(16),
  };
  if (
    signature !== "89504e470d0a1a0a" ||
    dimensions.height !== expectedSize.height ||
    dimensions.width !== expectedSize.width
  ) {
    throw new Error(`${fileName} metadata is not the exact reviewed PNG viewport.`);
  }
  for (let offset = 8; offset + 12 <= screenshot.byteLength;) {
    const length = screenshot.readUInt32BE(offset);
    const type = screenshot.subarray(offset + 4, offset + 8).toString("ascii");
    if (["iTXt", "tEXt", "zTXt"].includes(type)) {
      throw new Error(`${fileName} contains unexpected textual PNG metadata.`);
    }
    offset += 12 + length;
  }
};

const assertNoAutomaticRequest = async (page, requests, key) => {
  const before = requests[key];
  await page.waitForTimeout(250);
  if (requests[key] !== before) {
    throw new Error(`The deterministic ${key} ledger changed without a user action.`);
  }
};

const assertDeterministicLedger = (scenarioId, ledger, expectation) => {
  if (!tarotBrowserAcceptanceScenarioIds.includes(scenarioId)) {
    throw new Error(`Unknown deterministic tarot scenario: ${scenarioId}`);
  }
  const findings = auditTarotBrowserAcceptanceLedger(ledger, expectation);
  if (findings.length > 0) {
    throw new Error(`${scenarioId} request ledger failed: ${findings.join(", ")}`);
  }
};

const runDeterministicTarotAcceptance = async (browser, origin, browserFailures) => {
  await mkdir(deterministicTarotAcceptanceArtifactDirectory, { recursive: true });
  let reviewedContrastNodes = 0;
  let scans = 0;

  const oneCardContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 1000, width: 1440 },
  });
  const oneCardPage = await oneCardContext.newPage();
  await attachBrowserBoundary(oneCardContext, oneCardPage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
  });
  const oneCardRequests = await installDeterministicTarotRoutes(oneCardPage, {
    readingType: "one_card",
  });
  try {
    await gotoReviewedPage(oneCardPage, `${origin}/en/tarot/one-card`, "deterministic:one-card");
    await assertRadioKeyboard(oneCardPage, "deterministic:one-card", "tarot-theme-code");
    await oneCardPage.getByRole("radio", { name: "Open reflection" }).focus();
    await oneCardPage.keyboard.press("Space");
    const drawOneCard = oneCardPage.getByRole("button", { name: "Draw one card" });
    await drawOneCard.focus();
    await oneCardPage.keyboard.press("Enter");
    const revealOneCard = oneCardPage.getByRole("button", { name: "Reveal my card" });
    await revealOneCard.waitFor({ state: "visible" });
    const oneCardRequestsBeforeReveal =
      oneCardRequests.sessionStarts + oneCardRequests.readingStarts + oneCardRequests.reports;
    await revealOneCard.focus();
    await oneCardPage.keyboard.press("Enter");
    await oneCardPage.getByRole("heading", { name: "Your one-card reflection" }).waitFor();
    if (
      oneCardRequests.sessionStarts + oneCardRequests.readingStarts + oneCardRequests.reports !==
      oneCardRequestsBeforeReveal
    ) {
      throw new Error("One-card reveal performed a network request.");
    }
    await assertDeterministicCards(oneCardPage, "one_card");
    await assertDeterministicStorage(oneCardPage, "one_card");
    await submitDeterministicReadingReport(oneCardPage, {
      category: "safety",
      target: "reading",
    });
    await oneCardPage
      .getByRole("button", { name: "Explore the deeper interpretation" })
      .waitFor({ state: "visible" });
    await assertKeyboard(oneCardPage, "deterministic:one-card:keyboard", {
      resetPage: false,
      verifySkipLink: false,
    });
    await assertReducedMotion(oneCardPage, "deterministic:one-card");
    await assertLayout(oneCardPage, "deterministic:one-card:desktop");
    await assertTouchTargets(oneCardPage, "deterministic:one-card:desktop");
    reviewedContrastNodes += await assertAxe(oneCardPage, "deterministic:one-card");
    scans += 1;
    await scrollToElementTop(
      oneCardPage.getByRole("heading", { name: "Your one-card reflection" }),
    );
    await assertScreenshot(oneCardPage, "one-card-result-1440x1000.png", {
      height: 1000,
      width: 1440,
    });

    await oneCardPage.setViewportSize({ height: 844, width: 320 });
    await assertLayout(oneCardPage, "deterministic:one-card:mobile");
    await assertTouchTargets(oneCardPage, "deterministic:one-card:mobile");
    reviewedContrastNodes += await assertAxe(oneCardPage, "deterministic:one-card");
    scans += 1;
    await applyPseudolocale(oneCardPage, "ltr");
    await assertPseudolocaleBoundary(oneCardPage, "/en/tarot/one-card", "ltr");
    await assertLayout(oneCardPage, "deterministic:one-card:expanded-mobile");

    const startsBeforeResume = {
      readingStarts: oneCardRequests.readingStarts,
      reports: oneCardRequests.reports,
      sessionStarts: oneCardRequests.sessionStarts,
    };
    await oneCardPage.reload({ waitUntil: "load" });
    await waitForReviewedPageReady(oneCardPage);
    try {
      await oneCardPage
        .getByText("This is the same saved result. Revealing it does not draw another card.", {
          exact: true,
        })
        .waitFor({ state: "visible", timeout: 5_000 });
    } catch {
      const diagnostic = await oneCardPage.evaluate(() => ({
        body: document.body.innerText.slice(-1_000),
        storage: Object.fromEntries(
          Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
            .filter((key) => key !== null)
            .map((key) => [key, sessionStorage.getItem(key)]),
        ),
      }));
      throw new Error(
        `One-card refresh did not expose its saved result: ${JSON.stringify({
          diagnostic,
          requests: oneCardRequests,
        })}`,
      );
    }
    if (
      oneCardRequests.readingGets !== 1 ||
      oneCardRequests.readingStarts !== startsBeforeResume.readingStarts ||
      oneCardRequests.reports !== startsBeforeResume.reports ||
      oneCardRequests.sessionStarts !== startsBeforeResume.sessionStarts
    ) {
      throw new Error(`One-card refresh was not GET-only: ${JSON.stringify(oneCardRequests)}`);
    }
    const resumeReveal = oneCardPage.getByRole("button", { name: "Reveal my card" });
    await resumeReveal.click();
    await assertDeterministicCards(oneCardPage, "one_card");
    if (oneCardRequests.readingGets !== 1) {
      throw new Error("One-card restored reveal performed another owner GET.");
    }
    assertDeterministicLedger("one-card-happy-report-resume", oneCardRequests, {
      readingGets: 1,
      readingStarts: 1,
      readingType: "one_card",
      reportBody: wholeReadingSafetyReportBody,
      reports: 1,
      sessionStarts: 1,
    });
  } finally {
    await oneCardContext.close();
  }

  const threeCardContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  const threeCardPage = await threeCardContext.newPage();
  await attachBrowserBoundary(threeCardContext, threeCardPage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
  });
  const threeCardRequests = await installDeterministicTarotRoutes(threeCardPage, {
    readingType: "three_card",
  });
  try {
    await gotoReviewedPage(
      threeCardPage,
      `${origin}/en/tarot/three-card`,
      "deterministic:three-card",
    );
    await threeCardPage.getByRole("radio", { name: "Open reflection" }).click();
    await threeCardPage.getByRole("button", { name: "Draw three cards" }).click();
    const revealThreeCards = threeCardPage.getByRole("button", {
      name: "Reveal the three cards",
    });
    await revealThreeCards.waitFor({ state: "visible" });
    const threeCardRequestsBeforeReveal =
      threeCardRequests.sessionStarts + threeCardRequests.readingStarts + threeCardRequests.reports;
    await revealThreeCards.click();
    if (
      threeCardRequests.sessionStarts +
        threeCardRequests.readingStarts +
        threeCardRequests.reports !==
      threeCardRequestsBeforeReveal
    ) {
      throw new Error(
        `Three-card reveal performed a network request: ${JSON.stringify(threeCardRequests)}`,
      );
    }
    await assertDeterministicCards(threeCardPage, "three_card");
    await assertDeterministicStorage(threeCardPage, "three_card");
    await submitDeterministicReadingReport(threeCardPage, {
      category: "translation",
      target: "action",
    });
    await threeCardPage
      .getByRole("button", { name: "Explore the deeper interpretation" })
      .waitFor({ state: "visible" });
    await assertKeyboard(threeCardPage, "deterministic:three-card:keyboard", {
      resetPage: false,
      verifySkipLink: false,
    });
    await assertReducedMotion(threeCardPage, "deterministic:three-card");
    await assertLayout(threeCardPage, "deterministic:three-card:mobile");
    await assertTouchTargets(threeCardPage, "deterministic:three-card:mobile");
    reviewedContrastNodes += await assertAxe(threeCardPage, "deterministic:three-card");
    scans += 1;
    await scrollToElementTop(
      threeCardPage.getByRole("heading", { name: "Your three-card reflection" }),
    );
    await assertScreenshot(threeCardPage, "three-card-result-320x844.png", {
      height: 844,
      width: 320,
    });

    await threeCardPage.setViewportSize({ height: 1000, width: 1440 });
    await assertLayout(threeCardPage, "deterministic:three-card:desktop");
    await assertTouchTargets(threeCardPage, "deterministic:three-card:desktop");
    reviewedContrastNodes += await assertAxe(threeCardPage, "deterministic:three-card");
    scans += 1;
    await applyPseudolocale(threeCardPage, "rtl");
    await assertPseudolocaleBoundary(threeCardPage, "/en/tarot/three-card", "rtl");
    await assertRtlGeometry(threeCardPage, "deterministic:three-card:rtl");
    await assertLayout(threeCardPage, "deterministic:three-card:rtl-desktop");
    await threeCardPage.setViewportSize({ height: 844, width: 320 });
    await assertLayout(threeCardPage, "deterministic:three-card:rtl-mobile");

    const startsBeforeResume = {
      readingStarts: threeCardRequests.readingStarts,
      reports: threeCardRequests.reports,
      sessionStarts: threeCardRequests.sessionStarts,
    };
    await threeCardPage.reload({ waitUntil: "load" });
    await waitForReviewedPageReady(threeCardPage);
    await threeCardPage
      .getByText(
        "These are the same saved cards in the same order. Revealing them does not draw again.",
        { exact: true },
      )
      .waitFor({ state: "visible" });
    if (
      threeCardRequests.readingGets !== 1 ||
      threeCardRequests.readingStarts !== startsBeforeResume.readingStarts ||
      threeCardRequests.reports !== startsBeforeResume.reports ||
      threeCardRequests.sessionStarts !== startsBeforeResume.sessionStarts
    ) {
      throw new Error(`Three-card refresh was not GET-only: ${JSON.stringify(threeCardRequests)}`);
    }
    await threeCardPage.getByRole("button", { name: "Reveal the three cards" }).click();
    await assertDeterministicCards(threeCardPage, "three_card");
    assertDeterministicLedger("three-card-happy-position-report", threeCardRequests, {
      readingGets: 1,
      readingStarts: 1,
      readingType: "three_card",
      reportBody: actionPositionTranslationReportBody,
      reports: 1,
      sessionStarts: 1,
    });
  } finally {
    await threeCardContext.close();
  }

  const offlineContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  const offlinePage = await offlineContext.newPage();
  await attachBrowserBoundary(offlineContext, offlinePage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
  });
  const offlineRequests = await installDeterministicTarotRoutes(offlinePage, {
    readingType: "one_card",
  });
  try {
    await gotoReviewedPage(
      offlinePage,
      `${origin}/en/tarot/one-card`,
      "deterministic:one-card-offline",
    );
    await offlineContext.setOffline(true);
    await offlinePage.waitForFunction(() => !navigator.onLine);
    await offlinePage.getByRole("radio", { name: "Open reflection" }).click();
    await offlinePage.getByRole("button", { name: "Draw one card" }).click();
    await offlinePage
      .locator('section[aria-label="You appear to be offline"]')
      .waitFor({ state: "visible" });
    if (offlineRequests.sessionStarts !== 0 || offlineRequests.readingStarts !== 0) {
      throw new Error("Offline one-card creation sent a request.");
    }
    await assertLayout(offlinePage, "deterministic:one-card-offline:mobile");
    await assertTouchTargets(offlinePage, "deterministic:one-card-offline:mobile");
    reviewedContrastNodes += await assertAxe(offlinePage, "deterministic:one-card-offline");
    scans += 1;
    await offlineContext.setOffline(false);
    await offlinePage.waitForFunction(() => navigator.onLine);
    await offlinePage.getByRole("button", { name: "Check connection and try again" }).click();
    await offlinePage.getByRole("button", { name: "Reveal my card" }).waitFor();
    if (offlineRequests.sessionStarts !== 1 || offlineRequests.readingStarts !== 1) {
      throw new Error("Offline recovery did not create exactly one fixed draw.");
    }
    assertDeterministicLedger("one-card-offline-recovery", offlineRequests, {
      readingGets: 0,
      readingStarts: 1,
      readingType: "one_card",
      reports: 0,
      sessionStarts: 1,
    });
  } finally {
    await offlineContext.close();
  }

  const serviceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  const servicePage = await serviceContext.newPage();
  await attachBrowserBoundary(serviceContext, servicePage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
    expectedApiFailures: [{ method: "POST", pathname: "/api/v1/readings/tarot", status: 503 }],
  });
  const serviceRequests = await installDeterministicTarotRoutes(servicePage, {
    readingFailures: [503],
    readingType: "three_card",
  });
  try {
    await gotoReviewedPage(
      servicePage,
      `${origin}/en/tarot/three-card`,
      "deterministic:three-card-error",
    );
    await servicePage.getByRole("radio", { name: "Open reflection" }).click();
    await servicePage.getByRole("button", { name: "Draw three cards" }).click();
    await servicePage
      .locator('section[aria-label="The reading service is unavailable"]')
      .waitFor({ state: "visible" });
    await assertNoAutomaticRequest(servicePage, serviceRequests, "readingStarts");
    reviewedContrastNodes += await assertAxe(servicePage, "deterministic:three-card-error");
    scans += 1;
    await servicePage.getByRole("button", { name: "Try the same draw again" }).click();
    await servicePage.getByRole("button", { name: "Reveal the three cards" }).waitFor();
    if (
      serviceRequests.sessionStarts !== 2 ||
      serviceRequests.readingStarts !== 2 ||
      new Set(serviceRequests.sessionOperationIds).size !== 1 ||
      new Set(serviceRequests.readingOperationIds).size !== 1
    ) {
      throw new Error(
        `Transient retry changed operation identity: ${JSON.stringify(serviceRequests)}`,
      );
    }
    await servicePage.getByRole("button", { name: "Reveal the three cards" }).click();
    await assertDeterministicCards(servicePage, "three_card");
    assertDeterministicLedger("three-card-service-retry", serviceRequests, {
      readingGets: 0,
      readingStarts: 2,
      readingType: "three_card",
      reports: 0,
      sameReadingKey: true,
      sameSessionKey: true,
      sessionStarts: 2,
    });
  } finally {
    await serviceContext.close();
  }

  const limitContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  const limitPage = await limitContext.newPage();
  await attachBrowserBoundary(limitContext, limitPage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
    expectedApiFailures: [{ method: "POST", pathname: "/api/v1/readings/tarot", status: 429 }],
  });
  const limitRequests = await installDeterministicTarotRoutes(limitPage, {
    readingFailures: [undefined, 429],
    readingType: "one_card",
  });
  try {
    await gotoReviewedPage(
      limitPage,
      `${origin}/en/tarot/one-card`,
      "deterministic:one-card-limit",
    );
    await limitPage.getByRole("radio", { name: "Open reflection" }).click();
    await limitPage.getByRole("button", { name: "Draw one card" }).click();
    await limitPage.getByRole("button", { name: "Reveal my card" }).click();
    await limitPage.getByRole("button", { name: "Start a new reflection" }).click();
    await limitPage.getByRole("radio", { name: "Open reflection" }).click();
    await limitPage.getByRole("button", { name: "Draw one card" }).click();
    await limitPage
      .locator('section[aria-label="The current reading limit has been reached"]')
      .waitFor({ state: "visible" });
    await limitPage
      .getByText(
        "Your previous fixed result remains available while a separate new reflection is unfinished.",
        { exact: true },
      )
      .waitFor({ state: "visible" });
    if ((await limitPage.getByRole("button", { name: "Try the same draw again" }).count()) !== 0) {
      throw new Error("The rate-limit state exposed an immediate draw retry.");
    }
    await assertNoAutomaticRequest(limitPage, limitRequests, "readingStarts");
    await assertDeterministicCards(limitPage, "one_card");
    reviewedContrastNodes += await assertAxe(limitPage, "deterministic:one-card-limit");
    scans += 1;
    assertDeterministicLedger("one-card-limit-stop", limitRequests, {
      readingGets: 0,
      readingStarts: 2,
      readingType: "one_card",
      reports: 0,
      sameReadingKey: false,
      sameSessionKey: false,
      sessionStarts: 2,
    });
  } finally {
    await limitContext.close();
  }

  const staleContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  const stalePage = await staleContext.newPage();
  await stalePage.addInitScript(({ key, readingId }) => sessionStorage.setItem(key, readingId), {
    key: "rituvia.tarot.resume.v1.one_card",
    readingId: tarotAcceptanceReadingIds.one_card,
  });
  await attachBrowserBoundary(staleContext, stalePage, origin, browserFailures, {
    expectedApiFailures: [
      {
        method: "GET",
        pathname: `/api/v1/readings/${tarotAcceptanceReadingIds.one_card}`,
        status: 404,
      },
    ],
  });
  const staleRequests = await installDeterministicTarotRoutes(stalePage, {
    readingType: "one_card",
    resumeStatus: 404,
  });
  try {
    await gotoReviewedPage(
      stalePage,
      `${origin}/en/tarot/one-card`,
      "deterministic:one-card-stale-resume",
    );
    await stalePage
      .locator('section[aria-label="The saved result is no longer available"]')
      .waitFor({ state: "visible" });
    const stored = await stalePage.evaluate(() =>
      sessionStorage.getItem("rituvia.tarot.resume.v1.one_card"),
    );
    if (
      stored !== null ||
      staleRequests.readingGets !== 1 ||
      staleRequests.sessionStarts !== 0 ||
      staleRequests.readingStarts !== 0
    ) {
      throw new Error(`Stale resume did not clear safely: ${JSON.stringify(staleRequests)}`);
    }
    await assertLayout(stalePage, "deterministic:one-card-stale-resume:mobile");
    await assertTouchTargets(stalePage, "deterministic:one-card-stale-resume:mobile");
    reviewedContrastNodes += await assertAxe(stalePage, "deterministic:one-card-stale-resume");
    scans += 1;
    assertDeterministicLedger("one-card-stale-resume", staleRequests, {
      readingGets: 1,
      readingStarts: 0,
      readingType: "one_card",
      reports: 0,
      sessionStarts: 0,
    });
  } finally {
    await staleContext.close();
  }

  return Object.freeze({
    reviewedContrastNodes,
    scans,
    scenarioCount: tarotBrowserAcceptanceScenarioIds.length,
    screenshotCount: 2,
  });
};

const assertTarotAcceptanceRequests = (requests, expected) => {
  if (
    requests.accountGets !== 1 ||
    requests.sessionStarts !== 1 ||
    requests.readingStarts !== 1 ||
    requests.interpretationStarts !== expected.interpretationStarts ||
    requests.interpretationGets !== 1 ||
    requests.interpretationReports !== expected.interpretationReports ||
    requests.unexpected.length > 0
  ) {
    throw new Error(`Tarot acceptance request ledger failed: ${JSON.stringify(requests)}`);
  }
  if (
    requests.interpretationOperationIds.length !== expected.interpretationStarts ||
    requests.interpretationOperationIds.some((operationId) => !uuidV4Pattern.test(operationId)) ||
    new Set(requests.interpretationOperationIds).size !== 1
  ) {
    throw new Error("Tarot acceptance did not preserve one UUID-v4 interpretation operation.");
  }
  const interpretationRequestId = requests.interpretationOperationIds.at(-1);
  if (
    requests.interpretationReportBodies.length !== expected.interpretationReports ||
    requests.interpretationReportOperationIds.length !== expected.interpretationReports ||
    requests.interpretationReportOperationIds.some(
      (operationId) => !uuidV4Pattern.test(operationId),
    ) ||
    requests.interpretationReportBodies.some(
      (body) =>
        JSON.stringify(body) !==
        JSON.stringify({
          category: "safety",
          schemaVersion: "tarot-reading-report.v2",
          target: {
            interpretationRequestId,
            kind: "interpretation",
          },
        }),
    )
  ) {
    throw new Error(`Tarot interpretation report ledger failed: ${JSON.stringify(requests)}`);
  }
};

const submitInterpretationReport = async (page, requests) => {
  const report = page.locator("details").filter({
    hasText: "Report an issue with this interpretation",
  });
  await report.locator("summary").click();
  await report.getByRole("combobox", { name: "Issue category" }).selectOption("safety");
  await report.getByRole("button", { name: "Send report" }).click();
  const alert = report.locator(".rvt-alert");
  await alert.waitFor({ state: "visible" });
  const alertText = await alert.innerText();
  const expected =
    "Thank you. The report was recorded without your private question or journal text.";
  if (!alertText.includes(expected)) {
    throw new Error(
      `Interpretation report did not succeed: ${alertText}; ledger=${JSON.stringify(requests)}`,
    );
  }
};

const runTarotAcceptance = async (browser, origin, browserFailures) => {
  await mkdir(tarotAcceptanceArtifactDirectory, { recursive: true });
  let reviewedContrastNodes = 0;

  const oneCardContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 1000, width: 1440 },
  });
  const oneCardPage = await oneCardContext.newPage();
  await attachBrowserBoundary(oneCardContext, oneCardPage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
    allowInterpretationUnavailable: true,
  });
  const oneCardRequests = await installTarotAcceptanceRoutes(oneCardPage, {
    failFirstInterpretationStart: true,
    finalStatus: "verified",
    readingType: "one_card",
  });
  try {
    await gotoReviewedPage(oneCardPage, `${origin}/en/tarot/one-card`, "acceptance:one-card");
    await oneCardPage.getByRole("radio", { name: "Open reflection" }).click();
    await oneCardPage.getByRole("button", { name: "Draw one card" }).click();
    await oneCardPage.getByRole("button", { name: "Reveal my card" }).click();
    const oneCardInterpretationStart = oneCardPage.getByRole("button", {
      name: "Explore the deeper interpretation",
    });
    await oneCardInterpretationStart.waitFor({ state: "visible" });
    if (oneCardRequests.interpretationStarts !== 0) {
      throw new Error("One-card interpretation started before explicit consent.");
    }
    await oneCardInterpretationStart.click();
    await oneCardPage
      .locator('section[aria-label="The interpretation could not be completed"]')
      .waitFor({ state: "visible" });
    if ((await oneCardPage.getByText("PRIVATE_PROBLEM_CANARY", { exact: true }).count()) !== 0) {
      throw new Error("One-card failure leaked untrusted Problem Details text.");
    }
    await oneCardPage.getByRole("button", { name: "Try the same request again" }).click();
    const oneCardProcessing = oneCardPage
      .getByRole("status")
      .filter({ hasText: "Preparing and checking the interpretation" });
    await oneCardProcessing.waitFor({ state: "visible" });
    await oneCardRequests.waitForInterpretationGet();
    if (
      (await oneCardPage
        .getByRole("heading", { name: tarotAcceptanceInterpretationOutput.title })
        .count()) !== 0
    ) {
      throw new Error("One-card processing displayed final interpretation text too early.");
    }
    const oneCardPanel = oneCardPage.locator(".principles-section").last();
    await scrollToElementTop(oneCardPanel);
    await oneCardPage.screenshot({
      path: path.join(
        tarotAcceptanceArtifactDirectory,
        "rituvia-one-card-processing-1440x1000.png",
      ),
    });
    oneCardRequests.releaseInterpretationGet();
    const oneCardFinalHeading = oneCardPage.getByRole("heading", {
      name: tarotAcceptanceInterpretationOutput.title,
    });
    await oneCardFinalHeading.waitFor({ state: "visible" });
    await oneCardPage
      .getByText("AI-generated interpretation · independently checked", { exact: true })
      .waitFor({ state: "visible" });
    await oneCardPage
      .getByText("Symbolic reflection, not professional advice.", { exact: true })
      .first()
      .waitFor({ state: "visible" });
    const oneCardArticle = oneCardPage.locator("article").filter({ has: oneCardFinalHeading });
    if (!(await oneCardArticle.evaluate((article) => article === document.activeElement))) {
      throw new Error("One-card verified interpretation did not receive focus.");
    }
    await submitInterpretationReport(oneCardPage, oneCardRequests);
    assertTarotAcceptanceRequests(oneCardRequests, {
      interpretationReports: 1,
      interpretationStarts: 2,
    });
    await assertLayout(oneCardPage, "acceptance:one-card:desktop");
    await assertTouchTargets(oneCardPage, "acceptance:one-card:desktop");
    reviewedContrastNodes += await assertAxe(oneCardPage, "acceptance:one-card");
    await scrollToElementTop(oneCardPanel);
    await oneCardPage.screenshot({
      path: path.join(tarotAcceptanceArtifactDirectory, "rituvia-one-card-verified-1440x1000.png"),
    });
    await oneCardPage.setViewportSize({ height: 844, width: 390 });
    await assertLayout(oneCardPage, "acceptance:one-card:mobile");
    await assertTouchTargets(oneCardPage, "acceptance:one-card:mobile");
  } finally {
    oneCardRequests.releaseInterpretationGet();
    await oneCardContext.close();
  }

  const threeCardContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 390 },
  });
  const threeCardPage = await threeCardContext.newPage();
  await attachBrowserBoundary(threeCardContext, threeCardPage, origin, browserFailures, {
    allowFulfilledSessionAbort: true,
  });
  const threeCardRequests = await installTarotAcceptanceRoutes(threeCardPage, {
    finalStatus: "reviewed_fallback",
    readingType: "three_card",
  });
  try {
    await gotoReviewedPage(threeCardPage, `${origin}/en/tarot/three-card`, "acceptance:three-card");
    await threeCardPage.getByRole("radio", { name: "Open reflection" }).click();
    await threeCardPage.getByRole("button", { name: "Draw three cards" }).click();
    await threeCardPage.getByRole("button", { name: "Reveal the three cards" }).click();
    if ((await threeCardPage.locator("ol.tarot-result-cards > li").count()) !== 3) {
      throw new Error("Three-card acceptance did not reveal exactly three ordered cards.");
    }
    await threeCardContext.setOffline(true);
    await threeCardPage.getByRole("button", { name: "Explore the deeper interpretation" }).click();
    await threeCardPage
      .locator('section[aria-label="You appear to be offline"]')
      .waitFor({ state: "visible" });
    if (threeCardRequests.interpretationStarts !== 0) {
      throw new Error("Three-card offline preflight sent an interpretation request.");
    }
    await threeCardContext.setOffline(false);
    await threeCardPage.waitForFunction(() => navigator.onLine);
    await threeCardPage.getByRole("button", { name: "Try the same request again" }).click();
    const threeCardProcessing = threeCardPage
      .getByRole("status")
      .filter({ hasText: "Preparing and checking the interpretation" });
    await threeCardProcessing.waitFor({ state: "visible" });
    await threeCardRequests.waitForInterpretationGet();
    if (
      (await threeCardPage
        .getByRole("heading", { name: tarotAcceptanceInterpretationOutput.title })
        .count()) !== 0
    ) {
      throw new Error("Three-card processing displayed final fallback text too early.");
    }
    threeCardRequests.releaseInterpretationGet();
    const threeCardFinalHeading = threeCardPage.getByRole("heading", {
      name: tarotAcceptanceInterpretationOutput.title,
    });
    await threeCardFinalHeading.waitFor({ state: "visible" });
    await threeCardPage
      .getByText("Reviewed non-AI fallback", { exact: true })
      .waitFor({ state: "visible" });
    await threeCardPage
      .getByText(
        "The AI draft was not used. This bounded alternative comes from reviewed content.",
        {
          exact: true,
        },
      )
      .waitFor({ state: "visible" });
    if (
      (await threeCardPage
        .getByText("AI-generated interpretation · independently checked", { exact: true })
        .count()) !== 0
    ) {
      throw new Error("Three-card reviewed fallback claimed AI verification.");
    }
    await submitInterpretationReport(threeCardPage, threeCardRequests);
    assertTarotAcceptanceRequests(threeCardRequests, {
      interpretationReports: 1,
      interpretationStarts: 1,
    });
    await assertLayout(threeCardPage, "acceptance:three-card:mobile");
    await assertTouchTargets(threeCardPage, "acceptance:three-card:mobile");
    reviewedContrastNodes += await assertAxe(threeCardPage, "acceptance:three-card");
    const threeCardPanel = threeCardPage.locator(".principles-section").last();
    await scrollToElementTop(threeCardPanel);
    await threeCardPage.screenshot({
      path: path.join(tarotAcceptanceArtifactDirectory, "rituvia-three-card-fallback-390x844.png"),
    });
  } finally {
    threeCardRequests.releaseInterpretationGet();
    await threeCardContext.close();
  }

  return Object.freeze({ reviewedContrastNodes, scans: 2 });
};

const run = async () => {
  const build = await verifyWebShellBuild(repositoryRoot);
  if (JSON.stringify(build.routes) !== JSON.stringify(publicAccessibilitySmokeRoutes)) {
    throw new Error(
      "Public accessibility inventory differs from the reviewed Web build inventory.",
    );
  }
  const artifacts = await loadReviewedArtifacts();
  const artifactServer = await createArtifactServer(artifacts);
  const browserFailures = [];
  let browser = null;
  let deterministicTarotScenarios = 0;
  let deterministicTarotScreenshots = 0;
  let reviewedContrastNodes = 0;
  let scans = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      reducedMotion: "reduce",
      serviceWorkers: "block",
      viewport: { height: 900, width: 1280 },
    });
    const page = await context.newPage();
    await attachBrowserBoundary(context, page, artifactServer.origin, browserFailures);

    for (const pathname of accessibilitySmokeRoutes) {
      const label = `english:${pathname}`;
      await page.setViewportSize({ height: 900, width: 1280 });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await gotoReviewedPage(page, `${artifactServer.origin}${pathname}`, label);
      await assertTouchTargets(page, label);
      await assertSelectedOptionFits(page, label);
      await assertReducedMotion(page, label);
      reviewedContrastNodes += await assertAxe(page, label);
      scans += 1;
      await assertKeyboard(page, label);
      if (pathname === "/en/intake") await assertRadioKeyboard(page, label, "theme-code");
      if (pathname === "/en/tarot/one-card" || pathname === "/en/tarot/three-card") {
        await assertRadioKeyboard(page, label, "tarot-theme-code");
      }

      await page.setViewportSize({ height: 900, width: 320 });
      await gotoReviewedPage(page, `${artifactServer.origin}${pathname}`, `mobile:${pathname}`);
      await assertLayout(page, `mobile:${pathname}`);
      await assertTouchTargets(page, `mobile:${pathname}`);
      await applyPseudolocale(page, "ltr");
      await assertPseudolocaleBoundary(page, pathname, "ltr");
      await assertLayout(page, `expanded:${pathname}`);
      await assertTouchTargets(page, `expanded:${pathname}`);
      await assertSelectedOptionFits(page, `expanded:${pathname}`);
      reviewedContrastNodes += await assertAxe(page, `expanded:${pathname}`);
      scans += 1;

      await page.setViewportSize({ height: 900, width: 1280 });
      await gotoReviewedPage(page, `${artifactServer.origin}${pathname}`, `rtl:${pathname}`);
      await applyPseudolocale(page, "rtl");
      await assertPseudolocaleBoundary(page, pathname, "rtl");
      await assertLayout(page, `rtl:${pathname}`);
      await assertTouchTargets(page, `rtl:${pathname}`);
      await assertSelectedOptionFits(page, `rtl:${pathname}`);
      await assertRtlGeometry(page, `rtl:${pathname}`);
      reviewedContrastNodes += await assertAxe(page, `rtl:${pathname}`);
      scans += 1;
      if (pathname === "/en") {
        await assertKeyboard(page, `rtl:${pathname}`, {
          resetPage: false,
          verifySkipLink: false,
        });
      }
      await page.setViewportSize({ height: 900, width: 320 });
      await assertLayout(page, `rtl-mobile:${pathname}`);
      await assertTouchTargets(page, `rtl-mobile:${pathname}`);

      await page.setViewportSize({ height: 900, width: 1280 });
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await gotoReviewedPage(page, `${artifactServer.origin}${pathname}`, `dark:${pathname}`);
      reviewedContrastNodes += await assertAxe(page, `dark:${pathname}`);
      scans += 1;
    }

    await context.setOffline(false);
    await page.setViewportSize({ height: 900, width: 320 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await gotoReviewedPage(page, `${artifactServer.origin}/en`, "offline:/en");
    const connectionAnnouncement = page.locator("[data-connection-announcement]");
    const connectedAnnouncement = await connectionAnnouncement.evaluate((node) => ({
      atomic: node.getAttribute("aria-atomic"),
      live: node.getAttribute("aria-live"),
      role: node.getAttribute("role"),
      text: node.textContent?.trim() ?? "",
    }));
    if (
      connectedAnnouncement.atomic !== "true" ||
      connectedAnnouncement.live !== "polite" ||
      connectedAnnouncement.role !== "status" ||
      connectedAnnouncement.text !== ""
    ) {
      throw new Error(
        `offline:/en did not mount an empty connection live region: ${JSON.stringify(connectedAnnouncement)}`,
      );
    }
    if ((await page.locator('[data-connection-state="offline"]').count()) !== 0) {
      throw new Error("offline:/en rendered a false offline state while connected.");
    }
    await context.setOffline(true);
    const offlineNotice = page.locator('[data-connection-state="offline"]');
    await offlineNotice.waitFor({ state: "visible" });
    const expectedOfflineAnnouncement =
      "Your device appears to be offline. This page remains readable, but links or new content may need a connection.";
    await page.waitForFunction(
      (expected) =>
        document.querySelector("[data-connection-announcement]")?.textContent?.trim() === expected,
      expectedOfflineAnnouncement,
    );
    const offlineSemantics = await offlineNotice.evaluate((notice) => ({
      mainTextLength: document.querySelector("main")?.textContent?.trim().length ?? 0,
      pathname: location.pathname,
      roleCount: notice.querySelectorAll('[role="status"]').length,
    }));
    if (
      offlineSemantics.roleCount !== 0 ||
      offlineSemantics.pathname !== "/en" ||
      offlineSemantics.mainTextLength < 200
    ) {
      throw new Error(`offline:/en state semantics failed: ${JSON.stringify(offlineSemantics)}`);
    }
    await assertLayout(page, "offline:/en");
    await assertTouchTargets(page, "offline:/en");
    reviewedContrastNodes += await assertAxe(page, "offline:/en");
    scans += 1;
    await context.setOffline(false);
    await offlineNotice.waitFor({ state: "detached" });
    const expectedOnlineAnnouncement = "Your device appears to be back online.";
    await page.waitForFunction(
      (expected) =>
        document.querySelector("[data-connection-announcement]")?.textContent?.trim() === expected,
      expectedOnlineAnnouncement,
    );
    await context.close();

    const deterministicTarotAcceptance = await runDeterministicTarotAcceptance(
      browser,
      artifactServer.origin,
      browserFailures,
    );
    deterministicTarotScenarios = deterministicTarotAcceptance.scenarioCount;
    deterministicTarotScreenshots = deterministicTarotAcceptance.screenshotCount;
    reviewedContrastNodes += deterministicTarotAcceptance.reviewedContrastNodes;
    scans += deterministicTarotAcceptance.scans;

    const tarotAcceptance = await runTarotAcceptance(
      browser,
      artifactServer.origin,
      browserFailures,
    );
    reviewedContrastNodes += tarotAcceptance.reviewedContrastNodes;
    scans += tarotAcceptance.scans;

    const noJavaScriptContext = await browser.newContext({
      colorScheme: "light",
      javaScriptEnabled: false,
      locale: "en-US",
      reducedMotion: "reduce",
      serviceWorkers: "block",
      viewport: { height: 900, width: 320 },
    });
    const noJavaScriptPage = await noJavaScriptContext.newPage();
    await attachBrowserBoundary(
      noJavaScriptContext,
      noJavaScriptPage,
      artifactServer.origin,
      browserFailures,
      { allowDisabledScriptCsp: true },
    );
    for (const pathname of accessibilitySmokeRoutes) {
      const label = `no-javascript:${pathname}`;
      await gotoReviewedPage(noJavaScriptPage, `${artifactServer.origin}${pathname}`, label);
      if (!(await noJavaScriptPage.locator(".no-script-note").isVisible())) {
        throw new Error(`${label} does not expose its no-JavaScript notice.`);
      }
      if ((await noJavaScriptPage.locator("main").innerText()).trim().length < 200) {
        throw new Error(`${label} lost its meaningful server-rendered content.`);
      }
      await assertLayout(noJavaScriptPage, label);
      await assertTouchTargets(noJavaScriptPage, label);
    }
    await noJavaScriptContext.close();
  } finally {
    await browser?.close();
    await artifactServer.close();
  }
  const failures = [...browserFailures, ...artifactServer.serverErrors];
  if (failures.length > 0) {
    throw new Error(`Accessibility browser boundary failed: ${[...new Set(failures)].join(", ")}`);
  }
  console.log(
    `Verified ${publicAccessibilitySmokeRoutes.length} public routes and ${privateAccessibilitySmokeRoutes.length} private routes with ${scans} axe scans (${reviewedContrastNodes} color-contrast nodes retained for the existing token/manual review), ${deterministicTarotScenarios} deterministic tarot scenarios with ${deterministicTarotScreenshots} supporting screenshots, forward/reverse keyboard focus, 40% expanded text, desktop/mobile RTL mirroring, a persistent online/offline/online advisory announcement, explicit tarot create/reveal/retry/limit/resume/report and interpretation retry/polling/verified/fallback/offline acceptance, 44px targets, dark/reduced-motion and no-JavaScript states, and local-only requests.`,
  );
};

await run();
