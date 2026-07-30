"use client";

import { ActionLink, Button, InlineAlert, Skeleton, type LocalActionHref } from "@rituvia/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CommerceMessages } from "../_i18n/commerce-messages";

export type CreditPackView = Readonly<{
  amountMinor: number;
  code: string;
  currencyCode: string;
  description: string;
  exactContents: readonly string[];
  title: string;
}>;

type AccountPhase = "age_required" | "loading" | "ready" | "signed_out" | "unavailable";

const csrfPattern = /^[A-Za-z0-9_-]{43}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseStripeCheckoutResponse = (value: unknown): string | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.state !== "checkout_created" ||
    typeof value.orderId !== "string" ||
    !uuidPattern.test(value.orderId) ||
    typeof value.checkoutUrl !== "string"
  ) {
    return null;
  }
  try {
    const url = new URL(value.checkoutUrl);
    return url.protocol === "https:" &&
      url.hostname === "checkout.stripe.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const storageKey = (productCode: string): string => `rituvia.stripe-checkout.${productCode}.v1`;

export const readCheckoutIdempotencyKey = (
  productCode: string,
  memory: Map<string, string>,
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  issue: () => string,
): string => {
  const remembered = memory.get(productCode);
  if (remembered !== undefined) return remembered;
  const key = storageKey(productCode);
  try {
    const stored = storage?.getItem(key);
    if (stored !== null && stored !== undefined && uuidPattern.test(stored)) {
      memory.set(productCode, stored);
      return stored;
    }
  } catch {
    // In-memory reuse still preserves retry idempotency when storage is unavailable.
  }
  const created = issue();
  if (!uuidPattern.test(created)) throw new TypeError("Checkout idempotency is unavailable.");
  memory.set(productCode, created);
  try {
    storage?.setItem(key, created);
  } catch {
    // In-memory reuse remains authoritative for this mounted checkout flow.
  }
  return created;
};

export const clearCheckoutIdempotencyKey = (
  productCode: string,
  memory: Map<string, string>,
  storage: Pick<Storage, "removeItem"> | null,
): void => {
  memory.delete(productCode);
  try {
    storage?.removeItem(storageKey(productCode));
  } catch {
    // A blocked storage API does not weaken server-side idempotency.
  }
};

type CreditPackCheckoutProps = Readonly<{
  accountHref: LocalActionHref;
  locale: string;
  messages: CommerceMessages["plans"];
  plansHref: LocalActionHref;
  products: readonly CreditPackView[];
  signInHref: LocalActionHref;
}>;

export function CreditPackCheckout({
  accountHref,
  locale,
  messages,
  plansHref,
  products,
  signInHref,
}: CreditPackCheckoutProps) {
  const [accountPhase, setAccountPhase] = useState<AccountPhase>("loading");
  const [checkoutError, setCheckoutError] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const csrfToken = useRef<string | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
  const reauthenticationHref = `${signInHref}?returnTo=${encodeURIComponent(plansHref)}`;

  const loadAccount = useCallback(async (): Promise<void> => {
    setAccountPhase("loading");
    try {
      const response = await fetch("/api/v1/me", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        setAccountPhase("signed_out");
        return;
      }
      const token = response.headers.get("x-csrf-token");
      const profile = response.ok ? ((await response.json()) as unknown) : null;
      if (
        !isRecord(profile) ||
        profile.status !== "active" ||
        profile.emailVerified !== true ||
        typeof profile.ageAttested !== "boolean" ||
        token === null ||
        !csrfPattern.test(token)
      ) {
        setAccountPhase("unavailable");
        return;
      }
      csrfToken.current = token;
      setAccountPhase(profile.ageAttested ? "ready" : "age_required");
    } catch {
      setAccountPhase("unavailable");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccount(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  const beginCheckout = async (productCode: string): Promise<void> => {
    if (accountPhase !== "ready" || csrfToken.current === null || pendingCode !== null) return;
    setCheckoutError(false);
    setPendingCode(productCode);
    try {
      let sessionStorage: Storage | null = null;
      try {
        sessionStorage = window.sessionStorage;
      } catch {
        // The mounted in-memory map remains available for safe retries.
      }
      const idempotencyKey = readCheckoutIdempotencyKey(
        productCode,
        idempotencyKeys.current,
        sessionStorage,
        () => window.crypto.randomUUID(),
      );
      const response = await fetch("/api/v1/checkout/stripe", {
        body: JSON.stringify({
          cancelPath: plansHref,
          productCode,
          successPath: `/${locale}/checkout/return`,
        }),
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-csrf-token": csrfToken.current,
        },
        method: "POST",
      });
      if (response.status === 401) {
        setAccountPhase("signed_out");
        return;
      }
      if (response.status === 403) {
        setAccountPhase("age_required");
        return;
      }
      if (response.status === 409) {
        clearCheckoutIdempotencyKey(productCode, idempotencyKeys.current, sessionStorage);
      }
      const checkoutUrl = response.ok
        ? parseStripeCheckoutResponse((await response.json()) as unknown)
        : null;
      if (checkoutUrl === null) {
        setCheckoutError(true);
        return;
      }
      window.location.assign(checkoutUrl);
    } catch {
      setCheckoutError(true);
    } finally {
      setPendingCode(null);
    }
  };

  const accountState = (() => {
    switch (accountPhase) {
      case "loading":
        return (
          <div aria-busy="true" aria-live="polite" className="credit-pack-account-state">
            <p>{messages.accountLoading}</p>
            <Skeleton lines={1} />
          </div>
        );
      case "signed_out":
        return (
          <div className="credit-pack-account-state">
            <InlineAlert
              message={messages.signInMessage}
              title={messages.signInTitle}
              tone="info"
            />
            <a className="rvt-action rvt-action--primary" href={reauthenticationHref}>
              {messages.signInAction}
            </a>
          </div>
        );
      case "age_required":
        return (
          <div className="credit-pack-account-state">
            <InlineAlert message={messages.ageMessage} title={messages.ageTitle} tone="warning" />
            <ActionLink href={accountHref}>{messages.accountAction}</ActionLink>
          </div>
        );
      case "unavailable":
        return (
          <div className="credit-pack-account-state">
            <InlineAlert
              message={messages.unavailable}
              title={messages.unavailableTitle}
              tone="error"
            />
            <Button label={messages.retry} onPress={() => void loadAccount()} />
          </div>
        );
      case "ready":
        return null;
    }
  })();

  return (
    <section aria-labelledby="credit-pack-heading" className="credit-pack-checkout">
      <h2 id="credit-pack-heading">{messages.availableTitle}</h2>
      {accountState}
      {checkoutError ? (
        <InlineAlert
          message={messages.checkoutError}
          title={messages.checkoutErrorTitle}
          tone="error"
        />
      ) : null}
      <div className="credit-pack-grid">
        {products.map((product) => (
          <article className="credit-pack-card" key={product.code}>
            <header>
              <h3>{product.title}</h3>
              <p className="credit-pack-price">
                {new Intl.NumberFormat(locale, {
                  currency: product.currencyCode,
                  style: "currency",
                }).format(product.amountMinor / 100)}
              </p>
              <p>{product.description}</p>
            </header>
            <h4>{messages.contentsTitle}</h4>
            <ul>
              {product.exactContents.map((content) => (
                <li key={content}>{content}</li>
              ))}
            </ul>
            <p>{messages.purchaseTerms}</p>
            <p>{messages.refundTerms}</p>
            <Button
              disabled={accountPhase !== "ready" || pendingCode !== null}
              label={messages.continueAction}
              {...(pendingCode === product.code
                ? { loading: true, loadingLabel: messages.continuingAction }
                : {})}
              onPress={() => void beginCheckout(product.code)}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
