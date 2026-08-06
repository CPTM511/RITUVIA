import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4181;
const origin = `http://${host}:${port}`;
const accountCookieName = "__Host-rituvia-account-session";
const anonymousCookieName = "__Host-rituvia-anonymous-session";
const authStateCookieName = "__Host-rituvia-auth-state";
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const emailSuffix = randomBytes(8).toString("hex");
const accountEmail = `account-browser-${emailSuffix}@example.test`;
const comparisonEmail = `comparison-browser-${emailSuffix}@example.test`;
const limitedEmail = `limited-browser-${emailSuffix}@example.test`;

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Account authentication browser server exited before ready.");
    }
    try {
      const response = await fetch(`${origin}/en/sign-in`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Account authentication browser server did not become ready.");
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

const assertAcceptedShape = (payload) => {
  assert.deepEqual(Object.keys(payload).sort(), ["accepted", "expiresAt", "localPreviewPath"]);
  assert.equal(payload.accepted, true);
  assert.equal(payload.localPreviewPath, "/api/v1/auth/local-preview");
  assert.equal(Number.isFinite(Date.parse(payload.expiresAt)), true);
  assert.equal(JSON.stringify(payload).includes(accountEmail), false);
  assert.equal(opaqueTokenPattern.test(payload.localPreviewPath), false);
};

const postAuthStart = async (request, email) => {
  const response = await request.post(`${origin}/api/v1/auth/start`, {
    data: { email, returnTo: "/en/account" },
    headers: {
      accept: "application/json",
      origin,
      "sec-fetch-site": "same-origin",
    },
  });
  return {
    body: await response.json(),
    retryAfter: response.headers()["retry-after"] ?? null,
    status: response.status(),
  };
};

const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: {
    ...process.env,
    BRAND_CANONICAL_ORIGIN: origin,
    RITUVIA_AUTH_START_GLOBAL_LIMIT: "20",
    RITUVIA_AUTH_START_IDENTIFIER_LIMIT: "2",
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
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7_500);
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()}:${new URL(request.url()).pathname}:${request.failure()?.errorText ?? "unknown"}`,
    );
  });

  await page.goto("/en/sign-in", { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Sign in without a password." }).waitFor();
  await assertLayout(page);
  await assertAxe(page);

  const emailInput = page.getByRole("textbox", { name: /Email address/u });
  await emailInput.focus();
  await emailInput.fill(accountEmail);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "Continue securely",
  );
  const startResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/start",
  );
  await page.keyboard.press("Enter");
  const startResponse = await startResponsePromise;
  assert.equal(startResponse.status(), 202);
  const firstStartPayload = await startResponse.json();
  assertAcceptedShape(firstStartPayload);
  await page.getByRole("link", { name: "Complete sandbox sign-in" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("sign-in-status")),
    true,
  );

  const stateCookie = (await context.cookies()).find(
    (cookie) => cookie.name === authStateCookieName,
  );
  assert.ok(stateCookie);
  assert.equal(stateCookie.httpOnly, true);
  assert.equal(stateCookie.secure, true);
  assert.equal(stateCookie.sameSite, "Lax");
  assert.equal(opaqueTokenPattern.test(stateCookie.value), true);
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  assert.equal(JSON.stringify(storage).includes(accountEmail), false);
  assert.equal(page.url().includes(accountEmail), false);
  assert.equal(page.url().includes(stateCookie.value), false);

  await Promise.all([
    page.waitForURL(`${origin}/en/account`, { timeout: 30_000 }),
    page.getByRole("link", { name: "Complete sandbox sign-in" }).click(),
  ]);
  const accountMeResponse = await page.evaluate(async () => {
    const response = await fetch("/api/v1/me", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    await response.arrayBuffer();
    return {
      csrfToken: response.headers.get("x-csrf-token"),
      status: response.status,
    };
  });
  assert.equal(accountMeResponse.status, 200);
  const csrfToken = accountMeResponse.csrfToken;
  assert.equal(opaqueTokenPattern.test(csrfToken ?? ""), true);
  await page.getByRole("heading", { name: "Your reflection space" }).waitFor();
  await assertLayout(page);
  await assertAxe(page);

  const initialAccountCookie = (await context.cookies()).find(
    (cookie) => cookie.name === accountCookieName,
  );
  assert.ok(initialAccountCookie);
  assert.equal(initialAccountCookie.httpOnly, true);
  assert.equal(initialAccountCookie.secure, true);
  assert.equal(initialAccountCookie.sameSite, "Strict");
  assert.equal(opaqueTokenPattern.test(initialAccountCookie.value), true);
  assert.equal(
    (await context.cookies()).some((cookie) => cookie.name === authStateCookieName),
    false,
  );
  const replayResponse = await context.request.get(`${origin}/api/v1/auth/local-preview`);
  assert.equal(replayResponse.status(), 400);

  await page.goto("/en/sign-in", { waitUntil: "load" });
  const comparison = await postAuthStart(context.request, comparisonEmail);
  assert.equal(comparison.status, 202);
  assertAcceptedShape(comparison.body);
  assert.deepEqual(
    Object.entries(comparison.body).map(([key, value]) => [key, typeof value]),
    Object.entries(firstStartPayload).map(([key, value]) => [key, typeof value]),
  );

  await page.getByRole("textbox", { name: /Email address/u }).fill(accountEmail);
  const rotationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/start",
  );
  await page.getByRole("button", { name: "Continue securely" }).click();
  const rotationResponse = await rotationResponsePromise;
  assert.equal(rotationResponse.status(), 202);
  assertAcceptedShape(await rotationResponse.json());
  await page.getByRole("link", { name: "Complete sandbox sign-in" }).click();
  await page.waitForURL(`${origin}/en/account`);
  await page.getByRole("heading", { name: "Your reflection space" }).waitFor();
  const rotatedAccountCookie = (await context.cookies()).find(
    (cookie) => cookie.name === accountCookieName,
  );
  assert.ok(rotatedAccountCookie);
  assert.notEqual(rotatedAccountCookie.value, initialAccountCookie.value);
  const rotatedMe = await fetch(`${origin}/api/v1/me`, {
    headers: { cookie: `${accountCookieName}=${rotatedAccountCookie.value}` },
  });
  assert.equal(rotatedMe.status, 200);
  const rotatedCsrfToken = rotatedMe.headers.get("x-csrf-token");
  assert.equal(opaqueTokenPattern.test(rotatedCsrfToken ?? ""), true);

  assert.equal(
    (
      await fetch(`${origin}/api/v1/me`, {
        headers: { cookie: `${accountCookieName}=${initialAccountCookie.value}` },
      })
    ).status,
    401,
  );

  assert.equal(
    (
      await context.request.post(`${origin}/api/v1/auth/logout`, {
        headers: { origin, "sec-fetch-site": "same-origin" },
      })
    ).status(),
    403,
  );
  const anonymousStart = await fetch(`${origin}/api/v1/anonymous/session`, {
    headers: {
      cookie: `${accountCookieName}=${rotatedAccountCookie.value}`,
      "idempotency-key": randomBytes(24).toString("base64url"),
      origin,
      "sec-fetch-site": "same-origin",
    },
    method: "POST",
  });
  assert.equal(anonymousStart.status, 204);
  const anonymousSetCookie = anonymousStart.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${anonymousCookieName}=`));
  assert.ok(anonymousSetCookie);
  const anonymousToken = anonymousSetCookie.match(
    new RegExp(`^${anonymousCookieName}=([A-Za-z0-9_-]{43})`),
  )?.[1];
  assert.ok(anonymousToken);
  const mergeKey = randomBytes(24).toString("base64url");
  const mergeHeaders = {
    cookie: `${accountCookieName}=${rotatedAccountCookie.value}; ${anonymousCookieName}=${anonymousToken}`,
    "idempotency-key": mergeKey,
    origin,
    "sec-fetch-site": "same-origin",
    "x-csrf-token": rotatedCsrfToken,
  };
  const mergeResponse = await fetch(`${origin}/api/v1/auth/account-merge`, {
    headers: mergeHeaders,
    method: "POST",
  });
  assert.equal(mergeResponse.status, 204);
  const replacementSetCookie = mergeResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${accountCookieName}=`));
  assert.ok(replacementSetCookie);
  const replacementToken = replacementSetCookie.match(
    new RegExp(`^${accountCookieName}=([A-Za-z0-9_-]{43})`),
  )?.[1];
  assert.ok(replacementToken);
  const replacementCsrf = mergeResponse.headers.get("x-csrf-token");
  assert.equal(opaqueTokenPattern.test(replacementCsrf ?? ""), true);
  assert.notEqual(replacementCsrf, rotatedCsrfToken);
  assert.equal(
    mergeResponse.headers
      .getSetCookie()
      .some((value) => value.startsWith(`${anonymousCookieName}=`) && value.includes("Max-Age=0")),
    true,
  );
  const droppedResponseRetry = await fetch(`${origin}/api/v1/auth/account-merge`, {
    headers: mergeHeaders,
    method: "POST",
  });
  assert.equal(droppedResponseRetry.status, 204);
  assert.equal(
    droppedResponseRetry.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${accountCookieName}=`))
      ?.match(new RegExp(`^${accountCookieName}=([A-Za-z0-9_-]{43})`))?.[1],
    replacementToken,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/v1/me`, {
        headers: { cookie: `${accountCookieName}=${rotatedAccountCookie.value}` },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/v1/me`, {
        headers: { cookie: `${accountCookieName}=${replacementToken}` },
      })
    ).status,
    200,
  );
  await context.addCookies([
    {
      domain: host,
      httpOnly: true,
      name: accountCookieName,
      path: "/",
      sameSite: "Strict",
      secure: true,
      value: replacementToken,
    },
  ]);
  await page.reload({ waitUntil: "load" });
  assert.equal(
    (await context.cookies()).some((cookie) => cookie.name === accountCookieName),
    true,
  );
  await page.getByRole("button", { exact: true, name: "Sign out" }).click();
  await page.waitForURL(`${origin}/en/sign-in`);
  assert.equal(
    (await context.cookies()).some((cookie) => cookie.name === accountCookieName),
    false,
  );
  assert.equal((await context.request.get(`${origin}/api/v1/me`)).status(), 401);

  const rateStatuses = [];
  let retryAfter = null;
  for (let requestIndex = 0; requestIndex < 3; requestIndex += 1) {
    const result = await postAuthStart(context.request, limitedEmail);
    rateStatuses.push(result.status);
    retryAfter = result.retryAfter;
  }
  assert.deepEqual(rateStatuses, [202, 202, 429]);
  assert.match(retryAfter ?? "", /^[1-9][0-9]*$/u);

  const expectedUnauthorizedConsoleMessage =
    "Failed to load resource: the server responded with a status of 401 (Unauthorized)";
  assert.deepEqual(
    consoleErrors.filter((message) => message !== expectedUnauthorizedConsoleMessage),
    [],
  );
  assert.ok(
    consoleErrors.filter((message) => message === expectedUnauthorizedConsoleMessage).length <= 2,
  );
  assert.deepEqual(pageErrors, []);
  const expectedLogoutAbort = "POST:/api/v1/auth/logout:net::ERR_ABORTED";
  assert.deepEqual(
    failedRequests.filter((failure) => failure !== expectedLogoutAbort),
    [],
  );
  assert.ok(failedRequests.filter((failure) => failure === expectedLogoutAbort).length <= 1);
  assert.deepEqual(externalRequests, []);
  await context.close();
} finally {
  await browser.close();
  await stopServer(server);
}

if (server.exitCode !== 0 && server.exitCode !== null && server.exitCode !== 143) {
  throw new Error(`Account authentication browser server failed: ${serverError}`);
}

process.stdout.write(
  "Verified account authentication enumeration resistance, local magic-link preview, atomic anonymous merge, dropped-response replay, session rotation, CSRF, logout, rate limits, mobile layout, keyboard flow, and accessibility.\n",
);
