"use client";

import {
  ActionLink,
  Button,
  Checkbox,
  createUiControlId,
  InlineAlert,
  Skeleton,
  TextAreaField,
  TextField,
  type LocalActionHref,
} from "@rituvia/ui";
import { evaluateReflectionIntentionAgencyV1, parseRitualCatalogV1 } from "@rituvia/domain";
import { createLocaleFormatter } from "@rituvia/i18n/locale";
import Image from "next/image";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  SanctuaryFreeRitualItem,
  SanctuaryMessages,
  SanctuaryThemeCode,
} from "../_i18n/sanctuary-messages";
import type { Locale } from "../_i18n/routing";
import {
  clearSanctuaryReadingHandoff,
  sanctuaryReadingHandoffStorageKey,
} from "./reading-sanctuary-handoff";
import {
  SanctuaryRitualExperience,
  type RitualCompletionResult,
  type RitualExperienceDestination,
  type RitualExperienceMode,
} from "./sanctuary-ritual-experience";
import { revisitIntentionStorageKey } from "./revisit-experience";
import { tarotReadingResumeStorageKeys } from "./tarot-reading-resume-storage";

export const sanctuaryEndpoints = Object.freeze({
  anonymousSession: "/api/v1/anonymous/session",
  catalog: "/api/v1/catalog",
  entitlements: "/api/v1/entitlements",
  intentions: "/api/v1/intentions",
  journalEntries: "/api/v1/journal-entries",
  orders: "/api/v1/orders",
  ritualObjects: "/api/v1/ritual-objects",
  ritualSessions: "/api/v1/ritual-sessions",
});

type CatalogItem = Readonly<{
  access: "free" | "purchase";
  code: string;
  description: string;
  name: string;
  objectCode: string;
  owned: boolean;
  price: Readonly<{ amountMinor: number; currency: string }> | null;
}>;

type IntentionStatus = "active" | "archived" | "completed";
type Intention = Readonly<{
  id: string;
  intentionCode: SanctuaryThemeCode;
  intentionText: string;
  reminderPreference: "none";
  revisitDate: string | null;
  revision: number;
  smallAction: string;
  status: IntentionStatus;
  timeZone: string | null;
}>;
type RitualStepCode = "breathe" | "complete" | "light" | "pause" | "place" | "prepare";
type RitualSession = Readonly<{
  currentStepCode: RitualStepCode;
  elapsedSeconds: number;
  id: string;
  itemCode: string;
  revision: number;
  status: "active" | "paused" | "completed" | "abandoned";
}>;
type JournalEntry = Readonly<{
  id: string;
  reflection: string;
  revision: number;
}>;

type CatalogPhase = "error" | "loading" | "ready";
type OperationPhase = "error" | "idle" | "loading" | "offline" | "success";
type IntentionErrorField = "intention" | "smallAction";
type IntentionLifecycleAction = "archive" | "complete" | "delete";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const codePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const csrfTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const legacyFreeRitualObjectCode = (code: SanctuaryFreeRitualItem["code"]): "candle" | "incense" =>
  code === "free_candle" ? "candle" : "incense";

const tomorrowLocalDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCatalogItem = (value: unknown): CatalogItem | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.productCode !== "string" ||
    !codePattern.test(value.productCode) ||
    typeof value.name !== "string" ||
    value.name.length < 1 ||
    value.name.length > 120 ||
    !Array.isArray(value.exactContents) ||
    value.exactContents.length < 1 ||
    value.exactContents.length > 8 ||
    value.exactContents.some(
      (entry) => typeof entry !== "string" || entry.length < 1 || entry.length > 240,
    ) ||
    !isRecord(value.price) ||
    !Number.isSafeInteger(value.price.amountMinor) ||
    (value.price.amountMinor as number) < 0 ||
    typeof value.price.currencyCode !== "string" ||
    !/^[A-Z]{3}$/u.test(value.price.currencyCode)
  ) {
    return null;
  }
  const exactContents = value.exactContents as string[];
  return Object.freeze({
    access: "purchase",
    code: value.productCode,
    description: exactContents.join(" · "),
    name: value.name,
    objectCode: value.productCode,
    owned: false,
    price: Object.freeze({
      amountMinor: value.price.amountMinor as number,
      currency: value.price.currencyCode,
    }),
  });
};

export const parseCatalogResponse = (value: unknown): readonly CatalogItem[] | null => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) return null;
  const items = value.items.map(parseCatalogItem);
  if (items.some((item) => item === null)) return null;
  const parsed = items.filter((item): item is CatalogItem => item !== null);
  if (new Set(parsed.map((item) => item.code)).size !== parsed.length) return null;
  return Object.freeze(parsed);
};

export const parseFreeRitualCatalogResponse = (value: unknown): boolean => {
  try {
    const catalog = parseRitualCatalogV1(value);
    return (["free_candle", "free_incense"] as const).every((code) =>
      catalog.items.some(
        (item) =>
          item.code === code &&
          item.access.kind === "free" &&
          item.kind === "free_object" &&
          item.status === "active",
      ),
    );
  } catch {
    return false;
  }
};

const parseActiveEntitlementCodes = (value: unknown): ReadonlySet<string> | null => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) return null;
  const codes = new Set<string>();
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.code !== "string" ||
      !codePattern.test(item.code) ||
      (item.state !== "active" && item.state !== "revoked")
    ) {
      return null;
    }
    if (item.state === "active") codes.add(item.code);
  }
  return codes;
};

const parseIntention = (value: unknown): Intention | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    ![
      "calm_clarity",
      "gratitude_abundance",
      "courage_action",
      "connection_understanding",
      "release_renewal",
    ].includes(typeof value.intentionCode === "string" ? value.intentionCode : "") ||
    typeof value.intentionText !== "string" ||
    value.intentionText.length < 1 ||
    value.intentionText.length > 280 ||
    value.reminderPreference !== "none" ||
    (value.revisitDate !== null &&
      (typeof value.revisitDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.revisitDate))) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.smallAction !== "string" ||
    value.smallAction.length < 1 ||
    value.smallAction.length > 280 ||
    (value.status !== "active" && value.status !== "completed" && value.status !== "archived") ||
    (value.timeZone !== null && typeof value.timeZone !== "string") ||
    value.schemaVersion !== "reflection-intention.v2"
  ) {
    return null;
  }
  return Object.freeze({
    id: value.id,
    intentionCode: value.intentionCode as SanctuaryThemeCode,
    intentionText: value.intentionText,
    reminderPreference: "none",
    revisitDate: value.revisitDate as string | null,
    revision: value.revision as number,
    smallAction: value.smallAction,
    status: value.status,
    timeZone: value.timeZone as string | null,
  });
};

const parseRitualSession = (value: unknown): RitualSession | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.itemCode !== "string" ||
    !codePattern.test(value.itemCode) ||
    !["active", "paused", "completed", "abandoned"].includes(
      typeof value.status === "string" ? value.status : "",
    ) ||
    !["breathe", "complete", "light", "pause", "place", "prepare"].includes(
      typeof value.currentStepCode === "string" ? value.currentStepCode : "",
    ) ||
    !Number.isSafeInteger(value.elapsedSeconds) ||
    (value.elapsedSeconds as number) < 0 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    value.schemaVersion !== "ritual-session.v2"
  ) {
    return null;
  }
  return Object.freeze({
    currentStepCode: value.currentStepCode as RitualStepCode,
    elapsedSeconds: value.elapsedSeconds as number,
    id: value.id,
    itemCode: value.itemCode,
    revision: value.revision as number,
    status: value.status as RitualSession["status"],
  });
};

const parseJournalEntry = (value: unknown): JournalEntry | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.reflection !== "string" ||
    value.reflection.length < 1 ||
    value.reflection.length > 3_000 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    value.schemaVersion !== "private-journal.v2"
  ) {
    return null;
  }
  return Object.freeze({
    id: value.id,
    reflection: value.reflection,
    revision: value.revision as number,
  });
};

type ReadingResumeStorage = Pick<Storage, "getItem">;

const resolveReadingCandidate = async (
  fetcher: typeof fetch,
  readingId: string,
): Promise<Readonly<{ createdAt: number; readingId: string }> | null> => {
  try {
    const response = await fetcher(`/api/v1/readings/${readingId}`, {
      cache: "no-store",
      credentials: "same-origin",
      method: "GET",
    });
    if (!response.ok) return null;
    const value = (await response.json()) as unknown;
    if (!isRecord(value) || value.readingId !== readingId || typeof value.createdAt !== "string") {
      return null;
    }
    const createdAt = Date.parse(value.createdAt);
    return Number.isFinite(createdAt) ? Object.freeze({ createdAt, readingId }) : null;
  } catch {
    return null;
  }
};

const readingResumeCandidates = (storage: ReadingResumeStorage): readonly string[] => {
  try {
    const candidates = [
      storage.getItem(tarotReadingResumeStorageKeys.one_card),
      storage.getItem(tarotReadingResumeStorageKeys.three_card),
    ];
    return Object.freeze(
      [
        ...new Set(candidates.filter((candidate): candidate is string => candidate !== null)),
      ].filter((candidate) => uuidPattern.test(candidate)),
    );
  } catch {
    return Object.freeze([]);
  }
};

export const resolveLatestReadingId = async (
  fetcher: typeof fetch,
  storage: ReadingResumeStorage,
): Promise<string | null> => {
  let handoffReadingId: string | null = null;
  try {
    handoffReadingId = storage.getItem(sanctuaryReadingHandoffStorageKey);
  } catch {
    handoffReadingId = null;
  }
  if (handoffReadingId !== null && uuidPattern.test(handoffReadingId)) {
    const resolvedHandoff = await resolveReadingCandidate(fetcher, handoffReadingId);
    if (resolvedHandoff !== null) return resolvedHandoff.readingId;
  }
  const candidates = readingResumeCandidates(storage);
  const resolved = await Promise.all(
    candidates.map((readingId) => resolveReadingCandidate(fetcher, readingId)),
  );
  return (
    resolved
      .filter(
        (candidate): candidate is Readonly<{ createdAt: number; readingId: string }> =>
          candidate !== null,
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0]?.readingId ?? null
  );
};

const currencyLabel = (item: CatalogItem, locale: Locale): string | null => {
  if (item.price === null) return null;
  try {
    return createLocaleFormatter({ locale, timeZone: "UTC" }).currency(
      item.price.amountMinor / 100,
      item.price.currency,
    );
  } catch {
    return `${item.price.currency} ${(item.price.amountMinor / 100).toFixed(2)}`;
  }
};

const safeCheckoutUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol !== "https:" && parsed.origin !== window.location.origin) return null;
    return parsed.href;
  } catch {
    return null;
  }
};

const orderIdFromResponse = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.order) ? value.order.orderId : value.orderId;
  return typeof candidate === "string" && uuidPattern.test(candidate) ? candidate : null;
};

const checkoutUrlFromResponse = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  return safeCheckoutUrl(value.url ?? value.checkoutUrl);
};

type SanctuaryFlowProps = Readonly<{
  accountHref: LocalActionHref;
  locale: Locale;
  messages: SanctuaryMessages;
  readingHref: LocalActionHref;
  revisitHref: LocalActionHref;
  sanctuaryHref: LocalActionHref;
  signInHref: LocalActionHref;
}>;

export function SanctuaryFlow({
  accountHref,
  locale,
  messages,
  readingHref,
  revisitHref,
  sanctuaryHref,
  signInHref,
}: SanctuaryFlowProps) {
  const [accountState, setAccountState] = useState<"loading" | "signed-in" | "signed-out">(
    "loading",
  );
  const [accountAgeAttested, setAccountAgeAttested] = useState(false);
  const [activeRitualItem, setActiveRitualItem] = useState<CatalogItem | null>(null);
  const [activeRitualMode, setActiveRitualMode] = useState<RitualExperienceMode>("visual");
  const [adultAttested, setAdultAttested] = useState(false);
  const [catalog, setCatalog] = useState<readonly CatalogItem[]>([]);
  const [catalogDegraded, setCatalogDegraded] = useState(false);
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>("loading");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPhase, setCheckoutPhase] = useState<OperationPhase>("idle");
  const [intention, setIntention] = useState<Intention | null>(null);
  const [intentionError, setIntentionError] = useState<string | null>(null);
  const [intentionErrorField, setIntentionErrorField] = useState<IntentionErrorField | null>(null);
  const [intentionPhase, setIntentionPhase] = useState<OperationPhase>("idle");
  const [intentionSuccess, setIntentionSuccess] = useState<string | null>(null);
  const [intentionText, setIntentionText] = useState("");
  const [intentionReframe, setIntentionReframe] = useState<string | null>(null);
  const [pendingIntentionAction, setPendingIntentionAction] =
    useState<IntentionLifecycleAction | null>(null);
  const [revisitDate, setRevisitDate] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalError, setJournalError] = useState<string | undefined>();
  const [journalPhase, setJournalPhase] = useState<OperationPhase>("idle");
  const [pendingItem, setPendingItem] = useState<CatalogItem | null>(null);
  const [placedItems, setPlacedItems] = useState<readonly CatalogItem[]>([]);
  const [ritualError, setRitualError] = useState<string | null>(null);
  const [ritualPhase, setRitualPhase] = useState<OperationPhase>("idle");
  const [ritualSession, setRitualSession] = useState<RitualSession | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<SanctuaryThemeCode | null>(null);
  const [smallAction, setSmallAction] = useState("");
  const completionRegion = useRef<HTMLElement | null>(null);
  const confirmationRegion = useRef<HTMLDivElement | null>(null);
  const accountCsrfToken = useRef<string | null>(null);
  const csrfToken = useRef<string | null>(null);
  const intentionOperation = useRef<Readonly<{ fingerprint: string; key: string }> | null>(null);
  const journalOperation = useRef<Readonly<{ fingerprint: string; key: string }> | null>(null);
  const ritualOperation = useRef<Readonly<{ fingerprint: string; key: string }> | null>(null);
  const ritualReturnFocus = useRef<HTMLElement | null>(null);
  const intentionTextId = createUiControlId("sanctuary-intention-text");
  const smallActionId = createUiControlId("sanctuary-small-action");
  const revisitDateId = createUiControlId("sanctuary-revisit-date");
  const journalId = createUiControlId("sanctuary-journal");
  const ageId = createUiControlId("sanctuary-checkout-age");
  const sanctuarySignInHref = `${signInHref}?returnTo=${encodeURIComponent(sanctuaryHref)}`;
  const minimumRevisitDate = tomorrowLocalDate();
  const idempotencyKeyFor = (fingerprint: string): string => {
    if (intentionOperation.current?.fingerprint === fingerprint) {
      return intentionOperation.current.key;
    }
    const key = crypto.randomUUID();
    intentionOperation.current = Object.freeze({ fingerprint, key });
    return key;
  };
  const ritualIdempotencyKeyFor = (fingerprint: string): string => {
    if (ritualOperation.current?.fingerprint === fingerprint) {
      return ritualOperation.current.key;
    }
    const key = crypto.randomUUID();
    ritualOperation.current = Object.freeze({ fingerprint, key });
    return key;
  };
  const journalIdempotencyKeyFor = (fingerprint: string): string => {
    if (journalOperation.current?.fingerprint === fingerprint) {
      return journalOperation.current.key;
    }
    const key = crypto.randomUUID();
    journalOperation.current = Object.freeze({ fingerprint, key });
    return key;
  };

  const loadCatalog = useCallback(async (): Promise<void> => {
    setCatalogPhase("loading");
    setCatalogDegraded(false);
    const freeItems: readonly CatalogItem[] = messages.ritual.freeItems.map((item) =>
      Object.freeze({
        access: "free",
        ...item,
        objectCode: legacyFreeRitualObjectCode(item.code),
        owned: true,
        price: null,
      }),
    );
    try {
      const [ritualObjectsResponse, catalogResponse, entitlementResponse] = await Promise.all([
        fetch(sanctuaryEndpoints.ritualObjects, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        }),
        fetch(sanctuaryEndpoints.catalog, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        }),
        fetch(sanctuaryEndpoints.entitlements, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        }),
      ]);
      if (!ritualObjectsResponse.ok) throw new TypeError("ritual catalog unavailable");
      if (!parseFreeRitualCatalogResponse((await ritualObjectsResponse.json()) as unknown)) {
        throw new TypeError("invalid ritual catalog");
      }
      if (!catalogResponse.ok) throw new TypeError("catalog unavailable");
      const parsed = parseCatalogResponse((await catalogResponse.json()) as unknown);
      if (parsed === null || parsed.length === 0) throw new TypeError("invalid catalog");
      const entitlementCodes = entitlementResponse.ok
        ? parseActiveEntitlementCodes((await entitlementResponse.json()) as unknown)
        : new Set<string>();
      if (entitlementCodes === null) throw new TypeError("invalid entitlements");
      const paidItems = parsed.map((item) =>
        Object.freeze({
          ...item,
          owned: entitlementCodes.has(`sanctuary.${item.code}`),
        }),
      );
      setCatalog(Object.freeze([...freeItems, ...paidItems]));
      setCatalogPhase("ready");
    } catch {
      setCatalog(freeItems);
      setCatalogDegraded(true);
      setCatalogPhase("ready");
    }
  }, [messages.ritual.freeItems]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadCatalog();
      void fetch("/api/v1/me", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            accountCsrfToken.current = null;
            setAccountAgeAttested(false);
            setAccountState("signed-out");
            return;
          }
          const payload = (await response.json()) as unknown;
          const issuedAccountCsrfToken = response.headers.get("x-csrf-token");
          if (issuedAccountCsrfToken === null || !csrfTokenPattern.test(issuedAccountCsrfToken)) {
            throw new TypeError("account csrf unavailable");
          }
          accountCsrfToken.current = issuedAccountCsrfToken;
          if (!isRecord(payload) || typeof payload.ageAttested !== "boolean") {
            accountCsrfToken.current = null;
            setAccountAgeAttested(false);
            setAccountState("signed-out");
            return;
          }
          setAccountAgeAttested(payload.ageAttested);
          setAccountState("signed-in");
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            accountCsrfToken.current = null;
            setAccountState("signed-out");
          }
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadCatalog]);

  useEffect(() => {
    if (journalPhase === "success") completionRegion.current?.focus();
  }, [journalPhase]);

  useEffect(() => {
    if (pendingIntentionAction !== null) confirmationRegion.current?.focus();
  }, [pendingIntentionAction]);

  const createIntention = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (selectedTheme === null) {
      setIntentionError(messages.intention.required);
      setIntentionErrorField(null);
      return;
    }
    if (intentionText.trim() === "") {
      setIntentionError(messages.intention.intentionTextDescription);
      setIntentionErrorField("intention");
      document.getElementById(intentionTextId)?.focus();
      return;
    }
    if (smallAction.trim() === "") {
      setIntentionError(messages.intention.smallActionRequired);
      setIntentionErrorField("smallAction");
      document.getElementById(smallActionId)?.focus();
      return;
    }
    let agency: ReturnType<typeof evaluateReflectionIntentionAgencyV1>;
    try {
      agency = evaluateReflectionIntentionAgencyV1(intentionText, selectedTheme);
    } catch {
      setIntentionError(messages.intention.intentionTextInvalid);
      setIntentionErrorField("intention");
      document.getElementById(intentionTextId)?.focus();
      return;
    }
    if (agency.kind === "reframe_required") {
      setIntentionReframe(agency.suggestedIntentionText);
      setIntentionError(messages.intention.reframeMessage);
      setIntentionErrorField("intention");
      document.getElementById(intentionTextId)?.focus();
      return;
    }
    if (!navigator.onLine) {
      setIntentionPhase("offline");
      setIntentionError(messages.intention.offline);
      setIntentionErrorField(null);
      return;
    }
    setIntentionError(null);
    setIntentionErrorField(null);
    setIntentionReframe(null);
    setIntentionSuccess(null);
    setIntentionPhase("loading");
    try {
      const updating = intention !== null && intention.status === "active";
      if (!updating) {
        const sessionResponse = await fetch(sanctuaryEndpoints.anonymousSession, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "idempotency-key": crypto.randomUUID() },
          method: "POST",
        });
        if (sessionResponse.status !== 204) throw new TypeError("session unavailable");
        const issuedCsrfToken = sessionResponse.headers.get("x-csrf-token");
        if (issuedCsrfToken === null || !csrfTokenPattern.test(issuedCsrfToken)) {
          throw new TypeError("session unavailable");
        }
        csrfToken.current = issuedCsrfToken;
      }
      const readingId = updating
        ? null
        : await resolveLatestReadingId(fetch, window.sessionStorage);
      const timeZone =
        revisitDate === "" ? null : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
      const body = updating
        ? {
            action: "edit",
            expectedRevision: intention.revision,
            intentionCode: selectedTheme,
            intentionText: agency.intentionText,
            privacyState: "private",
            reminderPreference: "none",
            revisitDate: revisitDate === "" ? null : revisitDate,
            schemaVersion: "reflection-intention-mutation.v1",
            smallAction,
            timeZone,
          }
        : {
            intentionCode: selectedTheme,
            intentionText: agency.intentionText,
            locale: "en",
            privacyState: "private",
            readingId,
            reminderPreference: "none",
            revisitDate: revisitDate === "" ? null : revisitDate,
            schemaVersion: "reflection-intention.v2",
            smallAction,
            timeZone,
          };
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const endpoint = updating
        ? `${sanctuaryEndpoints.intentions}/${intention.id}`
        : sanctuaryEndpoints.intentions;
      const method = updating ? "PATCH" : "POST";
      const operationFingerprint = `${method}:${endpoint}:${JSON.stringify(body)}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(operationFingerprint),
          "x-csrf-token": csrfToken.current,
        },
        method,
      });
      if (!response.ok) throw new TypeError("intention unavailable");
      const refreshedCsrfToken = response.headers.get("x-csrf-token");
      if (refreshedCsrfToken === null || !csrfTokenPattern.test(refreshedCsrfToken)) {
        throw new TypeError("csrf unavailable");
      }
      const parsed = parseIntention((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid intention response");
      csrfToken.current = refreshedCsrfToken;
      intentionOperation.current = null;
      clearSanctuaryReadingHandoff(window.sessionStorage);
      setIntention(parsed);
      setIntentionText(parsed.intentionText);
      setSmallAction(parsed.smallAction);
      setRevisitDate(parsed.revisitDate ?? "");
      setIntentionSuccess(updating ? messages.intention.updated : messages.intention.created);
      setIntentionPhase("success");
    } catch {
      setIntentionPhase(navigator.onLine ? "error" : "offline");
      setIntentionError(navigator.onLine ? messages.intention.error : messages.intention.offline);
      setIntentionErrorField(null);
    }
  };

  const mutateIntentionLifecycle = async (action: IntentionLifecycleAction): Promise<void> => {
    if (intention === null || !navigator.onLine) {
      setIntentionPhase(navigator.onLine ? "error" : "offline");
      setIntentionError(navigator.onLine ? messages.intention.error : messages.intention.offline);
      setIntentionErrorField(null);
      return;
    }
    setIntentionError(null);
    setIntentionErrorField(null);
    setIntentionSuccess(null);
    setIntentionPhase("loading");
    try {
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const endpoint = `${sanctuaryEndpoints.intentions}/${intention.id}`;
      const mutationBody =
        action === "delete"
          ? null
          : {
              action,
              expectedRevision: intention.revision,
              schemaVersion: "reflection-intention-mutation.v1",
            };
      const operationFingerprint = `${action === "delete" ? "DELETE" : "PATCH"}:${endpoint}:${
        mutationBody === null ? intention.revision : JSON.stringify(mutationBody)
      }`;
      const idempotencyKey = idempotencyKeyFor(operationFingerprint);
      const response =
        action === "delete"
          ? await fetch(endpoint, {
              cache: "no-store",
              credentials: "same-origin",
              headers: {
                accept: "application/json",
                "idempotency-key": idempotencyKey,
                "if-match": `"revision-${intention.revision}"`,
                "x-csrf-token": csrfToken.current,
              },
              method: "DELETE",
            })
          : await fetch(endpoint, {
              body: JSON.stringify(mutationBody),
              cache: "no-store",
              credentials: "same-origin",
              headers: {
                accept: "application/json",
                "content-type": "application/json",
                "idempotency-key": idempotencyKey,
                "x-csrf-token": csrfToken.current,
              },
              method: "PATCH",
            });
      if (!response.ok) throw new TypeError("intention mutation unavailable");
      const refreshedCsrfToken = response.headers.get("x-csrf-token");
      if (refreshedCsrfToken !== null) {
        if (!csrfTokenPattern.test(refreshedCsrfToken)) {
          throw new TypeError("csrf unavailable");
        }
        csrfToken.current = refreshedCsrfToken;
      }
      intentionOperation.current = null;
      setPendingIntentionAction(null);
      if (action === "delete") {
        if (response.status !== 204) throw new TypeError("invalid delete response");
        setIntention(null);
        setSelectedTheme(null);
        setIntentionText("");
        setSmallAction("");
        setRevisitDate("");
        setActiveRitualItem(null);
        setRitualSession(null);
        setIntentionSuccess(messages.intention.deleted);
      } else {
        const parsed = parseIntention((await response.json()) as unknown);
        if (parsed === null) throw new TypeError("invalid intention mutation response");
        setIntention(parsed);
        if (action === "archive") {
          setActiveRitualItem(null);
          setRitualSession(null);
        }
        setIntentionSuccess(
          action === "complete" ? messages.intention.completed : messages.intention.archived,
        );
      }
      setIntentionPhase("success");
    } catch {
      setIntentionPhase(navigator.onLine ? "error" : "offline");
      setIntentionError(navigator.onLine ? messages.intention.error : messages.intention.offline);
      setIntentionErrorField(null);
    }
  };

  const startRitualExperience = async (item: CatalogItem): Promise<RitualCompletionResult> => {
    if (intention === null || intention.status !== "active") {
      return "error";
    }
    if (!navigator.onLine) {
      setRitualPhase("offline");
      return "offline";
    }
    setRitualPhase("loading");
    const body = {
      intentionId: intention.id,
      itemCode: item.code,
      schemaVersion: "ritual-session.v2",
    };
    const fingerprint = `POST:${sanctuaryEndpoints.ritualSessions}:${JSON.stringify(body)}`;
    try {
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const startResponse = await fetch(sanctuaryEndpoints.ritualSessions, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": ritualIdempotencyKeyFor(fingerprint),
          "x-csrf-token": csrfToken.current,
        },
        method: "POST",
      });
      if (!startResponse.ok) throw new TypeError("ritual unavailable");
      const session = parseRitualSession((await startResponse.json()) as unknown);
      if (session === null || session.itemCode !== item.code || session.status !== "active") {
        throw new TypeError("invalid ritual response");
      }
      const refreshedCsrfToken = startResponse.headers.get("x-csrf-token");
      if (refreshedCsrfToken === null || !csrfTokenPattern.test(refreshedCsrfToken)) {
        throw new TypeError("csrf unavailable");
      }
      csrfToken.current = refreshedCsrfToken;
      setRitualSession(session);
      setRitualPhase("idle");
      setPendingItem(null);
      ritualOperation.current = null;
      return "success";
    } catch {
      const result = navigator.onLine ? "error" : "offline";
      setRitualPhase(result);
      return result;
    }
  };

  const mutateActiveRitual = async (
    action: "complete" | "pause" | "resume",
    currentStepCode: RitualStepCode,
    elapsedSeconds: number,
  ): Promise<RitualCompletionResult> => {
    if (ritualSession === null || !navigator.onLine) {
      setRitualPhase(navigator.onLine ? "error" : "offline");
      return navigator.onLine ? "error" : "offline";
    }
    const endpoint =
      action === "complete"
        ? `${sanctuaryEndpoints.ritualSessions}/${ritualSession.id}/complete`
        : `${sanctuaryEndpoints.ritualSessions}/${ritualSession.id}`;
    const body = {
      action,
      currentStepCode,
      elapsedSeconds,
      expectedRevision: ritualSession.revision,
      schemaVersion: "ritual-session-mutation.v1",
    };
    const fingerprint = `${action === "complete" ? "POST" : "PATCH"}:${endpoint}:${JSON.stringify(body)}`;
    setRitualPhase("loading");
    try {
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": ritualIdempotencyKeyFor(fingerprint),
          "x-csrf-token": csrfToken.current,
        },
        method: action === "complete" ? "POST" : "PATCH",
      });
      if (!response.ok) throw new TypeError("ritual mutation unavailable");
      const session = parseRitualSession((await response.json()) as unknown);
      if (session === null || session.id !== ritualSession.id) {
        throw new TypeError("invalid ritual mutation response");
      }
      const refreshedCsrfToken = response.headers.get("x-csrf-token");
      if (refreshedCsrfToken === null || !csrfTokenPattern.test(refreshedCsrfToken)) {
        throw new TypeError("csrf unavailable");
      }
      csrfToken.current = refreshedCsrfToken;
      ritualOperation.current = null;
      setRitualSession(session);
      setRitualPhase(action === "complete" ? "success" : "idle");
      if (action === "complete" && activeRitualItem !== null) {
        setPlacedItems((items) =>
          Object.freeze([
            ...items.filter(({ code }) => code !== activeRitualItem.code),
            activeRitualItem,
          ]),
        );
      }
      return "success";
    } catch {
      const result = navigator.onLine ? "error" : "offline";
      setRitualPhase(result);
      return result;
    }
  };

  const selectItem = async (item: CatalogItem): Promise<void> => {
    setCheckoutError(null);
    setCheckoutPhase("idle");
    setRitualError(null);
    if (item.access === "free") {
      if (intention === null || intention.status !== "active") {
        setRitualError(messages.ritual.selectIntention);
        return;
      }
      ritualReturnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveRitualMode(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "linear" : "visual",
      );
      if (
        ritualSession !== null &&
        ritualSession.itemCode === item.code &&
        ritualSession.status === "paused"
      ) {
        setActiveRitualItem(item);
        return;
      }
      const result = await startRitualExperience(item);
      if (result === "success") {
        setActiveRitualItem(item);
      } else {
        setRitualError(
          result === "offline" ? messages.ritual.offline : messages.ritual.completionError,
        );
      }
      return;
    }
    if (item.access === "purchase" && !item.owned) {
      setPendingItem(item);
      return;
    }
    setRitualError(messages.ritual.unavailable);
  };

  const dismissRitualExperience = (destination: RitualExperienceDestination): void => {
    setActiveRitualItem(null);
    window.setTimeout(() => {
      if (destination === "journal" && ritualSession !== null) {
        document.getElementById(journalId)?.focus();
        return;
      }
      ritualReturnFocus.current?.focus();
    }, 0);
  };

  const beginCheckout = async (): Promise<void> => {
    if (pendingItem === null || pendingItem.price === null) return;
    if (accountState !== "signed-in") {
      setCheckoutError(messages.checkout.signInDescription);
      return;
    }
    if (!accountAgeAttested && !adultAttested) {
      setCheckoutError(messages.checkout.ageRequired);
      document.getElementById(ageId)?.focus();
      return;
    }
    if (!navigator.onLine) {
      setCheckoutPhase("offline");
      setCheckoutError(messages.ritual.offline);
      return;
    }
    setCheckoutError(null);
    setCheckoutPhase("loading");
    try {
      if (!accountAgeAttested) {
        if (accountCsrfToken.current === null) {
          throw new TypeError("account csrf unavailable");
        }
        const ageResponse = await fetch("/api/v1/me", {
          body: JSON.stringify({
            ageAttested: true,
            agePolicyVersion: "age-18.local.v1",
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-csrf-token": accountCsrfToken.current,
          },
          method: "PATCH",
        });
        if (ageResponse.status === 401) {
          setAccountState("signed-out");
          setCheckoutError(messages.checkout.signInDescription);
          setCheckoutPhase("error");
          return;
        }
        if (!ageResponse.ok) {
          setCheckoutError(messages.checkout.ageSaveError);
          setCheckoutPhase("error");
          return;
        }
        const agePayload = (await ageResponse.json()) as unknown;
        if (!isRecord(agePayload) || agePayload.ageAttested !== true) {
          throw new TypeError("invalid age confirmation response");
        }
        setAccountAgeAttested(true);
        setAdultAttested(false);
      }
      const orderResponse = await fetch(sanctuaryEndpoints.orders, {
        body: JSON.stringify({
          productCode: pendingItem.code,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        method: "POST",
      });
      if (orderResponse.status === 401) {
        setAccountState("signed-out");
        setCheckoutError(messages.checkout.signInDescription);
        setCheckoutPhase("error");
        return;
      }
      if (!orderResponse.ok) {
        setCheckoutError(
          orderResponse.status === 403 ? messages.checkout.unavailable : messages.checkout.error,
        );
        setCheckoutPhase("error");
        return;
      }
      const orderId = orderIdFromResponse((await orderResponse.json()) as unknown);
      if (orderId === null) throw new TypeError("invalid order response");
      const checkoutResponse = await fetch(
        `${sanctuaryEndpoints.orders}/${encodeURIComponent(orderId)}/checkout`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json", "idempotency-key": crypto.randomUUID() },
          method: "POST",
        },
      );
      if (!checkoutResponse.ok) throw new TypeError("checkout unavailable");
      const checkoutUrl = checkoutUrlFromResponse((await checkoutResponse.json()) as unknown);
      if (checkoutUrl === null) throw new TypeError("invalid checkout response");
      window.location.assign(checkoutUrl);
    } catch {
      setCheckoutPhase(navigator.onLine ? "error" : "offline");
      setCheckoutError(navigator.onLine ? messages.checkout.error : messages.ritual.offline);
    }
  };

  const saveJournal = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (intention === null || ritualSession === null) {
      setJournalError(messages.journal.prerequisite);
      return;
    }
    if (journalBody.trim() === "") {
      setJournalError(messages.journal.required);
      document.getElementById(journalId)?.focus();
      return;
    }
    if (!navigator.onLine) {
      setJournalPhase("offline");
      setJournalError(messages.journal.offline);
      return;
    }
    setJournalError(undefined);
    setJournalPhase("loading");
    try {
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const endpoint =
        journalEntry === null
          ? sanctuaryEndpoints.journalEntries
          : `${sanctuaryEndpoints.journalEntries}/${journalEntry.id}`;
      const body =
        journalEntry === null
          ? {
              intentionId: intention.id,
              reflection: journalBody,
              ritualSessionId: ritualSession.id,
              schemaVersion: "private-journal.v2",
            }
          : {
              action: "update",
              expectedRevision: journalEntry.revision,
              reflection: journalBody,
              schemaVersion: "private-journal-mutation.v1",
            };
      const method = journalEntry === null ? "POST" : "PATCH";
      const fingerprint = `${method}:${endpoint}:${JSON.stringify(body)}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": journalIdempotencyKeyFor(fingerprint),
          "x-csrf-token": csrfToken.current,
        },
        method,
      });
      if (!response.ok) throw new TypeError("journal unavailable");
      const parsed = parseJournalEntry((await response.json()) as unknown);
      if (parsed === null) {
        throw new TypeError("invalid journal response");
      }
      const refreshedCsrfToken = response.headers.get("x-csrf-token");
      if (refreshedCsrfToken === null || !csrfTokenPattern.test(refreshedCsrfToken)) {
        throw new TypeError("csrf unavailable");
      }
      csrfToken.current = refreshedCsrfToken;
      journalOperation.current = null;
      setJournalEntry(parsed);
      setJournalBody(parsed.reflection);
      setJournalPhase("success");
    } catch {
      setJournalPhase(navigator.onLine ? "error" : "offline");
      setJournalError(navigator.onLine ? messages.journal.error : messages.journal.offline);
    }
  };

  const deleteJournal = async (): Promise<void> => {
    if (journalEntry === null || !navigator.onLine) {
      setJournalPhase(navigator.onLine ? "error" : "offline");
      setJournalError(navigator.onLine ? messages.journal.error : messages.journal.offline);
      return;
    }
    if (!window.confirm(messages.journal.confirmDelete)) return;
    setJournalError(undefined);
    setJournalPhase("loading");
    const endpoint = `${sanctuaryEndpoints.journalEntries}/${journalEntry.id}`;
    const fingerprint = `DELETE:${endpoint}:${journalEntry.revision}`;
    try {
      if (csrfToken.current === null) throw new TypeError("csrf unavailable");
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "idempotency-key": journalIdempotencyKeyFor(fingerprint),
          "if-match": `"revision-${journalEntry.revision}"`,
          "x-csrf-token": csrfToken.current,
        },
        method: "DELETE",
      });
      if (response.status !== 204) throw new TypeError("journal delete unavailable");
      const refreshedCsrfToken = response.headers.get("x-csrf-token");
      if (refreshedCsrfToken !== null) {
        if (!csrfTokenPattern.test(refreshedCsrfToken)) {
          throw new TypeError("csrf unavailable");
        }
        csrfToken.current = refreshedCsrfToken;
      }
      journalOperation.current = null;
      setJournalEntry(null);
      setJournalBody("");
      setJournalPhase("idle");
      requestAnimationFrame(() => document.getElementById(journalId)?.focus());
    } catch {
      setJournalPhase(navigator.onLine ? "error" : "offline");
      setJournalError(navigator.onLine ? messages.journal.error : messages.journal.offline);
    }
  };

  const themeEntries = Object.entries(messages.intention.themes) as readonly [
    SanctuaryThemeCode,
    string,
  ][];
  const activeFreeRitual: SanctuaryFreeRitualItem | null =
    activeRitualItem === null
      ? null
      : (messages.ritual.freeItems.find((item) => item.code === activeRitualItem.code) ?? null);

  if (
    activeRitualItem !== null &&
    activeFreeRitual !== null &&
    intention !== null &&
    ritualSession !== null &&
    ritualSession.status !== "abandoned"
  ) {
    return (
      <SanctuaryRitualExperience
        currentStepCode={
          ritualSession.currentStepCode === "place" ? "prepare" : ritualSession.currentStepCode
        }
        elapsedSeconds={ritualSession.elapsedSeconds}
        initialMode={activeRitualMode}
        intentionLabel={intention.intentionText}
        item={activeFreeRitual}
        locale={locale}
        messages={messages.ritual.experience}
        onDismiss={dismissRitualExperience}
        onMutate={mutateActiveRitual}
        status={ritualSession.status}
      />
    );
  }

  return (
    <div className="sanctuary-flow">
      <noscript>
        <section className="sanctuary-panel sanctuary-noscript">
          <p className="eyebrow">{messages.ritual.title}</p>
          <h2>{messages.ritual.noScriptTitle}</h2>
          <p>{messages.ritual.noScriptDescription}</p>
          {messages.ritual.freeItems.map((item) => (
            <article key={item.code}>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <ol>
                {item.steps.map((step) => (
                  <li key={step.code}>
                    <strong>{step.title}</strong>
                    <span>{step.instruction}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      </noscript>
      <section aria-label={messages.page.title} className="sanctuary-scene">
        <Image
          alt={messages.page.title}
          className="sanctuary-scene-image"
          height={1402}
          loading="eager"
          sizes="(max-width: 640px) 100vw, (max-width: 928px) 90vw, 58vw"
          src="/images/rituvia-sanctuary-orb.png"
          width={1122}
        />
        <div className="sanctuary-scene-copy">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h2>
            {selectedTheme === null
              ? messages.page.title
              : messages.intention.themes[selectedTheme]}
          </h2>
          <div aria-live="polite" className="sanctuary-placed-items">
            {placedItems.map((item) => (
              <span key={item.code}>{item.name}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="sanctuary-workspace">
        <section className="sanctuary-panel" aria-labelledby="sanctuary-intention-title">
          <header>
            <p className="eyebrow">{messages.page.eyebrow}</p>
            <h2 id="sanctuary-intention-title">{messages.intention.title}</h2>
            <p>{messages.intention.description}</p>
          </header>
          <form aria-busy={intentionPhase === "loading" || undefined} onSubmit={createIntention}>
            <fieldset className="sanctuary-theme-fieldset">
              <legend>{messages.intention.themeLabel}</legend>
              <div className="sanctuary-theme-list">
                {themeEntries.map(([code, label]) => (
                  <button
                    aria-pressed={selectedTheme === code}
                    className="sanctuary-theme-chip"
                    disabled={
                      intentionPhase === "loading" ||
                      (intention !== null && intention.status !== "active")
                    }
                    key={code}
                    onClick={() => {
                      setSelectedTheme(code);
                      setIntentionError(null);
                      setIntentionErrorField(null);
                      setIntentionPhase("idle");
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="sanctuary-theme-fieldset">
              <legend>{messages.intention.templateLabel}</legend>
              <div className="sanctuary-theme-list">
                {messages.intention.templates.map((template) => (
                  <button
                    className="sanctuary-theme-chip"
                    disabled={
                      intentionPhase === "loading" ||
                      (intention !== null && intention.status !== "active")
                    }
                    key={template}
                    onClick={() => {
                      setIntentionText(template.replace("…", " "));
                      setIntentionReframe(null);
                      setIntentionError(null);
                      setIntentionErrorField(null);
                      setIntentionSuccess(null);
                      setIntentionPhase("idle");
                      document.getElementById(intentionTextId)?.focus();
                    }}
                    type="button"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </fieldset>
            <TextAreaField
              description={messages.intention.intentionTextDescription}
              disabled={intention !== null && intention.status !== "active"}
              {...(intentionErrorField === "intention" && intentionError !== null
                ? { error: intentionError }
                : {})}
              id={intentionTextId}
              label={messages.intention.intentionTextLabel}
              maxLength={280}
              onValueChange={(value) => {
                setIntentionText(value);
                setIntentionReframe(null);
                setIntentionErrorField(null);
                setIntentionSuccess(null);
                setIntentionPhase("idle");
              }}
              placeholder={messages.intention.intentionTextPlaceholder}
              required
              requiredLabel={messages.intention.requiredLabel}
              rows={3}
              value={intentionText}
            />
            <TextAreaField
              description={messages.intention.smallActionDescription}
              disabled={intention !== null && intention.status !== "active"}
              {...(intentionErrorField === "smallAction" && intentionError !== null
                ? { error: intentionError }
                : {})}
              id={smallActionId}
              label={messages.intention.smallActionLabel}
              maxLength={280}
              onValueChange={(value) => {
                setSmallAction(value);
                setIntentionErrorField(null);
                setIntentionSuccess(null);
                setIntentionPhase("idle");
              }}
              placeholder={messages.intention.smallActionPlaceholder}
              required
              requiredLabel={messages.intention.requiredLabel}
              rows={3}
              value={smallAction}
            />
            <TextField
              description={messages.intention.revisitDateDescription}
              disabled={intention !== null && intention.status !== "active"}
              id={revisitDateId}
              label={messages.intention.revisitDateLabel}
              minimum={minimumRevisitDate}
              onValueChange={(value) => {
                setRevisitDate(value);
                setIntentionSuccess(null);
                setIntentionPhase("idle");
              }}
              type="date"
              value={revisitDate}
            />
            <p className="sanctuary-private-note">{messages.intention.privacyDisclosure}</p>
            <p className="sanctuary-private-note">{messages.intention.reminderDisclosure}</p>
            {intentionError === null ? null : (
              <InlineAlert
                live="assertive"
                message={intentionError}
                title={messages.intention.title}
                tone="error"
              />
            )}
            {intentionReframe === null ? null : (
              <div className="sanctuary-status">
                <InlineAlert
                  message={intentionReframe}
                  title={messages.intention.reframeTitle}
                  tone="warning"
                />
                <Button
                  label={messages.intention.applyReframe}
                  onPress={() => {
                    setIntentionText(intentionReframe);
                    setIntentionReframe(null);
                    setIntentionError(null);
                    setIntentionErrorField(null);
                    setIntentionPhase("idle");
                    document.getElementById(intentionTextId)?.focus();
                  }}
                  tone="secondary"
                />
              </div>
            )}
            {intentionPhase === "success" && intentionSuccess !== null ? (
              <InlineAlert
                live="polite"
                message={intentionSuccess}
                title={messages.intention.title}
                tone="success"
              />
            ) : null}
            {intention === null || intention.status === "active" ? (
              <Button
                label={
                  intention === null ? messages.intention.create : messages.intention.saveChanges
                }
                {...(intentionPhase === "loading"
                  ? {
                      loading: true,
                      loadingLabel:
                        intention === null
                          ? messages.intention.creating
                          : messages.intention.savingChanges,
                    }
                  : {})}
                type="submit"
              />
            ) : null}
            {intention === null ? null : (
              <div className="sanctuary-intention-actions">
                <a
                  className="rvt-action rvt-action--primary"
                  href={revisitHref}
                  onClick={() =>
                    window.sessionStorage.setItem(revisitIntentionStorageKey, intention.id)
                  }
                >
                  {messages.intention.revisitAction}
                </a>
                {intention.status === "active" ? (
                  <Button
                    disabled={intentionPhase === "loading"}
                    label={messages.intention.complete}
                    onPress={() => setPendingIntentionAction("complete")}
                    tone="secondary"
                  />
                ) : null}
                {intention.status === "active" || intention.status === "completed" ? (
                  <Button
                    disabled={intentionPhase === "loading"}
                    label={messages.intention.archive}
                    onPress={() => setPendingIntentionAction("archive")}
                    tone="secondary"
                  />
                ) : null}
                <Button
                  disabled={intentionPhase === "loading"}
                  label={messages.intention.delete}
                  onPress={() => setPendingIntentionAction("delete")}
                  tone="danger"
                />
              </div>
            )}
            {pendingIntentionAction === null ? null : (
              <div className="sanctuary-status" ref={confirmationRegion} tabIndex={-1}>
                <InlineAlert
                  live="polite"
                  message={
                    pendingIntentionAction === "complete"
                      ? messages.intention.confirmComplete
                      : pendingIntentionAction === "archive"
                        ? messages.intention.confirmArchive
                        : messages.intention.confirmDelete
                  }
                  title={messages.intention.title}
                  tone="warning"
                />
                <div className="sanctuary-intention-actions">
                  <Button
                    label={
                      pendingIntentionAction === "complete"
                        ? messages.intention.complete
                        : pendingIntentionAction === "archive"
                          ? messages.intention.archive
                          : messages.intention.delete
                    }
                    onPress={() => void mutateIntentionLifecycle(pendingIntentionAction)}
                    tone={pendingIntentionAction === "delete" ? "danger" : "primary"}
                  />
                  <Button
                    label={messages.intention.cancel}
                    onPress={() => setPendingIntentionAction(null)}
                    tone="secondary"
                  />
                </div>
              </div>
            )}
          </form>
        </section>

        <section className="sanctuary-panel ritual-store" aria-labelledby="ritual-store-title">
          <header>
            <p className="eyebrow">{messages.ritual.title}</p>
            <h2 id="ritual-store-title">{messages.ritual.title}</h2>
            <p>{messages.ritual.description}</p>
          </header>
          {catalogPhase === "loading" ? (
            <div aria-busy="true" aria-live="polite">
              <p>{messages.ritual.catalogLoading}</p>
              <Skeleton lines={4} />
            </div>
          ) : null}
          {catalogPhase === "error" ? (
            <div className="sanctuary-status">
              <InlineAlert
                live="assertive"
                message={messages.ritual.catalogError}
                title={messages.ritual.catalogErrorTitle}
                tone="error"
              />
              <Button label={messages.ritual.retry} onPress={() => void loadCatalog()} />
            </div>
          ) : null}
          {catalogPhase === "ready" ? (
            <>
              {catalogDegraded ? (
                <div className="sanctuary-status">
                  <InlineAlert
                    live="polite"
                    message={messages.ritual.catalogDegraded}
                    title={messages.ritual.catalogErrorTitle}
                    tone="warning"
                  />
                  <Button label={messages.ritual.retry} onPress={() => void loadCatalog()} />
                </div>
              ) : null}
              <div className="ritual-item-list">
                {catalog.map((item) => {
                  const price = currencyLabel(item, locale);
                  const accessLabel =
                    item.access === "free"
                      ? messages.ritual.free
                      : item.owned
                        ? messages.ritual.owned
                        : messages.ritual.purchase;
                  const disabled =
                    (item.access === "purchase" && price === null) ||
                    (item.access === "purchase" && !item.owned && accountState === "loading");
                  return (
                    <article className="ritual-item-card" key={item.code}>
                      <div>
                        <span className="ritual-access-badge">{accessLabel}</span>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <p className="ritual-price">
                          {price === null ? messages.ritual.free : <bdi dir="auto">{price}</bdi>}
                        </p>
                        {item.access === "purchase" ? (
                          <p className="privacy-note">{messages.ritual.priceDisclosure}</p>
                        ) : null}
                      </div>
                      <Button
                        disabled={disabled || ritualPhase === "loading"}
                        label={
                          disabled
                            ? messages.ritual.unavailable
                            : item.access === "purchase" && !item.owned
                              ? accountState === "signed-in"
                                ? messages.checkout.continue
                                : messages.checkout.signIn
                              : item.access === "free"
                                ? messages.ritual.begin
                                : messages.ritual.place
                        }
                        onPress={() => void selectItem(item)}
                        tone={item.access === "free" || item.owned ? "primary" : "secondary"}
                      />
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
          {ritualError === null ? null : (
            <InlineAlert
              live="assertive"
              message={ritualError}
              title={messages.ritual.title}
              tone="error"
            />
          )}
          {ritualPhase === "loading" ? <p aria-live="polite">{messages.ritual.placing}</p> : null}
          {ritualPhase === "success" ? (
            <InlineAlert
              live="polite"
              message={messages.ritual.completed}
              title={messages.ritual.title}
              tone="success"
            />
          ) : null}
        </section>

        {pendingItem !== null && pendingItem.access === "purchase" && !pendingItem.owned ? (
          <section className="sanctuary-panel checkout-panel" aria-labelledby="checkout-title">
            <header>
              <p className="eyebrow">{messages.checkout.methodLabel}</p>
              <h2 id="checkout-title">{messages.checkout.title}</h2>
              <p>{messages.checkout.description}</p>
            </header>
            <div className="checkout-order-summary">
              <strong>{pendingItem.name}</strong>
              <span>
                <bdi dir="auto">{currencyLabel(pendingItem, locale)}</bdi>
              </span>
            </div>
            {accountState === "loading" ? (
              <div aria-busy="true" aria-live="polite" className="sanctuary-status">
                <p>{messages.checkout.accountChecking}</p>
                <Skeleton lines={1} />
              </div>
            ) : accountState === "signed-in" ? (
              <>
                <p className="checkout-method">{messages.checkout.methodValue}</p>
                {accountAgeAttested ? (
                  <InlineAlert
                    message={messages.checkout.ageConfirmed}
                    title={messages.checkout.title}
                    tone="success"
                  />
                ) : (
                  <Checkbox
                    checked={adultAttested}
                    {...(checkoutError === messages.checkout.ageRequired
                      ? { error: messages.checkout.ageRequired }
                      : {})}
                    id={ageId}
                    label={messages.checkout.ageLabel}
                    onCheckedChange={(checked) => {
                      setAdultAttested(checked);
                      setCheckoutError(null);
                    }}
                    required
                    requiredLabel={messages.checkout.requiredLabel}
                  />
                )}
                <Button
                  label={messages.checkout.continue}
                  {...(checkoutPhase === "loading"
                    ? { loading: true, loadingLabel: messages.checkout.creating }
                    : {})}
                  onPress={() => void beginCheckout()}
                />
              </>
            ) : (
              <div className="sanctuary-status">
                <p>{messages.checkout.signInDescription}</p>
                <a className="rvt-action rvt-action--primary" href={sanctuarySignInHref}>
                  {messages.checkout.signIn}
                </a>
              </div>
            )}
            {checkoutError === null ? null : (
              <InlineAlert message={checkoutError} title={messages.checkout.title} tone="error" />
            )}
          </section>
        ) : null}

        <section className="sanctuary-panel journal-panel" aria-labelledby="journal-title">
          <header>
            <p className="eyebrow">{messages.journal.title}</p>
            <h2 id="journal-title">{messages.journal.title}</h2>
            <p>{messages.journal.description}</p>
          </header>
          <form aria-busy={journalPhase === "loading" || undefined} onSubmit={saveJournal}>
            <TextAreaField
              {...(journalError === undefined ? {} : { error: journalError })}
              id={journalId}
              label={messages.journal.label}
              maxLength={3_000}
              onValueChange={(value) => {
                setJournalBody(value);
                setJournalError(undefined);
                setJournalPhase("idle");
              }}
              placeholder={messages.journal.placeholder}
              required
              requiredLabel={messages.journal.requiredLabel}
              rows={5}
              value={journalBody}
            />
            <Button
              label={journalEntry === null ? messages.journal.save : messages.journal.saveChanges}
              {...(journalPhase === "loading"
                ? { loading: true, loadingLabel: messages.journal.saving }
                : {})}
              type="submit"
            />
            {journalEntry === null ? null : (
              <Button
                label={messages.journal.delete}
                onPress={() => void deleteJournal()}
                tone="quiet"
              />
            )}
          </form>
        </section>

        {journalPhase === "success" ? (
          <section className="sanctuary-completion" ref={completionRegion} tabIndex={-1}>
            <p className="eyebrow">{messages.completion.eyebrow}</p>
            <h2>{messages.completion.title}</h2>
            <p>{messages.completion.description}</p>
            <div className="sanctuary-completion-actions">
              <ActionLink href={accountHref}>{messages.completion.accountAction}</ActionLink>
              <ActionLink href={readingHref} variant="secondary">
                {messages.completion.readingAction}
              </ActionLink>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
