import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import {
  astrologyNatalBodies,
  astrologyNatalRequestSchemaVersion,
  astrologyNativeExecutionSchemaVersion,
  createAstrologyEphemerisAdapterV1,
} from "../packages/divination/dist/index.js";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4187;
const origin = `http://${host}:${port}`;
const astrologyPath = "/en/readings/astrology";
const astrologyApiPath = "/api/v1/readings/astrology/natal";

const digest = "a".repeat(64);
const engine = Object.freeze({
  abiVersion: "darwin-arm64-clang",
  adapterVersion: "1.0.0",
  binarySha256: digest,
  compilerFlagsSha256: "b".repeat(64),
  compilerId: "Apple clang 17",
  dataInventorySha256: "c".repeat(64),
  libraryVersion: "2.10.03",
  nativeSbomSha256: "d".repeat(64),
  sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
  sourceInventorySha256: "e".repeat(64),
  sourceSnapshotTag: "v2.10.3final",
});
const request = Object.freeze({
  approximationWindowMinutes: null,
  houseSystem: "placidus",
  inputSnapshotSha256: "f".repeat(64),
  latitudeE6: 40_712_800,
  longitudeE6: -74_006_000,
  method: Object.freeze({
    aspectPolicyVersion: "rituvia-major-aspects.v1",
    catalogSha256: "b9711f18e41d27807616493c1624ac9633d538c78d91d2fc1436fe99fa4b885f",
    methodVersion: "rituvia-western-natal.v1",
    node: "true_node",
    zodiac: "tropical",
  }),
  profileRevision: 3,
  schemaVersion: astrologyNatalRequestSchemaVersion,
  timeCertainty: "exact",
  timeZoneProvenanceSha256: "1".repeat(64),
  utcInstant: "2000-01-01T12:00:00.000Z",
});
const execution = Object.freeze({
  angles: Object.freeze({
    armcDegrees: 281.282,
    ascendantDegrees: 24.293,
    midheavenDegrees: 283.11,
    vertexDegrees: 167.2,
  }),
  engineVersion: "2.10.03",
  houseCuspsDegrees: Object.freeze([
    24.293, 51.2, 76.4, 103.11, 132.8, 164.2, 204.293, 231.2, 256.4, 283.11, 312.8, 344.2,
  ]),
  julianDayUt: 2_451_545,
  positions: Object.freeze(
    astrologyNatalBodies.map((body, index) =>
      Object.freeze({
        body,
        distanceAu: index === 1 ? 0.0027 : 1 + index,
        latitudeDegrees: 0,
        longitudeDegrees: (280 + index * 31) % 360,
        longitudeSpeedDegreesPerDay: index === 9 ? -0.01 : 1,
        returnedEphemerisFlags: 258,
      }),
    ),
  ),
  schemaVersion: astrologyNativeExecutionSchemaVersion,
});
const adapter = (reviewedExecution) =>
  createAstrologyEphemerisAdapterV1({ execute: async () => reviewedExecution }, engine);
const exactFacts = await adapter(execution).calculateNatal(request);
const approximateFacts = await adapter({
  ...execution,
  angles: null,
  houseCuspsDegrees: null,
}).calculateNatal({
  ...request,
  approximationWindowMinutes: 90,
  timeCertainty: "approximate",
});
const unknownFacts = await adapter(execution).calculateNatal({
  ...request,
  timeCertainty: "unknown",
  utcInstant: null,
});
const responseFor = (facts) => ({
  item: {
    calculationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-27T08:00:00.000Z",
    facts: {
      approximationWindowMinutes: facts.approximationWindowMinutes,
      aspects: facts.aspects,
      calculationStatus: facts.calculationStatus,
      confidence: facts.confidence,
      engine: {
        abiVersion: facts.engine.abiVersion,
        adapterVersion: facts.engine.adapterVersion,
        libraryVersion: facts.engine.libraryVersion,
        sourceCommit: facts.engine.sourceCommit,
        sourceSnapshotTag: facts.engine.sourceSnapshotTag,
      },
      houseSystem: facts.houseSystem,
      houses: facts.houses,
      julianDayUt: facts.julianDayUt,
      method: {
        aspectPolicyVersion: facts.method.aspectPolicyVersion,
        methodVersion: facts.method.methodVersion,
        node: facts.method.node,
        zodiac: facts.method.zodiac,
      },
      placements: facts.placements,
      profileRevision: facts.profileRevision,
      requestedEphemerisFlags: facts.requestedEphemerisFlags,
      schemaVersion: "astrology-natal-view-facts.v1",
    },
  },
  schemaVersion: "astrology-natal-view-response.v1",
});

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Astrology browser server exited before ready.");
    try {
      const response = await fetch(`${origin}${astrologyPath}`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Astrology browser server did not become ready.");
};

const stopServer = async (server) => {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: { ...process.env, BRAND_CANONICAL_ORIGIN: origin },
  stdio: ["ignore", "ignore", "pipe"],
});
let serverError = "";
server.stderr?.on("data", (chunk) => {
  serverError += String(chunk);
});

const browser = await chromium.launch({ headless: true });
try {
  await waitForServer(server);
  let responseMode = "exact";
  const requests = [];
  const unexpected = [];
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  await context.route("**/api/v1/**", async (route) => {
    const requestRecord = route.request();
    const url = new URL(requestRecord.url());
    const key = `${requestRecord.method()}:${url.pathname}`;
    requests.push({ key, search: url.search });
    if (key === "GET:/api/v1/me") {
      return route.fulfill({
        body: JSON.stringify({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }),
        contentType: "application/json",
        status: 401,
      });
    }
    if (key === `GET:${astrologyApiPath}`) {
      if (responseMode === "unauthorized") {
        return route.fulfill({ body: "{}", contentType: "application/json", status: 401 });
      }
      if (responseMode === "unavailable") {
        return route.fulfill({ body: "{}", contentType: "application/json", status: 503 });
      }
      const facts =
        responseMode === "approximate"
          ? approximateFacts
          : responseMode === "unknown"
            ? unknownFacts
            : exactFacts;
      return route.fulfill({
        body: JSON.stringify(
          responseMode === "empty"
            ? { item: null, schemaVersion: "astrology-natal-view-response.v1" }
            : responseFor(facts),
        ),
        contentType: "application/json",
        headers: {
          "cache-control": "private, no-store, max-age=0",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
        status: 200,
      });
    }
    unexpected.push(key);
    return route.abort("blockedbyclient");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(7_500);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    const expectedPrivateStatus =
      message.text().includes("401") ||
      (responseMode === "unavailable" && message.text().includes("503"));
    if (message.type() === "error" && !expectedPrivateStatus) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const scan = async () => {
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations
      .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
      .map((finding) => `${finding.impact}:${finding.id}`);
    assert.deepEqual(serious, []);
    const incomplete = result.incomplete.filter(
      (finding) => finding.impact === "critical" || finding.impact === "serious",
    );
    assert.ok(
      incomplete.every((finding) => finding.id === "color-contrast"),
      JSON.stringify(incomplete.map(({ id, impact }) => ({ id, impact }))),
    );
    return incomplete.flatMap((finding) => finding.nodes).length;
  };

  await page.goto(astrologyPath, { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Your latest saved natal facts" }).waitFor();
  const exactIncomplete = await scan();
  assert.equal(await page.locator(".astrology-wheel").count(), 1);
  assert.equal(await page.locator("#astrology-placements-heading + div tbody tr").count(), 11);
  assert.equal(await page.locator("#astrology-houses-heading + div tbody tr").count(), 12);
  assert.equal(await page.getByRole("heading", { name: "Angles" }).count(), 1);
  assert.equal(await page.getByRole("heading", { name: "Major aspects" }).count(), 1);
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute("content"),
    "noindex, nofollow",
  );
  await page.locator(".astrology-table-scroll").first().focus();
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("astrology-table-scroll")),
    true,
  );
  const summarySize = await page.locator(".astrology-method summary").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return { height: rectangle.height, width: rectangle.width };
  });
  assert.ok(summarySize.height >= 44 && summarySize.width >= 44);

  responseMode = "approximate";
  await page.reload({ waitUntil: "load" });
  await page.getByText("Approximate-time facts", { exact: true }).waitFor();
  assert.match(await page.locator(".astrology-result").textContent(), /90 minutes/u);
  assert.equal(await page.getByRole("heading", { name: "House cusps" }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Angles" }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Major aspects" }).count(), 0);

  responseMode = "unknown";
  await page.reload({ waitUntil: "load" });
  await page.getByText("Unknown-time boundary", { exact: true }).waitFor();
  assert.equal(await page.locator(".astrology-wheel").count(), 0);
  assert.equal(await page.locator(".astrology-table-section").count(), 0);

  responseMode = "empty";
  await page.reload({ waitUntil: "load" });
  await page.getByText("There is no saved chart yet", { exact: true }).waitFor();
  assert.equal(await page.locator(".astrology-result").count(), 0);

  responseMode = "unauthorized";
  await page.reload({ waitUntil: "load" });
  await page.getByText("Sign in is required", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Sign in to view saved charts" }).getAttribute("href"),
    "/en/sign-in",
  );

  responseMode = "unavailable";
  await page.reload({ waitUntil: "load" });
  await page.getByText("The saved chart is unavailable", { exact: true }).waitFor();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Try loading again" }).click();
  await page.getByText("You appear to be offline", { exact: true }).waitFor();
  await context.setOffline(false);

  responseMode = "exact";
  await page.getByRole("button", { name: "Check connection and try again" }).click();
  await page.getByRole("heading", { name: "Your latest saved natal facts" }).waitFor();
  await page.addStyleTag({ content: "html { font-size: 400% !important; }" });
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  const reflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    overflowers: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rectangle = element.getBoundingClientRect();
        return {
          className: element.getAttribute("class"),
          left: rectangle.left,
          right: rectangle.right,
          tagName: element.tagName,
          width: rectangle.width,
        };
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
      .slice(0, 12),
    storage: localStorage.length + sessionStorage.length,
    viewportWidth: window.innerWidth,
    wheelDirection: getComputedStyle(document.querySelector(".astrology-wheel")).direction,
  }));
  assert.ok(
    reflow.documentWidth <= reflow.viewportWidth,
    JSON.stringify({
      documentWidth: reflow.documentWidth,
      overflowers: reflow.overflowers,
      viewportWidth: reflow.viewportWidth,
    }),
  );
  assert.equal(reflow.storage, 0);
  assert.equal(reflow.wheelDirection, "ltr");

  const astrologyRequests = requests.filter(({ key }) => key === `GET:${astrologyApiPath}`);
  assert.ok(astrologyRequests.length >= 7);
  assert.ok(astrologyRequests.every(({ search }) => search === ""));
  assert.deepEqual(unexpected, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  process.stdout.write(
    `${JSON.stringify({
      astrologyGets: astrologyRequests.length,
      axeCriticalOrSeriousViolations: 0,
      axeIncompleteColorContrastNodes: exactIncomplete,
      browserStorageEntries: reflow.storage,
      forcedColors: true,
      mobileHorizontalOverflow: reflow.documentWidth > reflow.viewportWidth,
      privateQueryRequests: astrologyRequests.filter(({ search }) => search !== "").length,
      reducedMotion: true,
      route: astrologyPath,
      rtlWheelDirection: reflow.wheelDirection,
      zoomPercent: 400,
    })}\n`,
  );
} finally {
  await browser.close();
  await stopServer(server);
  if (serverError !== "" && server.exitCode !== 0 && server.exitCode !== null) {
    process.stderr.write(serverError);
  }
}
