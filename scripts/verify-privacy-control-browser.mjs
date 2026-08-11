import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import { chromium } from "playwright";

import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "../packages/db/scripts/local-postgres.mjs";

const host = "127.0.0.1";
const port = 4189;
const origin = `http://${host}:${port}`;
const accountCookieName = "__Host-rituvia-account-session";
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const accountEmail = `privacy-browser-${randomBytes(8).toString("hex")}@example.test`;

const waitForServer = async (server, readOutput) => {
  const deadline = Date.now() + 30_000;
  let lastStatus = "unreachable";
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Privacy control browser server exited before ready.");
    }
    if (readOutput().includes("Ready in")) return;
    try {
      const response = await fetch(`${origin}/en/sign-in`);
      lastStatus = String(response.status);
      if (response.ok) return;
    } catch (error) {
      lastStatus =
        error instanceof Error &&
        typeof error.cause === "object" &&
        error.cause !== null &&
        "code" in error.cause
          ? String(error.cause.code)
          : error instanceof Error
            ? error.name
            : "unreachable";
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Privacy control browser server did not become ready: ${lastStatus}.`);
};

const stopServer = async (server) => {
  if (server === undefined || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

const sanitizeServerError = (value) =>
  value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-database-url]")
    .replace(/[A-Za-z0-9_-]{43,}/gu, "[redacted-token]")
    .slice(0, 2_000);

const browserRequest = async (page, pathname, init = {}) =>
  page.evaluate(
    async ({ init: requestInit, pathname: requestPathname }) => {
      const response = await fetch(requestPathname, {
        ...requestInit,
        credentials: "same-origin",
      });
      return {
        body: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
      };
    },
    { init, pathname },
  );

const lease = await withLocalPostgresLease(async (activeLease) => {
  runLocalPrisma(activeLease.runtime, activeLease.developmentMigrationDatabaseUrl, ["generate"]);
  runLocalPrisma(activeLease.runtime, activeLease.developmentMigrationDatabaseUrl, [
    "migrate",
    "deploy",
  ]);
  await ensureRuntimeDatabasePrivileges(activeLease.runtime, "rituvia_local");
  return activeLease;
});

let browser;
let server;
let serverError = "";
let serverOutput = "";
let primaryError;
try {
  server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
    cwd: `${process.cwd()}/apps/web`,
    env: {
      ...process.env,
      APP_ENV: "local",
      BRAND_CANONICAL_ORIGIN: origin,
      DATABASE_URL: lease.developmentDatabaseUrl,
      PRIVACY_DELETION_DATABASE_URL: lease.developmentPrivacyDeletionDatabaseUrl,
      RITUVIA_AUTH_START_GLOBAL_LIMIT: "100",
      RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "20",
      RITUVIA_AUTH_START_WINDOW_SECONDS: "60",
      RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_KEY_V1: randomBytes(32).toString("base64url"),
      RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("spawn", resolve);
  });
  server.stdout?.on("data", (chunk) => {
    serverOutput += String(chunk);
  });
  server.stderr?.on("data", (chunk) => {
    serverError += String(chunk);
  });

  browser = await chromium.launch({ headless: true });
  await waitForServer(server, () => serverOutput);
  const context = await browser.newContext({
    baseURL: origin,
    locale: "en-US",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const consoleErrors = [];
  const externalRequests = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
  });

  await page.goto("/en/sign-in", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("textbox", { name: /Email address/u }).fill(accountEmail);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByRole("link", { name: "Complete sandbox sign-in" }).click();
  await page.waitForURL(`${origin}/en/account`, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Your reflection space" }).waitFor();

  const accountCookie = (await context.cookies()).find(
    (cookie) => cookie.name === accountCookieName,
  );
  assert.ok(accountCookie);
  assert.equal(opaqueTokenPattern.test(accountCookie.value), true);
  const accountResponse = await browserRequest(page, "/api/v1/me", {
    headers: { accept: "application/json" },
  });
  assert.equal(accountResponse.status, 200);
  const csrfToken = accountResponse.headers["x-csrf-token"];
  assert.equal(opaqueTokenPattern.test(csrfToken ?? ""), true);

  const exportRequestKey = randomBytes(24).toString("base64url");
  const privacyHeaders = {
    origin,
    "sec-fetch-site": "same-origin",
    "x-csrf-token": csrfToken,
  };
  const exportResponse = await browserRequest(page, "/api/v1/privacy/export", {
    headers: { ...privacyHeaders, "idempotency-key": exportRequestKey },
    method: "POST",
  });
  assert.equal(exportResponse.status, 202);
  const exportMetadata = JSON.parse(exportResponse.body);
  assert.equal(exportMetadata.status, "ready");
  assert.match(exportMetadata.id, /^[0-9a-f-]{36}$/u);

  const metadataResponse = await browserRequest(
    page,
    `/api/v1/privacy/exports/${exportMetadata.id}`,
  );
  assert.equal(metadataResponse.status, 200);
  assert.equal(JSON.parse(metadataResponse.body).id, exportMetadata.id);
  const crossSiteMetadata = await context.request.get(
    `${origin}/api/v1/privacy/exports/${exportMetadata.id}`,
    {
      headers: {
        origin: "https://foreign.example",
        "sec-fetch-site": "cross-site",
      },
    },
  );
  assert.equal(crossSiteMetadata.status(), 404);

  const downloadResponse = await browserRequest(
    page,
    `/api/v1/privacy/exports/${exportMetadata.id}/download`,
    { headers: privacyHeaders, method: "POST" },
  );
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers["content-type"] ?? "", /application\/json/u);
  const exportPackage = JSON.parse(downloadResponse.body);
  assert.equal(exportPackage.schemaVersion, "privacy-export-package.v2");
  assert.equal(Array.isArray(exportPackage.machineReadable?.astrologyCalculations), true);
  assert.equal(JSON.stringify(exportPackage).includes(accountCookie.value), false);
  assert.equal(JSON.stringify(exportPackage).includes(csrfToken), false);

  const deletionRequestKey = randomBytes(24).toString("base64url");
  const deletionResponse = await browserRequest(page, "/api/v1/privacy/deletions", {
    body: JSON.stringify({ scope: "account" }),
    headers: {
      ...privacyHeaders,
      "content-type": "application/json",
      "idempotency-key": deletionRequestKey,
    },
    method: "POST",
  });
  assert.equal(deletionResponse.status, 202);
  const deletion = JSON.parse(deletionResponse.body);
  assert.equal(deletion.scope, "account");
  assert.equal(deletion.status, "completed");
  assert.equal(
    (await context.cookies()).some((cookie) => cookie.name === accountCookieName),
    false,
  );

  const oldCookieHeader = `${accountCookieName}=${accountCookie.value}`;
  assert.equal(
    (
      await fetch(`${origin}/api/v1/me`, {
        headers: { cookie: oldCookieHeader },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/v1/privacy/exports/${exportMetadata.id}`, {
        headers: {
          cookie: oldCookieHeader,
          "sec-fetch-site": "same-origin",
        },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/v1/privacy/export`, {
        headers: {
          ...privacyHeaders,
          cookie: oldCookieHeader,
          "idempotency-key": randomBytes(24).toString("base64url"),
        },
        method: "POST",
      })
    ).status,
    401,
  );
  const deletionReplay = await fetch(`${origin}/api/v1/privacy/deletions`, {
    body: JSON.stringify({ scope: "account" }),
    headers: {
      ...privacyHeaders,
      cookie: oldCookieHeader,
      "content-type": "application/json",
      "idempotency-key": deletionRequestKey,
    },
    method: "POST",
  });
  assert.equal(deletionReplay.status, 202);
  assert.equal((await deletionReplay.json()).id, deletion.id);

  const browserState = await page.evaluate(() => ({
    historyLength: history.length,
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    title: document.title,
    url: location.href,
  }));
  assert.equal(JSON.stringify(browserState).includes(accountEmail), false);
  assert.equal(JSON.stringify(browserState).includes(accountCookie.value), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  assert.equal(serverError.includes(accountEmail), false);
  assert.equal(serverError.includes(accountCookie.value), false);
  assert.deepEqual(
    consoleErrors.filter(
      (message) => !message.includes("401 (Unauthorized)") && !message.includes("404 (Not Found)"),
    ),
    [],
  );
  await context.close();
} catch (error) {
  primaryError = error;
} finally {
  await browser?.close().catch((error) => {
    if (primaryError === undefined) primaryError = error;
  });
  await stopServer(server).catch((error) => {
    if (primaryError === undefined) primaryError = error;
  });
  await stopLeaseOwnedRuntime(lease).catch((error) => {
    if (primaryError === undefined) primaryError = error;
  });
}
if (primaryError !== undefined) {
  const serverDiagnostics = `${serverOutput}\n${serverError}`.trim();
  if (serverDiagnostics !== "") {
    throw new Error(`Privacy control server failed: ${sanitizeServerError(serverDiagnostics)}`, {
      cause: primaryError,
    });
  }
  throw primaryError;
}

process.stdout.write(
  "Verified recent-authenticated privacy export, same-origin metadata, encrypted download, account deletion, old-session denial, export fencing, dropped-response replay, and browser privacy.\n",
);
