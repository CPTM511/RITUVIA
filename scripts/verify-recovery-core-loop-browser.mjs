import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
if (configuredUrl === undefined || configuredUrl === "") {
  throw new Error("RITUVIA_RECOVERY_STAGING_URL is required.");
}

const baseUrl = new URL(configuredUrl);
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";
const origin = baseUrl.origin;
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
const artifactRoot =
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR?.trim() ||
  path.join(process.cwd(), "artifacts", "recovery", "item-5");

const privateQuestion = "What small step could I try for item-five-question-canary this week?";
const privateIntention = "I intend to pause before answering the item-five-intention-canary.";
const privateAction = "Take three calm item-five-action-canary breaths before replying.";
const privateJournal = "The item-five-journal-canary helped me notice a calmer response.";
const privateRevisit = "The item-five-revisit-canary confirmed that the pause was useful.";
const privateCanaries = [
  privateQuestion,
  privateIntention,
  privateAction,
  privateJournal,
  privateRevisit,
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const forbiddenApiPattern =
  /\/api\/v1\/(?:accounts?|catalog|checkout|entitlements?|interpretations?|me(?:\/|$)|orders?|payments?|providers?|readings\/tarot\/three-card|revisit-reminders)/u;

const safeUrl = (value) => {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
};

const digest = (value) => createHash("sha256").update(value).digest("hex");

const assertAxe = async (page) => {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations
      .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
      .map((finding) => `${finding.impact}:${finding.id}`),
    [],
  );
  assert.deepEqual(
    result.incomplete
      .filter(
        (finding) =>
          (finding.impact === "critical" || finding.impact === "serious") &&
          finding.id !== "color-contrast",
      )
      .map((finding) => `${finding.impact}:${finding.id}`),
    [],
  );
  return result.incomplete
    .filter((finding) => finding.id === "color-contrast")
    .flatMap((finding) => finding.nodes).length;
};

const assertLayout = async (page) => {
  const failures = await page.evaluate(() => {
    const found = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      found.push("document-overflow");
    }
    for (const element of document.querySelectorAll("main *")) {
      const rectangle = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        style.position !== "fixed" &&
        rectangle.width > 1 &&
        (rectangle.left < -1 || rectangle.right > innerWidth + 1)
      ) {
        found.push(element.tagName);
        if (found.length >= 8) break;
      }
    }
    return found;
  });
  assert.deepEqual(failures, []);
};

const assertTouchTargets = async (page) => {
  const failures = await page
    .locator(
      'main button:visible, main a:visible, main input:not([type="radio"]):not([type="checkbox"]):visible, main textarea:visible',
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          if (node.hasAttribute("disabled")) return false;
          const rectangle = node.getBoundingClientRect();
          return rectangle.width < 44 || rectangle.height < 44;
        })
        .map((node) => node.tagName),
    );
  assert.deepEqual(failures, []);
};

const activateWithKeyboard = async (locator) => {
  await locator.click({ trial: true });
  await locator.focus();
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true);
  await locator.press("Enter");
};

const waitForInputValue = async (locator, expected) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await locator.inputValue()) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Private input did not restore before the verification deadline.");
};

const headers =
  bypass === undefined || bypass === ""
    ? undefined
    : {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: origin,
  colorScheme: "dark",
  extraHTTPHeaders: headers,
  locale: "en-US",
  reducedMotion: "reduce",
  timezoneId: "Asia/Shanghai",
  viewport: { height: 900, width: 1_440 },
});

const requests = [];
const responses = [];
const pageErrors = [];
const consoleErrors = [];
const axeColorContrastIncomplete = [];
const page = await context.newPage();
page.on("request", (request) => {
  requests.push({ method: request.method(), url: safeUrl(request.url()) });
});
page.on("response", (response) => {
  responses.push({
    requestId:
      response.headers()["x-rituvia-correlation-id"] ||
      response.headers()["x-vercel-id"] ||
      "not-provided",
    status: response.status(),
    url: safeUrl(response.url()),
  });
});
page.on("pageerror", (error) => pageErrors.push(error.name));
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    !message.text().includes("eval() is not supported in this environment")
  ) {
    consoleErrors.push(message.text());
  }
});

try {
  const health = await context.request.get("/api/recovery/health", { headers });
  assert.equal(health.status(), 200);
  const healthBody = await health.json();
  assert.equal(healthBody.environment, "staging");
  assert.equal(healthBody.recoveryItem, 5);
  if (expectedSourceSha !== undefined && expectedSourceSha !== "") {
    assert.equal(healthBody.sourceSha, expectedSourceSha);
  }

  const readiness = await context.request.get("/api/recovery/readiness", { headers });
  assert.equal(readiness.status(), 200);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.status, "ready");
  assert.equal(readinessBody.controls.database, "connected");
  assert.equal(readinessBody.controls.productionProviders, "disabled");

  await page.goto("/en/intake", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "What would you like to reflect on?" }).waitFor();
  await page.getByLabel("Open reflection").check();
  await page.getByLabel("Optional question").fill(privateQuestion);
  await activateWithKeyboard(page.getByRole("button", { name: "Review my question" }));
  await page.locator(".question-intake-result").waitFor();
  axeColorContrastIncomplete.push(await assertAxe(page));
  await assertLayout(page);
  await activateWithKeyboard(
    page.getByRole("link", { name: "Continue to a private one-card reflection" }),
  );

  await page.getByRole("heading", { name: "A single perspective for this moment" }).waitFor();
  await page.getByLabel("Open reflection").check();
  await activateWithKeyboard(page.getByRole("button", { name: "Draw one card" }));
  await page.getByRole("heading", { name: "Your card is ready" }).waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Reveal my card" }));
  await page.getByRole("heading", { name: "Your one-card reflection" }).waitFor();
  axeColorContrastIncomplete.push(await assertAxe(page));
  await assertLayout(page);
  await activateWithKeyboard(page.getByRole("link", { name: "Continue to a private intention" }));

  await page.getByRole("heading", { name: "Set an intention" }).waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Peace and clarity" }));
  await page.getByLabel("Your intention").fill(privateIntention);
  await page.getByLabel("One small real-world action").fill(privateAction);
  await activateWithKeyboard(page.getByRole("button", { name: "Continue with this intention" }));
  await page.getByText("Your intention is ready.", { exact: false }).waitFor();

  const beginRitual = page.getByRole("button", { name: "Begin free ritual" }).first();
  await activateWithKeyboard(beginRitual);
  await page.getByRole("heading", { name: "Quiet candle" }).waitFor();
  await page.getByText("Accessible linear mode", { exact: true }).waitFor();
  assert.equal(await page.locator(".ritual-experience").getByRole("img").count(), 0);
  axeColorContrastIncomplete.push(await assertAxe(page));
  await assertLayout(page);

  const completeRitual = page.getByRole("button", { name: "Complete now" });
  await context.setOffline(true);
  await activateWithKeyboard(completeRitual);
  await page.getByText("You appear to be offline.", { exact: false }).waitFor();
  await context.setOffline(false);
  await activateWithKeyboard(completeRitual);
  await page.getByRole("heading", { name: "You can leave this moment here." }).waitFor();

  await activateWithKeyboard(page.getByRole("button", { name: "Continue to private reflection" }));
  await page.getByLabel("Your private journal entry").fill(privateJournal);
  await activateWithKeyboard(page.getByRole("button", { name: "Save private reflection" }));
  await page.getByRole("button", { name: "Save reflection changes" }).waitFor();

  await page.reload({ timeout: 30_000, waitUntil: "load" });
  await page.getByText(privateIntention, { exact: true }).waitFor();
  const restoredJournal = page.getByLabel("Your private journal entry");
  await restoredJournal.waitFor();
  await waitForInputValue(restoredJournal, privateJournal);
  await page.getByText(privateAction, { exact: true }).waitFor();
  axeColorContrastIncomplete.push(await assertAxe(page));
  await assertLayout(page);

  const browserStorage = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith("rituvia."))
        .sort()
        .map((key) => [key, window.sessionStorage.getItem(key)]),
    ),
  );
  assert.equal(
    Object.values(browserStorage).every((value) => uuidPattern.test(value ?? "")),
    true,
  );
  const serializedStorage = JSON.stringify(browserStorage);
  assert.equal(
    privateCanaries.some((canary) => serializedStorage.includes(canary)),
    false,
  );

  const revisitLink = page.getByRole("link", { name: "Schedule a private Revisit" }).last();
  assert.equal(await revisitLink.getAttribute("href"), "/en/revisit");
  await Promise.all([
    page.waitForURL("**/en/revisit", { timeout: 30_000 }),
    activateWithKeyboard(revisitLink),
  ]);
  await page.getByRole("heading", { name: "Schedule this Revisit" }).waitFor();
  await page.getByLabel("In seven days").check();
  await page.getByLabel("Time zone").fill("Asia/Shanghai");
  await activateWithKeyboard(page.getByRole("button", { name: "Schedule this Revisit" }));
  await page.getByText("Scheduled", { exact: true }).first().waitFor();

  await page.reload({ timeout: 30_000, waitUntil: "load" });
  const revisitCard = page.locator(".revisit-card").first();
  await revisitCard.getByText(privateIntention, { exact: true }).waitFor();
  await activateWithKeyboard(revisitCard.getByRole("button", { name: "Complete this Revisit" }));
  await revisitCard
    .getByLabel("What happened, and what do you understand now?")
    .fill(privateRevisit);
  await revisitCard.getByLabel("I took the action").check();
  await activateWithKeyboard(revisitCard.getByRole("button", { name: "Complete this Revisit" }));
  await revisitCard.getByRole("button", { name: "Archive" }).waitFor();
  await revisitCard.getByText(privateRevisit, { exact: true }).waitFor();

  await page.reload({ timeout: 30_000, waitUntil: "load" });
  await page.locator(".revisit-card").first().getByText(privateRevisit, { exact: true }).waitFor();
  axeColorContrastIncomplete.push(await assertAxe(page));
  await assertLayout(page);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/en/sanctuary", { timeout: 30_000, waitUntil: "load" });
  await page.getByText(privateIntention, { exact: true }).waitFor();
  const mobileJournal = page.getByLabel("Your private journal entry");
  await mobileJournal.waitFor();
  await waitForInputValue(mobileJournal, privateJournal);
  await assertTouchTargets(page);
  await assertLayout(page);
  axeColorContrastIncomplete.push(await assertAxe(page));

  await page.goto("/en/revisit", { timeout: 30_000, waitUntil: "load" });
  await page.locator(".revisit-card").first().getByText(privateRevisit, { exact: true }).waitFor();
  await assertTouchTargets(page);
  await assertLayout(page);
  axeColorContrastIncomplete.push(await assertAxe(page));

  const cookies = await context.cookies();
  const anonymousCookie = cookies.find(
    (cookie) => cookie.name === "__Host-rituvia-anonymous-session",
  );
  assert.notEqual(anonymousCookie, undefined);
  assert.equal(anonymousCookie.httpOnly, true);

  assert.deepEqual(pageErrors, []);
  const sameOriginFailures = responses.filter(
    (response) => new URL(response.url).origin === origin && response.status >= 400,
  );
  assert.deepEqual(
    consoleErrors.filter(
      (message) =>
        !(
          message.startsWith("Failed to load resource:") &&
          sameOriginFailures.length > 0 &&
          sameOriginFailures.every((response) => new URL(response.url).pathname === "/favicon.ico")
        ),
    ),
    [],
  );
  assert.deepEqual(
    requests.filter((request) => forbiddenApiPattern.test(new URL(request.url).pathname)),
    [],
  );
  assert.deepEqual(
    responses.filter(
      (response) =>
        new URL(response.url).origin === origin &&
        response.status >= 400 &&
        (new URL(response.url).pathname.startsWith("/api/") ||
          new URL(response.url).pathname.startsWith("/en/")),
    ),
    [],
  );

  const finalBody = await page.locator("body").innerText();
  assert.equal(finalBody.includes(privateQuestion), false);
  const currentStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  assert.equal(
    privateCanaries.some((canary) => currentStorage.includes(canary)),
    false,
  );

  const resourceIds = Object.fromEntries(
    Object.entries(browserStorage).filter(([, value]) => uuidPattern.test(value ?? "")),
  );
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const artifactDirectory = path.join(artifactRoot, timestamp);
  await mkdir(artifactDirectory, { recursive: true });
  const artifact = {
    axeColorContrastIncomplete,
    canaryDigests: privateCanaries.map(digest),
    desktop: "passed",
    environment: healthBody.environment,
    health: {
      database: readinessBody.controls.database,
      productionProviders: readinessBody.controls.productionProviders,
      ready: readinessBody.status === "ready",
      recoveryItem: healthBody.recoveryItem,
      sourceSha: healthBody.sourceSha,
    },
    mobile: "passed",
    mockedRoutes: 0,
    origin,
    requestCount: requests.length,
    resourceIds,
    responseCount: responses.length,
    responseEvidence: responses.filter((response) =>
      [
        "/api/v1/anonymous/session",
        "/api/v1/intake/evaluate",
        "/api/v1/readings/tarot",
        "/api/v1/intentions",
        "/api/v1/ritual-sessions",
        "/api/v1/journal-entries",
        "/api/v1/revisits",
      ].some((pathname) => new URL(response.url).pathname.startsWith(pathname)),
    ),
    status: "passed",
  };
  await writeFile(
    path.join(artifactDirectory, "browser-evidence.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Item 5 real core loop with zero mocked routes. Artifact: ${artifactDirectory}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}
