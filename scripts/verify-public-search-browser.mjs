import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { serializePublicStructuredData } from "../apps/web/app/_i18n/public-structured-data.ts";

const host = "127.0.0.1";
const port = 4192;
const origin = `http://${host}:${port}`;
const privateCanary = `private-search-${randomUUID()}`;
const webRoot = path.join(process.cwd(), "apps/web");
const buildRoot = path.join(webRoot, ".next");
const routes = Object.freeze([
  Object.freeze({
    classifications: ["product_guidance", "interpretation"],
    entityId: "rituvia-public-guidance-v1",
    pathname: "/en",
    structuredType: "WebSite",
  }),
  Object.freeze({
    classifications: ["fact", "product_guidance"],
    entityId: "rituvia-public-guidance-v1",
    pathname: "/en/methodology",
    structuredType: "WebPage",
  }),
  Object.freeze({
    classifications: ["fact", "interpretation"],
    entityId: "rituvia-numerology-v1",
    pathname: "/en/numerology",
    structuredType: "CollectionPage",
  }),
  Object.freeze({
    classifications: ["fact", "interpretation"],
    entityId: "rituvia-numerology-v1",
    pathname: "/en/numerology/life-path-number",
    structuredType: "Article",
  }),
  Object.freeze({
    classifications: ["fact", "tradition", "interpretation"],
    entityId: "rituvia-western-natal-astrology-v1",
    pathname: "/en/astrology/natal-chart-calculation",
    structuredType: "Article",
  }),
  Object.freeze({
    classifications: ["tradition", "interpretation"],
    entityId: "rituvia-major-arcana-reflection-v1",
    pathname: "/en/tarot/the-fool",
    structuredType: "Article",
  }),
  Object.freeze({
    classifications: ["product_guidance", "interpretation"],
    entityId: "rituvia-original-secular-reflection-v1",
    pathname: "/en/rituals/virtual-candle-reflection",
    structuredType: "Article",
  }),
]);
const forbiddenStructuredTypes = new Set([
  "BreadcrumbList",
  "FAQPage",
  "MedicalWebPage",
  "Offer",
  "Product",
]);

const hasForbiddenStructuredClaim = (value) => {
  if (Array.isArray(value)) return value.some(hasForbiddenStructuredClaim);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      key === "aggregateRating" ||
      (key === "@type" &&
        typeof nestedValue === "string" &&
        forbiddenStructuredTypes.has(nestedValue)) ||
      hasForbiddenStructuredClaim(nestedValue),
  );
};

const respondWithFile = async (response, filePath, contentType) => {
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(body.byteLength),
      "content-type": contentType,
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
};

const artifactServer = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", origin);
  if (requestUrl.pathname.startsWith("/_next/static/")) {
    const relativePath = requestUrl.pathname.slice("/_next/static/".length);
    const filePath = path.resolve(buildRoot, "static", relativePath);
    const staticRoot = `${path.resolve(buildRoot, "static")}${path.sep}`;
    if (!filePath.startsWith(staticRoot)) return response.writeHead(404).end();
    const contentType = filePath.endsWith(".css")
      ? "text/css; charset=utf-8"
      : "text/javascript; charset=utf-8";
    return respondWithFile(response, filePath, contentType);
  }
  if (requestUrl.pathname === "/_next/image") {
    if (requestUrl.searchParams.get("url") !== "/images/rituvia-sanctuary-orb.png") {
      return response.writeHead(404).end();
    }
    return respondWithFile(
      response,
      path.join(webRoot, "public/images/rituvia-sanctuary-orb.png"),
      "image/png",
    );
  }
  if (requestUrl.pathname === "/icon.svg") {
    return respondWithFile(
      response,
      path.join(buildRoot, "server/app/icon.svg.body"),
      "image/svg+xml",
    );
  }
  if (routes.some(({ pathname: routePathname }) => routePathname === requestUrl.pathname)) {
    return respondWithFile(
      response,
      path.join(buildRoot, "server/app", `${requestUrl.pathname.slice(1)}.html`),
      "text/html; charset=utf-8",
    );
  }
  response.writeHead(404).end();
});

const listen = async () => {
  await new Promise((resolve, reject) => {
    artifactServer.once("error", reject);
    artifactServer.listen(port, host, resolve);
  });
};

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: origin,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { height: 844, width: 320 },
  });
  await context.addCookies([
    {
      name: "private-search-canary",
      url: origin,
      value: privateCanary,
    },
  ]);
  const unexpectedRequests = [];
  let accountSessionProbes = 0;
  await context.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }),
      contentType: "application/json",
      status: 401,
    });
  });
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/me" && request.method() === "GET") {
      accountSessionProbes += 1;
    } else if (url.origin !== origin || url.pathname.startsWith("/api/")) {
      unexpectedRequests.push(`${request.method()}:${url.toString()}`);
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let axeScans = 0;
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const route of routes) {
    const response = await page.goto(route.pathname, { timeout: 30_000, waitUntil: "load" });
    assert.ok(response);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('script[type="application/ld+json"]').count(), 1);
    const payload = await page.locator('script[type="application/ld+json"]').textContent();
    assert.ok(payload);
    assert.equal(payload.includes(privateCanary), false);
    const structured = JSON.parse(payload);
    assert.equal(structured["@context"], "https://schema.org");
    assert.equal(structured["@graph"].length, 1);
    const node = structured["@graph"][0];
    assert.equal(node["@type"], route.structuredType);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.ok(canonical);
    assert.equal(node.url, canonical);
    assert.equal(node.inLanguage, "en");
    assert.equal(
      node[route.structuredType === "Article" ? "headline" : "name"].replace(/\s+/gu, " ").trim(),
      (await page.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/gu, " ").trim(),
    );
    assert.equal(
      (await page.locator("main#main-content").innerText()).includes(node.description),
      true,
    );
    const answerContext = page.locator("[data-geo-answer-context]");
    assert.equal(await answerContext.count(), 1);
    assert.equal(await answerContext.getAttribute("data-geo-entity-id"), route.entityId);
    assert.deepEqual(
      await answerContext
        .locator("[data-geo-classification]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-geo-classification"))),
      route.classifications,
    );
    assert.equal(await answerContext.getByRole("heading", { level: 2 }).count(), 1);
    assert.equal(await answerContext.getByRole("heading", { level: 3 }).count(), 1);
    assert.equal((await answerContext.innerText()).includes("Source basis"), true);
    assert.equal((await answerContext.innerText()).includes("Review authority"), true);
    assert.equal((await answerContext.locator("li").count()) >= 1, true);
    assert.deepEqual(
      await answerContext.evaluate((element) => ({
        ariaHiddenAncestor: element.closest('[aria-hidden="true"]') !== null,
        display: getComputedStyle(element).display,
        hidden: element.hasAttribute("hidden"),
        textLength: element.innerText.trim().length,
        visibility: getComputedStyle(element).visibility,
      })),
      {
        ariaHiddenAncestor: false,
        display: "grid",
        hidden: false,
        textLength: (await answerContext.innerText()).trim().length,
        visibility: "visible",
      },
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );
    const axe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      axe.violations
        .filter(({ impact }) => impact === "critical" || impact === "serious")
        .map(({ id, impact }) => ({ id, impact })),
      [],
    );
    assert.equal(
      axe.incomplete
        .filter(({ impact }) => impact === "critical" || impact === "serious")
        .every(({ id }) => id === "color-contrast"),
      true,
    );
    axeScans += 1;
    assert.equal(hasForbiddenStructuredClaim(structured), false);
    assert.equal((await page.content()).includes(privateCanary), false);
    assert.equal((await page.content()).includes("content/editorial/"), false);
    assert.equal((await page.content()).includes("product.codex"), false);
  }

  const injectionPage = await context.newPage();
  const maliciousValue = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        description: `Reviewed visible copy </script><script>globalThis.__rituviaPwned=true</script> ${privateCanary}\u2028\u2029`,
      },
    ],
  };
  const serialized = serializePublicStructuredData(maliciousValue);
  await injectionPage.setContent(
    `<script type="application/ld+json">${serialized}</script><main>Safe document</main>`,
  );
  assert.equal(await injectionPage.locator("script").count(), 1);
  assert.equal(await injectionPage.evaluate(() => globalThis.__rituviaPwned ?? null), null);
  const injectionPayload = await injectionPage
    .locator('script[type="application/ld+json"]')
    .textContent();
  assert.ok(injectionPayload);
  assert.deepEqual(JSON.parse(injectionPayload), maliciousValue);

  assert.deepEqual(unexpectedRequests, []);
  assert.equal(accountSessionProbes, routes.length);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  await context.close();

  const noScriptRequests = [];
  const noScriptContext = await browser.newContext({
    baseURL: origin,
    javaScriptEnabled: false,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { height: 844, width: 320 },
  });
  noScriptContext.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith("/api/")) {
      noScriptRequests.push(`${request.method()}:${url.toString()}`);
    }
  });
  const noScriptPage = await noScriptContext.newPage();
  for (const route of routes) {
    const response = await noScriptPage.goto(route.pathname, {
      timeout: 30_000,
      waitUntil: "load",
    });
    assert.ok(response);
    assert.equal(response.status(), 200);
    const answerContext = noScriptPage.locator("[data-geo-answer-context]");
    assert.equal(await answerContext.count(), 1);
    assert.equal(await answerContext.getAttribute("data-geo-entity-id"), route.entityId);
    assert.equal((await answerContext.innerText()).trim().length > 300, true);
    assert.equal(
      await noScriptPage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );
  }
  assert.deepEqual(noScriptRequests, []);
  await noScriptContext.close();

  process.stdout.write(
    `Verified ${routes.length} public search/GEO browser shapes, ${axeScans} Axe scans, no-JavaScript visibility, and inert JSON-LD injection handling.\n`,
  );
} catch (error) {
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => artifactServer.close(resolve));
}
