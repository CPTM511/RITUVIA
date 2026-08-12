import { canonicalizeLocale, resolveLocaleFallbackChain } from "./locale.js";
import { formatIcuMessage, inspectIcuMessage, type IcuMessageValues } from "./messages.js";

type UnknownRecord = Record<string, unknown>;

export type TranslationRisk = "legal" | "low" | "payment" | "product" | "safety" | "spiritual";
export type TranslationStatus =
  "approved" | "human_review" | "machine_draft" | "stale" | "withdrawn";

export type SourceMessageV1 = Readonly<{
  allowedIdentical: boolean;
  allowedLinks: readonly string[];
  allowedTags: readonly string[];
  description: string;
  maxLength: number;
  message: string;
  placeholders: readonly string[];
  risk: TranslationRisk;
}>;

export type MessageSourceCatalogV1 = Readonly<{
  audience: "account" | "all";
  catalogId: string;
  contentType: "lifecycle_messages" | "ui_messages";
  editorial: Readonly<{
    approvalReference: string;
    authorId: string;
    changeReason: string;
    effectiveDate: string;
    reviewDueDate: string;
    reviewedDate: string;
    reviewerId: string;
    status: "source_ready";
    supersedes: null;
  }>;
  locale: string;
  messages: Readonly<Record<string, SourceMessageV1>>;
  rights: Readonly<{
    allowedUses: readonly ["public_display", "commercial_use", "translation"];
    evidenceReference: string;
    owner: string;
    status: "owned";
    territory: "worldwide";
  }>;
  schemaVersion: "rituvia-message-source.v1";
  version: string;
}>;

export type MessageTranslationCatalogV1 = Readonly<{
  catalogId: string;
  locale: string;
  messages: Readonly<Record<string, string>>;
  method: "human" | "machine" | "machine_then_human";
  reviewer: Readonly<{
    id: string;
    reviewedDate: string;
    role: "owner" | "qualified" | "reviewer";
  }> | null;
  schemaVersion: "rituvia-message-translation.v1";
  sourceChecksum: string;
  sourceLocale: string;
  sourceVersion: string;
  status: TranslationStatus;
  version: string;
}>;

export type MessageRuntimeCatalogV1 = Readonly<{
  catalogId: string;
  contentType: "lifecycle_messages" | "ui_messages";
  locale: string;
  messages: Readonly<Record<string, string>>;
  schemaVersion: "rituvia-message-runtime.v1";
  sourceChecksum: string;
  sourceVersion: string;
}>;

export type TranslationGlossaryV1 = Readonly<{
  approvalReference: string;
  entries: readonly Readonly<{
    mode: "do_not_translate" | "translate";
    sourceTerm: string;
    targetTerm: string;
  }>[];
  locale: string;
  reviewerId: string;
  schemaVersion: "rituvia-translation-glossary.v1";
  sourceCatalogId: string;
  sourceVersion: string;
  status: "approved";
  version: string;
}>;

export type TranslationFinding = Readonly<{
  code:
    | "forbidden-term"
    | "glossary"
    | "identical-source"
    | "invalid-icu"
    | "length"
    | "links"
    | "markup"
    | "missing-key"
    | "placeholder"
    | "review"
    | "source-binding"
    | "status"
    | "unexpected-key";
  key?: string;
}>;

export type MessageFallbackEvent = Readonly<{
  key: string;
  requestedLocale: string;
  resolvedLocale: string;
}>;

const keyPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/u;
const versionPattern = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const checksumPattern = /^[0-9a-f]{64}$/u;
const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const linkPattern = /https:\/\/[^\s<>"')\]]+/gu;
const forbiddenControlPattern =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/u;

const record = (value: unknown): UnknownRecord => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The translation record must be an object.");
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected.at(index))
  ) {
    throw new TypeError("The translation record has an invalid field inventory.");
  }
};

const text = (value: unknown, maximum = 1_000): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    forbiddenControlPattern.test(value)
  ) {
    throw new TypeError("The translation record contains invalid text.");
  }
  return value;
};

const stringList = (value: unknown, maximum = 20): readonly string[] => {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError("The translation record contains an invalid string list.");
  }
  const parsed = value.map((item) => text(item, 300));
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError("The translation record contains duplicate list entries.");
  }
  return Object.freeze(parsed);
};

const literal = <Value extends string | boolean>(value: unknown, expected: Value): Value => {
  if (value !== expected) throw new TypeError("The translation record literal is invalid.");
  return expected;
};

const parseVersion = (value: unknown): string => {
  const version = text(value, 40);
  if (!versionPattern.test(version)) throw new TypeError("The translation version is invalid.");
  return version;
};

const parseDate = (value: unknown): string => {
  const date = text(value, 10);
  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new TypeError("The translation review date is invalid.");
  }
  return date;
};

const parseSourceMessage = (value: unknown): SourceMessageV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "allowedIdentical",
    "allowedLinks",
    "allowedTags",
    "description",
    "maxLength",
    "message",
    "placeholders",
    "risk",
  ]);
  const message = text(candidate.message, 10_000);
  const placeholders = stringList(candidate.placeholders);
  const allowedTags = stringList(candidate.allowedTags);
  const allowedLinks = stringList(candidate.allowedLinks);
  const shape = inspectIcuMessage(message);
  if (
    shape.arguments.join("\u0000") !== [...placeholders].sort().join("\u0000") ||
    shape.tags.join("\u0000") !== [...allowedTags].sort().join("\u0000")
  ) {
    throw new TypeError("The source message metadata does not match its ICU structure.");
  }
  const links = message.match(linkPattern) ?? [];
  if (links.join("\u0000") !== allowedLinks.join("\u0000")) {
    throw new TypeError("The source message link inventory is invalid.");
  }
  const risk = text(candidate.risk, 20);
  if (!["legal", "low", "payment", "product", "safety", "spiritual"].includes(risk)) {
    throw new TypeError("The source message risk is invalid.");
  }
  if (
    typeof candidate.maxLength !== "number" ||
    !Number.isSafeInteger(candidate.maxLength) ||
    candidate.maxLength < message.length ||
    candidate.maxLength > 20_000
  ) {
    throw new TypeError("The source message length constraint is invalid.");
  }
  return Object.freeze({
    allowedIdentical:
      candidate.allowedIdentical === true ? true : literal(candidate.allowedIdentical, false),
    allowedLinks,
    allowedTags,
    description: text(candidate.description, 1_000),
    maxLength: candidate.maxLength,
    message,
    placeholders: Object.freeze([...placeholders].sort()),
    risk: risk as TranslationRisk,
  });
};

export const parseMessageSourceCatalogV1 = (value: unknown): MessageSourceCatalogV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "audience",
    "catalogId",
    "contentType",
    "editorial",
    "locale",
    "messages",
    "rights",
    "schemaVersion",
    "version",
  ]);
  const editorial = record(candidate.editorial);
  exactKeys(editorial, [
    "approvalReference",
    "authorId",
    "changeReason",
    "effectiveDate",
    "reviewDueDate",
    "reviewedDate",
    "reviewerId",
    "status",
    "supersedes",
  ]);
  if (editorial.supersedes !== null) {
    throw new TypeError("The first source message catalog cannot supersede a record.");
  }
  const messages = record(candidate.messages);
  const messageEntries = Object.entries(messages);
  if (messageEntries.length < 1 || messageEntries.length > 5_000) {
    throw new TypeError("The source message inventory is invalid.");
  }
  const parsedMessages = Object.fromEntries(
    messageEntries.map(([key, message]) => {
      if (!keyPattern.test(key)) throw new TypeError("The source message key is invalid.");
      return [key, parseSourceMessage(message)];
    }),
  );
  const rights = record(candidate.rights);
  exactKeys(rights, ["allowedUses", "evidenceReference", "owner", "status", "territory"]);
  const allowedUses = stringList(rights.allowedUses, 3);
  if (
    allowedUses.join("\u0000") !==
    ["public_display", "commercial_use", "translation"].join("\u0000")
  ) {
    throw new TypeError("The source message rights inventory is invalid.");
  }
  const audience = text(candidate.audience, 20);
  if (audience !== "account" && audience !== "all") {
    throw new TypeError("The source message audience is invalid.");
  }
  const contentType = text(candidate.contentType, 30);
  if (contentType !== "lifecycle_messages" && contentType !== "ui_messages") {
    throw new TypeError("The source message content type is invalid.");
  }
  return Object.freeze({
    audience,
    catalogId: text(candidate.catalogId, 120),
    contentType,
    editorial: Object.freeze({
      approvalReference: text(editorial.approvalReference, 120),
      authorId: text(editorial.authorId, 120),
      changeReason: text(editorial.changeReason, 1_000),
      effectiveDate: parseDate(editorial.effectiveDate),
      reviewDueDate: parseDate(editorial.reviewDueDate),
      reviewedDate: parseDate(editorial.reviewedDate),
      reviewerId: text(editorial.reviewerId, 120),
      status: literal(editorial.status, "source_ready"),
      supersedes: null,
    }),
    locale: canonicalizeLocale(text(candidate.locale, 64)),
    messages: Object.freeze(parsedMessages),
    rights: Object.freeze({
      allowedUses: Object.freeze(["public_display", "commercial_use", "translation"] as const),
      evidenceReference: text(rights.evidenceReference, 120),
      owner: text(rights.owner, 120),
      status: literal(rights.status, "owned"),
      territory: literal(rights.territory, "worldwide"),
    }),
    schemaVersion: literal(candidate.schemaVersion, "rituvia-message-source.v1"),
    version: parseVersion(candidate.version),
  });
};

export const parseMessageRuntimeCatalogV1 = (value: unknown): MessageRuntimeCatalogV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "catalogId",
    "contentType",
    "locale",
    "messages",
    "schemaVersion",
    "sourceChecksum",
    "sourceVersion",
  ]);
  const messages = record(candidate.messages);
  const entries = Object.entries(messages);
  if (entries.length < 1 || entries.length > 5_000) {
    throw new TypeError("The runtime message inventory is invalid.");
  }
  const parsedMessages = Object.fromEntries(
    entries.map(([key, message]) => {
      if (!keyPattern.test(key)) throw new TypeError("The runtime message key is invalid.");
      const parsed = text(message, 20_000);
      inspectIcuMessage(parsed);
      return [key, parsed];
    }),
  );
  const sourceChecksum = text(candidate.sourceChecksum, 64);
  if (!checksumPattern.test(sourceChecksum)) {
    throw new TypeError("The runtime source checksum is invalid.");
  }
  const contentType = text(candidate.contentType, 30);
  if (contentType !== "lifecycle_messages" && contentType !== "ui_messages") {
    throw new TypeError("The runtime message content type is invalid.");
  }
  return Object.freeze({
    catalogId: text(candidate.catalogId, 120),
    contentType,
    locale: canonicalizeLocale(text(candidate.locale, 64)),
    messages: Object.freeze(parsedMessages),
    schemaVersion: literal(candidate.schemaVersion, "rituvia-message-runtime.v1"),
    sourceChecksum,
    sourceVersion: parseVersion(candidate.sourceVersion),
  });
};

export const parseMessageTranslationCatalogV1 = (value: unknown): MessageTranslationCatalogV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "catalogId",
    "locale",
    "messages",
    "method",
    "reviewer",
    "schemaVersion",
    "sourceChecksum",
    "sourceLocale",
    "sourceVersion",
    "status",
    "version",
  ]);
  const messages = record(candidate.messages);
  const parsedMessages = Object.fromEntries(
    Object.entries(messages).map(([key, message]) => {
      if (!keyPattern.test(key)) throw new TypeError("The translation message key is invalid.");
      return [key, text(message, 20_000)];
    }),
  );
  const method = text(candidate.method, 30);
  if (!["human", "machine", "machine_then_human"].includes(method)) {
    throw new TypeError("The translation method is invalid.");
  }
  const status = text(candidate.status, 30);
  if (!["approved", "human_review", "machine_draft", "stale", "withdrawn"].includes(status)) {
    throw new TypeError("The translation status is invalid.");
  }
  let reviewer: MessageTranslationCatalogV1["reviewer"] = null;
  if (candidate.reviewer !== null) {
    const reviewerRecord = record(candidate.reviewer);
    exactKeys(reviewerRecord, ["id", "reviewedDate", "role"]);
    const role = text(reviewerRecord.role, 20);
    if (!["owner", "qualified", "reviewer"].includes(role)) {
      throw new TypeError("The translation reviewer role is invalid.");
    }
    reviewer = Object.freeze({
      id: text(reviewerRecord.id, 120),
      reviewedDate: parseDate(reviewerRecord.reviewedDate),
      role: role as "owner" | "qualified" | "reviewer",
    });
  }
  const sourceChecksum = text(candidate.sourceChecksum, 64);
  if (!checksumPattern.test(sourceChecksum)) {
    throw new TypeError("The translation source checksum is invalid.");
  }
  return Object.freeze({
    catalogId: text(candidate.catalogId, 120),
    locale: canonicalizeLocale(text(candidate.locale, 64)),
    messages: Object.freeze(parsedMessages),
    method: method as MessageTranslationCatalogV1["method"],
    reviewer,
    schemaVersion: literal(candidate.schemaVersion, "rituvia-message-translation.v1"),
    sourceChecksum,
    sourceLocale: canonicalizeLocale(text(candidate.sourceLocale, 64)),
    sourceVersion: parseVersion(candidate.sourceVersion),
    status: status as TranslationStatus,
    version: parseVersion(candidate.version),
  });
};

export const parseTranslationGlossaryV1 = (value: unknown): TranslationGlossaryV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "approvalReference",
    "entries",
    "locale",
    "reviewerId",
    "schemaVersion",
    "sourceCatalogId",
    "sourceVersion",
    "status",
    "version",
  ]);
  if (
    !Array.isArray(candidate.entries) ||
    candidate.entries.length < 1 ||
    candidate.entries.length > 500
  ) {
    throw new TypeError("The translation glossary inventory is invalid.");
  }
  const entries = candidate.entries.map((value) => {
    const entry = record(value);
    exactKeys(entry, ["mode", "sourceTerm", "targetTerm"]);
    const mode = text(entry.mode, 30);
    if (mode !== "do_not_translate" && mode !== "translate") {
      throw new TypeError("The translation glossary mode is invalid.");
    }
    const sourceTerm = text(entry.sourceTerm, 120);
    const targetTerm = text(entry.targetTerm, 120);
    if (mode === "do_not_translate" && sourceTerm !== targetTerm) {
      throw new TypeError("Protected glossary terms must remain exact.");
    }
    return Object.freeze({ mode, sourceTerm, targetTerm });
  });
  return Object.freeze({
    approvalReference: text(candidate.approvalReference, 120),
    entries: Object.freeze(entries),
    locale: canonicalizeLocale(text(candidate.locale, 64)),
    reviewerId: text(candidate.reviewerId, 120),
    schemaVersion: literal(candidate.schemaVersion, "rituvia-translation-glossary.v1"),
    sourceCatalogId: text(candidate.sourceCatalogId, 120),
    sourceVersion: parseVersion(candidate.sourceVersion),
    status: literal(candidate.status, "approved"),
    version: parseVersion(candidate.version),
  });
};

const addFinding = (
  findings: TranslationFinding[],
  code: TranslationFinding["code"],
  key?: string,
): void => {
  findings.push(Object.freeze(key === undefined ? { code } : { code, key }));
};

const includesTerm = (value: string, term: string): boolean =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .includes(term.normalize("NFKC").toLocaleLowerCase("en"));

const authorizedTranslationCatalogs = new WeakSet<object>();

export const validateTranslationForPublication = (
  input: Readonly<{
    forbiddenTerms?: readonly string[];
    glossary: TranslationGlossaryV1;
    source: MessageSourceCatalogV1;
    sourceChecksum: string;
    translation: MessageTranslationCatalogV1;
  }>,
): readonly TranslationFinding[] => {
  const findings: TranslationFinding[] = [];
  const { glossary, source, sourceChecksum, translation } = input;
  const sourceMessages = new Map(Object.entries(source.messages));
  const translatedMessages = new Map(Object.entries(translation.messages));
  if (
    translation.catalogId !== source.catalogId ||
    translation.sourceLocale !== source.locale ||
    translation.sourceVersion !== source.version ||
    translation.sourceChecksum !== sourceChecksum
  ) {
    addFinding(findings, "source-binding");
  }
  if (translation.status !== "approved") addFinding(findings, "status");
  if (translation.method === "machine" || translation.reviewer === null) {
    addFinding(findings, "review");
  }
  if (
    translation.locale !== glossary.locale ||
    glossary.sourceCatalogId !== source.catalogId ||
    glossary.sourceVersion !== source.version
  ) {
    addFinding(findings, "glossary");
  }

  const sourceKeys = [...sourceMessages.keys()].sort();
  const translationKeys = [...translatedMessages.keys()].sort();
  for (const key of sourceKeys) {
    if (!translationKeys.includes(key)) addFinding(findings, "missing-key", key);
  }
  for (const key of translationKeys) {
    if (!sourceKeys.includes(key)) addFinding(findings, "unexpected-key", key);
  }

  for (const key of sourceKeys) {
    const sourceMessage = sourceMessages.get(key);
    const translated = translatedMessages.get(key);
    if (sourceMessage === undefined || translated === undefined) continue;
    let translatedShape;
    try {
      translatedShape = inspectIcuMessage(translated);
    } catch {
      addFinding(findings, "invalid-icu", key);
      continue;
    }
    if (translatedShape.arguments.join("\u0000") !== sourceMessage.placeholders.join("\u0000")) {
      addFinding(findings, "placeholder", key);
    }
    if (translatedShape.tags.join("\u0000") !== sourceMessage.allowedTags.join("\u0000")) {
      addFinding(findings, "markup", key);
    }
    if (
      (translated.match(linkPattern) ?? []).join("\u0000") !==
      sourceMessage.allowedLinks.join("\u0000")
    ) {
      addFinding(findings, "links", key);
    }
    if (translated.length > sourceMessage.maxLength) addFinding(findings, "length", key);
    if (
      translation.locale !== source.locale &&
      translated === sourceMessage.message &&
      !sourceMessage.allowedIdentical
    ) {
      addFinding(findings, "identical-source", key);
    }
    if (
      ["legal", "payment", "safety", "spiritual"].includes(sourceMessage.risk) &&
      translation.reviewer !== null &&
      translation.reviewer.role === "reviewer"
    ) {
      addFinding(findings, "review", key);
    }
    for (const entry of glossary.entries) {
      if (
        includesTerm(sourceMessage.message, entry.sourceTerm) &&
        !includesTerm(translated, entry.targetTerm)
      ) {
        addFinding(findings, "glossary", key);
      }
    }
    for (const term of input.forbiddenTerms ?? []) {
      if (includesTerm(translated, term)) addFinding(findings, "forbidden-term", key);
    }
  }
  return Object.freeze(findings);
};

export const authorizeTranslationForPublication = (
  input: Parameters<typeof validateTranslationForPublication>[0],
): MessageTranslationCatalogV1 => {
  const findings = validateTranslationForPublication(input);
  if (findings.length > 0) {
    throw new TypeError("The translation catalog is not eligible for publication.");
  }
  authorizedTranslationCatalogs.add(input.translation);
  return input.translation;
};

const createRuntime = (
  input: Readonly<{
    configuredFallbacks: Readonly<Record<string, readonly string[]>>;
    sourceCatalogId: string;
    sourceChecksum?: string;
    onFallback?: (event: MessageFallbackEvent) => void;
    sourceLocale: string;
    sourceMessages: Readonly<Record<string, string>>;
    translations: readonly MessageTranslationCatalogV1[];
  }>,
) => {
  const sourceLocale = canonicalizeLocale(input.sourceLocale);
  const sourceMessages = new Map(Object.entries(input.sourceMessages));
  const translations = new Map(
    input.translations
      .filter(
        (catalog) =>
          catalog.status === "approved" &&
          authorizedTranslationCatalogs.has(catalog) &&
          catalog.catalogId === input.sourceCatalogId &&
          catalog.sourceLocale === sourceLocale &&
          (input.sourceChecksum === undefined || catalog.sourceChecksum === input.sourceChecksum),
      )
      .map((catalog) => [
        canonicalizeLocale(catalog.locale),
        new Map(Object.entries(catalog.messages)),
      ]),
  );
  return Object.freeze({
    format: (requestedLocale: string, key: string, values: IcuMessageValues = {}): string => {
      const chain = resolveLocaleFallbackChain(
        requestedLocale,
        sourceLocale,
        input.configuredFallbacks,
      );
      const requested = chain.at(0) as string;
      for (const locale of chain) {
        const message =
          locale === sourceLocale ? sourceMessages.get(key) : translations.get(locale)?.get(key);
        if (message !== undefined) {
          if (locale !== requested) {
            input.onFallback?.(
              Object.freeze({ key, requestedLocale: requested, resolvedLocale: locale }),
            );
          }
          return formatIcuMessage(locale, message, values);
        }
      }
      throw new TypeError(
        "The requested message key is unavailable in the explicit fallback chain.",
      );
    },
  });
};

export const createMessageRuntime = (
  input: Readonly<{
    configuredFallbacks: Readonly<Record<string, readonly string[]>>;
    onFallback?: (event: MessageFallbackEvent) => void;
    source: MessageSourceCatalogV1;
    translations: readonly MessageTranslationCatalogV1[];
  }>,
) =>
  createRuntime({
    configuredFallbacks: input.configuredFallbacks,
    ...(input.onFallback === undefined ? {} : { onFallback: input.onFallback }),
    sourceCatalogId: input.source.catalogId,
    sourceLocale: input.source.locale,
    sourceMessages: Object.fromEntries(
      Object.entries(input.source.messages).map(([key, message]) => [key, message.message]),
    ),
    translations: input.translations,
  });

export const createProjectedMessageRuntime = (
  input: Readonly<{
    configuredFallbacks: Readonly<Record<string, readonly string[]>>;
    onFallback?: (event: MessageFallbackEvent) => void;
    source: MessageRuntimeCatalogV1;
    translations: readonly MessageTranslationCatalogV1[];
  }>,
) =>
  createRuntime({
    configuredFallbacks: input.configuredFallbacks,
    ...(input.onFallback === undefined ? {} : { onFallback: input.onFallback }),
    sourceCatalogId: input.source.catalogId,
    sourceChecksum: input.source.sourceChecksum,
    sourceLocale: input.source.locale,
    sourceMessages: input.source.messages,
    translations: input.translations,
  });
