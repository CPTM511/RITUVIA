"use client";

import { accountConsentNoticeVersionFor, type AccountConsentPurpose } from "@rituvia/domain";
import { createLocaleFormatter } from "@rituvia/i18n/locale";
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
import type { Locale } from "../_i18n/routing";
import {
  parseAccountConsentControlResponse,
  parseAccountConsentControls,
  parseAccountHistoryPage,
  parseAccountSessionList,
  type AccountConsentControl,
  type AccountHistorySummary,
  type AccountSessionSummary,
} from "./account-control";
import { storeTarotReadingResumeId } from "./tarot-reading-resume-storage";

export const currentAccountEndpoint = "/api/v1/me";
export const accountHistoryEndpoint = "/api/v1/me/history";
export const accountReadingsEndpoint = "/api/v1/me/readings";
export const accountSessionsEndpoint = "/api/v1/me/sessions";
export const accountConsentsEndpoint = "/api/v1/me/consents";
export const accountLogoutEndpoint = "/api/v1/auth/logout";
export const accountLogoutAllEndpoint = "/api/v1/auth/logout-all";
const accountCsrfTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

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

const formatAccountInstant = (locale: Locale, value: string, timeZone: string): string => {
  try {
    return createLocaleFormatter({ locale, timeZone }).date(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return createLocaleFormatter({ locale, timeZone: "UTC" }).date(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
};

const accountHistoryLabel = (
  item: AccountHistorySummary,
  messages: AccountMessages["account"],
): string => {
  switch (item.resourceType) {
    case "intention":
      return messages.historyIntention;
    case "journal":
      return messages.historyJournal;
    case "reading":
      return item.readingType === "one_card" ? messages.historyOneCard : messages.historyThreeCard;
    case "revisit":
      return messages.historyRevisit;
    case "ritual":
      return messages.historyRitual;
  }
};

const accountHistoryStatusLabel = (
  status: AccountHistorySummary["status"],
  messages: AccountMessages["account"],
): string => {
  switch (status) {
    case "abandoned":
      return messages.historyStatusAbandoned;
    case "active":
    case "facts_ready":
      return messages.historyStatusActive;
    case "archived":
      return messages.historyStatusArchived;
    case "completed":
      return messages.historyStatusCompleted;
    case "paused":
      return messages.historyStatusPaused;
    case "scheduled":
      return messages.historyStatusScheduled;
  }
};

const accountReadingThemeLabel = (
  themeCode: NonNullable<AccountHistorySummary["themeCode"]>,
  messages: AccountMessages["account"],
): string => {
  switch (themeCode) {
    case "courage":
      return messages.readingThemes.courage;
    case "creativity":
      return messages.readingThemes.creativity;
    case "gratitude":
      return messages.readingThemes.gratitude;
    case "grief":
      return messages.readingThemes.grief;
    case "open_reflection":
      return messages.readingThemes.open_reflection;
    case "relationships":
      return messages.readingThemes.relationships;
    case "release":
      return messages.readingThemes.release;
    case "self":
      return messages.readingThemes.self;
    case "transition":
      return messages.readingThemes.transition;
    case "work":
      return messages.readingThemes.work;
  }
};

export const parseAccountSummary = (value: unknown): AccountSummary | null => {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    value.status !== "active" ||
    (typeof value.displayName !== "string" && value.displayName !== null) ||
    (typeof value.displayName === "string" &&
      (value.displayName.length < 1 || Array.from(value.displayName).length > 80)) ||
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
      .then(async (response) => {
        if (!response.ok) {
          await response.arrayBuffer();
          return false;
        }
        return parseAccountSummary((await response.json()) as unknown) !== null;
      })
      .then(setAuthenticated)
      .catch(() => {
        if (!controller.signal.aborted) setAuthenticated(false);
      });
    return () => controller.abort();
  }, []);

  const href = authenticated === false ? signInHref : accountHref;
  const label = authenticated === null ? loadingLabel : authenticated ? accountLabel : signInLabel;

  return (
    <a
      aria-busy={authenticated === null ? true : undefined}
      className="rvt-action rvt-action--secondary account-navigation-link"
      href={href}
    >
      {label}
    </a>
  );
}

type AccountExperienceProps = Readonly<{
  locale: Locale;
  messages: AccountMessages["account"];
  oneCardHref: LocalActionHref;
  sanctuaryHref: LocalActionHref;
  signInHref: LocalActionHref;
  threeCardHref: LocalActionHref;
}>;

export function AccountExperience({
  locale,
  messages,
  oneCardHref,
  sanctuaryHref,
  signInHref,
  threeCardHref,
}: AccountExperienceProps) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [ageChecked, setAgeChecked] = useState(false);
  const [ageStatus, setAgeStatus] = useState<"error" | "idle" | "saving" | "success">("idle");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<AccountPhase>("loading");
  const [profileStatus, setProfileStatus] = useState<
    "conflict" | "error" | "idle" | "saving" | "success"
  >("idle");
  const [consents, setConsents] = useState<readonly AccountConsentControl[]>([]);
  const [consentPhase, setConsentPhase] = useState<"error" | "loading" | "ready">("loading");
  const [consentSavingPurpose, setConsentSavingPurpose] = useState<AccountConsentPurpose | null>(
    null,
  );
  const [consentStatus, setConsentStatus] = useState<"error" | "idle" | "success">("idle");
  const [history, setHistory] = useState<readonly AccountHistorySummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyPhase, setHistoryPhase] = useState<"error" | "loading" | "ready">("loading");
  const [historyActionError, setHistoryActionError] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [sessionActionStatus, setSessionActionStatus] = useState<"error" | "idle" | "success">(
    "idle",
  );
  const [sessions, setSessions] = useState<readonly AccountSessionSummary[]>([]);
  const [sessionsPhase, setSessionsPhase] = useState<"error" | "loading" | "ready">("loading");
  const [signingOut, setSigningOut] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");
  const csrfToken = useRef<string | null>(null);
  const statusRegion = useRef<HTMLElement | null>(null);
  const ageId = createUiControlId("account-age-confirmation");
  const displayNameId = createUiControlId("account-display-name");
  const timeZoneId = createUiControlId("account-time-zone");
  const analyticsConsentId = createUiControlId("account-consent-analytics");
  const personalizationConsentId = createUiControlId("account-consent-ai-personalization");
  const modelImprovementConsentId = createUiControlId("account-consent-model-improvement");

  const loadConsents = useCallback(async (): Promise<void> => {
    setConsentPhase("loading");
    try {
      const response = await fetch(accountConsentsEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        csrfToken.current = null;
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (!response.ok) throw new TypeError("consents unavailable");
      const parsed = parseAccountConsentControls((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid consent response");
      setConsents(parsed);
      setConsentPhase("ready");
    } catch {
      setConsentPhase("error");
    }
  }, []);

  const loadHistory = useCallback(async (cursor: string | null = null): Promise<void> => {
    setHistoryPhase("loading");
    try {
      const query = new URLSearchParams({ limit: "10" });
      if (cursor !== null) query.set("cursor", cursor);
      const response = await fetch(`${accountHistoryEndpoint}?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        csrfToken.current = null;
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (!response.ok) throw new TypeError("history unavailable");
      const parsed = parseAccountHistoryPage((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid history response");
      setHistory((current) =>
        cursor === null
          ? parsed.items
          : Object.freeze([
              ...current,
              ...parsed.items.filter(
                (candidate) =>
                  !current.some(
                    (item) =>
                      item.resourceId === candidate.resourceId &&
                      item.resourceType === candidate.resourceType,
                  ),
              ),
            ]),
      );
      setHistoryCursor(parsed.nextCursor);
      setHistoryPhase("ready");
    } catch {
      setHistoryPhase("error");
    }
  }, []);

  const loadSessions = useCallback(async (): Promise<void> => {
    setSessionsPhase("loading");
    try {
      const response = await fetch(accountSessionsEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        csrfToken.current = null;
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (!response.ok) throw new TypeError("sessions unavailable");
      const parsed = parseAccountSessionList((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid sessions response");
      setSessions(parsed);
      setSessionsPhase("ready");
    } catch {
      setSessionsPhase("error");
    }
  }, []);

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
        csrfToken.current = null;
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (!response.ok) throw new TypeError("account unavailable");
      const issuedCsrfToken = response.headers.get("x-csrf-token");
      if (issuedCsrfToken === null || !accountCsrfTokenPattern.test(issuedCsrfToken)) {
        throw new TypeError("account csrf unavailable");
      }
      const parsed = parseAccountSummary((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid account response");
      setAccount(parsed);
      setDisplayName(parsed.displayName ?? "");
      setTimeZone(parsed.timeZone);
      csrfToken.current = issuedCsrfToken;
      setPhase("ready");
      setSessionActionStatus("idle");
      setConsentStatus("idle");
      void loadConsents();
      void loadHistory();
      void loadSessions();
    } catch {
      csrfToken.current = null;
      setAccount(null);
      setError(messages.error);
      setPhase("error");
    }
  }, [loadConsents, loadHistory, loadSessions, messages.error]);

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
    if (csrfToken.current === null) {
      setProfileStatus("error");
      return;
    }
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
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-csrf-token": csrfToken.current,
        },
        method: "PATCH",
      });
      if (response.status === 409) {
        setProfileStatus("conflict");
        return;
      }
      if (!response.ok) throw new TypeError("profile update failed");
      const issuedCsrfToken = response.headers.get("x-csrf-token");
      if (issuedCsrfToken === null || !accountCsrfTokenPattern.test(issuedCsrfToken)) {
        throw new TypeError("account csrf unavailable");
      }
      const parsed = parseAccountSummary((await response.json()) as unknown);
      if (parsed === null) throw new TypeError("invalid profile response");
      csrfToken.current = issuedCsrfToken;
      setAccount(parsed);
      setDisplayName(parsed.displayName ?? "");
      setTimeZone(parsed.timeZone);
      setProfileStatus("success");
    } catch {
      setProfileStatus("error");
    }
  };

  const updateConsent = async (purpose: AccountConsentPurpose, granted: boolean): Promise<void> => {
    if (csrfToken.current === null || consentSavingPurpose !== null) {
      setConsentStatus("error");
      return;
    }
    setConsentSavingPurpose(purpose);
    setConsentStatus("idle");
    try {
      const response = await fetch(accountConsentsEndpoint, {
        body: JSON.stringify({
          granted,
          noticeVersion: accountConsentNoticeVersionFor(purpose),
          purpose,
          schemaVersion: 1,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-csrf-token": csrfToken.current,
        },
        method: "POST",
      });
      if (!response.ok) throw new TypeError("consent update failed");
      const parsed = parseAccountConsentControlResponse((await response.json()) as unknown);
      if (parsed === null || parsed.purpose !== purpose) {
        throw new TypeError("invalid consent update response");
      }
      setConsents((current) =>
        Object.freeze(current.map((control) => (control.purpose === purpose ? parsed : control))),
      );
      setConsentStatus("success");
    } catch {
      setConsentStatus("error");
    } finally {
      setConsentSavingPurpose(null);
    }
  };

  const signOut = async (): Promise<void> => {
    if (signingOut) return;
    if (csrfToken.current === null) {
      setError(messages.signOutError);
      return;
    }
    setSigningOut(true);
    try {
      const response = await fetch(accountLogoutEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken.current },
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
    if (csrfToken.current === null) {
      setAgeStatus("error");
      return;
    }
    setAgeStatus("saving");
    try {
      const response = await fetch(currentAccountEndpoint, {
        body: JSON.stringify({
          ageAttested: true,
          agePolicyVersion: "age-18.local.v1",
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-csrf-token": csrfToken.current,
        },
        method: "PATCH",
      });
      if (!response.ok) throw new TypeError("age update failed");
      if (response.status === 204) {
        setAccount(Object.freeze({ ...account, adultAttested: true }));
      } else {
        const issuedCsrfToken = response.headers.get("x-csrf-token");
        if (issuedCsrfToken === null || !accountCsrfTokenPattern.test(issuedCsrfToken)) {
          throw new TypeError("account csrf unavailable");
        }
        const parsed = parseAccountSummary((await response.json()) as unknown);
        if (parsed === null) throw new TypeError("invalid age response");
        csrfToken.current = issuedCsrfToken;
        setAccount(parsed);
      }
      setAgeChecked(false);
      setAgeStatus("success");
    } catch {
      setAgeStatus("error");
    }
  };

  const revokeSession = async (sessionId: string): Promise<void> => {
    if (
      revokingSessionId !== null ||
      csrfToken.current === null ||
      !window.confirm(messages.sessionRevokeConfirm)
    ) {
      return;
    }
    setRevokingSessionId(sessionId);
    setSessionActionStatus("idle");
    try {
      const response = await fetch(`${accountSessionsEndpoint}/${sessionId}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken.current },
        method: "DELETE",
      });
      if (response.status === 401) {
        csrfToken.current = null;
        setAccount(null);
        setPhase("signed-out");
        return;
      }
      if (response.status !== 204 && response.status !== 404) {
        throw new TypeError("session revoke failed");
      }
      await loadSessions();
      setSessionActionStatus("success");
    } catch {
      setSessionActionStatus("error");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const signOutAll = async (): Promise<void> => {
    if (
      signingOutAll ||
      csrfToken.current === null ||
      !window.confirm(messages.signOutAllConfirm)
    ) {
      return;
    }
    setSigningOutAll(true);
    try {
      const response = await fetch(accountLogoutAllEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken.current },
        method: "POST",
      });
      if (!response.ok) throw new TypeError("all-session sign-out failed");
      window.location.assign(signInHref);
    } catch {
      setError(messages.signOutAllError);
      setSigningOutAll(false);
    }
  };

  const openReading = (item: AccountHistorySummary): void => {
    if (
      item.resourceType !== "reading" ||
      item.readingType === null ||
      !storeTarotReadingResumeId(window.sessionStorage, item.readingType, item.resourceId)
    ) {
      setHistoryActionError(true);
      return;
    }
    setHistoryActionError(false);
    window.location.assign(item.readingType === "one_card" ? oneCardHref : threeCardHref);
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
          {profileStatus === "conflict" ? (
            <InlineAlert
              message={messages.saveConflict}
              title={messages.profileTitle}
              tone="warning"
            />
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

      <aside className="account-control-stack" aria-label={messages.title}>
        <section
          className="account-panel account-consent-panel"
          aria-labelledby="account-consent-title"
        >
          <p className="eyebrow">{messages.consentEyebrow}</p>
          <h2 id="account-consent-title">{messages.consentTitle}</h2>
          <p>{messages.consentDescription}</p>
          {consentPhase === "loading" ? (
            <div aria-busy="true" aria-live="polite">
              <p>{messages.consentLoading}</p>
              <Skeleton lines={2} />
            </div>
          ) : null}
          {consentPhase === "error" ? (
            <div className="account-control-status">
              <InlineAlert
                message={messages.consentError}
                title={messages.consentErrorTitle}
                tone="error"
              />
              <Button
                label={messages.consentRetry}
                onPress={() => void loadConsents()}
                tone="secondary"
              />
            </div>
          ) : null}
          {consentPhase === "ready" ? (
            <div className="account-consent-list">
              <Checkbox
                checked={
                  consents.find((control) => control.purpose === "optional_product_analytics")
                    ?.granted ?? false
                }
                description={messages.analyticsConsentDescription}
                disabled={consentSavingPurpose !== null}
                id={analyticsConsentId}
                label={messages.analyticsConsentLabel}
                onCheckedChange={(checked) =>
                  void updateConsent("optional_product_analytics", checked)
                }
              />
              <Checkbox
                checked={
                  consents.find((control) => control.purpose === "ai_personalization")?.granted ??
                  false
                }
                description={messages.personalizationConsentDescription}
                disabled={consentSavingPurpose !== null}
                id={personalizationConsentId}
                label={messages.personalizationConsentLabel}
                onCheckedChange={(checked) => void updateConsent("ai_personalization", checked)}
              />
              <Checkbox
                checked={
                  consents.find((control) => control.purpose === "model_improvement")?.granted ??
                  false
                }
                description={messages.modelImprovementConsentDescription}
                disabled={consentSavingPurpose !== null}
                id={modelImprovementConsentId}
                label={messages.modelImprovementConsentLabel}
                onCheckedChange={(checked) => void updateConsent("model_improvement", checked)}
              />
              <p className="account-consent-note">{messages.consentSeparationNote}</p>
            </div>
          ) : null}
          {consentSavingPurpose !== null ? (
            <p aria-live="polite">{messages.consentSaving}</p>
          ) : null}
          {consentStatus === "success" ? (
            <InlineAlert
              live="polite"
              message={messages.consentSaved}
              title={messages.consentTitle}
              tone="success"
            />
          ) : null}
          {consentStatus === "error" ? (
            <InlineAlert
              message={messages.consentSaveError}
              title={messages.consentErrorTitle}
              tone="error"
            />
          ) : null}
        </section>

        <section
          className="account-panel account-history-panel"
          aria-labelledby="account-history-title"
        >
          <p className="eyebrow">{messages.historyTitle}</p>
          <h2 id="account-history-title">{messages.historyTitle}</h2>
          <p>{messages.historyDescription}</p>
          {historyPhase === "loading" && history.length === 0 ? (
            <div aria-busy="true" aria-live="polite">
              <p>{messages.historyLoading}</p>
              <Skeleton lines={3} />
            </div>
          ) : null}
          {historyPhase === "error" ? (
            <div className="account-control-status">
              <InlineAlert
                message={messages.historyError}
                title={messages.historyErrorTitle}
                tone="error"
              />
              <Button
                label={messages.historyRetry}
                onPress={() => void loadHistory()}
                tone="secondary"
              />
            </div>
          ) : null}
          {historyPhase === "ready" && history.length === 0 ? (
            <p className="account-empty-state">{messages.historyEmpty}</p>
          ) : null}
          {history.length > 0 ? (
            <ol className="account-history-list">
              {history.map((item) => (
                <li key={`${item.resourceType}:${item.resourceId}`}>
                  <strong>{accountHistoryLabel(item, messages)}</strong>
                  <span>
                    {item.resourceType === "reading" && item.themeCode !== null
                      ? `${accountReadingThemeLabel(item.themeCode, messages)} · `
                      : null}
                    {accountHistoryStatusLabel(item.status, messages)}
                  </span>
                  <time dateTime={item.occurredAt} dir="auto">
                    {formatAccountInstant(locale, item.occurredAt, account.timeZone)}
                  </time>
                  {item.resourceType === "reading" ? (
                    <Button
                      label={messages.historyOpen}
                      onPress={() => openReading(item)}
                      tone="quiet"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          {historyActionError ? (
            <InlineAlert
              message={messages.historyOpenError}
              title={messages.historyErrorTitle}
              tone="error"
            />
          ) : null}
          {historyCursor !== null ? (
            <Button
              label={messages.historyLoadMore}
              {...(historyPhase === "loading"
                ? { loading: true, loadingLabel: messages.historyLoadingMore }
                : {})}
              onPress={() => void loadHistory(historyCursor)}
              tone="secondary"
            />
          ) : null}
          <ActionLink href={sanctuaryHref} variant="quiet">
            {messages.sanctuaryAction}
          </ActionLink>
        </section>

        <section
          className="account-panel account-sessions-panel"
          aria-labelledby="account-sessions-title"
        >
          <p className="eyebrow">{messages.sessionsTitle}</p>
          <h2 id="account-sessions-title">{messages.sessionsTitle}</h2>
          <p>{messages.sessionsDescription}</p>
          {sessionsPhase === "loading" && sessions.length === 0 ? (
            <div aria-busy="true" aria-live="polite">
              <p>{messages.sessionsLoading}</p>
              <Skeleton lines={2} />
            </div>
          ) : null}
          {sessionsPhase === "error" ? (
            <div className="account-control-status">
              <InlineAlert
                message={messages.sessionsError}
                title={messages.sessionsErrorTitle}
                tone="error"
              />
              <Button
                label={messages.sessionsRetry}
                onPress={() => void loadSessions()}
                tone="secondary"
              />
            </div>
          ) : null}
          {sessions.length > 0 ? (
            <ul className="account-session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>
                      {session.current ? messages.sessionCurrent : messages.sessionOther}
                    </strong>
                    <dl>
                      <div>
                        <dt>{messages.sessionCreated}</dt>
                        <dd>
                          <time dateTime={session.createdAt} dir="auto">
                            {formatAccountInstant(locale, session.createdAt, account.timeZone)}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>{messages.sessionLastActive}</dt>
                        <dd>
                          <time dateTime={session.lastSeenAt} dir="auto">
                            {formatAccountInstant(locale, session.lastSeenAt, account.timeZone)}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>{messages.sessionExpires}</dt>
                        <dd>
                          <time dateTime={session.expiresAt} dir="auto">
                            {formatAccountInstant(locale, session.expiresAt, account.timeZone)}
                          </time>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {session.current ? null : (
                    <Button
                      label={messages.sessionRevoke}
                      {...(revokingSessionId === session.id
                        ? { loading: true, loadingLabel: messages.sessionRevoking }
                        : {})}
                      onPress={() => void revokeSession(session.id)}
                      tone="danger"
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {sessionActionStatus === "success" ? (
            <InlineAlert
              live="polite"
              message={messages.sessionRevokeSuccess}
              title={messages.sessionsTitle}
              tone="success"
            />
          ) : null}
          {sessionActionStatus === "error" ? (
            <InlineAlert
              message={messages.sessionRevokeError}
              title={messages.sessionsErrorTitle}
              tone="error"
            />
          ) : null}
          <Button
            label={messages.signOutAll}
            {...(signingOutAll ? { loading: true, loadingLabel: messages.signingOutAll } : {})}
            onPress={() => void signOutAll()}
            tone="danger"
          />
        </section>
      </aside>
    </div>
  );
}
