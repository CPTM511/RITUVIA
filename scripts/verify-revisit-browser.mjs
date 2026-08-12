import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4178;
const origin = `http://${host}:${port}`;
const intentionId = "11111111-1111-4111-8111-111111111111";
const revisitId = "22222222-2222-4222-8222-222222222222";
const csrfToken = "v".repeat(43);
const privateIntention = "I intend to pause before I answer the private canary.";
const privateAction = "Take three private canary breaths.";
const privateReflection = "I took the action and learned from the private canary.";
const updatedRevisitDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000)
  .toISOString()
  .slice(0, 10);
const artifactDirectory = path.join(process.cwd(), "output/playwright/rit044");

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Revisit browser server exited before ready.");
    try {
      const response = await fetch(`${origin}/en/revisit`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Revisit browser server did not become ready.");
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
  const requests = [];
  const unexpected = [];
  let resource = null;
  let reminder = null;
  let reminderPreferenceMutations = 0;
  let scheduleFailures = 0;
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "no-preference",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 700, width: 320 },
  });
  await context.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: "rituvia.revisit-intention.v1",
    value: intentionId,
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()}:${url.pathname}`;
    const json = (status, body, headers = {}) =>
      route.fulfill({
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: { "cache-control": "private, no-store, max-age=0", ...headers },
        status,
      });
    if (key === "GET:/api/v1/me") {
      return json(200, { ageAttested: false }, { "x-csrf-token": csrfToken });
    }
    if (key === "GET:/api/v1/me/revisit-reminders") {
      return json(200, {
        accountAvailable: true,
        reminders: reminder === null ? [] : [reminder],
        schemaVersion: 1,
      });
    }
    if (key === "GET:/api/v1/revisits") {
      return json(200, { items: resource === null ? [] : [resource] });
    }
    if (key === `GET:/api/v1/intentions/${intentionId}`) {
      return json(200, {
        createdAt: "2026-07-24T00:00:00.000Z",
        expiresAt: "2026-08-24T00:00:00.000Z",
        id: intentionId,
        intentionCode: "calm_clarity",
        intentionText: privateIntention,
        locale: "en",
        policyVersion: "reflection-loop.en.v1",
        privacyState: "private",
        readingId: null,
        reminderPreference: "none",
        revisitDate: null,
        revision: 1,
        schemaVersion: "reflection-intention.v2",
        smallAction: privateAction,
        status: "active",
        timeZone: null,
        updatedAt: "2026-07-24T00:00:00.000Z",
      });
    }
    if (key === "POST:/api/v1/anonymous/session") {
      return route.fulfill({
        body: "",
        headers: { "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    if (key === "POST:/api/v1/revisits") {
      const body = request.postDataJSON();
      requests.push({ body, key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.deepEqual(Object.keys(body).sort(), [
        "customDate",
        "intentionId",
        "quietHours",
        "reminderChannel",
        "reminderPreference",
        "scheduleKind",
        "schemaVersion",
        "timeZone",
      ]);
      resource = {
        archivedAt: null,
        completedAt: null,
        completionReflection: null,
        createdAt: "2026-07-24T00:00:00.000Z",
        expiresAt: "2026-08-24T00:00:00.000Z",
        id: revisitId,
        intentionId,
        intentionRevision: 1,
        intentionText: privateIntention,
        isDue: false,
        outcomeTags: [],
        policyVersion: "reflection-loop.en.v1",
        quietHours: body.quietHours,
        reminderChannel: null,
        reminderPreference: "none",
        revision: 1,
        scheduledLocalDate: "2026-07-31",
        scheduleKind: body.scheduleKind,
        schemaVersion: "reflection-revisit.v1",
        smallAction: privateAction,
        status: "scheduled",
        timeZone: body.timeZone,
        updatedAt: "2026-07-24T00:00:00.000Z",
      };
      return json(201, resource, { "x-csrf-token": csrfToken });
    }
    if (key === `PATCH:/api/v1/revisits/${revisitId}`) {
      const body = request.postDataJSON();
      requests.push({ body, key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.ok(resource);
      if (body.action === "reschedule") {
        resource = {
          ...resource,
          quietHours: body.quietHours,
          revision: resource.revision + 1,
          scheduledLocalDate: body.customDate,
          scheduleKind: body.scheduleKind,
          timeZone: body.timeZone,
          updatedAt: "2026-07-24T01:00:00.000Z",
        };
      } else if (body.action === "archive") {
        resource = {
          ...resource,
          archivedAt: "2026-07-24T03:00:00.000Z",
          isDue: false,
          revision: resource.revision + 1,
          status: "archived",
          updatedAt: "2026-07-24T03:00:00.000Z",
        };
      } else {
        unexpected.push(`${key}:${body.action}`);
      }
      return json(200, resource, { "x-csrf-token": csrfToken });
    }
    if (key === `POST:/api/v1/revisits/${revisitId}/complete`) {
      const body = request.postDataJSON();
      requests.push({ body, key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.equal(body.reflection, privateReflection);
      assert.ok(resource);
      resource = {
        ...resource,
        completedAt: "2026-07-24T02:00:00.000Z",
        completionReflection: body.reflection,
        isDue: false,
        outcomeTags: body.outcomeTags,
        revision: resource.revision + 1,
        status: "completed",
        updatedAt: "2026-07-24T02:00:00.000Z",
      };
      return json(200, resource, { "x-csrf-token": csrfToken });
    }
    if (key === `POST:/api/v1/revisits/${revisitId}/reminder`) {
      const body = request.postDataJSON();
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.deepEqual(Object.keys(body).sort(), [
        "action",
        "channel",
        "frequency",
        "noticeVersion",
        "schemaVersion",
      ]);
      assert.equal(body.channel, "email");
      assert.equal(body.frequency, "once");
      reminderPreferenceMutations += 1;
      reminder = {
        channel: "email",
        deliveryState: body.action === "subscribe" ? "pending" : "cancelled",
        frequency: "once",
        locale: "en",
        noticeVersion: "rituvia.revisit-reminder-notice.v1",
        preferenceState: body.action === "subscribe" ? "subscribed" : "unsubscribed",
        recordedAt: "2026-07-24T00:30:00.000Z",
        revisitId,
        schemaVersion: "revisit-reminder-preference.v1",
      };
      return json(200, { reminder, schemaVersion: 1 });
    }
    if (key === `DELETE:/api/v1/revisits/${revisitId}`) {
      requests.push({ body: null, key });
      assert.ok(resource);
      assert.equal(request.headers()["if-match"], `"revision-${resource.revision}"`);
      resource = null;
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
        (request.method() === "DELETE" && url.pathname === `/api/v1/revisits/${revisitId}`)) &&
      request.failure()?.errorText === "net::ERR_ABORTED"
    ) {
      return;
    }
    if (url.origin === origin) failedLocalRequests.push(url.pathname);
  });

  await page.goto("/en/revisit", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Schedule this Revisit" }).waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rituvia.revisit-intention.v1")),
    intentionId,
  );
  await page.getByLabel("In seven days").check();
  await page.getByLabel("Time zone").fill("America/New_York");
  await page.getByLabel("Store quiet hours").check();
  await page.getByRole("button", { name: "Schedule this Revisit" }).click();
  await page.getByText("Scheduled", { exact: true }).first().waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rituvia.revisit-intention.v1")),
    null,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.reminderPreference, "none");
  assert.equal(requests[0].body.reminderChannel, null);
  await page.goto("/en/revisit#reminder-preferences", {
    timeout: 30_000,
    waitUntil: "load",
  });
  const reminderCheckbox = page.getByLabel("Email me once when this Revisit date arrives");
  await reminderCheckbox.waitFor();
  await page.waitForFunction(
    () =>
      document.activeElement?.id === "reminder-preferences" ||
      (document.activeElement instanceof HTMLInputElement &&
        document.activeElement.id.startsWith("revisit-reminder-")),
  );
  assert.equal(requests.length, 1);
  assert.equal(reminderPreferenceMutations, 0);
  await reminderCheckbox.click();
  await page.getByText("The one-time email reminder is on.", { exact: true }).waitFor();
  assert.equal(await reminderCheckbox.isChecked(), true);
  await reminderCheckbox.click();
  await page.getByText("The one-time email reminder is off.", { exact: true }).waitFor();
  assert.equal(await reminderCheckbox.isChecked(), false);
  assert.equal(reminderPreferenceMutations, 2);

  await page.locator(".revisit-card").getByRole("button", { name: "Save new date" }).click();
  await page.getByRole("radio", { name: "Choose a date" }).check();
  await page.locator('input[type="date"]').fill(updatedRevisitDate);
  await context.setOffline(true);
  await page
    .locator(".revisit-schedule form")
    .getByRole("button", { name: "Save new date" })
    .click();
  await page
    .getByText("Your private Revisit could not be loaded or saved.", { exact: false })
    .waitFor();
  scheduleFailures += 1;
  assert.equal(requests.length, 1);
  await context.setOffline(false);
  await page
    .locator(".revisit-schedule form")
    .getByRole("button", { name: "Save new date" })
    .click();
  await page.getByText(updatedRevisitDate, { exact: true }).waitFor();
  assert.equal(requests.length, 2);

  const revisitCard = page.locator(".revisit-card");
  await revisitCard.getByRole("button", { name: "Complete this Revisit" }).click();
  const reflectionField = revisitCard.locator("#revisit-reflection");
  await reflectionField.fill(privateReflection);
  await page.getByLabel("I took the action").check();
  await page.getByRole("button", { name: "Complete this Revisit" }).click();
  await page.getByText(privateReflection, { exact: true }).waitFor();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].body.expectedRevision, 2);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  const axeIncomplete = await assertAxe(page);
  await assertLayout(page);
  const touchFailures = await page
    .locator("main button:visible, main a:visible")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rectangle = node.getBoundingClientRect();
          return !node.hasAttribute("disabled") && (rectangle.width < 44 || rectangle.height < 44);
        })
        .map((node) => node.textContent),
    );
  assert.deepEqual(touchFailures, []);

  await page.evaluate(
    ({ action, intention, reflection }) => {
      for (const node of document.querySelectorAll("dd, .revisit-completion-text")) {
        if (
          node.textContent?.includes(intention) === true ||
          node.textContent?.includes(action) === true ||
          node.textContent?.includes(reflection) === true
        ) {
          node.textContent = "Private text hidden from test evidence.";
        }
      }
    },
    { action: privateAction, intention: privateIntention, reflection: privateReflection },
  );
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(artifactDirectory, "revisit-completed-redacted.png"),
  });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByText("Archived", { exact: true }).first().waitFor();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByText("The private Revisit was deleted.", { exact: true }).waitFor();
  assert.equal(requests.length, 5);

  const privacyState = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    metadata: [...document.querySelectorAll("meta")].map((node) => node.outerHTML),
    session: Object.entries(sessionStorage),
    title: document.title,
    url: location.href,
  }));
  const privateCanaries = [privateIntention, privateAction, privateReflection];
  for (const canary of privateCanaries) {
    assert.equal(JSON.stringify(privacyState).includes(canary), false);
    assert.equal(
      consoleErrors.some((message) => message.includes(canary)),
      false,
    );
    assert.equal(
      pageErrors.some((message) => message.includes(canary)),
      false,
    );
  }
  assert.deepEqual(unexpected, []);
  assert.deepEqual(failedLocalRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  process.stdout.write(
    `${JSON.stringify(
      {
        axeColorContrastIncompleteNodes: axeIncomplete,
        axeCriticalOrSeriousViolations: 0,
        archiveAndDeleteMutations: 2,
        consoleOrPageErrors: 0,
        earlyCompletionAccepted: true,
        localCalendarReschedules: 1,
        offlineScheduleRequests: 0,
        offlineStateAssertions: scheduleFailures,
        privateStorageMetadataConsoleLeaks: 0,
        redactedSupportingScreenshots: 1,
        reminderDeliveryRequests: 0,
        reminderPreferenceMutations,
        rtlAnd320LayoutFailures: 0,
        scheduleRequests: 1,
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
