import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
assert.ok(configuredUrl, "RITUVIA_RECOVERY_STAGING_URL is required.");

const configuredBaseUrl = new URL(configuredUrl);
configuredBaseUrl.pathname = "/";
configuredBaseUrl.search = "";
configuredBaseUrl.hash = "";
const origin = configuredBaseUrl.origin;
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const artifactRoot = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-7-tarot",
);
const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const artifactDirectory = path.join(artifactRoot, timestamp);
await mkdir(artifactDirectory, { recursive: true });

const extraHTTPHeaders =
  bypass === undefined || bypass === ""
    ? undefined
    : {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const forbiddenRequestPattern = /\/(?:interpretation|providers?)(?:\/|$)/u;
const unsafeClaimPattern =
  /\b(?:guarantee(?:d|s)?|will definitely|certain future|curse removal|exorcism|death timing|medical diagnosis|legal outcome|investment certainty)\b/iu;

const profiles = Object.freeze({
  desktop: Object.freeze({ height: 900, width: 1_440 }),
  mobile: Object.freeze({ height: 844, width: 390 }),
});

const safeUrl = (value) => {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
};

const assertAxe = async (page) => {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact }) => `${impact}:${id}`),
    [],
  );
  assert.deepEqual(
    result.incomplete
      .filter(
        ({ id, impact }) =>
          id !== "color-contrast" && (impact === "critical" || impact === "serious"),
      )
      .map(({ id, impact }) => `${impact}:${id}`),
    [],
  );
  return result.incomplete.filter(({ id }) => id === "color-contrast").flatMap(({ nodes }) => nodes)
    .length;
};

const assertLayout = async (page) => {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  assert.ok(overflow.documentWidth <= overflow.viewportWidth + 1);
  return overflow;
};

const assertTouchTargets = async (page) => {
  const failures = await page.locator("main button:visible, main a:visible").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rectangle = node.getBoundingClientRect();
        return !node.hasAttribute("disabled") && (rectangle.width < 44 || rectangle.height < 44);
      })
      .map((node) => node.textContent?.trim() ?? node.tagName),
  );
  assert.deepEqual(failures, []);
};

const activateWithKeyboard = async (locator) => {
  await locator.click({ trial: true });
  await locator.focus();
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true);
  await locator.press("Enter");
};

const assertReading = (reading, readingType) => {
  const expectedCount = readingType === "one_card" ? 1 : 3;
  assert.match(reading.readingId, uuidPattern);
  assert.equal(reading.readingType, readingType);
  assert.equal(reading.schemaVersion, "tarot-reading-response.v2");
  assert.equal(reading.facts.catalog.id, "rituvia.major-arcana-catalog");
  assert.equal(reading.facts.catalog.version, "1.0.0");
  assert.equal(reading.facts.positions.length, expectedCount);
  assert.equal(reading.presentation.cards.length, expectedCount);
  assert.equal(new Set(reading.facts.positions.map(({ cardId }) => cardId)).size, expectedCount);
  assert.deepEqual(
    reading.presentation.cards.map(({ cardId, order, orientation, positionId }) => ({
      cardId,
      order,
      orientation,
      positionId,
    })),
    reading.facts.positions,
  );
  if (readingType === "three_card") {
    assert.deepEqual(
      reading.facts.positions.map(({ positionId }) => positionId),
      ["situation", "action", "possibility"],
    );
  }
  assert.equal(unsafeClaimPattern.test(JSON.stringify(reading.presentation)), false);
};

const collectVisibleCards = async (page) =>
  await page.locator(".tarot-result-card").evaluateAll((cards) =>
    cards.map((card) => {
      const eyebrows = [...card.querySelectorAll("header .tarot-result-eyebrow")];
      return {
        cardTitle: card.querySelector("h3")?.textContent?.trim(),
        orientation: eyebrows[1]?.textContent?.trim(),
        positionTitle: eyebrows[0]?.textContent?.trim(),
      };
    }),
  );

const expectedVisibleCards = (reading) =>
  reading.presentation.cards.map(({ cardTitle, orientation, positionTitle }) => ({
    cardTitle,
    orientation: orientation === "upright" ? "Upright" : "Reversed",
    positionTitle,
  }));

const waitForReadingResponse = (page, method) =>
  page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === method &&
        (method === "POST"
          ? url.pathname === "/api/v1/readings/tarot"
          : /^\/api\/v1\/readings\/[0-9a-f-]+$/u.test(url.pathname))
      );
    },
    { timeout: 60_000 },
  );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: origin,
  colorScheme: "dark",
  extraHTTPHeaders,
  hasTouch: true,
  locale: "en-US",
  reducedMotion: "reduce",
  timezoneId: "Asia/Shanghai",
  viewport: profiles.desktop,
});
const page = await context.newPage();
const requests = [];
const responseEvidence = [];
const pageErrors = [];
const consoleErrors = [];
page.on("request", (request) => {
  requests.push({ method: request.method(), url: safeUrl(request.url()) });
});
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.origin !== origin) return;
  responseEvidence.push({
    method: response.request().method(),
    pathname: url.pathname,
    requestId:
      response.headers()["x-request-id"] ??
      response.headers()["x-rituvia-correlation-id"] ??
      "unavailable",
    status: response.status(),
  });
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

const acceptance = {};
const deniedEvidence = [];
try {
  const health = await context.request.get("/api/recovery/health");
  assert.equal(health.status(), 200);
  const healthBody = await health.json();
  assert.equal(healthBody.environment, "staging");
  assert.equal(healthBody.recoveryItem, 7);
  if (expectedSourceSha !== undefined && expectedSourceSha !== "") {
    assert.equal(healthBody.sourceSha, expectedSourceSha);
  }

  const readiness = await context.request.get("/api/recovery/readiness");
  assert.equal(readiness.status(), 200);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.status, "ready");
  assert.equal(readinessBody.controls.database, "connected");
  assert.equal(readinessBody.controls.tarotCatalog, "enabled");
  assert.equal(readinessBody.controls.productionProviders, "disabled");

  const methodology = await context.request.get("/en/methodology");
  assert.equal(methodology.status(), 200);
  for (const denied of [
    { method: "GET", pathname: "/en/account" },
    { method: "GET", pathname: "/en/tarot" },
    { method: "GET", pathname: "/zh-Hans/tarot/one-card" },
    { method: "GET", pathname: "/sitemap.xml" },
    { method: "POST", pathname: "/api/v1/orders" },
    {
      method: "POST",
      pathname: "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation",
    },
  ]) {
    const response = await context.request.fetch(denied.pathname, { method: denied.method });
    assert.equal(response.status(), 404, `${denied.method} ${denied.pathname}`);
    deniedEvidence.push({ ...denied, status: response.status() });
  }

  const runFlow = async ({
    drawName,
    path: pathname,
    readingType,
    readyHeading,
    resultHeading,
    revealName,
  }) => {
    await page.goto(pathname, { timeout: 60_000, waitUntil: "load" });
    await page.getByLabel("Open reflection").check();
    const createResponsePromise = waitForReadingResponse(page, "POST");
    await activateWithKeyboard(page.getByRole("button", { name: drawName }));
    const createResponse = await createResponsePromise;
    assert.equal(createResponse.status(), 201);
    const reading = await createResponse.json();
    assertReading(reading, readingType);
    await page.getByRole("heading", { name: readyHeading }).waitFor();
    await activateWithKeyboard(page.getByRole("button", { name: revealName }));
    await page.getByRole("heading", { name: resultHeading }).waitFor();
    assert.deepEqual(await collectVisibleCards(page), expectedVisibleCards(reading));
    await page
      .getByText("Provider AI is disabled in protected staging", { exact: false })
      .waitFor();
    assert.equal(
      await page.getByText("Explore a deeper interpretation", { exact: true }).count(),
      0,
    );
    assert.equal(await page.getByText("Share this card", { exact: true }).count(), 0);
    assert.equal(await page.locator(".tarot-report textarea").count(), 0);
    assert.equal(await page.getByText("There is no free-text field", { exact: false }).count(), 1);
    const methodologyLink = page.getByRole("link", { name: "Read the methodology" });
    assert.equal(await methodologyLink.getAttribute("href"), "/en/methodology");
    const desktopAxeColorContrastIncomplete = await assertAxe(page);
    const desktopLayout = await assertLayout(page);
    const desktopScreenshot = path.join(artifactDirectory, `${readingType}-desktop.png`);
    await page.screenshot({ fullPage: true, path: desktopScreenshot });

    const restoreResponsePromise = waitForReadingResponse(page, "GET");
    await page.reload({ timeout: 60_000, waitUntil: "load" });
    const restoreResponse = await restoreResponsePromise;
    assert.equal(restoreResponse.status(), 200);
    assert.deepEqual(await restoreResponse.json(), reading);
    await page.getByRole("heading", { name: readyHeading }).waitFor();
    await activateWithKeyboard(page.getByRole("button", { name: revealName }));
    await page.getByRole("heading", { name: resultHeading }).waitFor();
    assert.deepEqual(await collectVisibleCards(page), expectedVisibleCards(reading));

    const sanctuaryLink = page.getByRole("link", { name: "Continue to a private intention" });
    await Promise.all([
      page.waitForURL("**/en/sanctuary", { timeout: 60_000 }),
      activateWithKeyboard(sanctuaryLink),
    ]);
    await page.getByRole("heading", { name: "Set an intention" }).waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("rituvia.sanctuary-reading.v1")),
      reading.readingId,
    );

    return {
      desktopAxeColorContrastIncomplete,
      desktopLayout,
      desktopScreenshot,
      reading,
    };
  };

  acceptance.oneCard = await runFlow({
    drawName: "Draw one card",
    path: "/en/tarot/one-card",
    readingType: "one_card",
    readyHeading: "Your card is ready",
    resultHeading: "Your one-card reflection",
    revealName: "Reveal my card",
  });
  acceptance.threeCard = await runFlow({
    drawName: "Draw three cards",
    path: "/en/tarot/three-card",
    readingType: "three_card",
    readyHeading: "Your three cards are ready",
    resultHeading: "Your three-card reflection",
    revealName: "Reveal the three cards",
  });

  const sessionStatus = await page.evaluate(async (idempotencyKey) => {
    const response = await fetch("/api/v1/anonymous/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "idempotency-key": idempotencyKey },
      method: "POST",
    });
    return response.status;
  }, randomUUID());
  assert.equal(sessionStatus, 204);
  const idempotencyKey = randomUUID();
  const requestBody = {
    locale: "en",
    readingType: "one_card",
    schemaVersion: "tarot-reading-create.v1",
    themeCode: "gratitude",
  };
  const [firstIdempotentResponse, replayedIdempotentResponse] = await page.evaluate(
    async ({ body, key }) => {
      const create = async () => {
        const response = await fetch("/api/v1/readings/tarot", {
          body: JSON.stringify(body),
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": key,
          },
          method: "POST",
        });
        return { body: await response.json(), status: response.status };
      };
      return [await create(), await create()];
    },
    { body: requestBody, key: idempotencyKey },
  );
  assert.equal(firstIdempotentResponse.status, 201);
  assert.equal(replayedIdempotentResponse.status, 200);
  const firstIdempotentReading = firstIdempotentResponse.body;
  const replayedIdempotentReading = replayedIdempotentResponse.body;
  assertReading(firstIdempotentReading, "one_card");
  assert.deepEqual(replayedIdempotentReading, firstIdempotentReading);
  assert.notEqual(firstIdempotentReading.readingId, acceptance.oneCard.reading.readingId);

  await page.setViewportSize(profiles.mobile);
  for (const flow of [
    {
      drawName: "Draw one card",
      path: "/en/tarot/one-card",
      readingType: "one_card",
      readyHeading: "Your card is ready",
      resultHeading: "Your one-card reflection",
      revealName: "Reveal my card",
    },
    {
      drawName: "Draw three cards",
      path: "/en/tarot/three-card",
      readingType: "three_card",
      readyHeading: "Your three cards are ready",
      resultHeading: "Your three-card reflection",
      revealName: "Reveal the three cards",
    },
  ]) {
    const acceptanceKey = flow.readingType === "one_card" ? "oneCard" : "threeCard";
    await page.goto(flow.path, { timeout: 60_000, waitUntil: "load" });
    await page.getByRole("heading", { name: flow.readyHeading }).waitFor();
    await page.getByRole("button", { name: flow.revealName }).tap();
    await page.getByRole("heading", { name: flow.resultHeading }).waitFor();
    await page.getByRole("button", { name: "Start a new reflection" }).tap();
    await page.getByText("Open reflection", { exact: true }).first().tap();
    const mobileCreateResponsePromise = waitForReadingResponse(page, "POST");
    await page.getByRole("button", { name: flow.drawName }).tap();
    const mobileCreateResponse = await mobileCreateResponsePromise;
    assert.equal(mobileCreateResponse.status(), 201);
    const mobileReading = await mobileCreateResponse.json();
    assertReading(mobileReading, flow.readingType);
    assert.notEqual(mobileReading.readingId, acceptance[acceptanceKey].reading.readingId);
    await page.getByRole("heading", { name: flow.readyHeading }).waitFor();
    await page.getByRole("button", { name: flow.revealName }).tap();
    await page.getByRole("heading", { name: flow.resultHeading }).waitFor();
    assert.deepEqual(await collectVisibleCards(page), expectedVisibleCards(mobileReading));
    const mobileSanctuaryLink = page.getByRole("link", {
      name: "Continue to a private intention",
    });
    await Promise.all([
      page.waitForURL("**/en/sanctuary", { timeout: 60_000 }),
      mobileSanctuaryLink.tap(),
    ]);
    await page.getByRole("heading", { name: "Set an intention" }).waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("rituvia.sanctuary-reading.v1")),
      mobileReading.readingId,
    );
    await page.goto(flow.path, { timeout: 60_000, waitUntil: "load" });
    await page.getByRole("heading", { name: flow.readyHeading }).waitFor();
    await page.getByRole("button", { name: flow.revealName }).tap();
    await page.getByRole("heading", { name: flow.resultHeading }).waitFor();
    await assertTouchTargets(page);
    const mobileLayout = await assertLayout(page);
    const mobileAxeColorContrastIncomplete = await assertAxe(page);
    const mobileScreenshot = path.join(artifactDirectory, `${flow.readingType}-mobile.png`);
    await page.screenshot({ fullPage: true, path: mobileScreenshot });
    acceptance[acceptanceKey] = {
      ...acceptance[acceptanceKey],
      mobileAxeColorContrastIncomplete,
      mobileLayout,
      mobileReading,
      mobileScreenshot,
    };
  }

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(
    consoleErrors.filter((message) => !message.startsWith("Failed to load resource:")),
    [],
  );
  assert.deepEqual(
    requests.filter(({ url }) => forbiddenRequestPattern.test(new URL(url).pathname)),
    [],
  );
  const browserStorage = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("rituvia."))
        .sort()
        .map((key) => [key, sessionStorage.getItem(key)]),
    ),
  );
  assert.equal(
    Object.values(browserStorage).every((value) => uuidPattern.test(value ?? "")),
    true,
  );
  assert.deepEqual(
    responseEvidence.filter(({ pathname, status }) => status >= 400 && pathname !== "/favicon.ico"),
    [],
  );

  const evidence = {
    acceptance,
    deniedEvidence,
    environment: healthBody.environment,
    idempotency: {
      firstStatus: firstIdempotentResponse.status,
      readingId: firstIdempotentReading.readingId,
      replayStatus: replayedIdempotentResponse.status,
    },
    mockFulfillmentCount: 0,
    origin,
    productionProviders: readinessBody.controls.productionProviders,
    protectionBypassUsed: bypass !== undefined && bypass !== "",
    recoveryItem: healthBody.recoveryItem,
    requestCount: requests.length,
    responseEvidence,
    sessionStorage: browserStorage,
    sourceSha: healthBody.sourceSha,
    status: "passed",
    tarotCatalog: readinessBody.controls.tarotCatalog,
  };
  await writeFile(
    path.join(artifactDirectory, "browser-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Recovery Item 7 Tarot with zero mocked routes. Artifact: ${artifactDirectory}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}
