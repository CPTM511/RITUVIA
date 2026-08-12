"use client";

import { ActionLink, Button, InlineAlert, Skeleton, type LocalActionHref } from "@rituvia/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PrivacyControlMessages } from "../_i18n/privacy-control-messages";
import styles from "./identity-privacy.module.css";

type PrivacyControlExperienceProps = Readonly<{
  accountHref: LocalActionHref;
  messages: PrivacyControlMessages;
  signInHref: LocalActionHref;
}>;

const accountEndpoint = "/api/v1/me";
const exportEndpoint = "/api/v1/privacy/export";
const deletionEndpoint = "/api/v1/privacy/deletions";
const csrfPattern = /^[A-Za-z0-9_-]{43}$/u;

export function PrivacyControlExperience({
  accountHref,
  messages,
  signInHref,
}: PrivacyControlExperienceProps) {
  const csrfToken = useRef<string | null>(null);
  const [phase, setPhase] = useState<"error" | "loading" | "ready" | "signed-out">("loading");
  const [operation, setOperation] = useState<
    "account-delete" | "download" | "idle" | "private-delete"
  >("idle");
  const [notice, setNotice] = useState<
    "account-deleted" | "downloaded" | "error" | "private-deleted" | null
  >(null);

  const load = useCallback(async () => {
    setPhase("loading");
    setNotice(null);
    try {
      const response = await fetch(accountEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        csrfToken.current = null;
        setPhase("signed-out");
        return;
      }
      const issued = response.headers.get("x-csrf-token");
      await response.arrayBuffer();
      if (!response.ok || issued === null || !csrfPattern.test(issued)) throw new TypeError();
      csrfToken.current = issued;
      setPhase("ready");
    } catch {
      csrfToken.current = null;
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const download = async (): Promise<void> => {
    if (csrfToken.current === null || operation !== "idle") return;
    setOperation("download");
    setNotice(null);
    try {
      const headers = {
        "idempotency-key": crypto.randomUUID(),
        "x-csrf-token": csrfToken.current,
      };
      const requested = await fetch(exportEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers,
        method: "POST",
      });
      const metadata = (await requested.json()) as unknown;
      if (
        !requested.ok ||
        typeof metadata !== "object" ||
        metadata === null ||
        !("id" in metadata) ||
        typeof metadata.id !== "string" ||
        !/^[0-9a-f-]{36}$/u.test(metadata.id)
      ) {
        throw new TypeError();
      }
      const response = await fetch(`/api/v1/privacy/exports/${metadata.id}/download`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken.current },
        method: "POST",
      });
      if (!response.ok) throw new TypeError();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `rituvia-privacy-export-${metadata.id}.json`;
      anchor.href = objectUrl;
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setNotice("downloaded");
    } catch {
      setNotice("error");
    } finally {
      setOperation("idle");
    }
  };

  const remove = async (scope: "account" | "private_content"): Promise<void> => {
    if (csrfToken.current === null || operation !== "idle") return;
    const confirmation =
      scope === "account" ? messages.accountDeleteConfirm : messages.privateDeleteConfirm;
    if (!window.confirm(confirmation)) return;
    setOperation(scope === "account" ? "account-delete" : "private-delete");
    setNotice(null);
    try {
      const response = await fetch(deletionEndpoint, {
        body: JSON.stringify({ scope }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-csrf-token": csrfToken.current,
        },
        method: "POST",
      });
      if (response.status !== 202) throw new TypeError();
      await response.arrayBuffer();
      if (scope === "account") {
        csrfToken.current = null;
        setPhase("signed-out");
        setNotice("account-deleted");
      } else {
        setNotice("private-deleted");
      }
    } catch {
      setNotice("error");
    } finally {
      setOperation("idle");
    }
  };

  if (phase === "loading") {
    return (
      <section aria-busy="true" className="account-panel">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{messages.loading}</p>
        <Skeleton lines={3} />
      </section>
    );
  }
  if (phase === "signed-out") {
    return (
      <section className="account-panel">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{notice === "account-deleted" ? messages.accountDeleteSuccess : messages.signedOut}</p>
        <ActionLink href={signInHref}>{messages.signInAction}</ActionLink>
      </section>
    );
  }
  if (phase === "error") {
    return (
      <section className="account-panel">
        <InlineAlert message={messages.downloadError} title={messages.title} tone="error" />
        <Button label={messages.retry} onPress={() => void load()} />
      </section>
    );
  }

  return (
    <div className={`account-layout ${styles.privacyLayout}`}>
      <section className="account-panel">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{messages.description}</p>
        <h2>{messages.downloadTitle}</h2>
        <p>{messages.downloadDescription}</p>
        <Button
          label={messages.downloadAction}
          {...(operation === "download" ? { loading: true, loadingLabel: messages.loading } : {})}
          onPress={() => void download()}
        />
        {notice === "downloaded" ? (
          <InlineAlert
            live="polite"
            message={messages.downloadSuccess}
            title={messages.downloadTitle}
            tone="success"
          />
        ) : null}
        {notice === "error" ? (
          <InlineAlert message={messages.downloadError} title={messages.title} tone="error" />
        ) : null}
        <ActionLink href={accountHref} variant="secondary">
          {messages.backToAccount}
        </ActionLink>
      </section>
      <aside className="account-control-stack">
        <section className="account-panel">
          <h2>{messages.deletionTitle}</h2>
          <p>{messages.privateDeleteDescription}</p>
          <Button
            label={messages.privateDeleteAction}
            {...(operation === "private-delete"
              ? { loading: true, loadingLabel: messages.loading }
              : {})}
            onPress={() => void remove("private_content")}
            tone="danger"
          />
          {notice === "private-deleted" ? (
            <InlineAlert
              live="polite"
              message={messages.privateDeleteSuccess}
              title={messages.deletionTitle}
              tone="success"
            />
          ) : null}
        </section>
        <section className="account-panel">
          <h2>{messages.accountDeleteAction}</h2>
          <p>{messages.accountDeleteDescription}</p>
          <Button
            label={messages.accountDeleteAction}
            {...(operation === "account-delete"
              ? { loading: true, loadingLabel: messages.loading }
              : {})}
            onPress={() => void remove("account")}
            tone="danger"
          />
        </section>
      </aside>
    </div>
  );
}
