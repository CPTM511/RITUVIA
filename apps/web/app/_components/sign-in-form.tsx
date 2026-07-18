"use client";

import { Button, createUiControlId, InlineAlert, TextField } from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { AccountMessages } from "../_i18n/account-messages";

export const authenticationStartEndpoint = "/api/v1/auth/start";

type SignInPhase =
  "error" | "idle" | "loading" | "local-ready" | "offline" | "sent" | "unavailable";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const safeCallbackUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (
      parsed.origin !== window.location.origin ||
      parsed.pathname !== "/api/v1/auth/callback" ||
      !parsed.searchParams.has("challenge") ||
      !parsed.searchParams.has("token")
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

type SignInFormProps = Readonly<{
  invalidInitial?: boolean;
  messages: AccountMessages["signIn"];
  returnTo: string;
}>;

export function SignInForm({ invalidInitial = false, messages, returnTo }: SignInFormProps) {
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phase, setPhase] = useState<SignInPhase>("idle");
  const statusRegion = useRef<HTMLElement | null>(null);
  const emailId = createUiControlId("account-email");

  useEffect(() => {
    if (phase !== "idle" && phase !== "loading") statusRegion.current?.focus();
  }, [phase]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (phase === "loading") return;
    const normalizedEmail = email.trim();
    if (!emailPattern.test(normalizedEmail)) {
      setEmailError(messages.required);
      document.getElementById(emailId)?.focus();
      return;
    }
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setCallbackUrl(null);
    setEmailError(undefined);
    setPhase("loading");
    try {
      const response = await fetch(authenticationStartEndpoint, {
        body: JSON.stringify({ email: normalizedEmail, returnTo }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      });
      if (response.status === 503) {
        setPhase("unavailable");
        return;
      }
      if (!response.ok) {
        setPhase("error");
        return;
      }
      const payload = (await response.json()) as unknown;
      const callback =
        typeof payload === "object" && payload !== null && !Array.isArray(payload)
          ? safeCallbackUrl((payload as Record<string, unknown>).callbackUrl)
          : null;
      if (callback === null) {
        setPhase("sent");
        return;
      }
      setCallbackUrl(callback);
      setPhase("local-ready");
    } catch {
      setPhase(navigator.onLine ? "error" : "offline");
    }
  };

  const alert = (() => {
    switch (phase) {
      case "error":
        return { message: messages.error, title: messages.title, tone: "error" as const };
      case "offline":
        return { message: messages.offline, title: messages.title, tone: "warning" as const };
      case "unavailable":
        return { message: messages.unavailable, title: messages.title, tone: "warning" as const };
      case "sent":
        return {
          message: messages.sentDescription,
          title: messages.sentTitle,
          tone: "success" as const,
        };
      case "local-ready":
        return {
          message: messages.localDescription,
          title: messages.localTitle,
          tone: "success" as const,
        };
      case "idle":
      case "loading":
        return null;
    }
  })();

  return (
    <div className="sign-in-layout">
      <section className="sign-in-panel">
        <header>
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1>{messages.title}</h1>
          <p className="sign-in-introduction">{messages.introduction}</p>
          <p className="privacy-note">{messages.privacy}</p>
        </header>
        {invalidInitial ? (
          <InlineAlert message={messages.invalid} title={messages.title} tone="warning" />
        ) : null}
        <form aria-busy={phase === "loading" || undefined} onSubmit={submit}>
          <TextField
            autoComplete="email"
            description={messages.emailDescription}
            {...(emailError === undefined ? {} : { error: emailError })}
            id={emailId}
            inputMode="email"
            label={messages.emailLabel}
            maxLength={254}
            onValueChange={(value) => {
              setEmail(value);
              setEmailError(undefined);
              if (phase !== "loading") setPhase("idle");
            }}
            placeholder={messages.emailPlaceholder}
            required
            requiredLabel={messages.requiredLabel}
            type="email"
            value={email}
          />
          <Button
            label={messages.submit}
            {...(phase === "loading" ? { loading: true, loadingLabel: messages.submitting } : {})}
            type="submit"
          />
        </form>
      </section>

      {alert === null ? null : (
        <aside className="sign-in-status" ref={statusRegion} tabIndex={-1}>
          <InlineAlert message={alert.message} title={alert.title} tone={alert.tone} />
          {phase === "local-ready" && callbackUrl !== null ? (
            <a className="rvt-action rvt-action--primary" href={callbackUrl}>
              {messages.localAction}
            </a>
          ) : null}
        </aside>
      )}
    </div>
  );
}
