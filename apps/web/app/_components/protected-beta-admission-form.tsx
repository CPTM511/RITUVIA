"use client";

import { Button, createUiControlId, InlineAlert, TextField } from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { ProtectedBetaAdmissionMessages } from "../_i18n/protected-beta-admission-messages";
import type { LocalActionHref } from "@rituvia/ui";

type AdmissionPhase = "idle" | "invalid" | "loading" | "offline" | "unavailable";

const inviteId = createUiControlId("protected-beta-invite");

export function ProtectedBetaAdmissionForm({
  continueHref,
  messages,
}: Readonly<{
  continueHref: LocalActionHref;
  messages: ProtectedBetaAdmissionMessages;
}>) {
  const [inviteToken, setInviteToken] = useState("");
  const [phase, setPhase] = useState<AdmissionPhase>("idle");
  const idempotencyKey = useRef<string | null>(null);
  const statusRegion = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (phase === "invalid" || phase === "offline" || phase === "unavailable") {
      statusRegion.current?.focus();
    }
  }, [phase]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!/^[A-Za-z0-9_-]{43}$/u.test(inviteToken)) {
      setPhase("invalid");
      return;
    }
    setPhase("loading");
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/anonymous/session", {
        body: JSON.stringify({
          inviteToken,
          schemaVersion: "protected-beta-admission.v1",
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        method: "POST",
      });
      if (response.status === 204) {
        setInviteToken("");
        window.location.replace(continueHref);
        return;
      }
      setPhase(response.status === 403 || response.status === 409 ? "invalid" : "unavailable");
    } catch {
      setPhase(navigator.onLine ? "unavailable" : "offline");
    }
  };

  const alert =
    phase === "invalid"
      ? { message: messages.form.invalid, title: messages.form.label, tone: "warning" as const }
      : phase === "offline"
        ? { ...messages.status.offline, tone: "warning" as const }
        : phase === "unavailable"
          ? { ...messages.status.unavailable, tone: "warning" as const }
          : null;

  return (
    <div className="sign-in-layout">
      <form aria-busy={phase === "loading" || undefined} onSubmit={submit}>
        <TextField
          autoComplete="off"
          description={messages.form.description}
          {...(phase === "invalid" ? { error: messages.form.invalid } : {})}
          id={inviteId}
          label={messages.form.label}
          maxLength={43}
          onValueChange={(value) => {
            setInviteToken(value.trim());
            idempotencyKey.current = null;
            if (phase !== "loading") setPhase("idle");
          }}
          placeholder={messages.form.placeholder}
          required
          requiredLabel={messages.form.required}
          value={inviteToken}
        />
        <Button
          label={messages.form.submit}
          {...(phase === "loading"
            ? { loading: true, loadingLabel: messages.form.submitting }
            : {})}
          type="submit"
        />
      </form>

      {alert === null ? null : (
        <aside ref={statusRegion} tabIndex={-1}>
          <InlineAlert message={alert.message} title={alert.title} tone={alert.tone} />
        </aside>
      )}
    </div>
  );
}
