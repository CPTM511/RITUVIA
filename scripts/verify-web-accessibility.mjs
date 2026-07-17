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
import { verifyWebShellBuild } from "./web-shell-build-policy.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nextRoot = path.join(repositoryRoot, "apps/web/.next");
const tarotAcceptanceArtifactDirectory = path.join(repositoryRoot, "output/playwright/rit035");
const homeContrastTargets = Object.freeze([
  Object.freeze([".brand-link"]),
  Object.freeze(['a[aria-current="page"]']),
  Object.freeze(['.navigation-link[href$="methodology"]']),
  Object.freeze(['.navigation-link[href$="safety"]']),
  Object.freeze(['.navigation-link[href$="privacy"]']),
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
    Object.freeze(['a[aria-current="page"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze(['.navigation-link[href$="privacy"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
  "/en/privacy": Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze(['a[aria-current="page"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
  "/en/safety": Object.freeze([
    Object.freeze([".brand-link"]),
    Object.freeze(['.navigation-link[href="/en"]']),
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['a[aria-current="page"]']),
    Object.freeze(['.navigation-link[href$="privacy"]']),
    Object.freeze(["label"]),
    Object.freeze([".eyebrow"]),
    Object.freeze(["h1"]),
    Object.freeze([".information-introduction"]),
  ]),
});
const intakeContrastTargets = Object.freeze([
  Object.freeze([".brand-link"]),
  Object.freeze(['.navigation-link[href="/en"]']),
  Object.freeze(['.navigation-link[href$="methodology"]']),
  Object.freeze(['.navigation-link[href$="safety"]']),
  Object.freeze(['.navigation-link[href$="privacy"]']),
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
    Object.freeze(['.navigation-link[href$="methodology"]']),
    Object.freeze(['.navigation-link[href$="safety"]']),
    Object.freeze(['.navigation-link[href$="privacy"]']),
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
    interpretationGets: 0,
    interpretationOperationIds: [],
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

const loadReviewedArtifacts = async () => {
  const artifacts = new Map();
  const add = async (requestTarget) => {
    if (artifacts.has(requestTarget)) return;
    const descriptor = resolveAccessibilityArtifactRequest(requestTarget);
    if (descriptor === null) {
      throw new Error("Reviewed Web build emitted an invalid accessibility artifact reference.");
    }
    const body = await readFile(path.join(nextRoot, descriptor.relativePath));
    artifacts.set(requestTarget, Object.freeze({ body, descriptor }));
    if (descriptor.type !== "document") return;
    const html = body.toString("utf8");
    const references = [
      ...html.matchAll(/\b(?:href|src)="(\/_next\/static\/[^"]+|\/icon\.svg[^"]*)"/gu),
    ].map(([, reference]) => reference);
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
        "content-security-policy":
          "default-src 'none'; base-uri 'none'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'",
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
    serverErrors.push(error.name);
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
  const replacements = values.map((value) => pseudoLocalizeText(value, direction));
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
      if (rectangle.left < -1 || rectangle.right > viewportWidth + 1) {
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
    .locator('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    .evaluateAll((elements) =>
      elements.flatMap((element, index) => {
        const style = getComputedStyle(element);
        const rectangle = element.getBoundingClientRect();
        if (
          element.hasAttribute("disabled") ||
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

const assertAxe = async (page, label) => {
  const result = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags([...accessibilityAxeTags])
    .analyze();
  const reviewedTargets = reviewedContrastTargetsByScan.get(label) ?? [];
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

const assertKeyboard = async (page, label, { resetPage = true, verifySkipLink = true } = {}) => {
  if (resetPage) {
    await page.goto(page.url().split("#", 1)[0], { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const seenRadioGroups = new Set();
    const focusable = candidates.filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (!(element instanceof HTMLInputElement) || element.type !== "radio") return true;
      const key = `${element.form?.id ?? ""}:${element.name}`;
      if (seenRadioGroups.has(key)) return false;
      seenRadioGroups.add(key);
      return true;
    });
    focusable.forEach((element, index) => {
      element.setAttribute("data-rituvia-smoke-focus-index", String(index));
    });
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

  if (!verifySkipLink) return;
  await page.goto(page.url().split("#", 1)[0], { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
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
      ".hero-boundary, .information-status, .question-intake-boundary, .tarot-reading-boundary",
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
    throw new Error(`${label} did not mirror the header geometry.`);
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
  } = {},
) => {
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === origin) {
      await route.continue();
      return;
    }
    failures.push("nonlocal-request");
    await route.abort("blockedbyclient");
  });
  page.on("console", (message) => {
    if (
      allowInterpretationUnavailable &&
      message.type() === "error" &&
      /status of 503 \(Service Unavailable\)/u.test(message.text())
    ) {
      return;
    }
    if (message.type() === "error" || message.type() === "warning") {
      failures.push(`console:${message.type()}:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`pageerror:${error.name}`));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? "unknown";
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
    if (url.origin === origin) {
      failures.push(`local-request-failed:${url.pathname}:${failure}`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
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
  await page.waitForLoadState("networkidle");
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

const assertTarotAcceptanceRequests = (requests, expected) => {
  if (
    requests.sessionStarts !== 1 ||
    requests.readingStarts !== 1 ||
    requests.interpretationStarts !== expected.interpretationStarts ||
    requests.interpretationGets !== 1 ||
    requests.unexpected.length > 0
  ) {
    throw new Error(`Tarot acceptance request ledger failed: ${JSON.stringify(requests)}`);
  }
  if (
    requests.interpretationOperationIds.length !== expected.interpretationStarts ||
    requests.interpretationOperationIds.some(
      (operationId) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(operationId),
    ) ||
    new Set(requests.interpretationOperationIds).size !== 1
  ) {
    throw new Error("Tarot acceptance did not preserve one UUID-v4 interpretation operation.");
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
    assertTarotAcceptanceRequests(oneCardRequests, { interpretationStarts: 2 });
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
    assertTarotAcceptanceRequests(threeCardRequests, { interpretationStarts: 1 });
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
    `Verified ${publicAccessibilitySmokeRoutes.length} public routes and ${privateAccessibilitySmokeRoutes.length} private routes with ${scans} axe scans (${reviewedContrastNodes} color-contrast nodes retained for the existing token/manual review), forward/reverse keyboard focus, 40% expanded text, desktop/mobile RTL mirroring, a persistent online/offline/online advisory announcement, explicit tarot interpretation retry/polling/verified/fallback/offline acceptance, 44px targets, dark/reduced-motion and no-JavaScript states, screenshots, and local-only requests.`,
  );
};

await run();
