"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CommerceMessages } from "../_i18n/commerce-messages";

type CatalogProduct = Readonly<{
  code: string;
  kind: string;
  localizations: readonly Readonly<{
    description: string;
    exactContents: readonly string[];
    locale: string;
    title: string;
  }>[];
  version: string;
}>;

type CatalogPrice = Readonly<{
  amountMinor: number;
  billingInterval: string;
  productCode: string;
  productVersion: string;
}>;

type Catalog = Readonly<{
  environment: string;
  prices: readonly CatalogPrice[];
  products: readonly CatalogProduct[];
}>;

type Snapshot = Readonly<{
  credits: Readonly<{
    purchased: number;
    reserved: number;
    subscription: number;
    totalAvailable: number;
  }>;
  ledger: readonly Readonly<{
    amount: number;
    createdAt: string;
    creditType: string;
    direction: string;
    id: string;
    reason: string;
  }>[];
  orders: readonly Readonly<{
    amountMinor: number;
    createdAt: string;
    entitlementGranted: boolean;
    orderId: string;
    productCode: string;
    state: string;
  }>[];
  reconciliation: Readonly<{ balanced: boolean }>;
  subscriptions: readonly Readonly<{
    cancelAtPeriodEnd: boolean;
    creditsPerMonth: number;
    currentPeriodEnd: string;
    productCode: string;
    status: string;
    subscriptionId: string;
  }>[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isString);

const parseCatalog = (value: unknown): Catalog => {
  if (
    !isRecord(value) ||
    value.environment !== "staging" ||
    !Array.isArray(value.prices) ||
    !Array.isArray(value.products) ||
    !value.prices.every(
      (price) =>
        isRecord(price) &&
        isPositiveInteger(price.amountMinor) &&
        isString(price.billingInterval) &&
        isString(price.productCode) &&
        isString(price.productVersion),
    ) ||
    !value.products.every(
      (product) =>
        isRecord(product) &&
        isString(product.code) &&
        isString(product.kind) &&
        isString(product.version) &&
        Array.isArray(product.localizations) &&
        product.localizations.every(
          (localization) =>
            isRecord(localization) &&
            isString(localization.description) &&
            isStringArray(localization.exactContents) &&
            isString(localization.locale) &&
            isString(localization.title),
        ),
    )
  ) {
    throw new TypeError("Invalid protected-staging catalog response.");
  }
  return value as Catalog;
};

const parseSnapshot = (value: unknown): Snapshot => {
  if (
    !isRecord(value) ||
    !isRecord(value.credits) ||
    !isNonnegativeInteger(value.credits.purchased) ||
    !isNonnegativeInteger(value.credits.reserved) ||
    !isNonnegativeInteger(value.credits.subscription) ||
    !isNonnegativeInteger(value.credits.totalAvailable) ||
    !Array.isArray(value.ledger) ||
    !value.ledger.every(
      (entry) =>
        isRecord(entry) &&
        isPositiveInteger(entry.amount) &&
        isString(entry.createdAt) &&
        isString(entry.creditType) &&
        isString(entry.direction) &&
        isString(entry.id) &&
        isString(entry.reason),
    ) ||
    !Array.isArray(value.orders) ||
    !value.orders.every(
      (order) =>
        isRecord(order) &&
        isPositiveInteger(order.amountMinor) &&
        isString(order.createdAt) &&
        typeof order.entitlementGranted === "boolean" &&
        isString(order.orderId) &&
        isString(order.productCode) &&
        isString(order.state),
    ) ||
    !isRecord(value.reconciliation) ||
    typeof value.reconciliation.balanced !== "boolean" ||
    !Array.isArray(value.subscriptions) ||
    !value.subscriptions.every(
      (subscription) =>
        isRecord(subscription) &&
        typeof subscription.cancelAtPeriodEnd === "boolean" &&
        isPositiveInteger(subscription.creditsPerMonth) &&
        isString(subscription.currentPeriodEnd) &&
        isString(subscription.productCode) &&
        isString(subscription.status) &&
        isString(subscription.subscriptionId),
    )
  ) {
    throw new TypeError("Invalid private commerce response.");
  }
  return value as Snapshot;
};

const formatUsd = (amountMinor: number): string =>
  new Intl.NumberFormat("en", { currency: "USD", style: "currency" }).format(amountMinor / 100);

const translatedValue = (
  values: Readonly<Record<string, string>>,
  key: string,
  fallback: string,
): string =>
  Object.entries(values)
    .find(([candidate]) => candidate === key)
    ?.at(1) ?? fallback;

const productName = (productCode: string, messages: CommerceMessages["recoveryCommerce"]): string =>
  translatedValue(messages.productNames, productCode, messages.plansTitle);

const statusName = (status: string, messages: CommerceMessages["recoveryCommerce"]): string =>
  translatedValue(messages.statusLabels, status, messages.loadError);

export function RecoveryPlans({
  messages,
  signInHref,
}: Readonly<{ messages: CommerceMessages["recoveryCommerce"]; signInHref: string }>) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [phase, setPhase] = useState<"error" | "loading" | "ready">("loading");
  const [signedIn, setSignedIn] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const csrfToken = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/v1/catalog", {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      }),
      fetch("/api/v1/me", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: controller.signal,
      }),
    ])
      .then(async ([catalogResponse, accountResponse]) => {
        if (!catalogResponse.ok) throw new TypeError();
        const nextCatalog = parseCatalog((await catalogResponse.json()) as unknown);
        const issued = accountResponse.headers.get("x-csrf-token");
        csrfToken.current = accountResponse.ok && issued !== null ? issued : null;
        setSignedIn(csrfToken.current !== null);
        setCatalog(nextCatalog);
        setPhase("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhase("error");
      });
    return () => controller.abort();
  }, []);

  const checkout = useCallback(
    async (productCode: string): Promise<void> => {
      if (csrfToken.current === null || submitting !== null) return;
      setSubmitting(productCode);
      try {
        const response = await fetch("/api/v1/checkout/stripe", {
          body: JSON.stringify({
            cancelPath: "/en/plans",
            productCode,
            successPath: "/en/checkout/return",
          }),
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
            "x-csrf-token": csrfToken.current,
          },
          method: "POST",
        });
        const body = (await response.json()) as unknown;
        if (!response.ok || !isRecord(body) || typeof body.checkoutUrl !== "string") {
          throw new TypeError();
        }
        const checkoutUrl = new URL(body.checkoutUrl);
        if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
          throw new TypeError();
        }
        window.location.assign(checkoutUrl.toString());
      } catch {
        setSubmitting("error");
      }
    },
    [submitting],
  );

  const products =
    catalog?.products.filter(({ kind }) => kind === "credit_pack" || kind === "plus_plan") ?? [];

  return (
    <section aria-busy={phase === "loading"} className="golden-shell-container">
      <p className="eyebrow">{messages.stagingEyebrow}</p>
      <h1>{messages.plansTitle}</h1>
      <p>{messages.plansIntroduction}</p>
      <p className="privacy-note">{messages.safetyNote}</p>
      {phase === "loading" ? <p role="status">{messages.loading}</p> : null}
      {phase === "error" ? <p role="alert">{messages.loadError}</p> : null}
      {phase === "ready" && !signedIn ? (
        <p className="privacy-note">
          {messages.accountRequired} <a href={signInHref}>{messages.signIn}</a>
        </p>
      ) : null}
      <div className="golden-grid-three">
        {products.map((product) => {
          const price = catalog?.prices.find(
            (candidate) =>
              candidate.productCode === product.code &&
              candidate.productVersion === product.version,
          );
          const copy = product.localizations.find(({ locale }) => locale === "en");
          if (price === undefined || copy === undefined) return null;
          return (
            <article className="golden-value-card" key={product.code}>
              <h2>{copy.title}</h2>
              <p className="golden-badge credit">
                {formatUsd(price.amountMinor)}
                {price.billingInterval === "month" ? ` · ${messages.priceMonthSuffix}` : null}
                {price.billingInterval === "year" ? ` · ${messages.priceYearSuffix}` : null}
              </p>
              <p>{copy.description}</p>
              <ul>
                {copy.exactContents.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <button
                className="rvt-action rvt-action--primary"
                disabled={!signedIn || submitting !== null}
                onClick={() => void checkout(product.code)}
                type="button"
              >
                {submitting === product.code ? messages.checkoutPending : messages.checkout}
              </button>
            </article>
          );
        })}
      </div>
      {submitting === "error" ? <p role="alert">{messages.checkoutError}</p> : null}
    </section>
  );
}

export function RecoveryCommercialAccount({
  messages,
  signInHref,
  view,
}: Readonly<{
  messages: CommerceMessages["recoveryCommerce"];
  signInHref: string;
  view: "billing" | "orders";
}>) {
  const [phase, setPhase] = useState<"error" | "loading" | "ready" | "signed-out">("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/commerce/account", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404 || response.status === 401) {
          setPhase("signed-out");
          return;
        }
        if (!response.ok) throw new TypeError();
        setSnapshot(parseSnapshot((await response.json()) as unknown));
        setPhase("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhase("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-busy={phase === "loading"} className="golden-shell-container">
      <p className="eyebrow">{messages.stagingEyebrow}</p>
      <h1>{view === "billing" ? messages.billingTitle : messages.ordersTitle}</h1>
      <p className="privacy-note">{messages.safetyNote}</p>
      {phase === "loading" ? <p role="status">{messages.loading}</p> : null}
      {phase === "error" ? <p role="alert">{messages.loadError}</p> : null}
      {phase === "signed-out" ? (
        <p>
          {messages.accountRequired} <a href={signInHref}>{messages.signIn}</a>
        </p>
      ) : null}
      {phase === "ready" && snapshot !== null && view === "billing" ? (
        <>
          <div className="golden-value-card">
            <strong>{snapshot.credits.totalAvailable}</strong> {messages.creditsLabel}
            <p>
              {messages.creditsPurchasedLabel} {snapshot.credits.purchased} ·{" "}
              {messages.creditsPlusLabel} {snapshot.credits.subscription} ·{" "}
              {messages.creditsReservedLabel} {snapshot.credits.reserved}
            </p>
          </div>
          <p className="privacy-note">
            {snapshot.reconciliation.balanced
              ? messages.reconciliationPass
              : messages.reconciliationFail}
          </p>
          <div className="golden-grid-three">
            {snapshot.subscriptions.length === 0 ? <p>{messages.billingEmpty}</p> : null}
            {snapshot.subscriptions.map((subscription) => (
              <article className="golden-value-card" key={subscription.subscriptionId}>
                <h2>{productName(subscription.productCode, messages)}</h2>
                <p>
                  {messages.statusLabel}: {statusName(subscription.status, messages)}
                </p>
                <p>
                  {subscription.creditsPerMonth} {messages.subscriptionCredits}
                </p>
                <p>
                  {messages.subscriptionPeriodEnd}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en")}
                </p>
                {subscription.cancelAtPeriodEnd ? <p>{messages.cancellationScheduled}</p> : null}
              </article>
            ))}
          </div>
          <h2>{messages.ledgerTitle}</h2>
          <ol>
            {snapshot.ledger.map((entry) => (
              <li key={entry.id}>
                <strong>
                  {entry.direction === "grant" || entry.direction === "release"
                    ? messages.ledgerAdded
                    : messages.ledgerRemoved}{" "}
                  {entry.amount}
                </strong>{" "}
                ·{" "}
                {entry.creditType === "purchased_credit"
                  ? messages.ledgerPurchased
                  : entry.creditType === "subscription_credit"
                    ? messages.ledgerSubscription
                    : entry.creditType === "refund_adjustment"
                      ? messages.ledgerAdjustment
                      : messages.ledgerOther}
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {phase === "ready" && snapshot !== null && view === "orders" ? (
        <div className="golden-grid-three">
          {snapshot.orders.length === 0 ? <p>{messages.ordersEmpty}</p> : null}
          {snapshot.orders.map((order) => (
            <article className="golden-value-card" key={order.orderId}>
              <h2>{productName(order.productCode, messages)}</h2>
              <p>
                {formatUsd(order.amountMinor)} · {statusName(order.state, messages)}
              </p>
              <p>{new Date(order.createdAt).toLocaleString("en")}</p>
              <p>
                {order.entitlementGranted
                  ? messages.fulfillmentVerified
                  : messages.fulfillmentAwaiting}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
