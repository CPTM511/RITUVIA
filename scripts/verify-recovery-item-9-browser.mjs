import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { privateKeyToAccount } from "../apps/web/node_modules/viem/_esm/accounts/index.js";

import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "../packages/db/scripts/local-postgres.mjs";

const host = "127.0.0.1";
const port = 4199;
const localOrigin = `http://${host}:${port}`;
const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
const hosted = configuredUrl !== undefined && configuredUrl !== "";
const accessUrl = new URL(hosted ? configuredUrl : localOrigin);
const originUrl = new URL(accessUrl);
originUrl.pathname = "/";
originUrl.search = "";
originUrl.hash = "";
const origin = originUrl.origin;
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const browserProxyServer = process.env.RITUVIA_BROWSER_PROXY_SERVER?.trim();
const vercelStorageState = process.env.RITUVIA_VERCEL_STORAGE_STATE?.trim();
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
const expectedRecoveryItem = Number(process.env.RITUVIA_EXPECTED_RECOVERY_ITEM ?? "9");
assert.ok(Number.isSafeInteger(expectedRecoveryItem) && expectedRecoveryItem > 0);
const artifactRoot = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-9",
);
const artifactDirectory = path.join(
  artifactRoot,
  new Date().toISOString().replaceAll(/[:.]/gu, "-"),
);
await mkdir(artifactDirectory, { recursive: true });

const accountCookieName = "__Host-rituvia-account-session";
const anonymousCookieName = "__Host-rituvia-anonymous-session";
const authStateCookieName = "__Host-rituvia-auth-state";
const bearerPattern = /^[A-Za-z0-9_-]{43}$/u;
const wallet = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
const emailSuffix = randomBytes(8).toString("hex");
const ownerEmail = `item9-owner-${emailSuffix}@example.test`;
const otherEmail = `item9-other-${emailSuffix}@example.test`;
const extraHTTPHeaders =
  bypass === undefined || bypass === ""
    ? undefined
    : {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      };
const profiles = Object.freeze({
  desktop: Object.freeze({ height: 900, width: 1_440 }),
  mobile: Object.freeze({ height: 844, width: 390 }),
});
const progress = (message) => process.stderr.write(`[item9-browser] ${message}\n`);

const within = async (promise, timeoutMilliseconds, label) => {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} exceeded ${timeoutMilliseconds}ms.`)),
          timeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

const waitForServer = async (server) => {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Item 9 browser server exited before ready.");
    try {
      const response = await fetch(`${origin}/en/sign-in`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Item 9 browser server did not become ready.");
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

const sanitize = (value) =>
  value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-database-url]")
    .replace(/[A-Za-z0-9_-]{43,}/gu, "[redacted-token]")
    .slice(0, 3_000);

const assertAxe = async (page) => {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(
        ({ id, impact, nodes }) =>
          `${impact}:${id}:${nodes.flatMap(({ target }) => target).join(",")}`,
      ),
    [],
  );
};

const assertLayout = async (page) => {
  const overflow = await page.evaluate(() => {
    const failures = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      failures.push("document-overflow");
    }
    for (const element of document.querySelectorAll("main *")) {
      const rectangle = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        style.position !== "fixed" &&
        rectangle.width > 1 &&
        (rectangle.left < -1 || rectangle.right > innerWidth + 1)
      ) {
        failures.push(`${element.tagName}.${element.className}`);
        if (failures.length >= 8) break;
      }
    }
    return failures;
  });
  assert.deepEqual(overflow, []);
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

const expectedUnauthorizedConsolePattern =
  /^Failed to load resource: the server responded with a status of 401 \((?:Unauthorized)?\)$/u;

const unexpectedConsoleErrors = (messages) =>
  messages.filter(
    (message) =>
      !message.includes("404 (Not Found)") &&
      !message.includes("https://vercel.live/_next-live/feedback/feedback.js"),
  );

const expectedBadRequestConsolePattern =
  /^Failed to load resource: the server responded with a status of 400 \((?:Bad Request)?\)$/u;

const removeExpectedBadRequestConsoleErrors = (messages, responses) => {
  const expectedBadRequestResponseCount = responses.filter(
    ({ pathname, status }) => status === 400 && pathname === "/api/v1/auth/wallet/verify",
  ).length;
  let consumed = 0;
  const remaining = messages.filter((message) => {
    if (
      consumed < expectedBadRequestResponseCount &&
      expectedBadRequestConsolePattern.test(message)
    ) {
      consumed += 1;
      return false;
    }
    return true;
  });
  assert.equal(consumed <= expectedBadRequestResponseCount, true);
  return remaining;
};

const removeExpectedUnauthorizedConsoleErrors = (messages, responses) => {
  const expectedUnauthorizedResponseCount = responses.filter(
    ({ pathname, status }) =>
      status === 401 && ["/api/v1/me", "/api/v1/me/wallets"].includes(pathname),
  ).length;
  let consumed = 0;
  const remaining = messages.filter((message) => {
    if (
      consumed < expectedUnauthorizedResponseCount &&
      expectedUnauthorizedConsolePattern.test(message)
    ) {
      consumed += 1;
      return false;
    }
    return true;
  });
  assert.equal(consumed <= expectedUnauthorizedResponseCount, true);
  return remaining;
};

const installWalletProvider = async (page) => {
  await page.exposeFunction("__rituviaSignMessage", async (message) =>
    wallet.signMessage({ message }),
  );
  await page.addInitScript(
    ({ address }) => {
      const provider = Object.freeze({
        async request({ method, params }) {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
          if (method === "eth_chainId") return "0x14a34";
          if (method === "personal_sign") {
            const message = Array.isArray(params) ? params[0] : null;
            if (typeof message !== "string") throw new Error("Invalid personal_sign request.");
            return window.__rituviaSignMessage(message);
          }
          throw new Error(`Unsupported sandbox wallet method: ${method}`);
        },
      });
      Object.defineProperty(window, "ethereum", { configurable: false, value: provider });
    },
    { address: wallet.address },
  );
};

const signInWithEmail = async (page, email) => {
  await page.goto("/en/sign-in", { timeout: 60_000, waitUntil: "load" });
  await page.getByRole("textbox", { name: /Email address/u }).fill(email);
  const started = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/start",
  );
  await page.getByRole("button", { name: "Continue securely" }).click();
  assert.equal((await started).status(), 202);
  await Promise.all([
    page.waitForURL(`${origin}/en/account`, { timeout: 60_000 }),
    page.getByRole("link", { name: "Complete sandbox sign-in" }).click(),
  ]);
  await page.getByRole("heading", { name: "Your reflection space" }).waitFor();
};

const contexts = [];
let lease;
let server;
let browser;
let serverError = "";
let serverOutput = "";
let primaryError;
const requests = [];
const responseEvidence = [];
const pageErrors = [];
const consoleErrors = [];
const externalRequests = [];
const providerAiRequests = [];
const forbiddenProviderRequestPattern =
  /(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openrouter\.ai|gateway\.ai\.vercel\.com)/u;
const isVercelProtectionResource = (hostname) =>
  hostname === "vercel.live" || hostname.endsWith(".vercel.live");
try {
  if (!hosted) {
    progress("preparing local database");
    lease = await withLocalPostgresLease(async (activeLease) => {
      runLocalPrisma(activeLease.runtime, activeLease.developmentMigrationDatabaseUrl, [
        "generate",
      ]);
      runLocalPrisma(activeLease.runtime, activeLease.developmentMigrationDatabaseUrl, [
        "migrate",
        "deploy",
      ]);
      await ensureRuntimeDatabasePrivileges(activeLease.runtime, "rituvia_local");
      return activeLease;
    });
    const uniqueKey = () => randomBytes(32).toString("base64url");
    const authDataKey = uniqueKey();
    const authSubjectKey = uniqueKey();
    const privacyExportKey = uniqueKey();
    const privateContentKey = uniqueKey();
    const runtimeEnvironment = {
      ...process.env,
      APP_ENV: "local",
      BRAND_CANONICAL_ORIGIN: origin,
      DATABASE_URL: lease.developmentDatabaseUrl,
      PRIVACY_DELETION_DATABASE_URL: lease.developmentPrivacyDeletionDatabaseUrl,
      RITUVIA_ACCOUNT_SESSION_TTL_SECONDS: "3600",
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: "100",
      RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: "60",
      RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "test.recovery-item-9.v1",
      RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: "86400",
      RITUVIA_AUTH_CHALLENGE_TTL_SECONDS: "600",
      RITUVIA_AUTH_DATA_KEY_V1: authDataKey,
      RITUVIA_AUTH_START_GLOBAL_LIMIT: "100",
      RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "20",
      RITUVIA_AUTH_START_WINDOW_SECONDS: "60",
      RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1: authSubjectKey,
      RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_KEY_V1: privacyExportKey,
      RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS: "900",
      RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS: "3600",
      RITUVIA_PRIVACY_EXPORT_TTL_SECONDS: "900",
      RITUVIA_PRIVATE_CONTENT_KEY_V1: privateContentKey,
      RITUVIA_RECOVERY_IDENTITY_SANDBOX: "item-9",
    };
    progress("building Item 9 production server");
    for (const packageName of ["@rituvia/config", "@rituvia/db", "@rituvia/web"]) {
      const build = spawnSync("pnpm", ["--filter", packageName, "build"], {
        cwd: process.cwd(),
        env: runtimeEnvironment,
        stdio: "inherit",
      });
      if (build.status !== 0) {
        throw new Error(`Item 9 production server dependency build failed for ${packageName}.`);
      }
    }
    server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
      cwd: `${process.cwd()}/apps/web`,
      env: runtimeEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (chunk) => {
      serverOutput += String(chunk);
    });
    server.stderr?.on("data", (chunk) => {
      serverError += String(chunk);
    });
    await waitForServer(server);
    progress("local server ready");
  }

  progress("launching browser");
  browser = await chromium.launch({
    headless: true,
    proxy:
      browserProxyServer === undefined || browserProxyServer === ""
        ? undefined
        : { server: browserProxyServer },
  });
  const ownerContext = await browser.newContext({
    acceptDownloads: true,
    baseURL: origin,
    colorScheme: "dark",
    extraHTTPHeaders,
    locale: "en-US",
    reducedMotion: "reduce",
    storageState: vercelStorageState || undefined,
    timezoneId: "Asia/Shanghai",
    viewport: profiles.desktop,
  });
  contexts.push(ownerContext);
  if (hosted && accessUrl.searchParams.has("_vercel_share")) {
    const bootstrap = await ownerContext.request.get(accessUrl.toString(), { timeout: 60_000 });
    assert.ok([200, 404].includes(bootstrap.status()));
  }
  const ownerPage = await ownerContext.newPage();
  ownerPage.setDefaultTimeout(20_000);
  await installWalletProvider(ownerPage);
  ownerPage.on("request", (request) => {
    const url = new URL(request.url());
    requests.push({ method: request.method(), pathname: url.pathname });
    if (url.origin !== origin && !isVercelProtectionResource(url.hostname)) {
      externalRequests.push(request.url());
    }
    if (forbiddenProviderRequestPattern.test(request.url())) {
      providerAiRequests.push(request.url());
    }
  });
  ownerPage.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin) {
      responseEvidence.push({
        method: response.request().method(),
        pathname: url.pathname,
        status: response.status(),
      });
    }
  });
  ownerPage.on("pageerror", (error) => pageErrors.push(error.message));
  ownerPage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  if (hosted) {
    const health = await ownerContext.request.get("/api/recovery/health");
    assert.equal(health.status(), 200);
    const healthBody = await health.json();
    assert.equal(healthBody.environment, "staging");
    assert.equal(healthBody.recoveryItem, expectedRecoveryItem);
    if (expectedSourceSha !== undefined && expectedSourceSha !== "") {
      assert.equal(healthBody.sourceSha, expectedSourceSha);
    }
    const readiness = await ownerContext.request.get("/api/recovery/readiness");
    assert.equal(readiness.status(), 200);
    const readinessBody = await readiness.json();
    assert.equal(readinessBody.controls.identitySandbox, "enabled");
    assert.equal(readinessBody.controls.privacyControls, "enabled");
    assert.equal(readinessBody.controls.productionProviders, "disabled");
  }

  await ownerPage.goto("/en/sign-in", { timeout: 60_000, waitUntil: "load" });
  progress("owner sign-in page loaded");
  await browserRequest(ownerPage, "/api/v1/anonymous/session", {
    headers: { "idempotency-key": randomBytes(24).toString("base64url") },
    method: "POST",
  });
  assert.equal(
    (await ownerContext.cookies()).some(({ name }) => name === anonymousCookieName),
    true,
  );
  await signInWithEmail(ownerPage, ownerEmail);
  progress("owner email sandbox sign-in complete");
  assert.equal(
    (await ownerContext.cookies()).some(({ name }) => name === anonymousCookieName),
    false,
  );
  assert.equal(
    (await ownerContext.cookies()).some(({ name }) => name === authStateCookieName),
    false,
  );
  const emailSessionCookie = (await ownerContext.cookies()).find(
    ({ name }) => name === accountCookieName,
  );
  assert.ok(emailSessionCookie);
  assert.equal(emailSessionCookie.httpOnly, true);
  assert.equal(emailSessionCookie.secure, true);
  assert.equal(emailSessionCookie.sameSite, "Strict");
  assert.equal(bearerPattern.test(emailSessionCookie.value), true);
  progress("waiting for wallet panel");
  await ownerPage.getByRole("heading", { name: "Linked sign-in wallets" }).waitFor();
  progress("wallet panel ready; checking provider");
  assert.equal(
    await within(
      ownerPage.evaluate(async () => window.ethereum.request({ method: "eth_chainId" })),
      5_000,
      "Wallet provider self-check",
    ),
    "0x14a34",
  );
  progress("wallet provider confirmed; linking");
  const linkChallengeResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/wallet/challenge",
  );
  const linkResponse = ownerPage
    .waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/auth/wallet/verify",
    )
    .catch((error) => error);
  await ownerPage.getByRole("button", { name: "Link a Base Sepolia wallet" }).click();
  const linkChallenge = await linkChallengeResponse;
  progress(`wallet challenge returned ${linkChallenge.status()}`);
  if (linkChallenge.status() !== 200) {
    let responseBody = "unavailable";
    try {
      responseBody = await within(linkChallenge.text(), 5_000, "Wallet challenge error body");
    } catch {}
    const pageText = (await ownerPage.locator("body").innerText()).slice(0, 600);
    throw new Error(
      `Wallet challenge failed (${linkChallenge.status()}): ${responseBody} | ${pageText}`,
    );
  }
  const linkVerification = await linkResponse;
  if (linkVerification instanceof Error) throw linkVerification;
  assert.equal(linkVerification.status(), 200);
  progress("wallet link verified");
  await ownerPage
    .getByText("The wallet is linked and can now be used for sign-in.", { exact: true })
    .waitFor();
  await ownerPage.getByText(`${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`).waitFor();
  await ownerPage.getByRole("heading", { name: "Personalization choices" }).waitFor();
  await ownerPage.getByRole("heading", { name: "Signed-in sessions" }).waitFor();
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);
  await ownerPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "account-wallet-desktop.png"),
  });

  const walletList = await browserRequest(ownerPage, "/api/v1/me/wallets");
  assert.equal(walletList.status, 200);
  const ownerWallet = JSON.parse(walletList.body).wallets[0];
  assert.equal(ownerWallet.address, wallet.address.toLowerCase());

  await ownerPage.getByRole("link", { name: "Manage privacy & data" }).click();
  await ownerPage.waitForURL(`${origin}/en/account/privacy`);
  await ownerPage
    .getByRole("heading", { name: "Your data, yours to keep, take, or delete" })
    .waitFor();
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);
  const downloadPromise = ownerPage.waitForEvent("download");
  await ownerPage.getByRole("button", { name: "Download my data" }).click();
  const download = await downloadPromise;
  const downloadPath = path.join(artifactDirectory, await download.suggestedFilename());
  await download.saveAs(downloadPath);
  progress("privacy export downloaded");
  const exported = JSON.parse(await readFile(downloadPath, "utf8"));
  assert.equal(exported.schemaVersion, "privacy-export-package.v2");
  assert.equal(exported.machineReadable.wallets[0].address, wallet.address.toLowerCase());
  assert.equal(JSON.stringify(exported).includes(emailSessionCookie.value), false);
  await ownerPage
    .getByText("Your encrypted export was authorized and downloaded to this device.", {
      exact: true,
    })
    .waitFor();
  const exportId = exported.manifest.exportId;

  await ownerPage.getByRole("link", { name: "Back to account" }).click();
  await ownerPage.waitForURL(`${origin}/en/account`);
  await ownerPage.getByRole("button", { name: "Sign out", exact: true }).click();
  await ownerPage.waitForURL(`${origin}/en/sign-in`);
  const walletSignInResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/wallet/verify",
  );
  await ownerPage.getByRole("button", { name: "Sign in with a linked wallet" }).click();
  assert.equal((await walletSignInResponse).status(), 200);
  progress("wallet sign-in complete");
  await ownerPage.waitForURL(`${origin}/en/account`, { timeout: 60_000 });
  const walletSessionCookie = (await ownerContext.cookies()).find(
    ({ name }) => name === accountCookieName,
  );
  assert.ok(walletSessionCookie);
  assert.notEqual(walletSessionCookie.value, emailSessionCookie.value);

  const otherContext = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders,
    locale: "en-US",
    storageState: vercelStorageState || undefined,
    timezoneId: "Asia/Shanghai",
    viewport: profiles.mobile,
  });
  contexts.push(otherContext);
  const otherPage = await otherContext.newPage();
  otherPage.setDefaultTimeout(20_000);
  await signInWithEmail(otherPage, otherEmail);
  progress("mobile comparison account ready");
  await otherPage.getByText("No browser wallet was found.", { exact: false }).waitFor();
  await assertAxe(otherPage);
  await assertLayout(otherPage);
  await assertTouchTargets(otherPage);
  await otherPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "account-no-wallet-mobile.png"),
  });
  const otherAccount = await browserRequest(otherPage, "/api/v1/me");
  const otherCsrf = otherAccount.headers["x-csrf-token"];
  assert.equal(bearerPattern.test(otherCsrf ?? ""), true);
  const crossWallet = await browserRequest(otherPage, `/api/v1/me/wallets/${ownerWallet.id}`, {
    headers: { "x-csrf-token": otherCsrf },
    method: "DELETE",
  });
  assert.equal(crossWallet.status, 404);
  const crossExport = await browserRequest(otherPage, `/api/v1/privacy/exports/${exportId}`);
  assert.equal(crossExport.status, 404);
  assert.deepEqual(
    unexpectedConsoleErrors(
      removeExpectedBadRequestConsoleErrors(
        removeExpectedUnauthorizedConsoleErrors(consoleErrors, responseEvidence),
        responseEvidence,
      ),
    ),
    [],
  );

  await ownerPage.goto("/en/account/privacy", { timeout: 60_000, waitUntil: "load" });
  await ownerPage
    .getByRole("heading", { name: "Your data, yours to keep, take, or delete" })
    .waitFor();
  ownerPage.once("dialog", (dialog) => dialog.accept());
  const deletionResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/privacy/deletions",
  );
  await ownerPage.getByRole("button", { name: "Delete account and data" }).click();
  const deletion = await deletionResponse;
  assert.equal(deletion.status(), 202);
  progress("account deletion complete");
  const deletionBody = await deletion.json();
  assert.equal(deletionBody.counts.wallets, 1);
  await ownerPage
    .getByText("The sandbox account was deleted and every session was revoked.", { exact: true })
    .waitFor();
  assert.equal(
    (await ownerContext.cookies()).some(({ name }) => name === accountCookieName),
    false,
  );
  const protectionCookies = (await ownerContext.cookies())
    .filter(({ name }) => name !== accountCookieName)
    .map(({ name, value }) => `${name}=${value}`);
  const revokedSession = await ownerContext.request.get("/api/v1/me", {
    headers: {
      cookie: [...protectionCookies, `${accountCookieName}=${walletSessionCookie.value}`].join(
        "; ",
      ),
    },
  });
  assert.equal(revokedSession.status(), 401);

  await ownerPage.goto("/en/sign-in", { waitUntil: "load" });
  const deniedWalletSignIn = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/wallet/verify",
  );
  await ownerPage.getByRole("button", { name: "Sign in with a linked wallet" }).click();
  assert.equal((await deniedWalletSignIn).status(), 400);
  await ownerPage
    .getByText("Wallet sign-in could not be verified. No account authority was granted.", {
      exact: true,
    })
    .waitFor();

  const forbiddenCommerce = await otherContext.request.post("/api/v1/orders", {
    data: {},
    headers: { origin, "sec-fetch-site": "same-origin" },
  });
  if (hosted) {
    assert.equal(forbiddenCommerce.status(), 404);
  } else {
    assert.equal(forbiddenCommerce.status() >= 400, true);
  }
  const browserState = await ownerPage.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    url: location.href,
  }));
  assert.equal(JSON.stringify(browserState).includes(ownerEmail), false);
  assert.equal(JSON.stringify(browserState).includes(walletSessionCookie.value), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(providerAiRequests, []);
  assert.equal(serverError.includes(ownerEmail), false);
  assert.equal(serverError.includes(walletSessionCookie.value), false);
  assert.deepEqual(
    unexpectedConsoleErrors(
      removeExpectedBadRequestConsoleErrors(
        removeExpectedUnauthorizedConsoleErrors(consoleErrors, responseEvidence),
        responseEvidence,
      ),
    ),
    [],
  );

  const evidence = Object.freeze({
    artifactDirectory,
    browserProfiles: Object.keys(profiles),
    deletion: Object.freeze({
      accountSessions: deletionBody.counts.accountSessions,
      wallets: deletionBody.counts.wallets,
    }),
    environment: hosted ? "protected-staging" : "local",
    externalRequestCount: externalRequests.length,
    mockFulfillmentCount: 0,
    providerAiRequestCount: providerAiRequests.length,
    ownerIsolation: Object.freeze({
      crossExport: crossExport.status,
      crossWallet: crossWallet.status,
    }),
    requestCount: requests.length,
    responses: responseEvidence,
    sourceSha: expectedSourceSha ?? null,
    wallet: Object.freeze({ address: wallet.address.toLowerCase(), chainId: 84_532 }),
  });
  await writeFile(
    path.join(artifactDirectory, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Recovery Item 9 identity, wallet, ownership, export, deletion, desktop/mobile, and accessibility at ${origin}.\nArtifacts: ${artifactDirectory}\n`,
  );
} catch (error) {
  primaryError = error;
  progress(`failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const context of contexts.reverse()) {
    await within(context.close(), 5_000, "Browser context cleanup").catch((error) => {
      if (primaryError === undefined) primaryError = error;
    });
  }
  await within(browser?.close() ?? Promise.resolve(), 5_000, "Browser cleanup").catch((error) => {
    if (primaryError === undefined) primaryError = error;
  });
  await stopServer(server).catch((error) => {
    if (primaryError === undefined) primaryError = error;
  });
  if (lease !== undefined) {
    await within(stopLeaseOwnedRuntime(lease), 10_000, "Local PostgreSQL cleanup").catch(
      (error) => {
        if (primaryError === undefined) primaryError = error;
      },
    );
  }
}
if (primaryError !== undefined) {
  const failure =
    primaryError instanceof Error
      ? (primaryError.stack ?? primaryError.message)
      : String(primaryError);
  const diagnostics = sanitize(`${serverError}\n${failure}\n${serverOutput}`.trim());
  throw new Error(diagnostics === "" ? "Item 9 browser verification failed." : diagnostics);
}
