import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  authorizeTranslationForPublication,
  parseMessageRuntimeCatalogV1,
  parseMessageSourceCatalogV1,
  parseMessageTranslationCatalogV1,
  parseTranslationGlossaryV1,
} from "../src/index.js";
import {
  createRevisitReminderEmail,
  createSupportReceiptEmail,
  revisitReminderTemplateBinding,
} from "../src/lifecycle.js";

const sourceUrl = new URL(
  "../../../content/localization/rituvia-lifecycle-messages.en.v1.json",
  import.meta.url,
);
const runtimeUrl = new URL(
  "../../../content/localization/rituvia-lifecycle-messages.en.v1.runtime.json",
  import.meta.url,
);
const sourceBytes = readFileSync(sourceUrl);
const sourceChecksum = createHash("sha256").update(sourceBytes).digest("hex");
const source = parseMessageSourceCatalogV1(JSON.parse(sourceBytes.toString("utf8")) as unknown);
const runtime = parseMessageRuntimeCatalogV1(
  JSON.parse(readFileSync(runtimeUrl, "utf8")) as unknown,
);

const reminderInput = Object.freeze({
  actionPath: "/en/revisit",
  brandName: "RITUVIA",
  canonicalOrigin: "https://rituvia.example",
  locale: "en",
  preferencePath: "/en/revisit#reminder-preferences",
  quietHours: "saved" as const,
  scheduledLocalDate: "2026-07-28",
  supportEmail: "support@rituvia.example",
  timeZone: "Asia/Shanghai",
});

const syntheticMessages = Object.freeze({
  "email.revisit.actionLabel": "[test] Abrir espacio privado",
  "email.revisit.body":
    "[test] Fecha {scheduledDate}, zona {timeZone}.{quietHours, select, saved { Fuera del horario silencioso.} none {} other {}} Abrir cuando quieras.",
  "email.revisit.preferenceLabel": "[test] Desactivar este recordatorio",
  "email.revisit.preview": "[test] Tu espacio privado está disponible.",
  "email.revisit.subject": "[test] Recordatorio de {brand}",
  "email.shared.supportLabel": "[test] Contactar soporte",
  "email.support.accountLabel": "[test] Abrir cuenta",
  "email.support.body":
    "[test] Solicitud recibida el {receivedDate} a las {receivedTime} ({timeZone}). Comparte solo lo necesario.",
  "email.support.preview": "[test] Solicitud recibida.",
  "email.support.replyLabel": "[test] Escribir a soporte",
  "email.support.subject": "[test] Recibimos tu solicitud",
});

const authorizedSyntheticTranslation = () => {
  const translation = parseMessageTranslationCatalogV1({
    catalogId: source.catalogId,
    locale: "es-419",
    messages: syntheticMessages,
    method: "human",
    reviewer: {
      id: "test.qualified.es-419",
      reviewedDate: "2026-07-27",
      role: "qualified",
    },
    schemaVersion: "rituvia-message-translation.v1",
    sourceChecksum,
    sourceLocale: source.locale,
    sourceVersion: source.version,
    status: "approved",
    version: "1.0.0",
  });
  return authorizeTranslationForPublication({
    glossary: parseTranslationGlossaryV1({
      approvalReference: "test-only",
      entries: [
        {
          mode: "do_not_translate",
          sourceTerm: "RITUVIA",
          targetTerm: "RITUVIA",
        },
      ],
      locale: "es-419",
      reviewerId: "test.qualified.es-419",
      schemaVersion: "rituvia-translation-glossary.v1",
      sourceCatalogId: source.catalogId,
      sourceVersion: source.version,
      status: "approved",
      version: "1.0.0",
    }),
    source,
    sourceChecksum,
    translation,
  });
};

describe("lifecycle message catalogs", () => {
  it("binds the server runtime projection to the governed lifecycle source", () => {
    expect(source).toMatchObject({
      audience: "account",
      catalogId: "rituvia.lifecycle.messages",
      contentType: "lifecycle_messages",
      locale: "en",
      version: "1.0.0",
    });
    expect(runtime).toEqual({
      catalogId: source.catalogId,
      contentType: source.contentType,
      locale: source.locale,
      messages: Object.fromEntries(
        Object.entries(source.messages).map(([key, message]) => [key, message.message]),
      ),
      schemaVersion: "rituvia-message-runtime.v1",
      sourceChecksum,
      sourceVersion: source.version,
    });
    expect(revisitReminderTemplateBinding).toEqual({
      fallbackUsed: false,
      locale: "en",
      sourceChecksum,
      sourceVersion: "1.0.0",
      templateId: "revisit-reminder",
      templateVersion: "revisit-reminder.en.v1",
    });
  });

  it("renders one locale-aware privacy-safe reminder with preference and support links", () => {
    const message = createRevisitReminderEmail(reminderInput);

    expect(message).toMatchObject({
      direction: "ltr",
      fallbackUsed: false,
      locale: "en",
      requestedLocale: "en",
      subject: "A quiet reminder from RITUVIA",
      templateVersion: "revisit-reminder.en.v1",
      timeZone: "Asia/Shanghai",
    });
    expect(message.bodyText).toContain("July 28, 2026");
    expect(message.bodyText).toContain("outside your saved quiet hours");
    expect(message.preference).toEqual({
      label: "Turn off this reminder",
      url: "https://rituvia.example/en/revisit#reminder-preferences",
    });
    expect(message.support.url).toBe("mailto:support@rituvia.example");
    expect(message.htmlBody).toContain('lang="en" dir="ltr"');
    expect(message.htmlBody).toContain(message.preference.url);
    expect(message.textBody).toContain(message.preference.url);
    expect(message.htmlBody).not.toMatch(/<script|<form|<img|tracking/iu);
    expect(`${message.subject} ${message.previewText}`).not.toMatch(
      /journal|prayer|birth|relationship|health|question|intention/iu,
    );
  });

  it("suppresses an unapproved delivery locale but permits an explicit fallback preview", () => {
    const onFallback = vi.fn();
    expect(() =>
      createRevisitReminderEmail(
        {
          ...reminderInput,
          actionPath: "/en/revisit",
          locale: "fr",
          preferencePath: "/en/revisit#reminder-preferences",
        },
        { onFallback },
      ),
    ).toThrow(/suppressed/u);
    expect(onFallback).toHaveBeenCalledOnce();

    const preview = createRevisitReminderEmail(
      {
        ...reminderInput,
        actionPath: "/en/revisit",
        locale: "fr",
        preferencePath: "/en/revisit#reminder-preferences",
      },
      { fallbackPolicy: "preview", onFallback },
    );
    expect(preview).toMatchObject({
      fallbackUsed: true,
      locale: "en",
      requestedLocale: "fr",
      templateVersion: "revisit-reminder.en.v1",
    });
    expect(onFallback).toHaveBeenCalledTimes(2);
  });

  it("uses only an authorized exact-source translation as one atomic template", () => {
    const translation = authorizedSyntheticTranslation();
    const message = createRevisitReminderEmail(
      {
        ...reminderInput,
        actionPath: "/es-419/revisit",
        locale: "es-419",
        preferencePath: "/es-419/revisit#reminder-preferences",
      },
      { translations: [translation] },
    );

    expect(message).toMatchObject({
      fallbackUsed: false,
      locale: "es-419",
      requestedLocale: "es-419",
      templateVersion: "revisit-reminder.es-419.v1",
    });
    expect(message.subject).toBe("[test] Recordatorio de RITUVIA");
    expect(message.bodyText).toMatch(/\[test\].*28 de julio de 2026/iu);
    expect(message.action.label).toMatch(/^\[test\]/u);
    expect(message.preference.label).toMatch(/^\[test\]/u);
    expect(message.support.label).toMatch(/^\[test\]/u);
  });

  it("renders a support receipt without accepting private request text", () => {
    const message = createSupportReceiptEmail({
      accountPath: "/en/account",
      canonicalOrigin: "https://rituvia.example",
      locale: "en",
      receivedAt: new Date("2026-07-27T12:30:00.000Z"),
      supportEmail: "support@rituvia.example",
      timeZone: "America/New_York",
    });

    expect(message.bodyText).toContain("July 27, 2026");
    expect(message.bodyText).toContain("8:30 AM");
    expect(message.bodyText).toContain("do not send journal, prayer, birth-time");
    expect(message.subject).toBe("We received your support request");
    expect(message.previewText).toBe("Your support request was received.");
    expect(message.action.url).toBe("https://rituvia.example/en/account");
  });

  it.each([
    { brandName: "RITUVIA\r\nBcc: attacker@example.test" },
    { brandName: "RITUVIA\u200F" },
    { brandName: "RITUVIA\u202E" },
    { canonicalOrigin: "https://user:pass@rituvia.example" },
    { canonicalOrigin: "http://rituvia.example" },
    { actionPath: "https://attacker.invalid/en/revisit" },
    { preferencePath: "//attacker.invalid/en/revisit" },
    { supportEmail: "support@example.test\r\nBcc: attacker@example.test" },
    { scheduledLocalDate: "2026-02-30" },
    { timeZone: "Not/AZone" },
  ])("rejects unsafe header, link, date, or time-zone input %j", (override) => {
    expect(() => createRevisitReminderEmail({ ...reminderInput, ...override })).toThrow(TypeError);
  });
});
