import lifecycleRuntimeRaw from "../../../content/localization/rituvia-lifecycle-messages.en.v1.runtime.json" with { type: "json" };

import {
  canonicalizeLocale,
  canonicalizeTimeZone,
  createLocaleFormatter,
  getTextDirection,
  type TextDirection,
} from "./locale.js";
import {
  createProjectedMessageRuntime,
  parseMessageRuntimeCatalogV1,
  type MessageFallbackEvent,
  type MessageTranslationCatalogV1,
} from "./workflow.js";

export type LifecycleEmailLink = Readonly<{
  label: string;
  url: string;
}>;

export type LifecycleEmailMessage = Readonly<{
  action: LifecycleEmailLink;
  bodyText: string;
  direction: TextDirection;
  fallbackUsed: boolean;
  htmlBody: string;
  locale: string;
  previewText: string;
  requestedLocale: string;
  sourceChecksum: string;
  sourceVersion: string;
  subject: string;
  support: LifecycleEmailLink;
  templateVersion: string;
  textBody: string;
  timeZone: string;
}>;

export type RevisitReminderEmailMessage = LifecycleEmailMessage &
  Readonly<{
    preference: LifecycleEmailLink;
  }>;

export type LifecycleMessageRuntimeOptions = Readonly<{
  configuredFallbacks?: Readonly<Record<string, readonly string[]>>;
  fallbackPolicy?: "preview" | "suppress";
  onFallback?: (event: MessageFallbackEvent) => void;
  translations?: readonly MessageTranslationCatalogV1[];
}>;

const runtimeCatalog = parseMessageRuntimeCatalogV1(lifecycleRuntimeRaw);
export const revisitReminderTemplateBinding = Object.freeze({
  fallbackUsed: false as const,
  locale: "en" as const,
  sourceChecksum: runtimeCatalog.sourceChecksum,
  sourceVersion: runtimeCatalog.sourceVersion,
  templateId: "revisit-reminder" as const,
  templateVersion: "revisit-reminder.en.v1" as const,
});

const unsafeTextPattern =
  /[\u0000-\u001F\u007F\u061C\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const localDatePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

const boundedSafeText = (value: string, label: string, maximum: number): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    unsafeTextPattern.test(value)
  ) {
    throw new TypeError(`The ${label} is invalid.`);
  }
  return value;
};

const parseCanonicalOrigin = (value: string): URL => {
  const parsed = new URL(value);
  const local =
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (
    (!local && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new TypeError("The lifecycle message origin is invalid.");
  }
  return parsed;
};

const parseLocalUrl = (origin: URL, pathname: string, locale: string): string => {
  if (
    typeof pathname !== "string" ||
    pathname.length < 1 ||
    pathname.length > 500 ||
    !pathname.startsWith(`/${locale}/`) ||
    pathname.startsWith("//") ||
    unsafeTextPattern.test(pathname)
  ) {
    throw new TypeError("The lifecycle message route is invalid.");
  }
  const parsed = new URL(pathname, origin);
  if (parsed.origin !== origin.origin || parsed.username !== "" || parsed.password !== "") {
    throw new TypeError("The lifecycle message route is invalid.");
  }
  return parsed.toString();
};

const parseSupportUrl = (email: string): string => {
  const parsed = boundedSafeText(email, "support email", 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(parsed)) {
    throw new TypeError("The support email is invalid.");
  }
  return `mailto:${parsed}`;
};

const parseLocalDate = (value: string): Date => {
  if (!localDatePattern.test(value)) throw new TypeError("The local date is invalid.");
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError("The local date is invalid.");
  }
  return parsed;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderEmailDocument = (input: {
  action: LifecycleEmailLink;
  bodyText: string;
  direction: TextDirection;
  locale: string;
  preference?: LifecycleEmailLink;
  previewText: string;
  subject: string;
  support: LifecycleEmailLink;
}): string => {
  const preference =
    input.preference === undefined
      ? ""
      : `<p><a href="${escapeHtml(input.preference.url)}">${escapeHtml(input.preference.label)}</a></p>`;
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(input.locale)}" dir="${input.direction}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.subject)}</title>`,
    "</head>",
    "<body>",
    `<p data-email-preview="true">${escapeHtml(input.previewText)}</p>`,
    `<main><p>${escapeHtml(input.bodyText)}</p>`,
    `<p><a href="${escapeHtml(input.action.url)}">${escapeHtml(input.action.label)}</a></p>`,
    preference,
    `<p><a href="${escapeHtml(input.support.url)}">${escapeHtml(input.support.label)}</a></p>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
};

const runtimeFor = (
  requestedLocaleInput: string,
  options: LifecycleMessageRuntimeOptions,
): Readonly<{
  assertDeliveryLocale: () => void;
  fallbackEvents: readonly MessageFallbackEvent[];
  format: ReturnType<typeof createProjectedMessageRuntime>["format"];
  requestedLocale: string;
  resolvedLocale: () => string;
}> => {
  const requestedLocale = canonicalizeLocale(requestedLocaleInput);
  const fallbackEvents: MessageFallbackEvent[] = [];
  let resolvedLocale = requestedLocale;
  const runtime = createProjectedMessageRuntime({
    configuredFallbacks: options.configuredFallbacks ?? {},
    onFallback: (event) => {
      resolvedLocale = event.resolvedLocale;
      if (
        !fallbackEvents.some(
          (existing) =>
            existing.requestedLocale === event.requestedLocale &&
            existing.resolvedLocale === event.resolvedLocale,
        )
      ) {
        fallbackEvents.push(event);
        options.onFallback?.(event);
      }
    },
    source: runtimeCatalog,
    translations: options.translations ?? [],
  });
  return Object.freeze({
    assertDeliveryLocale: () => {
      if (fallbackEvents.length > 0 && (options.fallbackPolicy ?? "suppress") === "suppress") {
        throw new TypeError("Lifecycle delivery is suppressed for an unapproved locale fallback.");
      }
    },
    fallbackEvents,
    format: runtime.format,
    requestedLocale,
    resolvedLocale: () => resolvedLocale,
  });
};

const createBaseResult = (input: {
  action: LifecycleEmailLink;
  bodyText: string;
  direction: TextDirection;
  fallbackUsed: boolean;
  locale: string;
  preference?: LifecycleEmailLink;
  previewText: string;
  requestedLocale: string;
  subject: string;
  support: LifecycleEmailLink;
  templateVersion: string;
  textBody: string;
  timeZone: string;
}): LifecycleEmailMessage =>
  Object.freeze({
    action: input.action,
    bodyText: input.bodyText,
    direction: input.direction,
    fallbackUsed: input.fallbackUsed,
    htmlBody: renderEmailDocument(input),
    locale: input.locale,
    previewText: input.previewText,
    requestedLocale: input.requestedLocale,
    sourceChecksum: runtimeCatalog.sourceChecksum,
    sourceVersion: runtimeCatalog.sourceVersion,
    subject: input.subject,
    support: input.support,
    templateVersion: input.templateVersion,
    textBody: input.textBody,
    timeZone: input.timeZone,
  });

export const createRevisitReminderEmail = (
  input: Readonly<{
    actionPath: string;
    brandName: string;
    canonicalOrigin: string;
    locale: string;
    preferencePath: string;
    quietHours: "none" | "saved";
    scheduledLocalDate: string;
    supportEmail: string;
    timeZone: string;
  }>,
  options: LifecycleMessageRuntimeOptions = {},
): RevisitReminderEmailMessage => {
  const runtime = runtimeFor(input.locale, options);
  const brand = boundedSafeText(input.brandName, "brand name", 120);
  const timeZone = canonicalizeTimeZone(input.timeZone);
  const subject = runtime.format(runtime.requestedLocale, "email.revisit.subject", { brand });
  runtime.assertDeliveryLocale();
  const locale = runtime.resolvedLocale();
  const formatter = createLocaleFormatter({ locale, timeZone: "UTC" });
  const scheduledDate = formatter.date(parseLocalDate(input.scheduledLocalDate), {
    dateStyle: "long",
  });
  const bodyText = runtime.format(runtime.requestedLocale, "email.revisit.body", {
    quietHours: input.quietHours,
    scheduledDate,
    timeZone,
  });
  const previewText = runtime.format(runtime.requestedLocale, "email.revisit.preview");
  const origin = parseCanonicalOrigin(input.canonicalOrigin);
  const action = Object.freeze({
    label: runtime.format(runtime.requestedLocale, "email.revisit.actionLabel"),
    url: parseLocalUrl(origin, input.actionPath, locale),
  });
  const preference = Object.freeze({
    label: runtime.format(runtime.requestedLocale, "email.revisit.preferenceLabel"),
    url: parseLocalUrl(origin, input.preferencePath, locale),
  });
  const support = Object.freeze({
    label: runtime.format(runtime.requestedLocale, "email.shared.supportLabel"),
    url: parseSupportUrl(input.supportEmail),
  });
  const textBody = `${previewText}\n\n${bodyText}\n\n${action.label}: ${action.url}\n${preference.label}: ${preference.url}\n${support.label}: ${support.url}`;
  return Object.freeze({
    ...createBaseResult({
      action,
      bodyText,
      direction: getTextDirection(locale),
      fallbackUsed: runtime.fallbackEvents.length > 0,
      locale,
      preference,
      previewText,
      requestedLocale: runtime.requestedLocale,
      subject,
      support,
      templateVersion: `revisit-reminder.${locale}.v1`,
      textBody,
      timeZone,
    }),
    preference,
  });
};

export const createSupportReceiptEmail = (
  input: Readonly<{
    accountPath: string;
    canonicalOrigin: string;
    locale: string;
    receivedAt: Date;
    supportEmail: string;
    timeZone: string;
  }>,
  options: LifecycleMessageRuntimeOptions = {},
): LifecycleEmailMessage => {
  if (!(input.receivedAt instanceof Date) || Number.isNaN(input.receivedAt.getTime())) {
    throw new TypeError("The support receipt time is invalid.");
  }
  const runtime = runtimeFor(input.locale, options);
  const timeZone = canonicalizeTimeZone(input.timeZone);
  const subject = runtime.format(runtime.requestedLocale, "email.support.subject");
  runtime.assertDeliveryLocale();
  const locale = runtime.resolvedLocale();
  const formatter = createLocaleFormatter({ locale, timeZone });
  const previewText = runtime.format(runtime.requestedLocale, "email.support.preview");
  const bodyText = runtime.format(runtime.requestedLocale, "email.support.body", {
    receivedDate: formatter.date(input.receivedAt, { dateStyle: "long" }),
    receivedTime: formatter.time(input.receivedAt, { timeStyle: "short" }),
    timeZone,
  });
  const origin = parseCanonicalOrigin(input.canonicalOrigin);
  const action = Object.freeze({
    label: runtime.format(runtime.requestedLocale, "email.support.accountLabel"),
    url: parseLocalUrl(origin, input.accountPath, locale),
  });
  const support = Object.freeze({
    label: runtime.format(runtime.requestedLocale, "email.support.replyLabel"),
    url: parseSupportUrl(input.supportEmail),
  });
  const textBody = `${previewText}\n\n${bodyText}\n\n${action.label}: ${action.url}\n${support.label}: ${support.url}`;
  return createBaseResult({
    action,
    bodyText,
    direction: getTextDirection(locale),
    fallbackUsed: runtime.fallbackEvents.length > 0,
    locale,
    previewText,
    requestedLocale: runtime.requestedLocale,
    subject,
    support,
    templateVersion: `support-receipt.${locale}.v1`,
    textBody,
    timeZone,
  });
};
