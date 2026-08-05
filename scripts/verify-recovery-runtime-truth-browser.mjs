import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const stagingUrl = process.env.RITUVIA_RECOVERY_STAGING_URL;
assert.ok(stagingUrl, "RITUVIA_RECOVERY_STAGING_URL is required.");

const artifactDirectory = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-5-runtime",
);
await mkdir(artifactDirectory, { recursive: true });

const expectedResponses = Object.freeze([
  Object.freeze({ method: "GET", pathname: "/api/recovery/health", status: 200 }),
  Object.freeze({ method: "GET", pathname: "/api/recovery/readiness", status: 200 }),
  Object.freeze({
    method: "GET",
    pathname: "/en/intake",
    status: 200,
  }),
]);

const profiles = Object.freeze([
  Object.freeze({ name: "desktop", viewport: { height: 900, width: 1440 } }),
  Object.freeze({ isMobile: true, name: "mobile", viewport: { height: 844, width: 390 } }),
]);

const browser = await chromium.launch({ headless: true });
const evidence = [];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      isMobile: profile.isMobile ?? false,
      viewport: profile.viewport,
    });
    const page = await context.newPage();
    const pageErrors = [];
    const runtimeResponseEvidence = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const responseUrl = new URL(response.url());
      const expected = expectedResponses.find(
        ({ pathname }) => pathname === responseUrl.pathname && responseUrl.search === "",
      );
      if (!expected) return;
      runtimeResponseEvidence.push(
        response.serverAddr().then((serverAddress) => ({
          environment: response.headers()["x-rituvia-environment"] ?? "unavailable",
          fromServiceWorker: response.fromServiceWorker(),
          method: response.request().method(),
          pathname: responseUrl.pathname,
          requestId: response.headers()["x-request-id"] ?? "unavailable",
          serverAddress,
          sourceSha: response.headers()["x-rituvia-source-sha"] ?? "unavailable",
          status: response.status(),
          vercelRequestId: response.headers()["x-vercel-id"] ?? "unavailable",
        })),
      );
    });

    const entryResponse = await page.goto(stagingUrl, {
      timeout: 120_000,
      waitUntil: "networkidle",
    });
    assert.equal(entryResponse?.status(), 200);
    const entryUrl = new URL(page.url());
    assert.equal(entryUrl.pathname, "/recovery");
    assert.equal(entryUrl.search, "");
    const expectsVercelEdge = entryUrl.hostname.endsWith(".vercel.app");
    if (expectsVercelEdge) assert.equal(entryUrl.protocol, "https:");

    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const runButton = page.getByRole("button", { name: "Run real runtime check" });
    await runButton.focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-runtime-state="passed"]').waitFor({
      state: "visible",
      timeout: 30_000,
    });

    const visibleResults = await page.locator("[data-runtime-result]").evaluateAll((elements) =>
      elements.map((element) => ({
        environment: element.getAttribute("data-runtime-environment"),
        expectedStatus: Number(element.getAttribute("data-runtime-expected-status")),
        method: element.getAttribute("data-runtime-method"),
        pathname: element.getAttribute("data-runtime-path"),
        requestId: element.getAttribute("data-runtime-request-id"),
        sourceSha: element.getAttribute("data-runtime-source-sha"),
        status: Number(element.getAttribute("data-runtime-status")),
      })),
    );
    const runtimeResponses = await Promise.all(runtimeResponseEvidence);

    assert.equal(visibleResults.length, expectedResponses.length);
    assert.equal(runtimeResponses.length, expectedResponses.length);
    assert.deepEqual(
      visibleResults.map(({ method, pathname, status }) => ({ method, pathname, status })),
      expectedResponses,
    );
    assert.deepEqual(
      runtimeResponses.map(({ method, pathname, status }) => ({ method, pathname, status })),
      expectedResponses,
    );

    for (const result of visibleResults) {
      assert.equal(result.environment, "staging");
      assert.equal(result.status, result.expectedStatus);
      assert.match(result.requestId ?? "", /^req_[0-9a-f]{32}$/u);
      assert.match(result.sourceSha ?? "", /^[0-9a-f]{40}$/u);
    }
    for (const result of runtimeResponses) {
      assert.equal(result.environment, "staging");
      assert.equal(result.fromServiceWorker, false);
      assert.match(result.requestId, /^req_[0-9a-f]{32}$/u);
      assert.ok(result.serverAddress);
      assert.ok(result.serverAddress.ipAddress.length > 0);
      assert.ok(Number.isInteger(result.serverAddress.port));
      assert.ok(result.serverAddress.port > 0 && result.serverAddress.port <= 65_535);
      assert.match(result.sourceSha, /^[0-9a-f]{40}$/u);
      if (expectsVercelEdge) assert.notEqual(result.vercelRequestId, "unavailable");
    }
    assert.deepEqual(pageErrors, []);
    await page.getByRole("button", { name: "Retry real runtime check" }).waitFor({
      state: "visible",
    });
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    assert.ok(layout.documentWidth <= layout.viewportWidth);
    const accessibility = await new AxeBuilder({ page }).analyze();
    const blockingAccessibilityViolations = accessibility.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    );
    assert.deepEqual(blockingAccessibilityViolations, []);

    const screenshotPath = path.join(artifactDirectory, `${profile.name}.png`);
    const tracePath = path.join(artifactDirectory, `${profile.name}-trace.zip`);
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await context.tracing.stop({ path: tracePath });
    evidence.push({
      entryStatus: entryResponse?.status(),
      entryUrl: `${entryUrl.origin}${entryUrl.pathname}`,
      mockFulfillmentCount: 0,
      blockingAccessibilityViolations: blockingAccessibilityViolations.length,
      layout,
      pageErrors,
      profile: profile.name,
      runtimeResponses,
      screenshotPath,
      tracePath,
      visibleResults,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ evidence, expectedResponses }, null, 2));
