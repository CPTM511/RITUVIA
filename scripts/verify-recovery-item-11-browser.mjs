import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
if (configuredUrl === undefined || configuredUrl === "") {
  throw new Error("Recovery Item 11 browser verification requires a protected staging URL.");
}
const accessUrl = new URL(configuredUrl);
if (
  accessUrl.protocol !== "https:" ||
  !accessUrl.hostname.endsWith(".vercel.app") ||
  accessUrl.username !== "" ||
  accessUrl.password !== ""
) {
  throw new Error("Recovery Item 11 browser verification requires a Vercel HTTPS target.");
}
const origin = accessUrl.origin;
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
if (!/^[0-9a-f]{40}$/u.test(expectedSourceSha ?? "")) {
  throw new Error("Recovery Item 11 browser verification requires the exact deployed source SHA.");
}
const browserProxyServer = process.env.RITUVIA_BROWSER_PROXY_SERVER?.trim();
const vercelStorageState = process.env.RITUVIA_VERCEL_STORAGE_STATE?.trim();
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const artifactRoot = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-11",
);
const artifactDirectory = path.join(
  artifactRoot,
  new Date().toISOString().replaceAll(/[:.]/gu, "-"),
);
await mkdir(artifactDirectory, { recursive: true });

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
const ownerEmail = `item11-owner-${randomBytes(8).toString("hex")}@example.test`;
const progress = (message) => process.stderr.write(`[item11-browser] ${message}\n`);
const providerAiPattern =
  /(?:ai-gateway\.vercel\.sh|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openrouter\.ai|gateway\.ai\.vercel\.com)/u;
const isExpectedHostedPlatformConsoleNoise = (message) => {
  const text = message.text();
  const locationUrl = message.location().url;
  return (
    (text.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
      text.includes("violates the following Content Security Policy directive")) ||
    (text === "Failed to load resource: the server responded with a status of 401 ()" &&
      locationUrl.startsWith("https://vercel.live/"))
  );
};
const isExpectedStripeCheckoutPageError = (error, pageUrl) => {
  try {
    return error.message === "network-error" && new URL(pageUrl).hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
};

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
  const failures = await page.evaluate(() => {
    const overflow = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      overflow.push("document-overflow");
    }
    for (const element of document.querySelectorAll("main *")) {
      const rectangle = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        style.position !== "fixed" &&
        rectangle.width > 1 &&
        (rectangle.left < -1 || rectangle.right > innerWidth + 1)
      ) {
        overflow.push(`${element.tagName}.${element.className}`);
        if (overflow.length >= 8) break;
      }
    }
    return overflow;
  });
  assert.deepEqual(failures, []);
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

const signInWithEmail = async (page) => {
  await page.goto(`${origin}/en/sign-in`, { timeout: 60_000, waitUntil: "load" });
  await page.getByRole("textbox", { name: /Email address/u }).fill(ownerEmail);
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

const confirmPaidEligibility = async (page) => {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PATCH" &&
      new URL(candidate.url()).pathname === "/api/v1/me",
  );
  await page.getByRole("checkbox", { name: "I confirm that I am 18 or older." }).check();
  await page.getByRole("button", { name: "Save 18+ confirmation" }).click();
  assert.equal((await response).status(), 200);
  await page.getByText("Your 18+ confirmation was saved.").waitFor();
};

const readOrder = async (context, orderId) => {
  const response = await context.request.get(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { accept: "application/json" },
  });
  assert.equal(response.status(), 200);
  return response.json();
};

const readAccount = async (context) => {
  const response = await context.request.get("/api/v1/commerce/account", {
    headers: { accept: "application/json" },
  });
  assert.equal(response.status(), 200);
  return response.json();
};

const waitForOrderFulfillment = async (context, orderId) => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const order = await readOrder(context, orderId);
    if (order.state === "paid" && order.entitlementGranted === true) return order;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Signed Stripe Test fulfillment did not arrive for order ${orderId}.`);
};

const locateVisible = async (page, selectors, timeoutMilliseconds = 30_000) => {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const selector of selectors) {
        const locator = frame.locator(selector).first();
        if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
          return locator;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const fillStripeField = async (page, selectors, value, optional = false) => {
  const locator = await locateVisible(page, selectors);
  if (locator === null) {
    if (optional) return false;
    throw new Error(`Stripe Test field unavailable: ${selectors.join(",")}`);
  }
  await locator.fill(value);
  return true;
};

const completeStripeTestCheckout = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  assert.equal(page.url().startsWith("https://checkout.stripe.com/"), true);
  assert.equal(page.url().includes("cs_test_"), true);
  await fillStripeField(page, ['input[type="email"]', 'input[name="email"]'], ownerEmail, true);
  const usdOption = page.getByText(/^\$\d+[.]\d{2}$/u).first();
  if ((await usdOption.count()) > 0 && (await usdOption.isVisible().catch(() => false))) {
    await usdOption.click();
  }
  const cardNumberSelectors = ['input[autocomplete="cc-number"]', 'input[name="cardNumber"]'];
  if ((await locateVisible(page, cardNumberSelectors, 2_000)) === null) {
    await page.getByRole("button", { name: "Pay with card" }).first().click();
  }
  await fillStripeField(page, cardNumberSelectors, "4242424242424242");
  await fillStripeField(page, ['input[autocomplete="cc-exp"]', 'input[name="cardExpiry"]'], "1234");
  await fillStripeField(page, ['input[autocomplete="cc-csc"]', 'input[name="cardCvc"]'], "123");
  await fillStripeField(
    page,
    ['input[autocomplete="name"]', 'input[name="billingName"]'],
    "RITUVIA Staging Test",
    true,
  );
  await fillStripeField(
    page,
    ['input[autocomplete="postal-code"]', 'input[name="billingPostalCode"]'],
    "94107",
    true,
  );
  let submit = page.getByRole("button", { name: /^(?:Pay|Subscribe)/iu }).last();
  if ((await submit.count()) === 0) submit = page.locator('button[type="submit"]').last();
  await Promise.all([
    page.waitForURL((url) => url.origin === origin && url.pathname === "/en/checkout/return", {
      timeout: 120_000,
    }),
    submit.click(),
  ]);
};

const startCheckout = async (page, provider) => {
  await page.goto(`${origin}/en/plans`, { timeout: 60_000, waitUntil: "load" });
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "6 Credits" }) });
  const routePath = `/api/v1/checkout/${provider}`;
  const buttonName =
    provider === "stripe"
      ? "Continue to Stripe Test Checkout"
      : "Continue to Coinbase USDC/Base Sandbox";
  let resolveCheckoutResponse;
  const responsePromise = new Promise((resolve) => {
    resolveCheckoutResponse = resolve;
  });
  await page.route(
    `**${routePath}`,
    async (route) => {
      const response = await route.fetch();
      const body = await response.body();
      await route.fulfill({ body, response });
      resolveCheckoutResponse({
        body: JSON.parse(body.toString("utf8")),
        status: response.status(),
      });
    },
    { times: 1 },
  );
  await card.getByRole("button", { name: buttonName }).click();
  const response = await responsePromise;
  assert.equal(response.status, 201);
  assert.equal(typeof response.body.orderId, "string");
  assert.equal(typeof response.body.checkoutUrl, "string");
  const checkoutUrl = new URL(response.body.checkoutUrl);
  assert.equal(
    checkoutUrl.hostname,
    provider === "stripe" ? "checkout.stripe.com" : "payments.coinbase.com",
  );
  await page.waitForURL((url) => url.hostname === checkoutUrl.hostname, { timeout: 60_000 });
  return response.body;
};

const contexts = [];
let browser;
let primaryError;
const requestUrls = [];
const pageErrors = [];
const appConsoleErrors = [];
let hostedPlatformConsoleNoiseCount = 0;
let stripeHostedCheckoutPageErrorCount = 0;
try {
  progress("launching protected-staging browser");
  browser = await chromium.launch({
    headless: true,
    proxy:
      browserProxyServer === undefined || browserProxyServer === ""
        ? undefined
        : { server: browserProxyServer },
  });
  const ownerContext = await browser.newContext({
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
  if (accessUrl.searchParams.has("_vercel_share")) {
    const bootstrap = await ownerContext.request.get(accessUrl.toString(), { timeout: 60_000 });
    assert.ok([200, 404].includes(bootstrap.status()));
  }
  const ownerPage = await ownerContext.newPage();
  ownerPage.setDefaultTimeout(25_000);
  ownerPage.on("request", (request) => requestUrls.push(request.url()));
  ownerPage.on("pageerror", (error) => {
    if (isExpectedStripeCheckoutPageError(error, ownerPage.url())) {
      stripeHostedCheckoutPageErrorCount += 1;
    } else {
      pageErrors.push(`${error.message} @ ${ownerPage.url()}`);
    }
  });
  ownerPage.on("console", (message) => {
    if (message.type() !== "error" || !ownerPage.url().startsWith(origin)) return;
    if (isExpectedHostedPlatformConsoleNoise(message)) {
      hostedPlatformConsoleNoiseCount += 1;
    } else if (!message.text().includes("server responded with a status of 401")) {
      appConsoleErrors.push(`${message.text()} @ ${message.location().url || ownerPage.url()}`);
    }
  });

  const readiness = await ownerContext.request.get("/api/recovery/readiness");
  assert.equal(readiness.status(), 200);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.environment, "staging");
  assert.equal(readinessBody.recoveryItem, 11);
  assert.equal(readinessBody.sourceSha, expectedSourceSha);
  assert.equal(readinessBody.controls.coinbaseSandbox, "enabled");
  assert.equal(readinessBody.controls.providerAi, "enabled");
  assert.equal(readinessBody.controls.productionProviders, "disabled");

  await signInWithEmail(ownerPage);
  await confirmPaidEligibility(ownerPage);
  progress("sandbox owner signed in and age-attested");

  const stripeCheckout = await startCheckout(ownerPage, "stripe");
  await completeStripeTestCheckout(ownerPage);
  await waitForOrderFulfillment(ownerContext, stripeCheckout.orderId);
  const fundedAccount = await readAccount(ownerContext);
  assert.equal(fundedAccount.credits.purchased, 6);
  assert.equal(fundedAccount.reconciliation.balanced, true);
  progress("six Credits funded by signed Stripe Test event");

  const coinbaseCheckout = await startCheckout(ownerPage, "coinbase");
  assert.equal(coinbaseCheckout.networkCode, "base");
  assert.equal(coinbaseCheckout.settlementAsset, "USDC");
  assert.equal(coinbaseCheckout.state, "checkout_created");
  await ownerPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "coinbase-sandbox-hosted.png"),
  });
  await ownerPage.goto(`${origin}/en/plans`, { timeout: 60_000, waitUntil: "load" });
  const abandonedOrder = await readOrder(ownerContext, coinbaseCheckout.orderId);
  assert.equal(abandonedOrder.state, "checkout_created");
  assert.equal(abandonedOrder.entitlementGranted, false);
  progress("Coinbase Sandbox hosted checkout opened; abandoned flow granted nothing");

  await ownerPage.getByRole("button", { name: "Use 1 Credit for synthetic Provider AI" }).click();
  await ownerPage
    .getByText("One Credit was consumed after the structured result passed safety checks.")
    .waitFor({ timeout: 60_000 });
  await ownerPage.getByText("Optional small action", { exact: true }).waitFor();
  const afterAi = await readAccount(ownerContext);
  assert.equal(afterAi.credits.purchased, 5);
  assert.equal(afterAi.credits.reserved, 0);
  assert.equal(afterAi.reconciliation.balanced, true);
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);
  await ownerPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "provider-ai-desktop.png"),
  });
  progress("bounded Provider AI generated safely and consumed exactly one Credit");

  const mobileContext = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    extraHTTPHeaders,
    locale: "en-US",
    reducedMotion: "reduce",
    storageState: await ownerContext.storageState(),
    timezoneId: "Asia/Shanghai",
    viewport: profiles.mobile,
  });
  contexts.push(mobileContext);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${origin}/en/plans`, { timeout: 60_000, waitUntil: "load" });
  await mobilePage.getByText("Founder Acceptance · Item 11").first().waitFor();
  await mobilePage
    .getByRole("button", { name: "Continue to Coinbase USDC/Base Sandbox" })
    .waitFor();
  await mobilePage
    .getByRole("button", { name: "Use 1 Credit for synthetic Provider AI" })
    .waitFor();
  await assertAxe(mobilePage);
  await assertLayout(mobilePage);
  await assertTouchTargets(mobilePage);
  await mobilePage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "item11-mobile.png"),
  });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(appConsoleErrors, []);
  assert.equal(
    requestUrls.some((url) => providerAiPattern.test(url)),
    false,
  );
  assert.equal(
    requestUrls.some((url) => url.includes("sk_live_")),
    false,
  );
  assert.equal(
    requestUrls.some((url) => url.startsWith("http://")),
    false,
  );

  const evidence = Object.freeze({
    ai: Object.freeze({ creditConsumed: 1, directBrowserProviderRequests: 0 }),
    artifactDirectory,
    browserProfiles: Object.keys(profiles),
    coinbase: Object.freeze({
      abandonedEntitlementGranted: false,
      networkCode: "base",
      orderId: coinbaseCheckout.orderId,
      settlementAsset: "USDC",
    }),
    environment: "protected-staging",
    hostedPlatformConsoleNoiseCount,
    mockFulfillmentCount: 0,
    sourceSha: expectedSourceSha,
    stripeHostedCheckoutPageErrorCount,
    stripeFundingOrderId: stripeCheckout.orderId,
  });
  await writeFile(
    path.join(artifactDirectory, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Recovery Item 11 Coinbase Sandbox abandonment, Provider AI, Credits, desktop/mobile, and accessibility at ${origin}.\nArtifacts: ${artifactDirectory}\n`,
  );
} catch (error) {
  primaryError = error;
} finally {
  for (const context of contexts.reverse()) await context.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
if (primaryError !== undefined) throw primaryError;
