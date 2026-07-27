import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4177;
const origin = `http://${host}:${port}`;
const intentionId = "22222222-2222-4222-8222-222222222222";
const candleSessionId = "33333333-3333-4333-8333-333333333333";
const incenseSessionId = "44444444-4444-4444-8444-444444444444";
const journalEntryId = "55555555-5555-4555-8555-555555555555";
const csrfToken = "r".repeat(43);
const privateIntention = "I intend to pause before choosing my next small action.";
const artifactDirectory = path.join(process.cwd(), "output/playwright/rit042");
const ritualCatalog = JSON.parse(
  await readFile(
    new URL("../content/traditions/ritual/rituvia-original.en.v1.json", import.meta.url),
    "utf8",
  ),
);

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Ritual browser server exited before ready.");
    try {
      const response = await fetch(`${origin}/en/sanctuary`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Ritual browser server did not become ready.");
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
        found.push(`${element.tagName}.${element.className}`);
        if (found.length >= 8) break;
      }
    }
    return found;
  });
  assert.deepEqual(failures, []);
};

const assertAxe = async (page) => {
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations
    .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
    .map((finding) => `${finding.impact}:${finding.id}`);
  assert.deepEqual(violations, []);
  const unexpectedIncomplete = result.incomplete.filter(
    (finding) =>
      (finding.impact === "critical" || finding.impact === "serious") &&
      finding.id !== "color-contrast",
  );
  assert.deepEqual(
    unexpectedIncomplete.map((finding) => finding.id),
    [],
  );
  return result.incomplete
    .filter((finding) => finding.id === "color-contrast")
    .flatMap((finding) => finding.nodes).length;
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
  await mkdir(artifactDirectory, { recursive: true });
  const ritualRequests = [];
  const journalRequests = [];
  const localRequests = [];
  const unexpected = [];
  const sessions = new Map();
  let returnInvalidFirstCandleCompletion = true;
  let journalRevision = 0;
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "no-preference",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()}:${url.pathname}`;
    localRequests.push(key);
    const json = (status, body, headers = {}) =>
      route.fulfill({
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: {
          "cache-control": "private, no-store, max-age=0",
          ...headers,
        },
        status,
      });

    if (key === "GET:/api/v1/ritual-objects") return json(200, ritualCatalog);
    if (key === "GET:/api/v1/catalog") {
      return json(200, {
        items: [
          {
            exactContents: ["One private ambient visual"],
            name: "Moonlit lotus",
            price: { amountMinor: 500, currencyCode: "USD" },
            productCode: "moonlit_lotus",
          },
        ],
        schemaVersion: 1,
      });
    }
    if (key === "GET:/api/v1/entitlements") {
      return json(200, { items: [], schemaVersion: 1 });
    }
    if (key === "GET:/api/v1/me") return json(200, { ageAttested: false });
    if (key === "POST:/api/v1/anonymous/session") {
      return route.fulfill({
        body: "",
        headers: { "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    if (key === "POST:/api/v1/intentions") {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      const body = request.postDataJSON();
      assert.equal(body.schemaVersion, "reflection-intention.v2");
      assert.equal(body.intentionText, privateIntention);
      return json(
        201,
        {
          id: intentionId,
          intentionCode: body.intentionCode,
          intentionText: body.intentionText,
          reminderPreference: "none",
          revisitDate: null,
          revision: 1,
          schemaVersion: "reflection-intention.v2",
          smallAction: body.smallAction,
          status: "active",
          timeZone: null,
        },
        { "x-csrf-token": csrfToken },
      );
    }
    if (key === "POST:/api/v1/ritual-sessions") {
      const body = request.postDataJSON();
      const operation = {
        body,
        idempotencyKey: request.headers()["idempotency-key"],
        key,
      };
      ritualRequests.push(operation);
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.deepEqual(Object.keys(body).sort(), ["intentionId", "itemCode", "schemaVersion"]);
      assert.equal(body.intentionId, intentionId);
      assert.equal(body.schemaVersion, "ritual-session.v2");
      assert.match(operation.idempotencyKey ?? "", /^[0-9a-f-]{36}$/u);
      const id = body.itemCode === "free_candle" ? candleSessionId : incenseSessionId;
      const session = {
        currentStepCode: "prepare",
        elapsedSeconds: 0,
        id,
        itemCode: body.itemCode,
        revision: 1,
        schemaVersion: "ritual-session.v2",
        status: "active",
      };
      sessions.set(id, session);
      return json(201, session, { "x-csrf-token": csrfToken });
    }
    const ritualMutation = /^\/api\/v1\/ritual-sessions\/([0-9a-f-]+)(?:\/complete)?$/u.exec(
      url.pathname,
    );
    if (ritualMutation !== null && (request.method() === "PATCH" || request.method() === "POST")) {
      const id = ritualMutation[1];
      const current = sessions.get(id);
      assert.ok(current);
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      const body = request.postDataJSON();
      const operation = {
        body,
        idempotencyKey: request.headers()["idempotency-key"],
        key,
      };
      ritualRequests.push(operation);
      assert.equal(body.expectedRevision, current.revision);
      assert.equal(body.schemaVersion, "ritual-session-mutation.v1");
      if (
        id === candleSessionId &&
        body.action === "complete" &&
        returnInvalidFirstCandleCompletion
      ) {
        returnInvalidFirstCandleCompletion = false;
        return json(200, {}, { "x-csrf-token": csrfToken });
      }
      const next = {
        ...current,
        currentStepCode: body.currentStepCode,
        elapsedSeconds: body.elapsedSeconds,
        revision: current.revision + 1,
        status:
          body.action === "pause" ? "paused" : body.action === "resume" ? "active" : "completed",
      };
      sessions.set(id, next);
      return json(200, next, { "x-csrf-token": csrfToken });
    }
    if (key === "POST:/api/v1/journal-entries") {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      const body = request.postDataJSON();
      journalRequests.push({
        body,
        idempotencyKey: request.headers()["idempotency-key"],
        key,
      });
      assert.equal(body.schemaVersion, "private-journal.v2");
      journalRevision = 1;
      return json(
        201,
        {
          id: journalEntryId,
          reflection: body.reflection,
          revision: journalRevision,
          schemaVersion: "private-journal.v2",
        },
        { "x-csrf-token": csrfToken },
      );
    }
    if (key === `PATCH:/api/v1/journal-entries/${journalEntryId}`) {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      const body = request.postDataJSON();
      journalRequests.push({
        body,
        idempotencyKey: request.headers()["idempotency-key"],
        key,
      });
      assert.equal(body.expectedRevision, journalRevision);
      journalRevision += 1;
      return json(
        200,
        {
          id: journalEntryId,
          reflection: body.reflection,
          revision: journalRevision,
          schemaVersion: "private-journal.v2",
        },
        { "x-csrf-token": csrfToken },
      );
    }
    if (key === `DELETE:/api/v1/journal-entries/${journalEntryId}`) {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.equal(request.headers()["if-match"], `"revision-${journalRevision}"`);
      journalRequests.push({
        body: null,
        idempotencyKey: request.headers()["idempotency-key"],
        key,
      });
      return route.fulfill({
        body: "",
        headers: { "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    unexpected.push(key);
    return route.abort("blockedbyclient");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(7_500);
  const consoleErrors = [];
  const pageErrors = [];
  const failedLocalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (
      (url.pathname === "/api/v1/anonymous/session" ||
        (request.method() === "DELETE" &&
          url.pathname === `/api/v1/journal-entries/${journalEntryId}`)) &&
      request.failure()?.errorText === "net::ERR_ABORTED"
    ) {
      return;
    }
    if (url.origin === origin && url.pathname !== "/api/v1/ritual-sessions") {
      failedLocalRequests.push(url.pathname);
    }
  });
  await page.goto("/en/sanctuary", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Set an intention" }).waitFor();

  await page.getByRole("button", { name: "Peace and clarity" }).click();
  await page.getByLabel("Your intention").fill(privateIntention);
  await page
    .getByLabel("One small real-world action")
    .fill("Take three quiet breaths before replying.");
  await page.getByRole("button", { name: "Continue with this intention" }).click();
  await page.getByText("Your intention is ready.", { exact: false }).waitFor();

  const beginButtons = page.getByRole("button", { name: "Begin free ritual" });
  await beginButtons.first().focus();
  await beginButtons.first().click();
  await page.getByRole("heading", { name: "Quiet candle" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.includes("Quiet candle")),
    true,
  );
  await page.getByText("Standard 2D mode", { exact: true }).waitFor();
  await page.getByText("Off. No sound will start.").waitFor();
  assert.equal(await page.locator("audio, video, canvas").count(), 0);
  assert.equal(ritualRequests.length, 1);
  assert.equal(ritualRequests[0].body.itemCode, "free_candle");
  const visualAxeIncomplete = await assertAxe(page);
  await assertLayout(page);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.locator(".ritual-experience").scrollIntoViewIfNeeded();
  await page.locator(".ritual-step .sanctuary-private-note").evaluate((element) => {
    element.textContent = "Private intention hidden from test evidence.";
  });
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: path.join(artifactDirectory, "free-candle-visual.png"),
  });
  await page.setViewportSize({ height: 844, width: 320 });

  await page.getByRole("button", { name: "Pause ritual" }).click();
  await page.getByRole("button", { name: "Resume ritual" }).waitFor();
  assert.equal(ritualRequests.length, 2);
  assert.equal(await page.getByRole("button", { name: "Continue" }).isDisabled(), true);
  await page.getByRole("button", { name: "Resume ritual" }).click();
  assert.equal(ritualRequests.length, 3);
  await page.getByRole("button", { name: "Use accessible linear mode" }).click();
  await page.getByText("Accessible linear mode", { exact: true }).waitFor();
  assert.equal(await page.locator(".ritual-experience").getByRole("img").count(), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "Set an intention" }).waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.textContent?.includes("Begin free ritual"),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.includes("Begin free ritual")),
    true,
  );
  assert.equal(ritualRequests.length, 4);

  await beginButtons.first().click();
  await page.getByRole("button", { name: "Resume ritual" }).click();
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await page.getByRole("heading", { name: "Complete the pause" }).waitFor();
  assert.equal(ritualRequests.length, 5);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Complete this ritual" }).click();
  await page.getByText("You appear to be offline.", { exact: false }).waitFor();
  assert.equal(ritualRequests.length, 5);
  await context.setOffline(false);

  await page.getByRole("button", { name: "Complete this ritual" }).click();
  await page.getByText("Completion could not be recorded.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Complete this ritual" }).click();
  await page.getByRole("heading", { name: "You can leave this moment here." }).waitFor();
  assert.equal(ritualRequests.length, 7);
  assert.equal(ritualRequests[5].body.action, "complete");
  assert.equal(ritualRequests[5].idempotencyKey, ritualRequests[6].idempotencyKey);
  const completionAxeIncomplete = await assertAxe(page);
  await page.getByRole("button", { name: "Continue to private reflection" }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA");
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), "TEXTAREA");
  await page.getByLabel("Your private journal entry").fill("I noticed a quieter response.");
  await page.getByRole("button", { name: "Save private reflection" }).click();
  await page.getByRole("button", { name: "Save reflection changes" }).waitFor();
  await page
    .getByLabel("Your private journal entry")
    .fill("I noticed a quieter and more deliberate response.");
  await page.getByRole("button", { name: "Save reflection changes" }).click();
  await page.getByRole("button", { name: "Delete private reflection" }).waitFor();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete private reflection" }).click();
  await page.getByRole("button", { name: "Save private reflection" }).waitFor();
  assert.equal(journalRequests.length, 3);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Begin free ritual" }).nth(1).click();
  await page.getByRole("heading", { name: "Quiet incense" }).waitFor();
  await page.getByText("Accessible linear mode", { exact: true }).waitFor();
  assert.equal(await page.locator(".ritual-experience").getByRole("img").count(), 0);
  assert.equal(
    await page
      .locator(".ritual-incense-smoke")
      .evaluateAll((nodes) =>
        nodes.every((node) => getComputedStyle(node).animationName === "none"),
      ),
    true,
  );
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await assertLayout(page);
  const linearAxeIncomplete = await assertAxe(page);
  const touchFailures = await page.locator("main button:visible").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rectangle = node.getBoundingClientRect();
        return !node.hasAttribute("disabled") && (rectangle.width < 44 || rectangle.height < 44);
      })
      .map((node) => node.textContent),
  );
  assert.deepEqual(touchFailures, []);
  assert.equal(ritualRequests.length, 8);
  await page.getByRole("button", { name: "Complete now" }).click();
  await page.getByRole("heading", { name: "You can leave this moment here." }).waitFor();
  assert.equal(ritualRequests.length, 9);
  assert.equal(ritualRequests[7].body.itemCode, "free_incense");

  const privacyState = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    url: location.href,
  }));
  assert.equal(JSON.stringify(privacyState).includes(privateIntention), false);
  assert.equal(
    localRequests.some((key) => /analytics|telemetry|audio|media/iu.test(key)),
    false,
  );
  assert.deepEqual(unexpected, []);
  assert.deepEqual(failedLocalRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  process.stdout.write(
    `${JSON.stringify(
      {
        axeColorContrastIncompleteNodes: [
          visualAxeIncomplete,
          completionAxeIncomplete,
          linearAxeIncomplete,
        ],
        axeCriticalOrSeriousViolations: 0,
        axeScans: 3,
        candleInvalidResponseSameKeyRetry: true,
        canonicalFreeDefinitions: 2,
        consoleOrPageErrors: 0,
        durablePauseAndResumeMutations: 4,
        freeRitualCompletions: 2,
        linearAndVisualModes: 2,
        offlineCompletionRequests: 0,
        privateStorageLeaks: 0,
        privateJournalCreateUpdateDelete: journalRequests.length,
        reducedMotionAnimations: 0,
        rtlAnd320LayoutFailures: 0,
        supportingScreenshots: 1,
        touchTargetFailures: 0,
        unexpectedRequests: unexpected.length,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  if (serverError !== "") process.stderr.write(serverError);
  throw error;
} finally {
  await browser.close();
  await stopServer(server);
}
