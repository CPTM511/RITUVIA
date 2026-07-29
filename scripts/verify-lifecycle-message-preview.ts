import assert from "node:assert/strict";

import AxeBuilder from "@axe-core/playwright";
import {
  createRevisitReminderEmail,
  createSupportReceiptEmail,
  type LifecycleEmailMessage,
} from "../packages/i18n/src/lifecycle.js";
import { chromium } from "playwright";

const style =
  "<style>html{font-family:system-ui,sans-serif;color:#241f2a;background:#fff}body{box-sizing:border-box;margin:0 auto;max-width:40rem;padding:1.5rem;overflow-wrap:anywhere}a{display:inline-flex;min-block-size:44px;align-items:center}p{line-height:1.6}</style>";
const privacyCanary = "PRIVATE-QUESTION-INTENTION-JOURNAL-PRAYER-BIRTH-TIME-RECIPIENT-TOKEN-CANARY";
const fallbackEvents: unknown[] = [];
const messages: readonly LifecycleEmailMessage[] = Object.freeze([
  createRevisitReminderEmail({
    actionPath: "/en/revisit",
    brandName: "RITUVIA",
    canonicalOrigin: "https://rituvia.example",
    locale: "en",
    preferencePath: "/en/revisit#reminder-preferences",
    quietHours: "saved",
    scheduledLocalDate: "2026-07-28",
    supportEmail: "support@rituvia.example",
    timeZone: "Asia/Shanghai",
  }),
  createRevisitReminderEmail(
    {
      actionPath: "/en/revisit",
      brandName: "RITUVIA",
      canonicalOrigin: "https://rituvia.example",
      locale: "fr",
      preferencePath: "/en/revisit#reminder-preferences",
      quietHours: "none",
      scheduledLocalDate: "2026-07-28",
      supportEmail: "support@rituvia.example",
      timeZone: "Europe/Paris",
    },
    {
      fallbackPolicy: "preview",
      onFallback: (event) => fallbackEvents.push(event),
    },
  ),
  createSupportReceiptEmail({
    accountPath: "/en/account",
    canonicalOrigin: "https://rituvia.example",
    locale: "en",
    receivedAt: new Date("2026-07-27T12:30:00.000Z"),
    supportEmail: "support@rituvia.example",
    timeZone: "America/New_York",
  }),
]);

assert.deepEqual(fallbackEvents, [
  {
    key: "email.revisit.subject",
    requestedLocale: "fr",
    resolvedLocale: "en",
  },
]);

const browser = await chromium.launch({ headless: true });
let axeScans = 0;
let layoutFailures = 0;
let externalRequests = 0;
try {
  const context = await browser.newContext({
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { height: 780, width: 320 },
  });
  const page = await context.newPage();
  page.on("request", (request) => {
    if (!request.url().startsWith("about:")) externalRequests += 1;
  });

  for (const message of messages) {
    const htmlDocument = message.htmlBody.replace("</head>", `${style}</head>`);
    assert.equal(htmlDocument.includes(privacyCanary), false);
    assert.equal(htmlDocument.includes("<script"), false);
    assert.equal(htmlDocument.includes("<form"), false);
    assert.equal(htmlDocument.includes("<img"), false);
    await page.setContent(htmlDocument, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("lang"), message.locale);
    assert.equal(await page.locator("html").getAttribute("dir"), message.direction);
    assert.equal(await page.title(), message.subject);
    assert.equal(await page.locator("[data-email-preview]").textContent(), message.previewText);
    assert.equal(await page.locator(`a[href="${message.action.url}"]`).count(), 1);
    assert.equal(await page.locator(`a[href="${message.support.url}"]`).count(), 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) layoutFailures += 1;
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    assert.deepEqual(
      serious.map(({ id, impact }) => ({ id, impact })),
      [],
    );
    axeScans += 1;
  }

  assert.equal(
    await page.evaluate(() => {
      try {
        return localStorage.length + sessionStorage.length;
      } catch {
        return 0;
      }
    }),
    0,
  );
  await context.close();
} finally {
  await browser.close();
}

assert.equal(externalRequests, 0);
assert.equal(layoutFailures, 0);
process.stdout.write(
  `${JSON.stringify({
    axeCriticalOrSeriousViolations: 0,
    axeScans,
    externalRequests,
    fallbackEvents: fallbackEvents.length,
    layoutFailures,
    localeActivations: 0,
    previewMessages: messages.length,
    storageWrites: 0,
    viewportWidth: 320,
  })}\n`,
);
