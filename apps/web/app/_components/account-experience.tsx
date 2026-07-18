"use client";

import {
  ActionLink,
  Button,
  Checkbox,
  createUiControlId,
  InlineAlert,
  Skeleton,
  TextField,
  type LocalActionHref,
} from "@rituvia/ui";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AccountMessages } from "../_i18n/account-messages";

export const currentAccountEndpoint = "/api/v1/me";
export const accountReadingsEndpoint = "/api/v1/me/readings";
export const accountLogoutEndpoint = "/api/v1/auth/logout";

type AccountSummary = Readonly<{
  adultAttested: boolean;
  displayName: string | null;
  emailVerified: boolean;
  id: string;
  locale: "en";
  profileVersion: number;
  status: "active";
  timeZone: string;
}>;

type AccountPhase = "error" | "loading" | "ready" | "signed-out";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const parseAccountSummary = (value: unknown): AccountSummary | null => {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    value.status !== "active" ||
    (typeof value.displayName !== "string" && value.displayName !== null) ||
    (typeof value.displayName === "string" &&
      (value.displayName.length < 1 || value.displayName.length > 80)) ||
    value.locale !== "en" ||
    typeof value.timeZone !== "string" ||
    value.timeZone.length < 1 ||
    value.timeZone.length > 64 ||
    value.emailVerified !== true ||
    typeof value.ageAttested !== "boolean" ||
    !Number.isSafeInteger(value.profileVersion) ||
    (value.profileVersion as number) < 1
  ) {
    return null;
  }
  return Object.freeze({
    adultAttested: value.ageAttested,
    displayName: value.displayName,
    emailVerified: true,
    id: value.id,
    locale: "en",
    profileVersion: value.profileVersion as number,
    status: "active",
    timeZone: value.timeZone,
  });
};

const readingCountFromResponse = (value: unknown): number | null => {
  if (!isRecord(value) || !Array.isArray(value.readings)) return null;
  return value.readings.length;
};

type AccountNavigationProps = Readonly<{
  accountHref: LocalActionHref;
  accountLabel: string;
  loadingLabel: string;
  signInHref: LocalActionHref;
  signInLabel: string;
}>;

export function AccountNavigation({
  accountHref,
  accountLabel,
  loadingLabel,
  signInHref,
  signInLabel,
}: AccountNavigationProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(currentAccountEndpoint, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        setAuthenticated(response.ok);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAuthenticated(false);
      });
    return () => controller.abort();
  }, []);

  const href = authenticated === false ? signInHref : accountHref;
  const label = authenticated === null ? loadingLabel : authenticated ? accountLabel : signInLabel;

  return (
    <a className="rvt-action rvt-action--secondary account-navigation-link" href={href}>
      {label}
    </a>
  );
}

type AccountExperienceProps = Readonly<{
  messages: AccountMessages["account"];
  sanctuaryHref: LocalActionHref;
  signInHref: LocalActionHref;
}>;

export function AccountExperience({ messages, sanctuaryHref, signInHref }: AccountExperienceProps) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [ageChecked, setAgeChecked] = useState(false);
  const [ageStatus, setAgeStatus] = useState<"error" | "idle" | "saving" | "success">("idle");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<AccountPhase>("loading");
  const [profileStatus, setProfileStatus] = useState<"error" | "idle" | "saving" | "success">(
    "idle",
  );
  const [readingCount, setReadingCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");
  const statusRegion = useRef<HTMLElement | null>(null);
  const ageId = createUiControlId("account-age-confirmation");
  const displayNameId = createUiControlId("account-display-name");
  const timeZoneId = createUiControlId("account-time-zone");

  const loadAccount = useCallback(async (): Promise<void> => {
    setError(null);
    setPhase("loading");
    try {
      const response = await fetch(currentAccountEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (!response.ok) throw new TypeError("account unavailable");
      const parsed = parseAccountSummary((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid account response");
      setAccount(parsed);
      setDisplayName(parsed.displayName ?? "");
      setTimeZone(parsed.timeZone);
      setPhase("ready");

      void fetch(accountReadingsEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      })
        .then(async (readingsResponse) =>
          readingsResponse.ok
            ? readingCountFromResponse((await readingsResponse.json()) as unknown)
            : null,
        )
        .then(setReadingCount)
        .catch(() => setReadingCount(null));
    } catch {
      setAccount(null);
      setError(messages.error);
      setPhase("error");
    }
  }, [messages.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccount(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  useEffect(() => {
    if (phase === "error" || phase === "signed-out") statusRegion.current?.focus();
  }, [phase]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (account === null || profileStatus === "saving") return;
    setProfileStatus("saving");
    try {
      const response = await fetch(currentAccountEndpoint, {
        body: JSON.stringify({
          displayName: displayName.trim() === "" ? null : displayName,
          locale: "en",
          profileVersion: account.profileVersion,
          schemaVersion: 1,
          timeZone,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new TypeError("profile update failed");
      const parsed = parseAccountSummary((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid profile response");
      setAccount(parsed);
      setDisplayName(parsed.displayName ?? "");
      setTimeZone(parsed.timeZone);
      setProfileStatus("success");
    } catch {
      setProfileStatus("error");
    }
  };

  const signOut = async (): Promise<void> => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch(accountLogoutEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        method: "POST",
      });
      if (!response.ok) throw new TypeError("sign-out failed");
      window.location.assign(signInHref);
    } catch {
      setError(messages.signOutError);
      setSigningOut(false);
    }
  };

  const saveAgeConfirmation = async (): Promise<void> => {
    if (account === null || account.adultAttested || !ageChecked || ageStatus === "saving") return;
    setAgeStatus("saving");
    try {
      const response = await fetch(currentAccountEndpoint, {
        body: JSON.stringify({
          ageAttested: true,
          agePolicyVersion: "age-18.local.v1",
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new TypeError("age update failed");
      if (response.status === 204) {
        setAccount(Object.freeze({ ...account, adultAttested: true }));
      } else {
        const parsed = parseAccountSummary((await response.json()) as unknown);
        if (parsed === null) throw new TypeError("invalid age response");
        setAccount(parsed);
      }
      setAgeChecked(false);
      setAgeStatus("success");
    } catch {
      setAgeStatus("error");
    }
  };

  if (phase === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className="account-panel">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.title}</h1>
        <p>{messages.loading}</p>
        <Skeleton lines={3} />
      </section>
    );
  }

  if (phase === "signed-out") {
    return (
      <section className="account-panel" ref={statusRegion} tabIndex={-1}>
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1>{messages.signedOutTitle}</h1>
        <p>{messages.signedOutDescription}</p>
        <ActionLink href={signInHref}>{messages.signInAction}</ActionLink>
      </section>
    );
  }

  if (phase === "error" || account === null) {
    return (
      <section className="account-panel" ref={statusRegion} tabIndex={-1}>
        <InlineAlert message={error ?? messages.error} title={messages.errorTitle} tone="error" />
        <Button label={messages.retry} onPress={() => void loadAccount()} />
      </section>
    );
  }

  return (
    <div className="account-layout">
      <section className="account-panel account-profile-panel">
        <header>
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1>{messages.title}</h1>
          <p>{messages.introduction}</p>
        </header>
        <form aria-busy={profileStatus === "saving" || undefined} onSubmit={saveProfile}>
          <TextField
            autoComplete="name"
            description={messages.displayNameDescription}
            id={displayNameId}
            label={messages.displayNameLabel}
            maxLength={80}
            onValueChange={(value) => {
              setDisplayName(value);
              setProfileStatus("idle");
            }}
            value={displayName}
          />
          <TextField
            description={messages.profileDescription}
            id={timeZoneId}
            label={messages.timeZoneLabel}
            maxLength={64}
            onValueChange={(value) => {
              setTimeZone(value);
              setProfileStatus("idle");
            }}
            required
            requiredLabel={messages.requiredLabel}
            value={timeZone}
          />
          <div className="account-status-list" role="list">
            <span role="listitem">{messages.verified}</span>
            <span role="listitem">
              {account.adultAttested ? messages.adultConfirmed : messages.adultNotConfirmed}
            </span>
          </div>
          {profileStatus === "success" ? (
            <InlineAlert
              live="polite"
              message={messages.saved}
              title={messages.profileTitle}
              tone="success"
            />
          ) : null}
          {profileStatus === "error" ? (
            <InlineAlert message={messages.saveError} title={messages.profileTitle} tone="error" />
          ) : null}
          <div className="account-actions">
            <Button
              label={messages.save}
              {...(profileStatus === "saving"
                ? { loading: true, loadingLabel: messages.saving }
                : {})}
              type="submit"
            />
            <Button
              label={messages.signOut}
              {...(signingOut ? { loading: true, loadingLabel: messages.signingOut } : {})}
              onPress={() => void signOut()}
              tone="quiet"
            />
          </div>
          {error === null ? null : (
            <InlineAlert message={error} title={messages.errorTitle} tone="error" />
          )}
        </form>
        <section className="account-age-panel" aria-labelledby="account-age-title">
          <h2 id="account-age-title">{messages.ageTitle}</h2>
          <p>{messages.ageDescription}</p>
          {account.adultAttested ? (
            <InlineAlert
              live="polite"
              message={ageStatus === "success" ? messages.ageSaved : messages.adultConfirmed}
              title={messages.ageTitle}
              tone="success"
            />
          ) : (
            <>
              <Checkbox
                checked={ageChecked}
                {...(ageStatus === "error" ? { error: messages.ageError } : {})}
                id={ageId}
                label={messages.ageLabel}
                onCheckedChange={(checked) => {
                  setAgeChecked(checked);
                  setAgeStatus("idle");
                }}
                required
                requiredLabel={messages.requiredLabel}
              />
              <Button
                disabled={!ageChecked}
                label={messages.ageSave}
                {...(ageStatus === "saving"
                  ? { loading: true, loadingLabel: messages.ageSaving }
                  : {})}
                onPress={() => void saveAgeConfirmation()}
                tone="secondary"
              />
            </>
          )}
        </section>
      </section>

      <aside
        className="account-panel account-history-panel"
        aria-labelledby="account-history-title"
      >
        <p className="eyebrow">{messages.readingsTitle}</p>
        <h2 id="account-history-title">
          {readingCount === null || readingCount === 0
            ? messages.readingsEmpty
            : messages.readingsCount.replace(
                "{count}",
                new Intl.NumberFormat("en").format(readingCount),
              )}
        </h2>
        <p>{messages.readingsDescription}</p>
        <ActionLink href={sanctuaryHref}>{messages.sanctuaryAction}</ActionLink>
      </aside>
    </div>
  );
}
