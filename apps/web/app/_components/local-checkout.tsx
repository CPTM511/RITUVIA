"use client";

import { ActionLink, Button, InlineAlert, type LocalActionHref } from "@rituvia/ui";
import { useEffect, useRef, useState } from "react";

import type { CommerceMessages } from "../_i18n/commerce-messages";

export const localCheckoutCompletionEndpoint = "/api/v1/checkout/local/complete";

const checkoutIdPattern = /^local_[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type LocalCheckoutPhase =
  | "error"
  | "idle"
  | "loading"
  | "missing"
  | "offline"
  | "session-required"
  | "success"
  | "unavailable";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const completedLocalOrderId = (value: unknown): string | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.state !== "paid" ||
    value.entitlementGranted !== true ||
    typeof value.orderId !== "string" ||
    !uuidPattern.test(value.orderId)
  ) {
    return null;
  }
  return value.orderId;
};

type LocalCheckoutProps = Readonly<{
  checkoutId: string | null;
  checkoutReturnHref: LocalActionHref;
  localCheckoutHref: LocalActionHref;
  messages: CommerceMessages["localCheckout"];
  sanctuaryHref: LocalActionHref;
  signInHref: LocalActionHref;
}>;

export function LocalCheckout({
  checkoutId,
  checkoutReturnHref,
  localCheckoutHref,
  messages,
  sanctuaryHref,
  signInHref,
}: LocalCheckoutProps) {
  const validCheckoutId =
    checkoutId !== null && checkoutIdPattern.test(checkoutId) ? checkoutId : null;
  const [phase, setPhase] = useState<LocalCheckoutPhase>(
    validCheckoutId === null ? "missing" : "idle",
  );
  const statusRegion = useRef<HTMLDivElement | null>(null);
  const reauthenticationHref =
    validCheckoutId === null
      ? signInHref
      : `${signInHref}?returnTo=${encodeURIComponent(
          `${localCheckoutHref}?checkout_id=${encodeURIComponent(validCheckoutId)}`,
        )}`;

  useEffect(() => {
    if (phase !== "idle" && phase !== "loading") statusRegion.current?.focus();
  }, [phase]);

  const complete = async (): Promise<void> => {
    if (validCheckoutId === null || phase === "loading") return;
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    try {
      const response = await fetch(localCheckoutCompletionEndpoint, {
        body: JSON.stringify({ checkoutSessionId: validCheckoutId }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      });
      if (response.status === 401) {
        setPhase("session-required");
        return;
      }
      if (response.status === 403 || response.status === 503) {
        setPhase("unavailable");
        return;
      }
      if (!response.ok) {
        setPhase("error");
        return;
      }
      const orderId = completedLocalOrderId((await response.json()) as unknown);
      if (orderId === null) {
        setPhase("error");
        return;
      }
      setPhase("success");
      window.location.assign(`${checkoutReturnHref}?order_id=${encodeURIComponent(orderId)}`);
    } catch {
      setPhase(navigator.onLine ? "error" : "offline");
    }
  };

  const alert = (() => {
    switch (phase) {
      case "missing":
        return {
          message: messages.missing,
          title: messages.missingTitle,
          tone: "warning" as const,
        };
      case "session-required":
        return {
          message: messages.sessionRequired,
          title: messages.errorTitle,
          tone: "warning" as const,
        };
      case "unavailable":
        return {
          message: messages.unavailable,
          title: messages.errorTitle,
          tone: "warning" as const,
        };
      case "offline":
      case "error":
        return { message: messages.error, title: messages.errorTitle, tone: "error" as const };
      case "success":
        return {
          message: messages.success,
          title: messages.successTitle,
          tone: "success" as const,
        };
      case "idle":
      case "loading":
        return null;
    }
  })();

  return (
    <section className="checkout-return-panel local-checkout-panel">
      <header>
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{messages.introduction}</p>
        <p className="local-checkout-test-note">{messages.testOnly}</p>
      </header>

      {validCheckoutId !== null && phase !== "success" ? (
        <Button
          label={messages.complete}
          {...(phase === "loading" ? { loading: true, loadingLabel: messages.completing } : {})}
          onPress={() => void complete()}
        />
      ) : null}

      {alert === null ? null : (
        <div className="checkout-return-status" ref={statusRegion} tabIndex={-1}>
          <InlineAlert message={alert.message} title={alert.title} tone={alert.tone} />
          <div className="checkout-return-actions">
            {phase === "session-required" ? (
              <a className="rvt-action rvt-action--primary" href={reauthenticationHref}>
                {messages.signInAction}
              </a>
            ) : null}
            {phase === "missing" || phase === "error" || phase === "unavailable" ? (
              <ActionLink href={sanctuaryHref} variant="secondary">
                {messages.sanctuaryAction}
              </ActionLink>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
