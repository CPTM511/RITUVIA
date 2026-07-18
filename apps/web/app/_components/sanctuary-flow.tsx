"use client";

import {
  ActionLink,
  Button,
  Checkbox,
  createUiControlId,
  InlineAlert,
  Skeleton,
  TextAreaField,
  type LocalActionHref,
} from "@rituvia/ui";
import Image from "next/image";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SanctuaryMessages, SanctuaryThemeCode } from "../_i18n/sanctuary-messages";
import { tarotReadingResumeStorageKeys } from "./tarot-reading-resume-storage";

export const sanctuaryEndpoints = Object.freeze({
  catalog: "/api/v1/catalog",
  entitlements: "/api/v1/entitlements",
  intentions: "/api/v1/intentions",
  journalEntries: "/api/v1/journal-entries",
  orders: "/api/v1/orders",
  ritualSessions: "/api/v1/ritual-sessions",
});

type CatalogItem = Readonly<{
  access: "free" | "purchase";
  code: string;
  description: string;
  name: string;
  owned: boolean;
  price: Readonly<{ amountMinor: number; currency: string }> | null;
}>;

type Intention = Readonly<{ id: string; intentionCode: SanctuaryThemeCode }>;
type RitualSession = Readonly<{ id: string; objectCode: string }>;

type CatalogPhase = "error" | "loading" | "ready";
type OperationPhase = "error" | "idle" | "loading" | "offline" | "success";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const codePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

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
    value.schemaVersion !== "reflection-intention.v1"
  ) {
    return null;
  }
  return Object.freeze({
    id: value.id,
    intentionCode: value.intentionCode as SanctuaryThemeCode,
  });
};

const parseRitualSession = (value: unknown): RitualSession | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.objectCode !== "string" ||
    !codePattern.test(value.objectCode) ||
    value.schemaVersion !== "reflection-ritual.v1"
  ) {
    return null;
  }
  return Object.freeze({ id: value.id, objectCode: value.objectCode });
};

const latestReadingId = (): string | null => {
  try {
    const candidates = [
      window.sessionStorage.getItem(tarotReadingResumeStorageKeys.one_card),
      window.sessionStorage.getItem(tarotReadingResumeStorageKeys.three_card),
    ];
    return (
      candidates.find((candidate) => candidate !== null && uuidPattern.test(candidate)) ?? null
    );
  } catch {
    return null;
  }
};

const currencyLabel = (item: CatalogItem): string | null => {
  if (item.price === null) return null;
  try {
    return new Intl.NumberFormat("en", {
      currency: item.price.currency,
      style: "currency",
    }).format(item.price.amountMinor / 100);
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
  messages: SanctuaryMessages;
  readingHref: LocalActionHref;
  sanctuaryHref: LocalActionHref;
  signInHref: LocalActionHref;
}>;

export function SanctuaryFlow({
  accountHref,
  messages,
  readingHref,
  sanctuaryHref,
  signInHref,
}: SanctuaryFlowProps) {
  const [accountState, setAccountState] = useState<"loading" | "signed-in" | "signed-out">(
    "loading",
  );
  const [accountAgeAttested, setAccountAgeAttested] = useState(false);
  const [adultAttested, setAdultAttested] = useState(false);
  const [catalog, setCatalog] = useState<readonly CatalogItem[]>([]);
  const [catalogDegraded, setCatalogDegraded] = useState(false);
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>("loading");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPhase, setCheckoutPhase] = useState<OperationPhase>("idle");
  const [intention, setIntention] = useState<Intention | null>(null);
  const [intentionError, setIntentionError] = useState<string | null>(null);
  const [intentionPhase, setIntentionPhase] = useState<OperationPhase>("idle");
  const [journalBody, setJournalBody] = useState("");
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
  const smallActionId = createUiControlId("sanctuary-small-action");
  const journalId = createUiControlId("sanctuary-journal");
  const ageId = createUiControlId("sanctuary-checkout-age");
  const sanctuarySignInHref = `${signInHref}?returnTo=${encodeURIComponent(sanctuaryHref)}`;

  const loadCatalog = useCallback(async (): Promise<void> => {
    setCatalogPhase("loading");
    setCatalogDegraded(false);
    const freeItems: readonly CatalogItem[] = messages.ritual.freeItems.map((item) =>
      Object.freeze({ access: "free", ...item, owned: true, price: null }),
    );
    try {
      const [catalogResponse, entitlementResponse] = await Promise.all([
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
            setAccountAgeAttested(false);
            setAccountState("signed-out");
            return;
          }
          const payload = (await response.json()) as unknown;
          if (!isRecord(payload) || typeof payload.ageAttested !== "boolean") {
            setAccountAgeAttested(false);
            setAccountState("signed-out");
            return;
          }
          setAccountAgeAttested(payload.ageAttested);
          setAccountState("signed-in");
        })
        .catch(() => {
          if (!controller.signal.aborted) setAccountState("signed-out");
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

  const createIntention = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (selectedTheme === null) {
      setIntentionError(messages.intention.required);
      return;
    }
    if (smallAction.trim() === "") {
      setIntentionError(messages.intention.smallActionRequired);
      document.getElementById(smallActionId)?.focus();
      return;
    }
    const readingId = latestReadingId();
    if (readingId === null) {
      setIntentionError(messages.intention.readingRequired);
      return;
    }
    if (!navigator.onLine) {
      setIntentionPhase("offline");
      setIntentionError(messages.intention.offline);
      return;
    }
    setIntentionError(null);
    setIntentionPhase("loading");
    try {
      const response = await fetch(sanctuaryEndpoints.intentions, {
        body: JSON.stringify({
          intentionCode: selectedTheme,
          locale: "en",
          readingId,
          schemaVersion: "reflection-intention.v1",
          smallAction,
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
      if (!response.ok) throw new TypeError("intention unavailable");
      const parsed = parseIntention((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid intention response");
      setIntention(parsed);
      setIntentionPhase("success");
    } catch {
      setIntentionPhase(navigator.onLine ? "error" : "offline");
      setIntentionError(navigator.onLine ? messages.intention.error : messages.intention.offline);
    }
  };

  const startRitual = async (item: CatalogItem): Promise<void> => {
    if (intention === null) {
      setRitualError(messages.ritual.selectIntention);
      return;
    }
    if (!navigator.onLine) {
      setRitualPhase("offline");
      setRitualError(messages.ritual.offline);
      return;
    }
    setPendingItem(item);
    setRitualError(null);
    setRitualPhase("loading");
    try {
      const startResponse = await fetch(sanctuaryEndpoints.ritualSessions, {
        body: JSON.stringify({
          intentionId: intention.id,
          objectCode: item.code,
          schemaVersion: "reflection-ritual.v1",
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
      if (!startResponse.ok) throw new TypeError("ritual unavailable");
      const session = parseRitualSession((await startResponse.json()) as unknown);
      if (session === null) throw new TypeError("invalid ritual response");
      setRitualSession(session);
      setPlacedItems((items) =>
        Object.freeze([...items.filter(({ code }) => code !== item.code), item]),
      );
      setRitualPhase("success");
      setPendingItem(null);
    } catch {
      setRitualPhase(navigator.onLine ? "error" : "offline");
      setRitualError(navigator.onLine ? messages.ritual.completionError : messages.ritual.offline);
    }
  };

  const selectItem = (item: CatalogItem): void => {
    setCheckoutError(null);
    setCheckoutPhase("idle");
    if (item.access === "purchase" && !item.owned) {
      setPendingItem(item);
      return;
    }
    void startRitual(item);
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
        const ageResponse = await fetch("/api/v1/me", {
          body: JSON.stringify({
            ageAttested: true,
            agePolicyVersion: "age-18.local.v1",
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json", "content-type": "application/json" },
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
      const response = await fetch(sanctuaryEndpoints.journalEntries, {
        body: JSON.stringify({
          intentionId: intention.id,
          reflection: journalBody,
          ritualSessionId: ritualSession.id,
          schemaVersion: "reflection-journal.v1",
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
      if (!response.ok) throw new TypeError("journal unavailable");
      const payload = (await response.json()) as unknown;
      if (!isRecord(payload) || typeof payload.id !== "string" || !uuidPattern.test(payload.id)) {
        throw new TypeError("invalid journal response");
      }
      setJournalPhase("success");
    } catch {
      setJournalPhase(navigator.onLine ? "error" : "offline");
      setJournalError(navigator.onLine ? messages.journal.error : messages.journal.offline);
    }
  };

  const themeEntries = Object.entries(messages.intention.themes) as readonly [
    SanctuaryThemeCode,
    string,
  ][];

  return (
    <div className="sanctuary-flow">
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
                    disabled={intentionPhase === "loading"}
                    key={code}
                    onClick={() => {
                      setSelectedTheme(code);
                      setIntentionError(null);
                      setIntentionPhase("idle");
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <TextAreaField
              description={messages.intention.smallActionDescription}
              id={smallActionId}
              label={messages.intention.smallActionLabel}
              maxLength={280}
              onValueChange={(value) => {
                setSmallAction(value);
                setIntentionPhase("idle");
              }}
              placeholder={messages.intention.smallActionPlaceholder}
              required
              requiredLabel={messages.intention.requiredLabel}
              rows={3}
              value={smallAction}
            />
            {intentionError === null ? null : (
              <InlineAlert message={intentionError} title={messages.intention.title} tone="error" />
            )}
            {intentionPhase === "success" ? (
              <InlineAlert
                live="polite"
                message={messages.intention.created}
                title={messages.intention.title}
                tone="success"
              />
            ) : null}
            <Button
              label={messages.intention.create}
              {...(intentionPhase === "loading"
                ? { loading: true, loadingLabel: messages.intention.creating }
                : {})}
              type="submit"
            />
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
                    message={messages.ritual.catalogDegraded}
                    title={messages.ritual.catalogErrorTitle}
                    tone="warning"
                  />
                  <Button label={messages.ritual.retry} onPress={() => void loadCatalog()} />
                </div>
              ) : null}
              <div className="ritual-item-list">
                {catalog.map((item) => {
                  const price = currencyLabel(item);
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
                        <p className="ritual-price">{price ?? messages.ritual.free}</p>
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
                              : messages.ritual.place
                        }
                        onPress={() => selectItem(item)}
                        tone={item.access === "free" || item.owned ? "primary" : "secondary"}
                      />
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
          {ritualError === null ? null : (
            <InlineAlert message={ritualError} title={messages.ritual.title} tone="error" />
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
              <span>{currencyLabel(pendingItem)}</span>
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
              maxLength={600}
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
              label={messages.journal.save}
              {...(journalPhase === "loading"
                ? { loading: true, loadingLabel: messages.journal.saving }
                : {})}
              type="submit"
            />
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
