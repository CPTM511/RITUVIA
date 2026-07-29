import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4188;
const origin = `http://${host}:${port}`;
const routes = Object.freeze([
  Object.freeze({
    heading: "The Major Arcana as reflection, not prediction",
    pathname: "/en/tarot",
    structuredType: "CollectionPage",
  }),
  Object.freeze({
    heading: "The Fool Tarot meaning",
    pathname: "/en/tarot/the-fool",
    structuredType: "Article",
  }),
  Object.freeze({
    heading: "Situation, Action, Possibility three-card spread",
    pathname: "/en/tarot/situation-action-possibility-spread",
    structuredType: "Article",
  }),
]);

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Tarot SEO browser server exited before ready.");
    }
    try {
      const response = await fetch(`${origin}/en/tarot`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Tarot SEO browser server did not become ready.");
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
    const canonicalUrl = new URL(
      route.pathname,
      process.env.BRAND_CANONICAL_ORIGIN ?? origin,
    ).toString();
    assert.ok(response);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["x-robots-tag"], undefined);
    await page.getByRole("heading", { level: 1, name: route.heading }).waitFor();
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(await page.locator("main#main-content").count(), 1);
    assert.equal(await page.locator("input, form, textarea").count(), 0);
    assert.equal((await page.locator('a[href="/en/tarot/one-card"]').count()) > 0, true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "index, follow",
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
    assert.equal(structured.includes('"@type":"Review"'), false);

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

    const actionLinks = page.locator(".tarot-library-actions a");
    for (let index = 0; index < (await actionLinks.count()); index += 1) {
      const box = await actionLinks.nth(index).boundingBox();
      assert.ok(box);
      assert.ok(box.height >= 44);
    }
  }

  const robotsResponse = await context.request.get("/robots.txt");
  assert.equal(robotsResponse.status(), 200);
  const robots = await robotsResponse.text();
  assert.equal((robots.match(/^Allow: \/en\/tarot(?:\/[^$]+)?\$$/gmu) ?? []).length, 25);
  assert.equal(robots.includes("/en/tarot/one-card$"), false);
  assert.equal(robots.includes("/en/tarot/three-card$"), false);
  assert.equal(robots.includes("/en/tarot/the-fool/upright"), false);

  const sitemapResponse = await context.request.get("/sitemaps/en-tarot.xml");
  assert.equal(sitemapResponse.status(), 200);
  const sitemap = await sitemapResponse.text();
  const canonicalOrigin = process.env.BRAND_CANONICAL_ORIGIN;
  assert.ok(canonicalOrigin);
  assert.equal((sitemap.match(/<url>/gu) ?? []).length, 25);
  for (const route of routes) {
    assert.equal(sitemap.includes(`<loc>${canonicalOrigin}${route.pathname}</loc>`), true);
  }
  assert.equal(sitemap.includes("/en/tarot/one-card</loc>"), false);
  assert.equal(sitemap.includes("/en/tarot/three-card</loc>"), false);
  assert.equal(sitemap.includes("/en/tarot/the-fool/upright"), false);

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
      sitemapRoutes: 25,
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
