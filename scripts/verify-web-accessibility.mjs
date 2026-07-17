import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
  accessibilityAxeTags,
  accessibilitySmokeRoutes,
  auditAxeResult,
  countReviewedAxeIncompleteNodes,
  pseudoLocalizeText,
  resolveAccessibilityArtifactRequest,
} from "../apps/web/test/accessibility-policy.mjs";
import { verifyWebShellBuild } from "./web-shell-build-policy.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nextRoot = path.join(repositoryRoot, "apps/web/.next");
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
const contrastScanStates = Object.freeze(["dark", "english", "expanded", "rtl"]);
const reviewedContrastTargetsByScan = new Map([
  ...contrastScanStates.map((state) => [`${state}:/en`, homeContrastTargets]),
  ["offline:/en", offlineContrastTargets],
  ...Object.entries(informationContrastTargets).flatMap(([pathname, targets]) =>
    contrastScanStates.map((state) => [`${state}:${pathname}`, targets]),
  ),
]);

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
    const focusable = [
      ...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
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
    const boundary = document.querySelector(".hero-boundary, .information-status");
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

const attachBrowserBoundary = async (
  context,
  page,
  origin,
  failures,
  { allowDisabledScriptCsp = false } = {},
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
    if (message.type() === "error" || message.type() === "warning") {
      failures.push(`console:${message.type()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`pageerror:${error.name}`));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? "unknown";
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
    if (response.status() >= 400) failures.push(`http:${response.status()}`);
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

const run = async () => {
  const build = await verifyWebShellBuild(repositoryRoot);
  if (JSON.stringify(build.routes) !== JSON.stringify(accessibilitySmokeRoutes)) {
    throw new Error("Accessibility route inventory differs from the reviewed Web build inventory.");
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
    `Verified ${accessibilitySmokeRoutes.length} public routes with ${scans} axe scans (${reviewedContrastNodes} color-contrast nodes retained for the existing token/manual review), forward/reverse keyboard focus, 40% expanded text, desktop/mobile RTL mirroring, a persistent online/offline/online advisory announcement, 44px targets, dark/reduced-motion and no-JavaScript states, and local-only requests.`,
  );
};

await run();
