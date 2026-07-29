import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  authorizeTranslationForPublication,
  canonicalizeLocale,
  canonicalizeTimeZone,
  createLocaleFormatter,
  createMessageRuntime,
  formatIcuMessage,
  getTextDirection,
  inspectIcuMessage,
  parseMessageSourceCatalogV1,
  parseMessageTranslationCatalogV1,
  parseTranslationGlossaryV1,
  resolveLocaleFallbackChain,
  validateTranslationForPublication,
  type MessageSourceCatalogV1,
  type MessageTranslationCatalogV1,
  type TranslationGlossaryV1,
} from "../src/index.js";
import {
  pseudoLocalizeIcuMessage,
  pseudoLocalizeText,
  testPseudolocales,
} from "../src/pseudolocale.js";

const sourceUrl = new URL(
  "../../../content/localization/rituvia-core-ui.en.v1.json",
  import.meta.url,
);
const glossaryUrl = new URL(
  "../../../content/localization/rituvia-core-glossary.en.v1.json",
  import.meta.url,
);
const runtimeUrl = new URL(
  "../../../content/localization/rituvia-core-ui.en.v1.runtime.json",
  import.meta.url,
);
const lifecycleSourceUrl = new URL(
  "../../../content/localization/rituvia-lifecycle-messages.en.v1.json",
  import.meta.url,
);
const lifecycleRuntimeUrl = new URL(
  "../../../content/localization/rituvia-lifecycle-messages.en.v1.runtime.json",
  import.meta.url,
);
const manifestUrl = new URL("../../../content/localization/manifest.v1.json", import.meta.url);

const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, "utf8"));
const clone = <Value>(value: Value): Value => structuredClone(value);
const sha256 = (url: URL): string => createHash("sha256").update(readFileSync(url)).digest("hex");

const sourceRaw = readJson(sourceUrl);
const source = parseMessageSourceCatalogV1(sourceRaw);
const sourceChecksum = sha256(sourceUrl);

const createGlossary = (override: Readonly<Record<string, unknown>> = {}): TranslationGlossaryV1 =>
  parseTranslationGlossaryV1({
    approvalReference: "test-qualified-review",
    entries: [
      {
        mode: "do_not_translate",
        sourceTerm: "RITUVIA",
        targetTerm: "RITUVIA",
      },
      {
        mode: "translate",
        sourceTerm: "Position",
        targetTerm: "Posición",
      },
    ],
    locale: "es-419",
    reviewerId: "qualified.es-419",
    schemaVersion: "rituvia-translation-glossary.v1",
    sourceCatalogId: source.catalogId,
    sourceVersion: source.version,
    status: "approved",
    version: "1.0.0",
    ...override,
  });

const validMessages = Object.freeze({
  "account.savedReflections":
    "{count, plural, =0 {No hay reflexiones guardadas} one {# reflexión guardada} other {# reflexiones guardadas}}",
  "practice.availableMode":
    "{mode, select, free {Práctica gratuita disponible} owned {Presentación adquirida disponible} other {Disponibilidad de práctica desconocida}}",
  "ritual.stepProgress": "Paso {current, number} de {total, number}",
  "shell.navigation.homeLabel": "Inicio de {brand}",
  "tarot.report.targetPosition": "Posición: {position}",
  "tarot.retryAfter":
    "{value, plural, one {# {unit, select, second {segundo} minute {minuto} hour {hora} other {unidad}}} other {# {unit, select, second {segundos} minute {minutos} hour {horas} other {unidades}}}}",
  "tarot.share.altText":
    "{cardTitle}, {orientation}. {themeVisibility, select, included {Tema de reflexión: {theme}.} hidden {Tema de reflexión oculto.} other {Tema de reflexión oculto.}} Tarjeta de {brand} segura para compartir. Reflexión simbólica, no una predicción.",
});

const createTranslation = (
  override: Readonly<Record<string, unknown>> = {},
): MessageTranslationCatalogV1 =>
  parseMessageTranslationCatalogV1({
    catalogId: source.catalogId,
    locale: "es-419",
    messages: validMessages,
    method: "machine_then_human",
    reviewer: {
      id: "qualified.es-419",
      reviewedDate: "2026-07-27",
      role: "qualified",
    },
    schemaVersion: "rituvia-message-translation.v1",
    sourceChecksum,
    sourceLocale: source.locale,
    sourceVersion: source.version,
    status: "approved",
    version: "1.0.0",
    ...override,
  });

const findingCodes = (
  translation: MessageTranslationCatalogV1,
  glossary = createGlossary(),
  forbiddenTerms: readonly string[] = [],
): readonly string[] =>
  validateTranslationForPublication({
    forbiddenTerms,
    glossary,
    source,
    sourceChecksum,
    translation,
  }).map(({ code, key }) => (key === undefined ? code : `${code}:${key}`));

describe("localization source records", () => {
  it("parses the approved source and glossary and verifies their manifest checksums", () => {
    const manifest = readJson(manifestUrl) as {
      files: readonly Readonly<{ path: string; sha256: string }>[];
      schemaVersion: string;
    };
    const approvedGlossary = parseTranslationGlossaryV1(readJson(glossaryUrl));
    const runtime = readJson(runtimeUrl) as {
      catalogId: string;
      contentType: string;
      locale: string;
      messages: Readonly<Record<string, string>>;
      schemaVersion: string;
      sourceChecksum: string;
      sourceVersion: string;
    };

    expect(source.locale).toBe("en");
    expect(Object.keys(source.messages)).toEqual([
      "account.savedReflections",
      "practice.availableMode",
      "ritual.stepProgress",
      "shell.navigation.homeLabel",
      "tarot.report.targetPosition",
      "tarot.retryAfter",
      "tarot.share.altText",
    ]);
    expect(approvedGlossary.sourceCatalogId).toBe(source.catalogId);
    expect(approvedGlossary.sourceVersion).toBe(source.version);
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
    expect(manifest).toEqual({
      files: [
        {
          path: "content/localization/rituvia-core-ui.en.v1.json",
          sha256: sourceChecksum,
        },
        {
          path: "content/localization/rituvia-core-ui.en.v1.runtime.json",
          sha256: sha256(runtimeUrl),
        },
        {
          path: "content/localization/rituvia-core-glossary.en.v1.json",
          sha256: sha256(glossaryUrl),
        },
        {
          path: "content/localization/rituvia-lifecycle-messages.en.v1.json",
          sha256: sha256(lifecycleSourceUrl),
        },
        {
          path: "content/localization/rituvia-lifecycle-messages.en.v1.runtime.json",
          sha256: sha256(lifecycleRuntimeUrl),
        },
      ],
      schemaVersion: "rituvia-localization-manifest.v1",
    });
  });

  it("fails closed on source metadata drift", () => {
    const wrongRights = clone(sourceRaw) as Record<string, unknown>;
    wrongRights.rights = {
      allowedUses: ["public_display", "translation"],
      evidenceReference: "D-023",
      owner: "RITUVIA",
      status: "owned",
      territory: "worldwide",
    };
    const wrongPlaceholders = clone(sourceRaw) as {
      messages: Record<string, Record<string, unknown>>;
    };
    wrongPlaceholders.messages["ritual.stepProgress"]!.placeholders = ["current"];

    expect(() => parseMessageSourceCatalogV1(wrongRights)).toThrow(TypeError);
    expect(() => parseMessageSourceCatalogV1(wrongPlaceholders)).toThrow(TypeError);
    expect(() =>
      parseMessageSourceCatalogV1({ ...(sourceRaw as object), unexpected: true }),
    ).toThrow(TypeError);
  });
});

describe("locale and ICU primitives", () => {
  it("canonicalizes strict BCP 47 locales, time zones, and bounded explicit fallbacks", () => {
    expect(canonicalizeLocale("zh-hans")).toBe("zh-Hans");
    expect(canonicalizeLocale("es-419")).toBe("es-419");
    expect(canonicalizeTimeZone("Asia/Shanghai")).toBe("Asia/Shanghai");
    expect(canonicalizeTimeZone("UTC")).toBe("UTC");
    expect(resolveLocaleFallbackChain("es-MX", "en", { "es-MX": ["es-419", "en"] })).toEqual([
      "es-MX",
      "es-419",
      "en",
    ]);
    expect(() => canonicalizeLocale("pt_BR")).toThrow(TypeError);
    expect(() => canonicalizeLocale("invalid_locale")).toThrow(TypeError);
    expect(() => canonicalizeTimeZone("Mars/Olympus")).toThrow(TypeError);
    expect(() =>
      resolveLocaleFallbackChain("es-MX", "en", {
        "es-MX": ["es-419", "es", "pt-BR", "pt", "fr", "de", "it", "ja"],
      }),
    ).toThrow(TypeError);
  });

  it("resolves text direction from canonical locale metadata", () => {
    for (const locale of [
      "ar-XB",
      "ar-EG",
      "ckb",
      "dv",
      "fa",
      "he",
      "nqo",
      "ps",
      "sd",
      "ug",
      "ur",
      "yi",
    ]) {
      expect(getTextDirection(locale)).toBe("rtl");
    }
    for (const locale of ["en-XA", "de", "hi", "ja", "ku", "zh-Hans"]) {
      expect(getTextDirection(locale)).toBe("ltr");
    }
    expect(() => getTextDirection("invalid_locale")).toThrow(TypeError);
  });

  it("formats nested ICU plural/select messages and enforces exact arguments", () => {
    const retryMessage = source.messages["tarot.retryAfter"]!.message;

    expect(inspectIcuMessage(retryMessage)).toEqual({
      arguments: ["unit", "value"],
      tags: [],
    });
    expect(formatIcuMessage("en", retryMessage, { unit: "minute", value: 1 })).toBe("1 minute");
    expect(formatIcuMessage("en", retryMessage, { unit: "minute", value: 2 })).toBe("2 minutes");
    expect(() => formatIcuMessage("en", retryMessage, { value: 2 })).toThrow(TypeError);
    expect(() =>
      formatIcuMessage("en", retryMessage, { extra: true, unit: "minute", value: 2 }),
    ).toThrow(TypeError);
    expect(() => inspectIcuMessage("{count, plural, one {One}}")).toThrow();
  });

  it("formats the redacted Tarot share description with explicit theme visibility", () => {
    const altTextMessage = source.messages["tarot.share.altText"]!.message;
    const commonArguments = {
      brand: "RITUVIA",
      cardTitle: "The Hermit",
      orientation: "Upright",
      theme: "Open reflection",
    };

    expect(inspectIcuMessage(altTextMessage)).toEqual({
      arguments: ["brand", "cardTitle", "orientation", "theme", "themeVisibility"],
      tags: [],
    });
    expect(
      formatIcuMessage("en", altTextMessage, {
        ...commonArguments,
        themeVisibility: "included",
      }),
    ).toBe(
      "The Hermit, Upright. Reflection theme: Open reflection. Privacy-safe RITUVIA share card. Symbolic reflection, not a prediction.",
    );
    expect(
      formatIcuMessage("en", altTextMessage, {
        ...commonArguments,
        themeVisibility: "hidden",
      }),
    ).toBe(
      "The Hermit, Upright. Reflection theme hidden. Privacy-safe RITUVIA share card. Symbolic reflection, not a prediction.",
    );
  });

  it("formats user-visible values with explicit locale, currency, and time zone", () => {
    const formatter = createLocaleFormatter({ locale: "en-US", timeZone: "UTC" });
    const instant = new Date("2026-01-02T03:04:00.000Z");

    expect(formatter.number(1234.5)).toBe("1,234.5");
    expect(formatter.currency(1234.5, "USD")).toBe("$1,234.50");
    expect(formatter.percent(0.25)).toBe("25%");
    expect(formatter.unit(2, "kilometer")).toBe("2 km");
    expect(formatter.date(instant)).toBe("Jan 2, 2026");
    expect(formatter.date(instant, { day: "2-digit", month: "2-digit", year: "numeric" })).toBe(
      "01/02/2026",
    );
    expect(formatter.time(instant, { hour: "2-digit", hour12: false, minute: "2-digit" })).toBe(
      "03:04",
    );
    expect(formatter.relativeTime(1, "day", { numeric: "auto" })).toBe("tomorrow");
    expect(formatter.list(["A", "B", "C"])).toBe("A, B, and C");
    expect(formatter.displayName("US", "region")).toBe("United States");
    expect(() => formatter.currency(1, "usd")).toThrow(TypeError);
  });

  it("keeps representative CJK and Hindi display formats separate from canonical ISO input", () => {
    const instant = new Date("2026-01-02T03:04:00.000Z");
    const scenarios = [
      {
        date: "2026年1月2日",
        locale: "zh-Hans",
        number: "1,234.5",
        timeZone: "Asia/Shanghai",
      },
      { date: "2026/01/02", locale: "ja-JP", number: "1,234.5", timeZone: "Asia/Tokyo" },
      { date: "2026. 1. 2.", locale: "ko-KR", number: "1,234.5", timeZone: "Asia/Seoul" },
      { date: "2 जन॰ 2026", locale: "hi-IN", number: "1,234.5", timeZone: "Asia/Kolkata" },
    ] as const;

    for (const scenario of scenarios) {
      const formatter = createLocaleFormatter(scenario);
      expect(formatter.date(instant)).toBe(scenario.date);
      expect(formatter.number(1234.5)).toBe(scenario.number);
    }
    expect(instant.toISOString().slice(0, 10)).toBe("2026-01-02");
  });
});

describe("test-only pseudolocalization", () => {
  it("expands LTR and RTL text without altering protected technical values", () => {
    const sourceText = "RITUVIA opens https://rituvia.example/help for care@example.com";

    expect(testPseudolocales).toEqual(["en-XA", "ar-XB"]);
    for (const locale of testPseudolocales) {
      const localized = pseudoLocalizeText(sourceText, locale);
      expect(localized).toContain("RITUVIA");
      expect(localized).toContain("https://rituvia.example/help");
      expect(localized).toContain("care@example.com");
      expect([...localized].length).toBeGreaterThanOrEqual(Math.ceil([...sourceText].length * 1.4));
      expect(localized).not.toMatch(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u);
    }
    expect(pseudoLocalizeText("Home", "en-XA")).toBe("［Ĥöṁë ·］");
    expect(pseudoLocalizeText("Home", "ar-XB")).toBe("اختبار Ĥöṁë · موسّع");
    expect(pseudoLocalizeText(" 123 ", "ar-XB")).toBe(" 123 ");
  });

  it("preserves nested ICU arguments, selectors, tags, and formatting syntax", () => {
    const message =
      "<strong>{count, plural, =0 {No readings} one {# reading for {name}} other {# readings for {name}}}</strong>";

    for (const locale of testPseudolocales) {
      const localized = pseudoLocalizeIcuMessage(message, locale);
      expect(inspectIcuMessage(localized)).toEqual({
        arguments: ["count", "name"],
        tags: ["strong"],
      });
      expect(localized).toContain("{name}");
      expect(localized).toContain("<strong>");
      expect(localized).toContain("</strong>");
      expect(localized).not.toMatch(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u);
    }
  });

  it("fails closed for non-test locales and bidi controls", () => {
    expect(() => pseudoLocalizeText("Home", "ar")).toThrow(TypeError);
    expect(() => pseudoLocalizeIcuMessage("Hello", "en")).toThrow(TypeError);
    expect(() => pseudoLocalizeText("unsafe\u202evalue", "ar-XB")).toThrow(TypeError);
  });
});

describe("translation publication workflow", () => {
  it("authorizes a complete reviewed catalog and formats it at runtime", () => {
    const glossary = createGlossary();
    const translation = createTranslation();

    expect(findingCodes(translation, glossary)).toEqual([]);
    expect(
      authorizeTranslationForPublication({
        glossary,
        source,
        sourceChecksum,
        translation,
      }),
    ).toBe(translation);

    const runtime = createMessageRuntime({
      configuredFallbacks: {},
      source,
      translations: [translation],
    });
    expect(runtime.format("es-419", "ritual.stepProgress", { current: 2, total: 3 })).toBe(
      "Paso 2 de 3",
    );
    expect(runtime.format("es-419", "tarot.retryAfter", { unit: "minute", value: 2 })).toBe(
      "2 minutos",
    );
  });

  it("does not admit a merely approved or draft catalog into runtime", () => {
    const approvedButUnauthorized = createTranslation();
    const draft = createTranslation({
      method: "machine",
      reviewer: null,
      status: "machine_draft",
    });
    const runtime = createMessageRuntime({
      configuredFallbacks: {},
      source,
      translations: [approvedButUnauthorized, draft],
    });

    expect(runtime.format("es-419", "ritual.stepProgress", { current: 2, total: 3 })).toBe(
      "Step 2 of 3",
    );
  });

  it("uses only explicit fallbacks and emits observable fallback events", () => {
    const events: unknown[] = [];
    const runtime = createMessageRuntime({
      configuredFallbacks: { fr: ["es-419"] },
      onFallback: (event) => events.push(event),
      source,
      translations: [],
    });

    expect(runtime.format("fr", "shell.navigation.homeLabel", { brand: "RITUVIA" })).toBe(
      "RITUVIA home",
    );
    expect(events).toEqual([
      {
        key: "shell.navigation.homeLabel",
        requestedLocale: "fr",
        resolvedLocale: "en",
      },
    ]);
    expect(() => runtime.format("fr", "missing.message")).toThrow(TypeError);
  });

  it.each([
    ["source-binding", { sourceChecksum: "0".repeat(64) }, undefined, undefined, "source-binding"],
    [
      "status and review",
      { method: "machine", reviewer: null, status: "machine_draft" },
      undefined,
      undefined,
      "status",
    ],
    [
      "high-risk qualified review",
      {
        reviewer: {
          id: "general-reviewer",
          reviewedDate: "2026-07-27",
          role: "reviewer",
        },
      },
      undefined,
      undefined,
      "review:practice.availableMode",
    ],
    ["glossary binding", {}, { sourceVersion: "2.0.0" }, undefined, "glossary"],
    ["forbidden term", {}, undefined, ["gratuita"], "forbidden-term:practice.availableMode"],
  ])(
    "rejects %s failures",
    (_label, translationOverride, glossaryOverride, forbiddenTerms, expectedFinding) => {
      const findings = findingCodes(
        createTranslation(translationOverride),
        createGlossary(glossaryOverride),
        forbiddenTerms,
      );
      expect(findings).toContain(expectedFinding);
    },
  );

  it.each([
    [
      "missing key",
      (messages: Record<string, string>) => {
        const missing = { ...messages };
        delete missing["account.savedReflections"];
        return missing;
      },
      "missing-key:account.savedReflections",
    ],
    [
      "unexpected key",
      (messages: Record<string, string>) => ({ ...messages, "unexpected.message": "Inesperado" }),
      "unexpected-key:unexpected.message",
    ],
    [
      "placeholder mismatch",
      (messages: Record<string, string>) => ({
        ...messages,
        "ritual.stepProgress": "Paso {current, number}",
      }),
      "placeholder:ritual.stepProgress",
    ],
    [
      "invalid ICU",
      (messages: Record<string, string>) => ({
        ...messages,
        "ritual.stepProgress": "{current, plural, one {Paso}}",
      }),
      "invalid-icu:ritual.stepProgress",
    ],
    [
      "unexpected markup",
      (messages: Record<string, string>) => ({
        ...messages,
        "shell.navigation.homeLabel": "<strong>Inicio de {brand}</strong>",
      }),
      "markup:shell.navigation.homeLabel",
    ],
    [
      "unexpected link",
      (messages: Record<string, string>) => ({
        ...messages,
        "shell.navigation.homeLabel": "Inicio de {brand} https://example.com",
      }),
      "links:shell.navigation.homeLabel",
    ],
    [
      "excessive expansion",
      (messages: Record<string, string>) => ({
        ...messages,
        "shell.navigation.homeLabel": `${"Muy ".repeat(30)}{brand}`,
      }),
      "length:shell.navigation.homeLabel",
    ],
    [
      "identical source",
      (messages: Record<string, string>) => ({
        ...messages,
        "shell.navigation.homeLabel": source.messages["shell.navigation.homeLabel"]!.message,
      }),
      "identical-source:shell.navigation.homeLabel",
    ],
    [
      "missing glossary target",
      (messages: Record<string, string>) => ({
        ...messages,
        "tarot.report.targetPosition": "Lugar: {position}",
      }),
      "glossary:tarot.report.targetPosition",
    ],
  ])("rejects %s message drift", (_label, mutate, expectedFinding) => {
    const messages = mutate({ ...validMessages });
    const findings = findingCodes(createTranslation({ messages }));
    expect(findings).toContain(expectedFinding);
  });

  it("refuses publication when any finding remains", () => {
    const translation = createTranslation({
      messages: {
        ...validMessages,
        "ritual.stepProgress": "Paso {current, number}",
      },
    });

    expect(() =>
      authorizeTranslationForPublication({
        glossary: createGlossary(),
        source,
        sourceChecksum,
        translation,
      }),
    ).toThrowError("The translation catalog is not eligible for publication.");
  });
});

describe("translation parser boundaries", () => {
  it("rejects invalid schemas, unsafe locales, and unreviewed glossary records", () => {
    expect(() =>
      parseMessageTranslationCatalogV1({
        ...(createTranslation() as object),
        locale: "es_419",
      }),
    ).toThrow(TypeError);
    expect(() =>
      parseTranslationGlossaryV1({
        ...(createGlossary() as object),
        status: "draft",
      }),
    ).toThrow(TypeError);
    expect(() =>
      parseTranslationGlossaryV1({
        ...(createGlossary() as object),
        entries: [
          {
            mode: "do_not_translate",
            sourceTerm: "RITUVIA",
            targetTerm: "Rituvia",
          },
        ],
      }),
    ).toThrow(TypeError);
  });
});

const _sourceTypeCheck: MessageSourceCatalogV1 = source;
void _sourceTypeCheck;
