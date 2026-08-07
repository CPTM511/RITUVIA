import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const configuredUrl = process.env.RITUVIA_RECOVERY_STAGING_URL?.trim();
if (configuredUrl === undefined || configuredUrl === "") {
  throw new Error("Recovery Item 10 browser verification requires a protected staging URL.");
}
const accessUrl = new URL(configuredUrl);
if (
  accessUrl.protocol !== "https:" ||
  !accessUrl.hostname.endsWith(".vercel.app") ||
  accessUrl.username !== "" ||
  accessUrl.password !== ""
) {
  throw new Error("Recovery Item 10 browser verification requires a Vercel HTTPS target.");
}
const origin = accessUrl.origin;
const expectedSourceSha = process.env.RITUVIA_EXPECTED_SOURCE_SHA?.trim();
if (!/^[0-9a-f]{40}$/u.test(expectedSourceSha ?? "")) {
  throw new Error("Recovery Item 10 browser verification requires the exact deployed source SHA.");
}
const browserProxyServer = process.env.RITUVIA_BROWSER_PROXY_SERVER?.trim();
const vercelStorageState = process.env.RITUVIA_VERCEL_STORAGE_STATE?.trim();
const bypass = process.env.RITUVIA_VERCEL_PROTECTION_BYPASS?.trim();
const artifactRoot = path.resolve(
  process.env.RITUVIA_RECOVERY_ARTIFACT_DIR ?? "output/playwright/recovery-item-10",
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
const ownerEmail = `item10-owner-${randomBytes(8).toString("hex")}@example.test`;
const progress = (message) => process.stderr.write(`[item10-browser] ${message}\n`);
const providerAiPattern =
  /(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openrouter\.ai|gateway\.ai\.vercel\.com)/u;

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
  let latest;
  while (Date.now() < deadline) {
    latest = await readOrder(context, orderId);
    if (latest.state === "paid" && latest.entitlementGranted === true) return latest;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Signed Stripe Test fulfillment did not arrive for order ${orderId}.`);
};

const locateVisible = async (page, selectors) => {
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
        return locator;
      }
    }
  }
  return null;
};

const fillStripeField = async (page, selectors, value, optional = false) => {
  const locator = await locateVisible(page, selectors);
  if (locator === null) {
    if (optional) return false;
    throw new Error(`Stripe Test Checkout field was not found: ${selectors.join(", ")}`);
  }
  await locator.fill(value);
  return true;
};

const completeStripeTestCheckout = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  assert.equal(page.url().startsWith("https://checkout.stripe.com/"), true);
  assert.equal(page.url().includes("cs_test_"), true);

  await fillStripeField(page, ['input[type="email"]', 'input[name="email"]'], ownerEmail, true);
  await fillStripeField(
    page,
    ['input[autocomplete="cc-number"]', 'input[name="cardNumber"]'],
    "4242424242424242",
  );
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
  assert.equal((await submit.count()) > 0, true);
  await Promise.all([
    page.waitForURL((url) => url.origin === origin && url.pathname === "/en/checkout/return", {
      timeout: 120_000,
    }),
    submit.click(),
  ]);
};

const startCheckout = async (page, productName) => {
  await page.goto(`${origin}/en/plans`, { timeout: 60_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Plus & Credits" }).waitFor();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: productName }) });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/checkout/stripe",
  );
  await card.getByRole("button", { name: "Continue to Stripe Test Checkout" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const checkout = await response.json();
  assert.equal(typeof checkout.orderId, "string");
  assert.equal(typeof checkout.checkoutUrl, "string");
  assert.equal(checkout.checkoutUrl.startsWith("https://checkout.stripe.com/"), true);
  assert.equal(checkout.checkoutUrl.includes("cs_test_"), true);
  await page.waitForURL((url) => url.hostname === "checkout.stripe.com", { timeout: 60_000 });
  return checkout;
};

const proveRedirectIsNotFulfillment = async (context, orderId) => {
  const order = await readOrder(context, orderId);
  assert.equal(order.state, "checkout_created");
  assert.equal(order.entitlementGranted, false);
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/en/checkout/return?order_id=${encodeURIComponent(orderId)}`, {
      timeout: 60_000,
      waitUntil: "load",
    });
    await page.getByRole("heading", { name: "Payment confirmation is still processing" }).waitFor();
  } finally {
    await page.close();
  }
};

const contexts = [];
let browser;
let primaryError;
const requestUrls = [];
const pageErrors = [];
const appConsoleErrors = [];
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
  ownerPage.on("request", (request) => {
    requestUrls.push(request.url());
  });
  ownerPage.on("pageerror", (error) => pageErrors.push(error.message));
  ownerPage.on("console", (message) => {
    if (message.type() === "error" && ownerPage.url().startsWith(origin)) {
      appConsoleErrors.push(message.text());
    }
  });

  const [health, readiness] = await Promise.all([
    ownerContext.request.get("/api/recovery/health"),
    ownerContext.request.get("/api/recovery/readiness"),
  ]);
  assert.equal(health.status(), 200);
  assert.equal(readiness.status(), 200);
  const healthBody = await health.json();
  const readinessBody = await readiness.json();
  assert.equal(healthBody.environment, "staging");
  assert.equal(healthBody.recoveryItem, 10);
  assert.equal(healthBody.sourceSha, expectedSourceSha);
  assert.equal(readinessBody.status, "ready");
  assert.equal(readinessBody.recoveryItem, 10);
  assert.equal(readinessBody.sourceSha, expectedSourceSha);
  assert.equal(readinessBody.controls.commerceSandbox, "enabled");
  assert.equal(readinessBody.controls.productionProviders, "disabled");

  await signInWithEmail(ownerPage);
  progress("sandbox owner signed in");
  await ownerPage.goto(`${origin}/en/plans`, { timeout: 60_000, waitUntil: "load" });
  await ownerPage.getByRole("heading", { name: "Plus & Credits" }).waitFor();
  await ownerPage.getByText("Protected Staging only.", { exact: false }).waitFor();
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);
  await ownerPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "plans-desktop.png"),
  });

  const creditCheckout = await startCheckout(ownerPage, "6 Credits");
  await proveRedirectIsNotFulfillment(ownerContext, creditCheckout.orderId);
  progress("redirect-only Credit order grants nothing");
  await completeStripeTestCheckout(ownerPage);
  const creditOrder = await waitForOrderFulfillment(ownerContext, creditCheckout.orderId);
  assert.equal(creditOrder.productCode, "pack_6");
  const afterCredit = await readAccount(ownerContext);
  assert.equal(afterCredit.credits.purchased, 6);
  assert.equal(afterCredit.credits.subscription, 0);
  assert.equal(afterCredit.reconciliation.balanced, true);
  progress("signed Credit fulfillment verified exactly once");

  const plusCheckout = await startCheckout(ownerPage, "Plus Monthly");
  await proveRedirectIsNotFulfillment(ownerContext, plusCheckout.orderId);
  progress("redirect-only Plus order grants nothing");
  await completeStripeTestCheckout(ownerPage);
  const plusOrder = await waitForOrderFulfillment(ownerContext, plusCheckout.orderId);
  assert.equal(plusOrder.productCode, "plus_monthly");
  const afterPlus = await readAccount(ownerContext);
  assert.equal(afterPlus.credits.purchased, 6);
  assert.equal(afterPlus.credits.subscription, 8);
  assert.equal(afterPlus.credits.totalAvailable, 14);
  assert.equal(afterPlus.reconciliation.balanced, true);
  assert.equal(afterPlus.subscriptions.length, 1);
  assert.equal(afterPlus.subscriptions[0].status, "active");
  assert.equal(afterPlus.subscriptions[0].creditsPerMonth, 8);
  assert.equal(afterPlus.orders.length, 2);
  progress("signed monthly Plus lifecycle verified");

  await ownerPage.goto(`${origin}/en/account/billing`, { timeout: 60_000, waitUntil: "load" });
  await ownerPage.getByRole("heading", { name: "Billing and Credits" }).waitFor();
  await ownerPage.getByText("14 available Credits", { exact: false }).waitFor();
  await ownerPage.getByText("Ledger and balance projection reconcile.").waitFor();
  await ownerPage.getByRole("heading", { name: "Plus Monthly" }).waitFor();
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);
  await ownerPage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "billing-desktop.png"),
  });

  await ownerPage.goto(`${origin}/en/account/orders`, { timeout: 60_000, waitUntil: "load" });
  await ownerPage.getByRole("heading", { name: "Orders" }).waitFor();
  assert.equal(await ownerPage.getByText("Verified fulfillment recorded").count(), 2);
  await assertAxe(ownerPage);
  await assertLayout(ownerPage);

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
  mobilePage.setDefaultTimeout(25_000);
  for (const pathname of ["/en/plans", "/en/account/billing", "/en/account/orders"]) {
    await mobilePage.goto(`${origin}${pathname}`, { timeout: 60_000, waitUntil: "load" });
    await mobilePage.getByText("Founder Acceptance · Item 10").waitFor();
    await assertAxe(mobilePage);
    await assertLayout(mobilePage);
    await assertTouchTargets(mobilePage);
  }
  await mobilePage.screenshot({
    fullPage: true,
    path: path.join(artifactDirectory, "orders-mobile.png"),
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
    artifactDirectory,
    browserProfiles: Object.keys(profiles),
    environment: "protected-staging",
    mockFulfillmentCount: 0,
    orders: Object.freeze([
      Object.freeze({ orderId: creditCheckout.orderId, productCode: "pack_6" }),
      Object.freeze({ orderId: plusCheckout.orderId, productCode: "plus_monthly" }),
    ]),
    providerAiRequestCount: requestUrls.filter((url) => providerAiPattern.test(url)).length,
    requestCount: requestUrls.length,
    sourceSha: expectedSourceSha,
    stripeMode: "test",
    totals: Object.freeze({ purchasedCredits: 6, subscriptionCredits: 8, totalAvailable: 14 }),
  });
  await writeFile(
    path.join(artifactDirectory, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `Verified Recovery Item 10 Stripe Test, zero-redirect fulfillment, Credits, Plus, desktop/mobile, and accessibility at ${origin}.\nArtifacts: ${artifactDirectory}\n`,
  );
} catch (error) {
  primaryError = error;
} finally {
  for (const context of contexts.reverse()) await context.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
if (primaryError !== undefined) throw primaryError;
