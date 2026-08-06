import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4186;
const origin = `http://${host}:${port}`;
const accountCookieName = "__Host-rituvia-account-session";
const accountEmail = `account-control-${randomBytes(8).toString("hex")}@example.test`;

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Account control browser server exited before ready.");
    }
    try {
      const response = await fetch(`${origin}/en/sign-in`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Account control browser server did not become ready.");
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

const createContext = (browser) =>
  browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });

const signIn = async (context) => {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto("/en/sign-in", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("textbox", { name: /Email address/u }).fill(accountEmail);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByRole("link", { name: "Complete sandbox sign-in" }).click();
  await page.waitForURL(`${origin}/en/account`);
  await page.getByRole("heading", { name: "Your reflection space" }).waitFor();
  return page;
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
};

const acceptNextDialog = (page) => {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
};

const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: {
    ...process.env,
    BRAND_CANONICAL_ORIGIN: origin,
    RITUVIA_AUTH_START_GLOBAL_LIMIT: "100",
    RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "20",
    RITUVIA_AUTH_START_WINDOW_SECONDS: "60",
  },
  stdio: ["ignore", "ignore", "pipe"],
});
let serverError = "";
server.stderr?.on("data", (chunk) => {
  serverError += String(chunk);
});

const browser = await chromium.launch({ headless: true });
try {
  await waitForServer(server);
  const ownerContext = await createContext(browser);
  const ownerPage = await signIn(ownerContext);
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  ownerPage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  ownerPage.on("pageerror", (error) => pageErrors.push(error.message));
  ownerPage.on("request", (request) => {
    if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
  });
  ownerPage.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()}:${new URL(request.url()).pathname}:${request.failure()?.errorText ?? "unknown"}`,
    );
  });

  try {
    await ownerPage.getByText("No account-linked history is available yet.").waitFor();
  } catch {
    throw new Error(
      `Account history empty state did not settle: ${await ownerPage.locator("body").innerText()}\n${serverError}`,
    );
  }
  await ownerPage.getByRole("heading", { name: "Signed-in sessions" }).waitFor();
  await ownerPage.getByRole("heading", { name: "Personalization choices" }).waitFor();
  const ownerAnalyticsConsent = ownerPage.getByRole("checkbox", {
    name: "Use behavioral data without private text to improve the experience",
  });
  const ownerPersonalizationConsent = ownerPage.getByRole("checkbox", {
    name: "Allow personalized summaries; private journal entries are excluded by default",
  });
  const ownerModelImprovementConsent = ownerPage.getByRole("checkbox", {
    name: "Allow excerpts I explicitly select to be considered for model-improvement review",
  });
  await assert.equal(await ownerAnalyticsConsent.isChecked(), false);
  await assert.equal(await ownerPersonalizationConsent.isChecked(), false);
  await assert.equal(await ownerModelImprovementConsent.isChecked(), false);
  await ownerPersonalizationConsent.click();
  await ownerPage
    .getByText("Your privacy choice was saved and now applies to new data flows.", { exact: true })
    .waitFor();
  assert.equal(await ownerPersonalizationConsent.isChecked(), true);
  await ownerPage.getByText("This session", { exact: true }).waitFor();
  assert.equal(await ownerPage.getByText("Other active session", { exact: true }).count(), 0);
  await assertLayout(ownerPage);
  await assertAxe(ownerPage);

  const displayName = ownerPage.getByRole("textbox", { name: /Display name/u });
  const timeZone = ownerPage.getByRole("textbox", { name: /Time zone/u });
  await displayName.fill("Quiet Lantern");
  await timeZone.fill("Asia/Shanghai");
  await timeZone.press("Tab");
  assert.equal(
    await ownerPage.evaluate(() => document.activeElement?.textContent?.trim()),
    "Save profile",
  );
  await ownerPage.keyboard.press("Enter");
  await ownerPage.getByText("Profile saved.", { exact: true }).waitFor();

  const secondContext = await createContext(browser);
  const secondPage = await signIn(secondContext);
  const secondPersonalizationConsent = secondPage.getByRole("checkbox", {
    name: "Allow personalized summaries; private journal entries are excluded by default",
  });
  await secondPersonalizationConsent.waitFor();
  assert.equal(await secondPersonalizationConsent.isChecked(), true);
  await secondPersonalizationConsent.click();
  await secondPage
    .getByText("Your privacy choice was saved and now applies to new data flows.", { exact: true })
    .waitFor();
  assert.equal(await secondPersonalizationConsent.isChecked(), false);
  const immediateConsentResult = await ownerPage.evaluate(async () => {
    const response = await fetch("/api/v1/me/consents", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    return { body: await response.json(), status: response.status };
  });
  assert.equal(immediateConsentResult.status, 200);
  const immediateConsentPayload = immediateConsentResult.body;
  assert.equal(
    immediateConsentPayload.controls.find((control) => control.purpose === "ai_personalization")
      ?.granted,
    false,
  );
  assert.equal(
    immediateConsentPayload.controls.find((control) => control.purpose === "model_improvement")
      ?.granted,
    false,
  );
  await secondPage.getByRole("textbox", { name: /Display name/u }).fill("Second session");
  await secondPage.getByRole("button", { name: "Save profile" }).click();
  await secondPage.getByText("Profile saved.", { exact: true }).waitFor();

  await displayName.fill("Stale owner update");
  await ownerPage.getByRole("button", { name: "Save profile" }).click();
  await ownerPage
    .getByText("This profile changed in another session. Reload the account before saving again.")
    .waitFor();

  await ownerPage.reload({ waitUntil: "load" });
  await ownerPage.getByText("Other active session", { exact: true }).waitFor();
  assert.equal(
    await ownerPage
      .getByRole("checkbox", {
        name: "Allow personalized summaries; private journal entries are excluded by default",
      })
      .isChecked(),
    false,
  );
  assert.equal(await ownerPage.getByText("This session", { exact: true }).count(), 1);
  assert.equal(await ownerPage.getByText("Other active session", { exact: true }).count(), 1);
  await assertLayout(ownerPage);
  await assertAxe(ownerPage);
  acceptNextDialog(ownerPage);
  await ownerPage.getByRole("button", { name: "Sign out this other session" }).click();
  await ownerPage.getByText("The other session was signed out.", { exact: true }).waitFor();
  assert.equal((await secondContext.request.get(`${origin}/api/v1/me`)).status(), 401);
  assert.equal(await ownerPage.getByText("Other active session", { exact: true }).count(), 0);

  const thirdContext = await createContext(browser);
  await signIn(thirdContext);
  await ownerPage.reload({ waitUntil: "load" });
  await ownerPage.getByText("Other active session", { exact: true }).waitFor();
  acceptNextDialog(ownerPage);
  await ownerPage.getByRole("button", { name: "Sign out all sessions" }).click();
  await ownerPage.waitForURL(`${origin}/en/sign-in`);
  assert.equal(
    (await ownerContext.cookies()).some(({ name }) => name === accountCookieName),
    false,
  );
  assert.equal((await thirdContext.request.get(`${origin}/api/v1/me`)).status(), 401);

  const browserState = await ownerPage.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    text: document.body.textContent,
    url: location.href,
  }));
  assert.equal(JSON.stringify(browserState).includes(accountEmail), false);
  assert.equal(JSON.stringify(browserState).includes("private-account-history-canary"), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  assert.ok(
    consoleErrors.every(
      (message) =>
        message ===
          "Failed to load resource: the server responded with a status of 401 (Unauthorized)" ||
        message === "Failed to load resource: the server responded with a status of 409 (Conflict)",
    ),
    JSON.stringify(consoleErrors),
  );
  assert.ok(
    failedRequests.every(
      (failure) =>
        failure === "PATCH:/api/v1/me:net::ERR_ABORTED" ||
        failure === "POST:/api/v1/auth/logout-all:net::ERR_ABORTED" ||
        failure === "GET:/api/v1/me:net::ERR_ABORTED" ||
        failure === "GET:/api/v1/me/history:net::ERR_ABORTED" ||
        failure === "GET:/api/v1/me/consents:net::ERR_ABORTED" ||
        failure === "GET:/api/v1/me/sessions:net::ERR_ABORTED" ||
        /^DELETE:\/api\/v1\/me\/sessions\/[0-9a-f-]{36}:net::ERR_ABORTED$/u.test(failure),
    ),
    JSON.stringify(failedRequests),
  );

  await Promise.all([ownerContext.close(), secondContext.close(), thirdContext.close()]);
} finally {
  await browser.close();
  await stopServer(server);
}

if (server.exitCode !== 0 && server.exitCode !== null && server.exitCode !== 143) {
  throw new Error(`Account control browser server failed: ${serverError}`);
}

process.stdout.write(
  "Verified independent consent controls, cross-session immediate withdrawal, account profile conflicts, private history empty state, current/other session controls, durable targeted/all-session logout, mobile layout, keyboard flow, privacy, and accessibility.\n",
);
