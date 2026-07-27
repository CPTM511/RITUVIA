import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4176;
const origin = `http://${host}:${port}`;
const readingId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";
const csrfToken = "c".repeat(43);
const ritualCatalog = JSON.parse(
  await readFile(
    new URL("../content/traditions/ritual/rituvia-original.en.v1.json", import.meta.url),
    "utf8",
  ),
);

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Intention browser server exited before ready.");
    try {
      const response = await fetch(`${origin}/en/sanctuary`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Intention browser server did not become ready.");
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
  const requests = [];
  const unexpected = [];
  const editKeys = [];
  let resource = null;
  let revision = 0;
  let abortFirstEdit = true;
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  await context.addInitScript(
    ({ readingId: storedReadingId }) =>
      sessionStorage.setItem("rituvia.tarot.resume.v1.one_card", storedReadingId),
    { readingId },
  );
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const key = `${request.method()}:${path}`;
    requests.push({
      body: request.postData(),
      headers: request.headers(),
      key,
    });
    const json = (status, body) =>
      route.fulfill({
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: {
          "cache-control": "private, no-store, max-age=0",
          "x-csrf-token": csrfToken,
        },
        status,
      });
    if (key === "GET:/api/v1/me") return json(200, { ageAttested: false });
    if (key === "GET:/api/v1/ritual-objects") return json(200, ritualCatalog);
    if (key === "GET:/api/v1/catalog") {
      return json(200, {
        items: [
          {
            exactContents: ["Private ambient visual"],
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
    if (key === `GET:/api/v1/readings/${readingId}`) {
      return json(200, { createdAt: "2026-07-24T00:00:00.000Z", readingId });
    }
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
      assert.deepEqual(
        Object.keys(body).sort(),
        [
          "intentionCode",
          "intentionText",
          "locale",
          "privacyState",
          "readingId",
          "reminderPreference",
          "revisitDate",
          "schemaVersion",
          "smallAction",
          "timeZone",
        ].sort(),
      );
      assert.equal(body.schemaVersion, "reflection-intention.v2");
      assert.equal(body.privacyState, "private");
      assert.equal(body.reminderPreference, "none");
      assert.equal(body.readingId, readingId);
      assert.notEqual(body.intentionText, "Make them contact me tomorrow.");
      revision = 1;
      resource = {
        id: intentionId,
        intentionCode: body.intentionCode,
        intentionText: body.intentionText,
        reminderPreference: "none",
        revisitDate: body.revisitDate,
        revision,
        schemaVersion: "reflection-intention.v2",
        smallAction: body.smallAction,
        status: "active",
        timeZone: body.timeZone,
      };
      return json(201, resource);
    }
    if (key === `PATCH:/api/v1/intentions/${intentionId}`) {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      const body = request.postDataJSON();
      assert.equal(body.schemaVersion, "reflection-intention-mutation.v1");
      if (body.action === "edit") {
        editKeys.push(request.headers()["idempotency-key"]);
        if (abortFirstEdit) {
          abortFirstEdit = false;
          revision = 2;
          resource = {
            ...resource,
            intentionCode: body.intentionCode,
            intentionText: body.intentionText,
            revisitDate: body.revisitDate,
            revision,
            smallAction: body.smallAction,
            timeZone: body.timeZone,
          };
          return json(200, {});
        }
        assert.equal(body.expectedRevision, 1);
        assert.equal(revision, 2);
        return json(200, resource);
      }
      assert.equal(body.expectedRevision, revision);
      revision += 1;
      resource = {
        ...resource,
        revision,
        status: body.action === "complete" ? "completed" : "archived",
      };
      return json(200, resource);
    }
    if (key === `DELETE:/api/v1/intentions/${intentionId}`) {
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.equal(request.headers()["if-match"], `"revision-${revision}"`);
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
  page.setDefaultTimeout(5_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/en/sanctuary", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Set an intention" }).waitFor();

  const scan = async () => {
    const result = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      result.violations
        .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
        .map((finding) => `${finding.impact}:${finding.id}`),
      [],
    );
    const incomplete = result.incomplete.filter(
      (finding) => finding.impact === "critical" || finding.impact === "serious",
    );
    assert.ok(incomplete.every((finding) => finding.id === "color-contrast"));
    return incomplete.flatMap((finding) => finding.nodes).length;
  };
  const initialIncomplete = await scan();
  const dateInput = page.getByLabel("Optional revisit date");
  const minimum = await dateInput.getAttribute("min");
  assert.match(minimum, /^\d{4}-\d{2}-\d{2}$/u);
  const localToday = await page.evaluate(() => {
    const date = new Date();
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  assert.ok(minimum > localToday);

  await page.getByRole("button", { name: "Peace and clarity" }).click();
  const intentionField = page.getByLabel("Your intention");
  await intentionField.fill("Make them contact me tomorrow.");
  await page
    .getByLabel("One small real-world action")
    .fill("Take ten quiet minutes before replying.");
  await dateInput.fill(new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Continue with this intention" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "This wording appears to direct another person's feelings or actions." })
    .waitFor();
  assert.equal(await intentionField.getAttribute("aria-invalid"), "true");
  assert.equal(requests.filter(({ key }) => key === "POST:/api/v1/intentions").length, 0);
  await page.getByRole("button", { name: "Use the suggested intention" }).click();
  const reframed = await intentionField.inputValue();
  assert.notEqual(reframed, "Make them contact me tomorrow.");
  await page.getByRole("button", { name: "Continue with this intention" }).click();
  await page.getByText("Your intention is ready.", { exact: false }).waitFor();

  await intentionField.fill("I intend to pause and listen before replying.");
  await page
    .getByLabel("One small real-world action")
    .fill("Take five quiet minutes before replying.");
  await page.getByRole("button", { name: "Save intention changes" }).click();
  await page.getByText("Your intention could not be saved.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Save intention changes" }).click();
  await page.getByText("Your private intention was updated.").waitFor();
  assert.equal(editKeys.length, 2);
  assert.equal(editKeys[0], editKeys[1]);

  await context.setOffline(true);
  await intentionField.fill("I intend to respond with patience.");
  await page.getByRole("button", { name: "Save intention changes" }).click();
  await page.getByText("You appear to be offline.", { exact: false }).waitFor();
  await context.setOffline(false);
  await intentionField.fill("I intend to pause and listen before replying.");

  await page.getByRole("button", { name: "Archive intention" }).first().click();
  await page.getByText("Archive this intention?", { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("sanctuary-status")),
    true,
  );
  await page.getByRole("button", { name: "Archive intention" }).last().click();
  await page.getByText("This intention is archived", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Begin free ritual" }).first().click();
  await page.getByText("Set an intention before starting a ritual.").waitFor();
  assert.equal(requests.filter(({ key }) => key.includes("/ritual-sessions")).length, 0);
  const archivedIncomplete = await scan();

  const touchFailures = await page
    .locator("main button:visible, main input:visible, main textarea:visible, main select:visible")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rectangle = node.getBoundingClientRect();
          return !node.hasAttribute("disabled") && (rectangle.width < 44 || rectangle.height < 44);
        })
        .map((node) => node.tagName),
    );
  assert.deepEqual(touchFailures, []);
  const layoutFailures = () =>
    page.evaluate(() => {
      const failures = [];
      const root = document.documentElement;
      if (root.scrollWidth > root.clientWidth + 1) failures.push("overflow");
      for (const element of document.querySelectorAll("main *")) {
        const style = getComputedStyle(element);
        const rectangle = element.getBoundingClientRect();
        if (
          style.position !== "fixed" &&
          style.position !== "absolute" &&
          rectangle.width > 1 &&
          (rectangle.left < -1 || rectangle.right > innerWidth + 1)
        ) {
          failures.push(element.tagName);
          if (failures.length >= 5) break;
        }
      }
      return failures;
    });
  assert.deepEqual(await layoutFailures(), []);
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await page.waitForTimeout(100);
  assert.deepEqual(await layoutFailures(), []);
  await page.evaluate(() => {
    document.documentElement.dir = "ltr";
  });

  await page.getByRole("button", { name: "Delete intention" }).first().click();
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("sanctuary-status")),
    true,
  );
  await page.getByRole("button", { name: "Delete intention" }).last().click();
  await page.getByText("Your intention was deleted.").waitFor();
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    url: location.href,
  }));
  for (const phrase of [
    "Make them contact me tomorrow.",
    reframed,
    "Take five quiet minutes before replying.",
  ]) {
    assert.equal(JSON.stringify(storage).includes(phrase), false);
  }
  assert.deepEqual(unexpected, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  const intentionLedger = requests.filter(({ key }) => key.includes("/intentions"));
  assert.deepEqual(
    intentionLedger.map(({ key }) => key),
    [
      "POST:/api/v1/intentions",
      `PATCH:/api/v1/intentions/${intentionId}`,
      `PATCH:/api/v1/intentions/${intentionId}`,
      `PATCH:/api/v1/intentions/${intentionId}`,
      `DELETE:/api/v1/intentions/${intentionId}`,
    ],
  );
  assert.ok(intentionLedger.every(({ headers }) => headers["x-csrf-token"] === csrfToken));
  process.stdout.write(
    `${JSON.stringify(
      {
        axeColorContrastIncompleteNodes: [initialIncomplete, archivedIncomplete],
        axeCriticalOrSeriousViolations: 0,
        axeScans: 2,
        confirmationFocusTransfers: 2,
        consoleOrPageErrors: 0,
        csrfProtectedIntentionRequests: intentionLedger.length,
        privateStorageLeaks: 0,
        ritualRequestsAfterArchive: 0,
        rtlAnd320LayoutFailures: 0,
        sameKeyLostResponseRetry: true,
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
