import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a full-loop verification port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
const port = await findAvailablePort();
const origin = `http://${host}:${port}`;
const readingId = "11111111-1111-4111-8111-111111111111";
const newerUnselectedReadingId = "66666666-6666-4666-8666-666666666666";
const intentionId = "22222222-2222-4222-8222-222222222222";
const ritualSessionId = "33333333-3333-4333-8333-333333333333";
const journalEntryId = "44444444-4444-4444-8444-444444444444";
const revisitId = "55555555-5555-4555-8555-555555555555";
const csrfToken = "f".repeat(43);
const serverReadyTimeoutMs = process.env.CI === "true" ? 60_000 : 30_000;
const tarotIntegrityKey = Buffer.alloc(32, 81).toString("base64url");
const anonymousSessionCookieName = "__Host-rituvia-anonymous-session";
const anonymousSessionToken = "a".repeat(43);
const privateQuestion = "What can I notice before I answer the private question canary?";
const privateBlockedQuestion = "Can this medical diagnosis guarantee my future?";
const privateCrisisQuestion = "I am in immediate danger and may hurt myself.";
const privateReframedQuestion = "Will my partner definitely come back to me?";
const privateOfflineQuestion = "What can I notice in this offline moment?";
const privateUnavailableQuestion = "What can I notice while this service recovers?";
const privateRateLimitedQuestion = "What can I notice while question checks pause?";
const relationshipSuggestion =
  "What boundaries or actions are within my control in this relationship?";
const privateIntention = "I intend to pause before answering the private intention canary.";
const privateAction = "Take three quiet private-action-canary breaths.";
const privateJournal = "I noticed a calmer private-journal-canary response.";
const privateRevisitReflection =
  "I took the action and noticed the private-revisit-canary pause helped.";
const privateCanaries = [
  privateQuestion,
  privateBlockedQuestion,
  privateCrisisQuestion,
  privateReframedQuestion,
  privateOfflineQuestion,
  privateUnavailableQuestion,
  privateRateLimitedQuestion,
  privateIntention,
  privateAction,
  privateJournal,
  privateRevisitReflection,
];
const ritualCatalog = JSON.parse(
  await readFile(
    new URL("../content/traditions/ritual/rituvia-original.en.v1.json", import.meta.url),
    "utf8",
  ),
);

const reading = Object.freeze({
  createdAt: "2026-07-24T00:00:00.000Z",
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
        cardTitle: "The Lantern",
        constructivePossibility: "A small source of clarity may be enough for the next step.",
        coreThemes: Object.freeze(["clarity", "attention"]),
        invitation: "Notice what becomes visible when you narrow your attention.",
        order: 1,
        orientation: "upright",
        positionId: "perspective",
        positionTitle: "Perspective",
        reflectionQuestion: "What deserves a little more light today?",
        smallAction: "Write down one next step you can complete in ten minutes.",
        tension: "Seeking total certainty can obscure the useful detail already present.",
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

const waitForServer = async (server, readOutput) => {
  const deadline = Date.now() + serverReadyTimeoutMs;
  let lastProbe = "not-attempted";
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(
        `Full-loop browser server exited before ready: ${server.exitCode ?? server.signalCode}.`,
      );
    }
    try {
      const response = await fetch(`${origin}/en/intake`, {
        signal: AbortSignal.timeout(2_000),
      });
      lastProbe = `http-${response.status}`;
      if (response.ok) return;
    } catch (error) {
      lastProbe = error instanceof Error ? `${error.name}:${error.message}` : "unknown-error";
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const output = readOutput().replaceAll(/\s+/gu, " ").trim().slice(-1_000) || "none";
  throw new Error(
    `Full-loop browser server did not become ready: ${server.exitCode ?? server.signalCode ?? "running"}; last probe: ${lastProbe}; output: ${output}.`,
  );
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
      .map((finding) => finding.id),
    [],
  );
  return result.incomplete
    .filter((finding) => finding.id === "color-contrast")
    .flatMap((finding) => finding.nodes).length;
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

const assertTouchTargets = async (page) => {
  const failures = await page.locator("main button:visible, main a:visible").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rectangle = node.getBoundingClientRect();
        return !node.hasAttribute("disabled") && (rectangle.width < 44 || rectangle.height < 44);
      })
      .map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(failures, []);
};

const activateWithKeyboard = async (locator) => {
  await locator.click({ trial: true });
  await locator.focus();
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true);
  await locator.press("Enter");
};

const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: {
    ...process.env,
    BRAND_CANONICAL_ORIGIN: origin,
    DATABASE_URL: "postgresql://127.0.0.1:1/rituvia_full_loop",
    RITUVIA_PROTECTED_BETA_ABUSE_POLICY_VERSION: "test.full-loop-browser.v1",
    RITUVIA_PROTECTED_BETA_MUTATION_LIMIT: "120",
    RITUVIA_PROTECTED_BETA_MUTATION_WINDOW_SECONDS: "86400",
    RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: "test.full-loop-browser.v1",
    RITUVIA_QUESTION_INTAKE_RATE_LIMIT: "12",
    RITUVIA_QUESTION_INTAKE_RATE_WINDOW_SECONDS: "60",
    RITUVIA_TAROT_INTEGRITY_KEY_V1: tarotIntegrityKey,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout?.on("data", (chunk) => {
  serverOutput += String(chunk);
});
server.stderr?.on("data", (chunk) => {
  serverOutput += String(chunk);
});

let browser = null;
try {
  await waitForServer(server, () => serverOutput);
  browser = await chromium.launch({ headless: true });
  const operations = [];
  const allRequests = [];
  const unexpected = [];
  const visitedUrls = [];
  let intentionAttempts = 0;
  let intakeUnavailableAttempts = 0;
  let intentionOperationKey = null;
  let ritualCompletionAttempts = 0;
  let ritualCompletionKey = null;
  let intentionResource = null;
  let ritualResource = null;
  let journalResource = null;
  let revisitResource = null;
  const browserAudit = {
    beacons: [],
    history: [],
    metadata: [],
    storageWrites: [],
  };

  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 700, width: 320 },
  });
  await context.setExtraHTTPHeaders({
    cookie: `${anonymousSessionCookieName}=${anonymousSessionToken}`,
  });
  await context.exposeBinding("__recordRituviaBrowserAudit", (_source, type, value) => {
    if (Object.hasOwn(browserAudit, type)) browserAudit[type].push(value);
  });
  await context.addInitScript(() => {
    const audit = {
      beacons: [],
      history: [],
      metadata: [],
      storageWrites: [],
    };
    Object.defineProperty(window, "__rituviaBrowserAudit", {
      configurable: false,
      enumerable: false,
      value: audit,
      writable: false,
    });
    const record = (type, value) => {
      audit[type].push(value);
      void window.__recordRituviaBrowserAudit(type, value);
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      record("storageWrites", [String(key), String(value)]);
      return originalSetItem.call(this, key, value);
    };
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method].bind(history);
      history[method] = (...arguments_) => {
        record("history", [method, String(arguments_[2] ?? location.href)]);
        return original(...arguments_);
      };
    }
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      record("beacons", [String(url), String(data ?? "")]);
      return originalSendBeacon(url, data);
    };
    addEventListener(
      "DOMContentLoaded",
      () => {
        const captureMetadata = () => {
          record("metadata", [
            document.title,
            ...[...document.querySelectorAll("meta")].map((node) => node.outerHTML),
          ]);
        };
        captureMetadata();
        new MutationObserver(captureMetadata).observe(document.head, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      },
      { once: true },
    );
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      unexpected.push(`${route.request().method()}:${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()}:${url.pathname}`;
    const json = (status, body, headers = {}) =>
      route.fulfill({
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: { "cache-control": "private, no-store, max-age=0", ...headers },
        status,
      });

    if (key === "POST:/api/v1/intake/evaluate") {
      const body = request.postDataJSON();
      assert.equal(body.schemaVersion, "1");
      const response = {
        locale: "en",
        policyVersion: "question-intake.en.v1",
        schemaVersion: "1",
        themeCode: body.themeCode,
      };
      if (body.question === privateUnavailableQuestion) {
        intakeUnavailableAttempts += 1;
        if (intakeUnavailableAttempts === 1) {
          operations.push({ key, state: "unavailable" });
          return json(503, { code: "INTAKE_UNAVAILABLE" });
        }
      }
      if (body.question === privateRateLimitedQuestion) {
        operations.push({ key, state: "rate_limited" });
        return json(429, { code: "INTAKE_RATE_LIMITED" }, { "retry-after": "31" });
      }
      if (body.question === privateBlockedQuestion) {
        operations.push({ key, state: "blocked" });
        return json(200, {
          ...response,
          canContinue: false,
          state: "blocked",
          suggestedQuestionCode: "professional_preparation",
        });
      }
      if (body.question === privateCrisisQuestion) {
        operations.push({ key, state: "crisis" });
        return json(200, {
          ...response,
          canContinue: false,
          state: "crisis",
          suggestedQuestionCode: null,
        });
      }
      if (body.question === privateReframedQuestion) {
        operations.push({ key, state: "reframed" });
        return json(200, {
          ...response,
          canContinue: false,
          state: "reframed",
          suggestedQuestionCode: "relationship_agency",
        });
      }
      assert.ok(
        [
          privateQuestion,
          privateOfflineQuestion,
          privateUnavailableQuestion,
          relationshipSuggestion,
        ].includes(body.question),
      );
      operations.push({ key, state: "allowed" });
      return json(200, {
        ...response,
        canContinue: true,
        state: "allowed",
        suggestedQuestionCode: null,
      });
    }
    if (key === "GET:/api/v1/me") return json(200, { ageAttested: false });
    if (key === "GET:/api/v1/me/revisit-reminders") {
      return json(200, {
        accountAvailable: false,
        reminders: [],
        schemaVersion: 1,
      });
    }
    if (key === "POST:/api/v1/anonymous/session") {
      operations.push({ key });
      return route.fulfill({
        body: "",
        headers: { "cache-control": "no-store", "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    if (key === "POST:/api/v1/readings/tarot") {
      const body = request.postDataJSON();
      operations.push({
        idempotencyKey: request.headers()["idempotency-key"],
        key,
        readingType: body.readingType,
        themeCode: body.themeCode,
      });
      assert.deepEqual(Object.keys(body).sort(), [
        "locale",
        "readingType",
        "schemaVersion",
        "themeCode",
      ]);
      assert.equal(body.readingType, "one_card");
      assert.equal(body.themeCode, "open_reflection");
      assert.equal(JSON.stringify(body).includes(privateQuestion), false);
      return json(201, reading);
    }
    if (key === `GET:/api/v1/readings/${readingId}`) {
      operations.push({ key });
      return json(200, reading);
    }
    if (key === "GET:/api/v1/ritual-objects") return json(200, ritualCatalog);
    if (key === "GET:/api/v1/catalog") return json(200, { items: [], schemaVersion: 1 });
    if (key === "GET:/api/v1/entitlements") {
      return json(200, { items: [], schemaVersion: 1 });
    }
    if (key === "POST:/api/v1/intentions") {
      const body = request.postDataJSON();
      const idempotencyKey = request.headers()["idempotency-key"];
      operations.push({ idempotencyKey, key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.intentionText, privateIntention);
      assert.equal(body.smallAction, privateAction);
      assert.equal(body.readingId, readingId);
      intentionAttempts += 1;
      if (intentionOperationKey === null) intentionOperationKey = idempotencyKey;
      assert.equal(idempotencyKey, intentionOperationKey);
      if (intentionAttempts === 1) return json(503, { code: "TEMPORARILY_UNAVAILABLE" });
      intentionResource = {
        createdAt: "2026-07-24T01:00:00.000Z",
        expiresAt: "2026-08-24T01:00:00.000Z",
        id: intentionId,
        intentionCode: body.intentionCode,
        intentionText: body.intentionText,
        locale: "en",
        policyVersion: "reflection-loop.en.v1",
        privacyState: "private",
        readingId,
        reminderPreference: "none",
        revisitDate: null,
        revision: 1,
        schemaVersion: "reflection-intention.v2",
        smallAction: body.smallAction,
        status: "active",
        timeZone: null,
        updatedAt: "2026-07-24T01:00:00.000Z",
      };
      return json(201, intentionResource, { "x-csrf-token": csrfToken });
    }
    if (key === `GET:/api/v1/intentions/${intentionId}`) {
      assert.ok(intentionResource);
      return json(200, intentionResource);
    }
    if (key === "POST:/api/v1/ritual-sessions") {
      const body = request.postDataJSON();
      operations.push({
        idempotencyKey: request.headers()["idempotency-key"],
        itemCode: body.itemCode,
        key,
      });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.intentionId, intentionId);
      assert.equal(body.itemCode, "free_candle");
      ritualResource = {
        currentStepCode: "prepare",
        elapsedSeconds: 0,
        id: ritualSessionId,
        itemCode: body.itemCode,
        revision: 1,
        schemaVersion: "ritual-session.v2",
        status: "active",
      };
      return json(201, ritualResource, { "x-csrf-token": csrfToken });
    }
    if (key === `POST:/api/v1/ritual-sessions/${ritualSessionId}/complete`) {
      assert.ok(ritualResource);
      const body = request.postDataJSON();
      const idempotencyKey = request.headers()["idempotency-key"];
      operations.push({ action: body.action, idempotencyKey, key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.action, "complete");
      assert.equal(body.expectedRevision, 1);
      ritualCompletionAttempts += 1;
      if (ritualCompletionKey === null) ritualCompletionKey = idempotencyKey;
      assert.equal(idempotencyKey, ritualCompletionKey);
      if (ritualCompletionAttempts === 1) {
        ritualResource = {
          ...ritualResource,
          currentStepCode: "complete",
          revision: 2,
          status: "completed",
        };
        return route.abort("failed");
      }
      return json(200, ritualResource, { "x-csrf-token": csrfToken });
    }
    if (key === "POST:/api/v1/journal-entries") {
      const body = request.postDataJSON();
      operations.push({ idempotencyKey: request.headers()["idempotency-key"], key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.intentionId, intentionId);
      assert.equal(body.ritualSessionId, ritualSessionId);
      assert.equal(body.reflection, privateJournal);
      journalResource = {
        id: journalEntryId,
        reflection: body.reflection,
        revision: 1,
        schemaVersion: "private-journal.v2",
      };
      return json(201, journalResource, { "x-csrf-token": csrfToken });
    }
    if (key === `DELETE:/api/v1/journal-entries/${journalEntryId}`) {
      operations.push({ idempotencyKey: request.headers()["idempotency-key"], key });
      assert.ok(journalResource);
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(request.headers()["if-match"], '"revision-1"');
      journalResource = null;
      return route.fulfill({
        body: "",
        headers: { "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    if (key === "GET:/api/v1/revisits") {
      return json(200, { items: revisitResource === null ? [] : [revisitResource] });
    }
    if (key === "POST:/api/v1/revisits") {
      const body = request.postDataJSON();
      operations.push({ idempotencyKey: request.headers()["idempotency-key"], key });
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.intentionId, intentionId);
      assert.equal(body.reminderPreference, "none");
      assert.equal(body.reminderChannel, null);
      revisitResource = {
        archivedAt: null,
        completedAt: null,
        completionReflection: null,
        createdAt: "2026-07-24T02:00:00.000Z",
        expiresAt: "2026-08-24T02:00:00.000Z",
        id: revisitId,
        intentionId,
        intentionRevision: 1,
        intentionText: privateIntention,
        isDue: false,
        outcomeTags: [],
        policyVersion: "reflection-loop.en.v1",
        quietHours: null,
        reminderChannel: null,
        reminderPreference: "none",
        revision: 1,
        scheduledLocalDate: "2026-07-31",
        scheduleKind: body.scheduleKind,
        schemaVersion: "reflection-revisit.v1",
        smallAction: privateAction,
        status: "scheduled",
        timeZone: body.timeZone,
        updatedAt: "2026-07-24T02:00:00.000Z",
      };
      return json(201, revisitResource, { "x-csrf-token": csrfToken });
    }
    if (key === `POST:/api/v1/revisits/${revisitId}/complete`) {
      const body = request.postDataJSON();
      operations.push({ idempotencyKey: request.headers()["idempotency-key"], key });
      assert.ok(revisitResource);
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(body.reflection, privateRevisitReflection);
      revisitResource = {
        ...revisitResource,
        completedAt: "2026-07-24T03:00:00.000Z",
        completionReflection: body.reflection,
        outcomeTags: body.outcomeTags,
        revision: 2,
        status: "completed",
        updatedAt: "2026-07-24T03:00:00.000Z",
      };
      return json(200, revisitResource, { "x-csrf-token": csrfToken });
    }
    if (key === `DELETE:/api/v1/revisits/${revisitId}`) {
      operations.push({ idempotencyKey: request.headers()["idempotency-key"], key });
      assert.ok(revisitResource);
      assert.equal(request.headers()["x-csrf-token"], csrfToken);
      assert.match(request.headers().cookie ?? "", new RegExp(anonymousSessionCookieName, "u"));
      assert.equal(request.headers()["if-match"], '"revision-2"');
      revisitResource = null;
      return route.fulfill({
        body: "",
        headers: { "x-csrf-token": csrfToken },
        status: 204,
      });
    }
    unexpected.push(key);
    return route.abort("blockedbyclient");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const consoleErrors = [];
  const consoleMessages = [];
  const pageErrors = [];
  const failedLocalRequests = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) visitedUrls.push(frame.url());
  });
  page.on("console", (message) => {
    consoleMessages.push(`${message.type()}:${message.text()}`);
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    allRequests.push({
      body: request.postData(),
      headers: request.headers(),
      method: request.method(),
      pathname: url.pathname,
      url: request.url(),
    });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const ignoredAbort =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      (url.pathname === "/api/v1/anonymous/session" ||
        (request.method() === "DELETE" &&
          (url.pathname === `/api/v1/journal-entries/${journalEntryId}` ||
            url.pathname === `/api/v1/revisits/${revisitId}`)));
    const simulatedLostResponse =
      url.pathname === `/api/v1/ritual-sessions/${ritualSessionId}/complete` &&
      request.failure()?.errorText === "net::ERR_FAILED";
    const expectedNavigationAbort =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      ((request.method() === "GET" && url.pathname === "/api/v1/entitlements") ||
        (request.method() === "POST" && url.pathname === "/api/v1/intentions"));
    const expectedIntakeUnavailableAbort =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url.pathname === "/api/v1/intake/evaluate" &&
      request.postData()?.includes(privateUnavailableQuestion) === true;
    const expectedIntakeRateLimitedAbort =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url.pathname === "/api/v1/intake/evaluate" &&
      request.postData()?.includes(privateRateLimitedQuestion) === true;
    if (
      url.origin === origin &&
      !ignoredAbort &&
      !simulatedLostResponse &&
      !expectedNavigationAbort &&
      !expectedIntakeUnavailableAbort &&
      !expectedIntakeRateLimitedAbort
    ) {
      failedLocalRequests.push(
        `${request.method()}:${url.pathname}:${request.failure()?.errorText ?? "unknown"}`,
      );
    }
  });
  const activateIntakeRequest = async (locator) => {
    const requestFinishedPromise = page.waitForEvent("requestfinished", {
      predicate: (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/intake/evaluate",
    });
    await activateWithKeyboard(locator);
    await requestFinishedPromise;
  };

  await page.goto("/en", { timeout: 30_000, waitUntil: "load" });
  assert.equal(await page.locator('a[href="/en/tarot/one-card"]').count(), 0);
  await activateWithKeyboard(page.getByRole("link", { name: "Begin a free reading" }));
  await page.getByRole("heading", { name: "What would you like to reflect on?" }).waitFor();
  await page.getByLabel("Open reflection").check();

  await page.getByLabel("Optional question").fill(privateBlockedQuestion);
  await activateIntakeRequest(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="This question is outside symbolic reflection"]').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Continue to a private one-card reflection" }).count(),
    0,
  );
  assert.equal(await page.getByLabel("Optional question").inputValue(), "");
  await activateWithKeyboard(page.getByRole("button", { name: "Use the safer question" }));
  await page.waitForFunction(() => document.activeElement?.id === "question-intake-question");

  await page.getByLabel("Optional question").fill(privateCrisisQuestion);
  await activateIntakeRequest(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="Pause this reflection and get immediate support"]').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Continue to a private one-card reflection" }).count(),
    0,
  );
  assert.equal(await page.getByLabel("Optional question").inputValue(), "");

  await page.getByLabel("Optional question").fill(privateReframedQuestion);
  await activateIntakeRequest(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="A gentler question keeps the choice with you"]').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Continue to a private one-card reflection" }).count(),
    0,
  );
  await activateWithKeyboard(page.getByRole("button", { name: "Use the suggested question" }));
  await page.waitForFunction(() => document.activeElement?.id === "question-intake-question");
  assert.equal(await page.getByLabel("Optional question").inputValue(), relationshipSuggestion);
  await activateIntakeRequest(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="Ready for a bounded reflection"]').waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Review another question" }));
  await page.waitForFunction(() => document.activeElement?.id === "question-intake-theme-option-1");

  await page.getByLabel("Open reflection").check();
  await page.getByLabel("Optional question").fill(privateOfflineQuestion);
  const intakeRequestsBeforeOffline = operations.filter(
    ({ key }) => key === "POST:/api/v1/intake/evaluate",
  ).length;
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
  await activateWithKeyboard(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="You appear to be offline"]').waitFor();
  assert.equal(
    operations.filter(({ key }) => key === "POST:/api/v1/intake/evaluate").length,
    intakeRequestsBeforeOffline,
  );
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine);
  await activateIntakeRequest(page.getByRole("button", { name: "Check connection and try again" }));
  await page.locator('[aria-label="Ready for a bounded reflection"]').waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Review another question" }));

  await page.getByLabel("Open reflection").check();
  await page.getByLabel("Optional question").fill(privateUnavailableQuestion);
  await activateWithKeyboard(page.getByRole("button", { name: "Review my question" }));
  await page.locator('[aria-label="The question check is unavailable"]').waitFor();
  await activateIntakeRequest(page.getByRole("button", { name: "Try again" }));
  await page.locator('[aria-label="Ready for a bounded reflection"]').waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Review another question" }));

  await page.getByLabel("Open reflection").check();
  await page.getByLabel("Optional question").fill(privateRateLimitedQuestion);
  const rateLimitedResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/intake/evaluate" &&
      response.status() === 429,
  );
  await activateWithKeyboard(page.getByRole("button", { name: "Review my question" }));
  const rateLimitedResponse = await rateLimitedResponsePromise;
  assert.equal(rateLimitedResponse.headers()["retry-after"], "31");
  await page.locator('[aria-label="Question checks are temporarily limited"]').waitFor();
  assert.equal(await page.getByRole("button", { name: "Try again" }).count(), 0);
  assert.equal(await page.getByLabel("Optional question").inputValue(), privateRateLimitedQuestion);

  await page.getByLabel("Optional question").fill(privateQuestion);
  await activateIntakeRequest(page.getByRole("button", { name: "Review my question" }));
  await page.waitForTimeout(250);
  assert.equal(operations.filter(({ key }) => key === "POST:/api/v1/intake/evaluate").length, 9);
  await page.locator('[aria-label="Ready for a bounded reflection"]').waitFor();
  const axeIncomplete = [await assertAxe(page)];
  await assertLayout(page);
  await assertTouchTargets(page);
  await activateWithKeyboard(
    page.getByRole("button", { name: "Continue to a private one-card reflection" }),
  );

  await page.getByRole("heading", { name: "A single perspective for this moment" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="tarot-theme-code"][value="open_reflection"]')?.checked ===
      true,
  );
  assert.equal(await page.getByLabel("Open reflection").isChecked(), true);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rituvia.question-intake-theme.v1")),
    null,
  );
  await activateWithKeyboard(page.getByRole("button", { name: "Draw one card" }));
  await page.getByRole("heading", { name: "Your card is ready" }).waitFor();
  await activateWithKeyboard(page.getByRole("button", { name: "Reveal my card" }));
  await page.getByRole("heading", { name: "Your one-card reflection" }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.textContent?.includes("Your one-card reflection"),
    ),
    true,
  );
  axeIncomplete.push(await assertAxe(page));
  await assertLayout(page);
  await assertTouchTargets(page);
  await page.evaluate((id) => {
    sessionStorage.setItem("rituvia.tarot.resume.v1.three_card", id);
  }, newerUnselectedReadingId);
  await activateWithKeyboard(page.getByRole("link", { name: "Continue to a private intention" }));

  await page.getByRole("heading", { name: "Set an intention" }).waitFor();
  assert.equal(
    await page.evaluate(
      (id) => sessionStorage.getItem("rituvia.tarot.resume.v1.one_card") === id,
      readingId,
    ),
    true,
  );
  assert.equal(
    await page.evaluate(
      (id) => sessionStorage.getItem("rituvia.sanctuary-reading.v1") === id,
      readingId,
    ),
    true,
  );
  await activateWithKeyboard(page.getByRole("button", { name: "Peace and clarity" }));
  await page.getByLabel("Your intention").fill(privateIntention);
  await page.getByLabel("One small real-world action").fill(privateAction);
  const intentionSubmit = page.getByRole("button", { name: "Continue with this intention" });
  await activateWithKeyboard(intentionSubmit);
  await page.getByText("Your intention could not be saved.", { exact: false }).waitFor();
  await page.waitForTimeout(250);
  assert.equal(intentionAttempts, 1);
  await activateWithKeyboard(intentionSubmit);
  await page.getByText("Your intention is ready.", { exact: false }).waitFor();
  assert.equal(intentionAttempts, 2);
  assert.match(intentionOperationKey ?? "", /^[0-9a-f-]{36}$/u);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rituvia.sanctuary-reading.v1")),
    null,
  );

  const beginRitual = page.getByRole("button", { name: "Begin free ritual" }).first();
  await activateWithKeyboard(beginRitual);
  await page.getByRole("heading", { name: "Quiet candle" }).waitFor();
  await page.getByText("Accessible linear mode", { exact: true }).waitFor();
  assert.equal(await page.locator(".ritual-experience").getByRole("img").count(), 0);
  axeIncomplete.push(await assertAxe(page));
  await assertLayout(page);
  await assertTouchTargets(page);
  const completeRitual = page.getByRole("button", { name: "Complete now" });
  await activateWithKeyboard(completeRitual);
  await page.getByText("Completion could not be recorded.", { exact: false }).waitFor();
  await page.waitForTimeout(250);
  assert.equal(ritualCompletionAttempts, 1);
  await activateWithKeyboard(completeRitual);
  await page.getByRole("heading", { name: "You can leave this moment here." }).waitFor();
  assert.equal(ritualCompletionAttempts, 2);
  assert.match(ritualCompletionKey ?? "", /^[0-9a-f-]{36}$/u);

  await activateWithKeyboard(page.getByRole("button", { name: "Continue to private reflection" }));
  await page.getByLabel("Your private journal entry").fill(privateJournal);
  await activateWithKeyboard(page.getByRole("button", { name: "Save private reflection" }));
  await page.getByRole("button", { name: "Delete private reflection" }).waitFor();
  page.once("dialog", (dialog) => void dialog.accept());
  await activateWithKeyboard(page.getByRole("button", { name: "Delete private reflection" }));
  await page.getByRole("button", { name: "Save private reflection" }).waitFor();
  await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA");
  assert.equal(journalResource, null);

  await activateWithKeyboard(page.getByRole("link", { name: "Schedule a private Revisit" }));
  await page.getByRole("heading", { name: "Schedule this Revisit" }).waitFor();
  assert.equal(
    await page.evaluate(
      (id) => sessionStorage.getItem("rituvia.revisit-intention.v1") === id,
      intentionId,
    ),
    true,
  );
  await page.getByLabel("In seven days").check();
  await page.getByLabel("Time zone").fill("Asia/Shanghai");
  await activateWithKeyboard(page.getByRole("button", { name: "Schedule this Revisit" }));
  await page.getByText("Scheduled", { exact: true }).first().waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rituvia.revisit-intention.v1")),
    null,
  );

  const revisitCard = page.locator(".revisit-card");
  await activateWithKeyboard(revisitCard.getByRole("button", { name: "Complete this Revisit" }));
  await page.waitForFunction(() => document.activeElement?.id === "revisit-reflection");
  await revisitCard
    .getByLabel("What happened, and what do you understand now?")
    .fill(privateRevisitReflection);
  await revisitCard.getByLabel("I took the action").check();
  await activateWithKeyboard(revisitCard.getByRole("button", { name: "Complete this Revisit" }));
  await page.getByText(privateRevisitReflection, { exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("Completed"));
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).direction),
    "rtl",
  );
  axeIncomplete.push(await assertAxe(page));
  await assertLayout(page);
  await assertTouchTargets(page);

  page.once("dialog", (dialog) => void dialog.accept());
  await activateWithKeyboard(revisitCard.getByRole("button", { name: "Delete" }));
  await page.getByText("The private Revisit was deleted.", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.textContent?.includes("The private Revisit was deleted."),
  );
  assert.equal(revisitResource, null);
  await page.reload({ timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "No Revisit is scheduled yet." }).waitFor();
  for (const canary of privateCanaries) {
    assert.equal((await page.locator("body").innerText()).includes(canary), false);
  }

  const privacyState = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    metadata: [...document.querySelectorAll("meta")].map((node) => node.outerHTML),
    session: Object.entries(sessionStorage),
    title: document.title,
    url: location.href,
  }));
  for (const canary of privateCanaries) {
    assert.equal(JSON.stringify(privacyState).includes(canary), false);
    assert.equal(JSON.stringify(browserAudit).includes(canary), false);
    assert.equal(
      visitedUrls.some((url) => url.includes(canary)),
      false,
    );
    assert.equal(
      consoleErrors.some((message) => message.includes(canary)),
      false,
    );
    assert.equal(
      pageErrors.some((message) => message.includes(canary)),
      false,
    );
    assert.equal(
      consoleMessages.some((message) => message.includes(canary)),
      false,
    );
    assert.equal(
      allRequests.some(
        (request) =>
          request.url.includes(canary) || JSON.stringify(request.headers).includes(canary),
      ),
      false,
    );
  }
  assert.deepEqual(browserAudit.beacons, []);
  const visitedPaths = visitedUrls
    .filter((url) => url.startsWith(origin))
    .map((url) => new URL(url).pathname);
  const orderedPaths = visitedPaths.filter(
    (pathname, index) => index === 0 || visitedPaths[index - 1] !== pathname,
  );
  assert.deepEqual(orderedPaths, [
    "/en",
    "/en/intake",
    "/en/tarot/one-card",
    "/en/sanctuary",
    "/en/revisit",
  ]);
  assert.ok(visitedPaths.filter((pathname) => pathname === "/en/revisit").length >= 2);
  assert.equal(context.pages().length, 1);
  assert.equal(
    visitedUrls.some((url) => {
      const parsed = new URL(url);
      return parsed.search !== "" || parsed.hash !== "";
    }),
    false,
  );
  assert.equal(
    allRequests.some(({ pathname }) => /analytics|telemetry|collect/iu.test(pathname)),
    false,
  );
  assert.equal(
    allRequests.some(({ pathname }) => /checkout|orders|payments/iu.test(pathname)),
    false,
  );
  assert.deepEqual(unexpected, []);
  assert.deepEqual(failedLocalRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors.toSorted(), [
    "Failed to load resource: net::ERR_FAILED",
    "Failed to load resource: the server responded with a status of 429 (Too Many Requests)",
    "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        anonymousAccountCreations: 0,
        axeColorContrastIncompleteNodes: axeIncomplete,
        axeCriticalOrSeriousViolations: 0,
        axeScans: axeIncomplete.length,
        consoleOrPageErrors: 0,
        continuousPageTransitions: visitedUrls.filter((url) => url.startsWith(origin)).length,
        fullLoopStages: 6,
        intentionSameKeyRetries: intentionAttempts,
        journalCreateDeleteMutations: 2,
        mobileKeyboardRtlLayoutFailures: 0,
        paymentRequests: 0,
        privateStorageMetadataHistoryLeaks: 0,
        reducedMotionLinearRituals: 1,
        revisitScheduleCompleteDeleteMutations: 3,
        ritualSameKeyRetries: ritualCompletionAttempts,
        touchTargetFailures: 0,
        unexpectedRequests: unexpected.length,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  if (serverOutput !== "") process.stderr.write(serverOutput);
  throw error;
} finally {
  if (browser !== null) await browser.close();
  await stopServer(server);
}
