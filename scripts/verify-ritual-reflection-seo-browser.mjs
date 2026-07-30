import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4189;
const origin = `http://${host}:${port}`;
const productionCrawl = process.env.APP_ENV === "production";
const expectedPathnames = Object.freeze([
  "/en/rituals",
  "/en/rituals/virtual-candle-reflection",
  "/en/rituals/virtual-incense-reflection",
  "/en/rituals/intention-and-small-action",
  "/en/rituals/private-reflection-journal",
  "/en/rituals/revisit-a-reflection",
]);
const routes = Object.freeze([
  Object.freeze({
    heading: "A symbolic pause that keeps the next step yours",
    pathname: "/en/rituals",
    structuredType: "CollectionPage",
  }),
  Object.freeze({
    heading: "How to use a virtual candle for reflection",
    pathname: "/en/rituals/virtual-candle-reflection",
    structuredType: "Article",
  }),
  Object.freeze({
    heading: "Write a private reflection after a ritual",
    pathname: "/en/rituals/private-reflection-journal",
    structuredType: "Article",
  }),
]);

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Ritual SEO browser server exited before ready.");
    }
    try {
      const response = await fetch(`${origin}/en/rituals`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Ritual SEO browser server did not become ready.");
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
  env: {
    ...process.env,
    BRAND_CANONICAL_ORIGIN: process.env.BRAND_CANONICAL_ORIGIN ?? origin,
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
  const unexpectedRequests = [];
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET" && pathname === "/api/v1/me") {
      return route.fulfill({
        body: JSON.stringify({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }),
        contentType: "application/json",
        status: 401,
      });
    }
    unexpectedRequests.push(`${request.method()}:${pathname}`);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  let axeScans = 0;
  let reviewedContrastNodes = 0;
  for (const route of routes) {
    const response = await page.goto(route.pathname, { timeout: 30_000, waitUntil: "load" });
    assert.ok(response);
    assert.equal(response.status(), 200);
    assert.equal(
      response.headers()["x-robots-tag"],
      productionCrawl ? undefined : "noindex, nofollow, noarchive",
    );
    await page.getByRole("heading", { level: 1, name: route.heading }).waitFor();
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(await page.locator("main#main-content").count(), 1);
    assert.equal(await page.locator("input, form, textarea").count(), 0);
    assert.equal((await page.locator('a[href="/en/sanctuary"]').count()) > 0, true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      productionCrawl ? "index, follow" : "noindex, nofollow",
    );
    const canonicalUrl = `${process.env.BRAND_CANONICAL_ORIGIN}${route.pathname}`;
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), canonicalUrl);
    assert.equal(
      await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute("href"),
      canonicalUrl,
    );
    assert.equal(
      await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute("href"),
      canonicalUrl,
    );
    const structured = await page.locator('script[type="application/ld+json"]').textContent();
    assert.ok(structured);
    const graph = JSON.parse(structured)["@graph"];
    assert.ok(Array.isArray(graph));
    assert.equal(graph.length, 1);
    const pageNode = graph.find((entry) => entry?.["@type"] === route.structuredType);
    assert.ok(pageNode);
    assert.equal(pageNode.url, canonicalUrl);
    assert.equal(pageNode.inLanguage, "en");
    assert.equal(
      pageNode[route.structuredType === "Article" ? "headline" : "name"],
      (await page.getByRole("heading", { level: 1 }).innerText()).trim(),
    );
    assert.equal(
      (await page.locator("main#main-content").innerText()).includes(pageNode.description),
      true,
    );
    assert.equal(
      graph.some((entry) => entry?.["@type"] === "BreadcrumbList"),
      false,
    );
    assert.equal(structured.includes("FAQPage"), false);
    assert.equal(structured.includes('"@type":"HowTo"'), false);
    assert.equal(structured.includes('"@type":"Product"'), false);

    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations
      .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
      .map((finding) => `${finding.impact}:${finding.id}`);
    assert.deepEqual(
      serious,
      [],
      JSON.stringify(
        axe.violations
          .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
          .map(({ id, impact, nodes }) => ({
            id,
            impact,
            nodes: nodes.map(({ failureSummary, target }) => ({ failureSummary, target })),
          })),
      ),
    );
    const incomplete = axe.incomplete.filter(
      (finding) => finding.impact === "critical" || finding.impact === "serious",
    );
    assert.equal(
      incomplete.every((finding) => finding.id === "color-contrast"),
      true,
      JSON.stringify(incomplete.map(({ id, impact }) => ({ id, impact }))),
    );
    reviewedContrastNodes += incomplete.flatMap(({ nodes }) => nodes).length;
    axeScans += 1;

    const actionLinks = page.locator(".ritual-guide-actions a");
    for (let index = 0; index < (await actionLinks.count()); index += 1) {
      const box = await actionLinks.nth(index).boundingBox();
      assert.ok(box);
      assert.ok(box.height >= 44);
    }
  }

  const robotsResponse = await context.request.get("/robots.txt");
  assert.equal(robotsResponse.status(), 200);
  const robots = await robotsResponse.text();
  const sitemapResponse = await context.request.get("/sitemaps/en-rituals.xml");
  if (productionCrawl) {
    const robotPathnames = (robots.match(/^Allow: \/en\/rituals(?:\/[^$]+)?\$$/gmu) ?? []).map(
      (line) => line.slice("Allow: ".length, -1),
    );
    assert.deepEqual(robotPathnames, expectedPathnames);
    assert.equal(robots.includes("/en/sanctuary$"), false);
    assert.equal(robots.includes("/en/rituals/love"), false);
    assert.equal(robots.includes("/en/rituals/physical-candle"), false);

    assert.equal(sitemapResponse.status(), 200);
    const sitemap = await sitemapResponse.text();
    const canonicalOrigin = process.env.BRAND_CANONICAL_ORIGIN;
    assert.ok(canonicalOrigin);
    assert.equal((sitemap.match(/<url>/gu) ?? []).length, 6);
    const sitemapPathnames = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
      (match) => new URL(match[1]).pathname,
    );
    assert.deepEqual(sitemapPathnames, expectedPathnames);
    for (const pathname of expectedPathnames) {
      const url = `${canonicalOrigin}${pathname}`;
      assert.equal(sitemap.includes(`<loc>${url}</loc>`), true);
      assert.equal(
        sitemap.includes(`<xhtml:link rel="alternate" hreflang="en" href="${url}"/>`),
        true,
      );
      assert.equal(
        sitemap.includes(`<xhtml:link rel="alternate" hreflang="x-default" href="${url}"/>`),
        true,
      );
    }
    assert.equal(sitemap.includes("/en/sanctuary</loc>"), false);
    assert.equal(sitemap.includes("/en/rituals/love"), false);
  } else {
    assert.equal(robots, "User-agent: *\nDisallow: /\n");
    assert.equal(sitemapResponse.status(), 404);
  }

  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
    { local: 0, session: 0 },
  );
  process.stdout.write(
    `${JSON.stringify({
      axeCriticalOrSeriousViolations: 0,
      axeScans,
      consoleErrors: 0,
      pageErrors: 0,
      reviewedContrastNodes,
      routes: routes.length,
      sitemapRoutes: productionCrawl ? 6 : 0,
      unexpectedApiRequests: 0,
      viewportWidth: 320,
    })}\n`,
  );
} catch (error) {
  if (serverError !== "") process.stderr.write(serverError);
  throw error;
} finally {
  await browser.close();
  await stopServer(server);
}
