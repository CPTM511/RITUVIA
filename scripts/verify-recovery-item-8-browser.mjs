import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
assert.ok(configuredUrl, "RITUVIA_RECOVERY_STAGING_URL is required.");

const accessUrl = new URL(configuredUrl);
const baseUrl = new URL(configuredUrl);
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";
const origin = baseUrl.origin;
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
const expectedRecoveryItem = Number(process.env.RITUVIA_EXPECTED_RECOVERY_ITEM ?? "8");
assert.ok(Number.isSafeInteger(expectedRecoveryItem) && expectedRecoveryItem > 0);
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const browserProxyServer = process.env.RITUVIA_BROWSER_PROXY_SERVER?.trim();
const artifactRoot = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-8",
);
const artifactDirectory = path.join(
  artifactRoot,
  new Date().toISOString().replaceAll(/[:.]/gu, "-"),
);
await mkdir(artifactDirectory, { recursive: true });

const extraHTTPHeaders =
  bypass === undefined || bypass === ""
    ? undefined
    : {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      };
const forbiddenRequestPattern =
  /\/(?:api\/v1\/(?:orders|checkout|entitlements|me|privacy)|interpretation|providers?)(?:\/|$)/u;
const privateInputPattern = /(?:2000-01-01|07:00|1990-11-28)/u;
const profiles = Object.freeze({
  desktop: Object.freeze({ height: 900, width: 1_440 }),
  mobile: Object.freeze({ height: 844, width: 390 }),
});
const isExpectedHostedPlatformConsoleNoise = (message) =>
  message.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
  message.includes("violates the following Content Security Policy directive");

const assertAxe = async (page) => {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact }) => `${impact}:${id}`),
    [],
  );
};

const assertLayout = async (page) => {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.documentWidth <= dimensions.viewportWidth + 1);
  return dimensions;
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

const assertStorageIsPrivate = async (page) => {
  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  assert.equal(privateInputPattern.test(JSON.stringify(storage)), false);
  return storage;
};

const browser = await chromium.launch({
  headless: true,
  proxy:
    browserProxyServer === undefined || browserProxyServer === ""
      ? undefined
      : { server: browserProxyServer },
});
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
  const url = new URL(request.url());
  requests.push({ method: request.method(), pathname: url.pathname });
});
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.origin !== origin) return;
  responseEvidence.push({
    method: response.request().method(),
    pathname: url.pathname,
    requestId: response.headers()["x-request-id"] ?? "unavailable",
    status: response.status(),
  });
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

const calculateAstrology = async ({
  approximationWindow,
  certainty,
  expectedConfidence,
  expectedPlacements,
}) => {
  await page.getByLabel("Birth-time certainty").selectOption(certainty);
  if (certainty !== "unknown") {
    await page.getByLabel("Synthetic local birth time").fill("07:00");
  }
  if (certainty === "approximate") {
    await page.getByLabel("Uncertainty window").selectOption(String(approximationWindow));
  }
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/recovery/item-8/astrology" &&
      response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "Calculate natal facts" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const body = await response.json();
  assert.equal(body.item.facts.confidence.messageCode, expectedConfidence);
  assert.equal(body.item.facts.placements.length, expectedPlacements);
  assert.equal(body.item.facts.approximationWindowMinutes, approximationWindow);
  await page
    .getByText(
      expectedConfidence === "EXACT_TIME_FULL_FACTS"
        ? "Exact-time facts"
        : expectedConfidence === "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED"
          ? "Approximate-time facts"
          : "Unknown-time boundary",
      { exact: true },
    )
    .waitFor();
  return {
    aspectCount: body.item.facts.aspects.length,
    confidence: body.item.facts.confidence.messageCode,
    hasHouses: body.item.facts.houses !== null,
    placementCount: body.item.facts.placements.length,
  };
};

let protectionBootstrapStatus;
try {
  if (accessUrl.searchParams.has("_vercel_share")) {
    const bootstrap = await context.request.get(accessUrl.toString(), { timeout: 60_000 });
    protectionBootstrapStatus = bootstrap.status();
    assert.ok([200, 404].includes(protectionBootstrapStatus));
  }

  const health = await context.request.get("/api/recovery/health");
  assert.equal(health.status(), 200);
  const healthBody = await health.json();
  assert.equal(healthBody.environment, "staging");
  assert.equal(healthBody.recoveryItem, expectedRecoveryItem);
  if (expectedSourceSha !== undefined && expectedSourceSha !== "") {
    assert.equal(healthBody.sourceSha, expectedSourceSha);
  }

  const readiness = await context.request.get("/api/recovery/readiness");
  assert.equal(readiness.status(), 200);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.status, "ready");
  assert.equal(readinessBody.controls.nativeAstrology, "enabled");
  assert.equal(readinessBody.controls.numerologyEngine, "enabled");
  assert.equal(readinessBody.controls.timeZoneRuntime, "pinned");
  assert.equal(readinessBody.controls.productionProviders, "disabled");

  const deniedEvidence = [];
  for (const denied of [
    { method: "GET", pathname: "/en/account" },
    { method: "GET", pathname: "/api/v1/readings/astrology/natal" },
    { method: "GET", pathname: "/en/numerology" },
    { method: "GET", pathname: "/en/astrology" },
    { method: "GET", pathname: "/zh-Hans/readings/numerology" },
    { method: "GET", pathname: "/zh-Hans/readings/astrology" },
    { method: "POST", pathname: "/api/v1/orders" },
  ]) {
    const response = await context.request.fetch(denied.pathname, { method: denied.method });
    assert.equal(response.status(), 404, `${denied.method} ${denied.pathname}`);
    deniedEvidence.push({ ...denied, status: response.status() });
  }

  await page.goto("/en/readings/numerology", { timeout: 60_000, waitUntil: "load" });
  assert.equal(new URL(page.url()).search, "");
  await page.getByLabel("Birth date").fill("1990-11-28");
  await page.getByLabel("Target year").fill("2026");
  const numerologyResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/numerology/calculate",
  );
  await page.getByRole("button", { name: "Calculate my numbers" }).click();
  const numerologyResponse = await numerologyResponsePromise;
  assert.equal(numerologyResponse.status(), 200);
  const numerologyFacts = await numerologyResponse.json();
  assert.deepEqual(
    numerologyFacts.calculations.map(({ result }) => result),
    [4, 1, 22],
  );
  await page.getByRole("heading", { name: "Your number pattern" }).waitFor();
  assert.match(await page.locator("main").innerText(), /AGPL-3\.0-only/u);
  assert.match(await page.locator("main").innerText(), /No Provider AI/u);
  await assertAxe(page);
  const numerologyDesktopLayout = await assertLayout(page);
  const numerologyDesktopScreenshot = path.join(artifactDirectory, "numerology-desktop.png");
  await page.screenshot({ fullPage: true, path: numerologyDesktopScreenshot });
  const numerologyStorage = await assertStorageIsPrivate(page);

  await page.goto("/en/readings/astrology", { timeout: 60_000, waitUntil: "load" });
  assert.equal(new URL(page.url()).search, "");
  await page.getByLabel("Synthetic birth date").fill("2000-01-01");
  await page.getByLabel("Synthetic local birth time").fill("25:00");
  await page.getByRole("button", { name: "Calculate natal facts" }).click();
  await page.getByText("Check the form", { exact: true }).waitFor();
  await page.getByLabel("Synthetic birth date").fill("2000-01-01");
  await page.getByLabel("Synthetic local birth time").fill("07:00");

  const exact = await calculateAstrology({
    approximationWindow: null,
    certainty: "exact",
    expectedConfidence: "EXACT_TIME_FULL_FACTS",
    expectedPlacements: 11,
  });
  assert.equal(exact.hasHouses, true);
  assert.ok(exact.aspectCount > 0);
  assert.equal((await page.locator("table").count()) >= 3, true);

  const approximate = await calculateAstrology({
    approximationWindow: 90,
    certainty: "approximate",
    expectedConfidence: "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED",
    expectedPlacements: 11,
  });
  assert.equal(approximate.hasHouses, false);
  assert.equal(approximate.aspectCount, 0);

  const unknown = await calculateAstrology({
    approximationWindow: null,
    certainty: "unknown",
    expectedConfidence: "UNKNOWN_TIME_NO_PLACEMENTS",
    expectedPlacements: 0,
  });
  assert.equal(unknown.hasHouses, false);
  assert.equal(unknown.aspectCount, 0);
  assert.equal(await page.locator(".astrology-wheel").count(), 0);
  assert.equal(await page.locator("table").count(), 0);
  assert.match(await page.locator("main").innerText(), /Swiss Ephemeris 2\.10\.03/u);
  assert.match(await page.locator("main").innerText(), /AGPL-3\.0-only/u);
  assert.match(await page.locator("main").innerText(), /Node 24\.18\.0, ICU 78\.3, tzdata 2026b/u);
  assert.match(
    await page
      .getByRole("link", { name: /Review this deployed source revision/u })
      .getAttribute("href"),
    new RegExp(`${healthBody.sourceSha}$`, "u"),
  );
  await assertAxe(page);
  const astrologyDesktopLayout = await assertLayout(page);
  const astrologyDesktopScreenshot = path.join(artifactDirectory, "astrology-desktop.png");
  await page.screenshot({ fullPage: true, path: astrologyDesktopScreenshot });
  const astrologyStorage = await assertStorageIsPrivate(page);

  await page.setViewportSize(profiles.mobile);
  await page.goto("/en/readings/numerology", { timeout: 60_000, waitUntil: "load" });
  await assertTouchTargets(page);
  const numerologyMobileLayout = await assertLayout(page);
  await assertAxe(page);
  const numerologyMobileScreenshot = path.join(artifactDirectory, "numerology-mobile.png");
  await page.screenshot({ fullPage: true, path: numerologyMobileScreenshot });

  await page.goto("/en/readings/astrology", { timeout: 60_000, waitUntil: "load" });
  await page.getByLabel("Synthetic birth date").fill("2000-01-01");
  await page.getByLabel("Birth-time certainty").selectOption("unknown");
  await page.getByRole("button", { name: "Calculate natal facts" }).tap();
  await page.getByText("Unknown-time boundary", { exact: true }).waitFor();
  await assertTouchTargets(page);
  const astrologyMobileLayout = await assertLayout(page);
  await assertAxe(page);
  const astrologyMobileScreenshot = path.join(artifactDirectory, "astrology-mobile.png");
  await page.screenshot({ fullPage: true, path: astrologyMobileScreenshot });
  const finalStorage = await assertStorageIsPrivate(page);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(
    consoleErrors.filter(
      (message) =>
        !message.startsWith("Failed to load resource:") &&
        !isExpectedHostedPlatformConsoleNoise(message),
    ),
    [],
  );
  assert.deepEqual(
    requests.filter(({ pathname }) => forbiddenRequestPattern.test(pathname)),
    [],
  );

  const evidence = {
    accessibility: { criticalOrSeriousViolations: 0 },
    astrology: { approximate, exact, unknown },
    browserProxyUsed: browserProxyServer !== undefined && browserProxyServer !== "",
    deniedEvidence,
    environment: healthBody.environment,
    layouts: {
      astrologyDesktopLayout,
      astrologyMobileLayout,
      numerologyDesktopLayout,
      numerologyMobileLayout,
    },
    mockFulfillmentCount: 0,
    numerology: { results: [4, 1, 22] },
    origin,
    productionProviders: readinessBody.controls.productionProviders,
    protectionBootstrapStatus,
    recoveryItem: healthBody.recoveryItem,
    requestCount: requests.length,
    responseEvidence,
    screenshots: [
      astrologyDesktopScreenshot,
      astrologyMobileScreenshot,
      numerologyDesktopScreenshot,
      numerologyMobileScreenshot,
    ],
    sourceSha: healthBody.sourceSha,
    status: "passed",
    storageKeys: {
      astrology:
        Object.keys(astrologyStorage.local).length + Object.keys(astrologyStorage.session).length,
      final: Object.keys(finalStorage.local).length + Object.keys(finalStorage.session).length,
      numerology:
        Object.keys(numerologyStorage.local).length + Object.keys(numerologyStorage.session).length,
    },
  };
  await writeFile(
    path.join(artifactDirectory, "browser-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Recovery Item 8 numerology and astrology with zero mocked routes. Artifact: ${artifactDirectory}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}
