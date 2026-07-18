"use client";

import { ActionLink, Button, InlineAlert, Skeleton, type LocalActionHref } from "@rituvia/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CommerceMessages } from "../_i18n/commerce-messages";

type CheckoutPhase = "failed" | "loading" | "missing" | "pending" | "success" | "unavailable";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveCheckoutOrderStatus = (
  value: unknown,
): Exclude<CheckoutPhase, "loading" | "missing" | "unavailable"> | null => {
  if (!isRecord(value) || typeof value.state !== "string") return null;
  if (
    [
      "canceled",
      "cancelled",
      "disputed",
      "expired",
      "failed",
      "payment_failed",
      "refunded",
      "void",
    ].includes(value.state)
  ) {
    return "failed";
  }
  if (value.state === "paid" && value.entitlementGranted === true) return "success";
  if (
    [
      "checkout_created",
      "created",
      "open",
      "paid",
      "pending",
      "pending_checkout",
      "processing",
    ].includes(value.state)
  ) {
    return "pending";
  }
  return null;
};

type CheckoutReturnProps = Readonly<{
  accountHref: LocalActionHref;
  messages: CommerceMessages["checkoutReturn"];
  orderId: string | null;
  sanctuaryHref: LocalActionHref;
}>;

export function CheckoutReturn({
  accountHref,
  messages,
  orderId,
  sanctuaryHref,
}: CheckoutReturnProps) {
  const validOrderId = orderId !== null && uuidPattern.test(orderId) ? orderId : null;
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<CheckoutPhase>(validOrderId === null ? "missing" : "loading");
  const controller = useRef<AbortController | null>(null);
  const statusRegion = useRef<HTMLElement | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (validOrderId === null) {
      setPhase("missing");
      return;
    }
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setPhase((current) => (current === "pending" ? "pending" : "loading"));
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(validOrderId)}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: nextController.signal,
      });
      if (!response.ok) {
        setPhase(response.status === 404 ? "failed" : "unavailable");
        return;
      }
      const nextPhase = resolveCheckoutOrderStatus((await response.json()) as unknown);
      setPhase(nextPhase ?? "unavailable");
      setAttempt((value) => value + 1);
    } catch {
      if (!nextController.signal.aborted) setPhase("unavailable");
    } finally {
      if (controller.current === nextController) controller.current = null;
    }
  }, [validOrderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (validOrderId !== null) void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.current?.abort();
    };
  }, [load, validOrderId]);

  useEffect(() => {
    if (phase !== "pending" || attempt >= 15) return;
    const timer = window.setTimeout(() => void load(), 2_000);
    return () => window.clearTimeout(timer);
  }, [attempt, load, phase]);

  useEffect(() => {
    if (phase !== "loading") statusRegion.current?.focus();
  }, [phase]);

  const content = (() => {
    switch (phase) {
      case "missing":
        return {
          message: messages.missing,
          title: messages.missingTitle,
          tone: "warning" as const,
        };
      case "pending":
        return { message: messages.pending, title: messages.pendingTitle, tone: "info" as const };
      case "success":
        return {
          message: messages.success,
          title: messages.successTitle,
          tone: "success" as const,
        };
      case "failed":
        return { message: messages.failed, title: messages.failedTitle, tone: "warning" as const };
      case "unavailable":
        return {
          message: messages.unavailable,
          title: messages.unavailableTitle,
          tone: "error" as const,
        };
      case "loading":
        return null;
    }
  })();

  return (
    <section className="checkout-return-panel" ref={statusRegion} tabIndex={-1}>
      <header>
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{messages.introduction}</p>
      </header>

      {phase === "loading" ? (
        <div aria-busy="true" aria-live="polite" className="checkout-return-status">
          <p>{messages.verifying}</p>
          <Skeleton lines={2} />
        </div>
      ) : null}

      {content === null ? null : (
        <div className="checkout-return-status">
          <InlineAlert message={content.message} title={content.title} tone={content.tone} />
          <p className="privacy-note">{messages.safetyNote}</p>
          <div className="checkout-return-actions">
            {phase === "pending" || phase === "unavailable" ? (
              <Button label={messages.retry} onPress={() => void load()} />
            ) : null}
            <ActionLink
              href={phase === "success" ? sanctuaryHref : accountHref}
              variant="secondary"
            >
              {phase === "success" ? messages.sanctuaryAction : messages.accountAction}
            </ActionLink>
          </div>
        </div>
      )}
    </section>
  );
}
