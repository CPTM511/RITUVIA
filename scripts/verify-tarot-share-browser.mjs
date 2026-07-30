import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4193;
const origin = `http://${host}:${port}`;
const routePath = "/en/tarot/one-card";
const webRoot = path.join(process.cwd(), "apps/web");
const buildRoot = path.join(webRoot, ".next");
const documentPath = path.join(buildRoot, "server/app/en/tarot/one-card.html");
const builtDocument = await readFile(documentPath, "utf8");
const builtTarotUrls = [
  ...new Set(
    [...builtDocument.matchAll(/https?:\/\/[^"<\\\s]+\/en\/tarot/gu)].map(([value]) => value),
  ),
];
assert.equal(builtTarotUrls.length, 1);
const [expectedCanonicalUrl] = builtTarotUrls;
assert.ok(expectedCanonicalUrl);
const expectedCanonicalLabel = new URL(expectedCanonicalUrl);
const readingId = "33333333-3333-4333-8333-333333333333";
const privateCanaries = Object.freeze([
  `PRIVATE_QUESTION_CANARY_${randomUUID()}`,
  `PRIVATE_INTENTION_CANARY_${randomUUID()}`,
  `PRIVATE_JOURNAL_CANARY_${randomUUID()}`,
  `PRIVATE_BIRTH_CANARY_${randomUUID()}`,
  readingId,
]);
const [privateQuestion, privateIntention, privateJournal, privateBirth] = privateCanaries;
const contentSecurityPolicy = [
  "base-uri 'none'",
  "connect-src 'self'",
  "default-src 'self'",
  "font-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' blob:",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
  "worker-src 'none'",
].join("; ");

const reading = Object.freeze({
  createdAt: "2026-07-17T12:00:00.000Z",
  facts: Object.freeze({
    algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
    catalog: Object.freeze({ id: "test.catalog", version: "1.0.0" }),
    deck: Object.freeze({ id: "test.deck", version: "1.0.0" }),
    engineName: "rituvia.tarot-draw",
    engineVersion: "1.0.0",
    method: "tarot",
    orientationPolicy: "upright_and_reversed",
    positions: Object.freeze([
      Object.freeze({
        cardId: "lantern",
        order: 1,
        orientation: "upright",
        positionId: "perspective",
      }),
    ]),
    replacementPolicy: "without_replacement",
    rulesVersion: "tarot-draw-rules.v1",
    schemaVersion: "tarot-draw-facts.v1",
    spread: Object.freeze({ id: "one-card-perspective", version: "1.0.0" }),
  }),
  locale: "en",
  presentation: Object.freeze({
    cards: Object.freeze([
      Object.freeze({
        cannotDetermine: "This symbol cannot determine an outcome.",
        cardId: "lantern",
        cardTitle: "The Lantern at the Threshold of Patient Reflection",
        constructivePossibility: "A small source of clarity may be enough for the next step.",
        coreThemes: Object.freeze(["clarity", "attention"]),
        invitation: privateJournal,
        order: 1,
        orientation: "upright",
        positionId: "perspective",
        positionTitle: "Perspective",
        reflectionQuestion: privateQuestion,
        smallAction: privateIntention,
        tension: "Seeking certainty can obscure the useful detail already present.",
      }),
    ]),
    schemaVersion: "tarot-reading-presentation.v1",
  }),
  readingId,
  readingPolicyVersion: "test.tarot-reading.v1",
  readingType: "one_card",
  schemaVersion: "tarot-reading-response.v2",
  status: "facts_ready",
  themeCode: "open_reflection",
});

const respondWithFile = async (response, filePath, contentType, headers = {}) => {
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(body.byteLength),
      "content-type": contentType,
      ...headers,
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
    return respondWithFile(
      response,
      filePath,
      filePath.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
    );
  }
  if (requestUrl.pathname === "/icon.svg") {
    return respondWithFile(
      response,
      path.join(buildRoot, "server/app/icon.svg.body"),
      "image/svg+xml",
    );
  }
  if (requestUrl.pathname === routePath) {
    return respondWithFile(response, documentPath, "text/html; charset=utf-8", {
      "content-security-policy": contentSecurityPolicy,
    });
  }
  response.writeHead(404).end();
});

const assertNoPrivateCanary = (label, value) => {
  for (const canary of privateCanaries) {
    assert.equal(value.includes(canary), false, `${label} leaked ${canary}`);
  }
};

await new Promise((resolve, reject) => {
  artifactServer.once("error", reject);
  artifactServer.listen(port, host, resolve);
});

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: origin,
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: 844, width: 320 },
  });
  await context.addCookies([{ name: "private-birth-canary", url: origin, value: privateBirth }]);
  await context.addInitScript(
    ({ journalCanary }) => {
      localStorage.setItem("private-journal-canary", journalCanary);
      globalThis.__rituviaSharePayload = null;
      globalThis.__rituviaObjectUrls = { created: [], revoked: [], texts: {} };
      const createObjectUrl = URL.createObjectURL.bind(URL);
      const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const value = createObjectUrl(blob);
        globalThis.__rituviaObjectUrls.created.push(value);
        void blob.text().then((text) => {
          globalThis.__rituviaObjectUrls.texts[value] = text;
        });
        return value;
      };
      URL.revokeObjectURL = (value) => {
        globalThis.__rituviaObjectUrls.revoked.push(value);
        revokeObjectUrl(value);
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (payload) =>
          Array.isArray(payload?.files) &&
          payload.files.length === 1 &&
          payload.files[0]?.type === "image/svg+xml",
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (payload) => {
          globalThis.__rituviaSharePayload = {
            fileNames: (payload.files ?? []).map(({ name }) => name),
            fileTexts: await Promise.all((payload.files ?? []).map((file) => file.text())),
            text: payload.text ?? null,
            title: payload.title ?? null,
            url: payload.url ?? null,
          };
        },
      });
    },
    { journalCanary: privateJournal },
  );

  const requests = [];
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      requests.push(`${request.method()}:${url.origin}${url.pathname}`);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text() !==
        "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/me") {
      await route.fulfill({
        body: JSON.stringify({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }),
        contentType: "application/json",
        status: 401,
      });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/anonymous/session") {
      await route.fulfill({ body: "", status: 204 });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/readings/tarot") {
      assert.deepEqual(request.postDataJSON(), {
        locale: "en",
        readingType: "one_card",
        schemaVersion: "tarot-reading-create.v1",
        themeCode: "open_reflection",
      });
      await route.fulfill({
        body: JSON.stringify(reading),
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        status: 201,
      });
      return;
    }
    throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}`);
  });

  const response = await page.goto(routePath, { waitUntil: "load" });
  assert.equal(response?.status(), 200);
  assert.equal(response?.headers()["content-security-policy"], contentSecurityPolicy);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
  assert.equal(await page.locator('meta[property^="og:"]').count(), 0);
  assert.equal(await page.locator('meta[name^="twitter:"]').count(), 0);

  await page.getByRole("radio", { name: "Open reflection" }).click();
  await page.getByRole("button", { name: "Draw one card" }).click();
  await page.getByRole("button", { name: "Reveal my card" }).click();
  await page.getByRole("heading", { name: reading.presentation.cards[0].cardTitle }).waitFor();
  assert.equal(await page.locator("img.tarot-share-card").count(), 0);

  await page.getByRole("button", { name: "Preview share card" }).click();
  const preview = page.locator("img.tarot-share-card");
  await preview.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector("img.tarot-share-card");
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 1200;
  });
  assert.equal(await preview.evaluate((image) => image.naturalHeight), 630);
  const includedAlt = await preview.getAttribute("alt");
  assert.ok(includedAlt);
  assert.match(includedAlt, /Reflection theme: Open reflection\./u);
  assertNoPrivateCanary("preview alt", includedAlt);
  const includedPreviewUrl = await preview.getAttribute("src");
  assert.ok(includedPreviewUrl);
  await page.waitForFunction(
    (url) => typeof globalThis.__rituviaObjectUrls.texts[url] === "string",
    includedPreviewUrl,
  );
  const includedSvg = await page.evaluate(
    (url) => globalThis.__rituviaObjectUrls.texts[url],
    includedPreviewUrl,
  );
  assert.match(includedSvg, /Reflection theme: Open reflection/u);
  assert.ok(
    includedSvg.includes(`${expectedCanonicalLabel.host}${expectedCanonicalLabel.pathname}`),
  );
  assertNoPrivateCanary("preview SVG", includedSvg);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download privacy-safe SVG" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "rituvia-reflection-card.svg");
  const downloadPath = await download.path();
  assert.ok(downloadPath);
  const downloadSvg = await readFile(downloadPath, "utf8");
  assert.equal(downloadSvg, includedSvg);
  assertNoPrivateCanary("download SVG", downloadSvg);
  await page
    .getByText("The privacy-safe SVG was downloaded. Nothing was uploaded.", { exact: true })
    .waitFor();

  await page.getByRole("checkbox", { name: "Include my selected reflection theme" }).uncheck();
  await page.waitForFunction((previousUrl) => {
    const image = document.querySelector("img.tarot-share-card");
    return (
      image?.getAttribute("alt")?.includes("theme hidden") === true &&
      image.getAttribute("src") !== previousUrl
    );
  }, includedPreviewUrl);
  const hiddenPreviewUrl = await preview.getAttribute("src");
  assert.ok(hiddenPreviewUrl);
  await page.waitForFunction(
    (url) => typeof globalThis.__rituviaObjectUrls.texts[url] === "string",
    hiddenPreviewUrl,
  );
  const hiddenSvg = await page.evaluate(
    (url) => globalThis.__rituviaObjectUrls.texts[url],
    hiddenPreviewUrl,
  );
  assert.equal(hiddenSvg.includes("Open reflection"), false);
  assert.match(hiddenSvg, /Reflection theme hidden\./u);
  assertNoPrivateCanary("redacted preview SVG", hiddenSvg);

  await page.getByRole("button", { name: "Open device share sheet" }).click();
  await page
    .getByText("The privacy-safe card was passed to your device's share sheet.", { exact: true })
    .waitFor();
  const sharePayload = await page.evaluate(() => globalThis.__rituviaSharePayload);
  assert.deepEqual(sharePayload.fileNames, ["rituvia-reflection-card.svg"]);
  assert.deepEqual(sharePayload.fileTexts, [hiddenSvg]);
  assert.equal(sharePayload.url, expectedCanonicalUrl);
  assert.match(sharePayload.text, /Reflection theme hidden\./u);
  assertNoPrivateCanary("native share payload", JSON.stringify(sharePayload));

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    [],
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  const smallTargets = await page.locator("button, input").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const rectangle = element.getBoundingClientRect();
        return { height: rectangle.height, width: rectangle.width };
      })
      .filter(({ height, width }) => height < 44 || width < 44),
  );
  assert.deepEqual(smallTargets, []);

  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key) => key !== null)
        .map((key) => [key, localStorage.getItem(key)]),
    ),
    session: Object.fromEntries(
      Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
        .filter((key) => key !== null)
        .map((key) => [key, sessionStorage.getItem(key)]),
    ),
    urls: globalThis.__rituviaObjectUrls,
  }));
  assert.deepEqual(storage.local, { "private-journal-canary": privateJournal });
  assert.deepEqual(storage.session, { "rituvia.tarot.resume.v1.one_card": readingId });
  assert.ok(storage.urls.created.length >= 3);
  assert.ok(storage.urls.revoked.length >= 2);

  assert.equal(requests.filter((entry) => entry.endsWith("/api/v1/anonymous/session")).length, 1);
  assert.equal(requests.filter((entry) => entry.endsWith("/api/v1/me")).length, 1);
  assert.equal(requests.filter((entry) => entry.endsWith("/api/v1/readings/tarot")).length, 1);
  assert.equal(
    requests.every((entry) => entry.includes(origin)),
    true,
  );
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  await page.getByRole("button", { name: "Hide share preview" }).click();
  await page.waitForFunction(() =>
    globalThis.__rituviaObjectUrls.created.every((url) =>
      globalThis.__rituviaObjectUrls.revoked.includes(url),
    ),
  );
  await context.close();
  process.stdout.write(
    "Verified the one-card redacted SVG preview, download, native file share, metadata, canary, network, storage, accessibility, and object-URL boundaries.\n",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => artifactServer.close(resolve));
}
