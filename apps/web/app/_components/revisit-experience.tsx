"use client";

import {
  Button,
  Checkbox,
  createUiControlId,
  InlineAlert,
  TextAreaField,
  TextField,
  type LocalActionHref,
} from "@rituvia/ui";
import {
  parseRevisitResourceV1,
  revisitReminderChannel,
  revisitReminderFrequency,
  revisitReminderNoticeVersion,
  revisitReminderSchemaVersion,
  type RevisitOutcomeTag,
  type RevisitReminderStateV1,
  type RevisitResourceV1,
  type RevisitScheduleKind,
} from "@rituvia/domain";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTomorrowLocalDate } from "./browser-local-date";

import type { RevisitMessages } from "../_i18n/revisit-messages";

export const revisitIntentionStorageKey = "rituvia.revisit-intention.v1";
export const revisitEndpoints = Object.freeze({
  account: "/api/v1/me",
  anonymousSession: "/api/v1/anonymous/session",
  intentions: "/api/v1/intentions",
  reminders: "/api/v1/me/revisit-reminders",
  revisits: "/api/v1/revisits",
});

type Intention = Readonly<{
  id: string;
  intentionText: string;
  revision: number;
  smallAction: string;
  status: "active" | "completed";
}>;

type Phase = "error" | "idle" | "loading" | "offline" | "rate_limited" | "success";
type RevisitListResponse = Readonly<{ items: readonly RevisitResourceV1[] }>;
type ReminderListResponse = Readonly<{
  accountAvailable: boolean;
  reminders: readonly RevisitReminderStateV1[];
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const csrfPattern = /^[A-Za-z0-9_-]{43}$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

class ProtectedBetaMutationRateLimitError extends Error {
  public constructor() {
    super("The protected Beta mutation budget is exhausted.");
    this.name = "ProtectedBetaMutationRateLimitError";
  }
}

const throwIfRateLimited = async (response: Response): Promise<void> => {
  if (response.status !== 429) return;
  await response.text().catch(() => "");
  throw new ProtectedBetaMutationRateLimitError();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseIntention = (value: unknown): Intention | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.intentionText !== "string" ||
    value.intentionText.length < 1 ||
    value.intentionText.length > 280 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.smallAction !== "string" ||
    value.smallAction.length < 1 ||
    value.smallAction.length > 280 ||
    (value.status !== "active" && value.status !== "completed") ||
    value.schemaVersion !== "reflection-intention.v2"
  ) {
    return null;
  }
  return Object.freeze({
    id: value.id,
    intentionText: value.intentionText,
    revision: value.revision as number,
    smallAction: value.smallAction,
    status: value.status,
  });
};

const parseList = (value: unknown): RevisitListResponse | null => {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 50) return null;
  try {
    return Object.freeze({ items: Object.freeze(value.items.map(parseRevisitResourceV1)) });
  } catch {
    return null;
  }
};

const parseReminderState = (value: unknown): RevisitReminderStateV1 | null => {
  if (
    !isRecord(value) ||
    typeof value.revisitId !== "string" ||
    !uuidPattern.test(value.revisitId) ||
    value.schemaVersion !== revisitReminderSchemaVersion ||
    value.noticeVersion !== revisitReminderNoticeVersion ||
    value.channel !== revisitReminderChannel ||
    value.frequency !== revisitReminderFrequency ||
    value.locale !== "en" ||
    (value.preferenceState !== "subscribed" && value.preferenceState !== "unsubscribed") ||
    !["cancelled", "dead_lettered", "delivered", "pending", "retry_wait"].includes(
      String(value.deliveryState),
    ) ||
    typeof value.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(value.recordedAt))
  ) {
    return null;
  }
  return Object.freeze(value as RevisitReminderStateV1);
};

const parseReminderList = (value: unknown): ReminderListResponse | null => {
  if (
    !isRecord(value) ||
    typeof value.accountAvailable !== "boolean" ||
    !Array.isArray(value.reminders) ||
    value.reminders.length > 50 ||
    (!value.accountAvailable && value.reminders.length > 0)
  ) {
    return null;
  }
  const reminders = value.reminders.map(parseReminderState);
  if (reminders.some((reminder) => reminder === null)) return null;
  return Object.freeze({
    accountAvailable: value.accountAvailable,
    reminders: Object.freeze(reminders as RevisitReminderStateV1[]),
  });
};

const initialTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const statusLabel = (resource: RevisitResourceV1, messages: RevisitMessages): string => {
  switch (resource.status) {
    case "archived":
      return messages.archived;
    case "completed":
      return messages.completed;
    case "scheduled":
      return resource.isDue ? messages.due : messages.scheduled;
  }
};

type RevisitExperienceProps = Readonly<{
  messages: RevisitMessages;
  sanctuaryHref: LocalActionHref;
}>;

export function RevisitExperience({ messages, sanctuaryHref }: RevisitExperienceProps) {
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [intention, setIntention] = useState<Intention | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [outcomeTags, setOutcomeTags] = useState<readonly RevisitOutcomeTag[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [reflection, setReflection] = useState("");
  const [reminderAccountAvailable, setReminderAccountAvailable] = useState<boolean | null>(null);
  const [reminders, setReminders] = useState<readonly RevisitReminderStateV1[]>([]);
  const [reminderSavingId, setReminderSavingId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [revisits, setRevisits] = useState<readonly RevisitResourceV1[]>([]);
  const [scheduleKind, setScheduleKind] = useState<RevisitScheduleKind>("next_day");
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const csrfToken = useRef<string | null>(null);
  const accountCsrfToken = useRef<string | null>(null);
  const operations = useRef(new Map<string, string>());
  const reminderPreferencesRegion = useRef<HTMLElement | null>(null);
  const reminderPreferencesRequested = useRef(false);
  const statusRegion = useRef<HTMLDivElement | null>(null);
  const customDateId = createUiControlId("revisit-custom-date");
  const quietHoursId = createUiControlId("revisit-quiet-hours");
  const reflectionId = createUiControlId("revisit-reflection");
  const timeZoneId = createUiControlId("revisit-time-zone");
  const minimumCustomDate = useTomorrowLocalDate();
  const mutationRateLimited = phase === "rate_limited";

  useEffect(() => {
    if (completionId === null) return;
    requestAnimationFrame(() => document.getElementById(reflectionId)?.focus());
  }, [completionId, reflectionId]);

  useEffect(() => {
    if (message === null || phase !== "success") return;
    requestAnimationFrame(() => statusRegion.current?.focus());
  }, [message, phase]);

  useEffect(() => {
    if (phase === "loading" || reminderPreferencesRequested.current) return;
    let timer = 0;
    const focusReminderPreferences = () => {
      if (
        reminderPreferencesRequested.current ||
        window.location.hash !== "#reminder-preferences"
      ) {
        return;
      }
      timer = window.setTimeout(() => {
        reminderPreferencesRequested.current = true;
        const region = reminderPreferencesRegion.current;
        const checkbox = region?.querySelector<HTMLInputElement>(
          'input[type="checkbox"][id^="revisit-reminder-"]',
        );
        (checkbox ?? region)?.focus({ preventScroll: true });
        region?.scrollIntoView({ block: "start" });
      }, 0);
    };
    focusReminderPreferences();
    window.addEventListener("hashchange", focusReminderPreferences);
    return () => {
      window.removeEventListener("hashchange", focusReminderPreferences);
      window.clearTimeout(timer);
    };
  }, [phase, reminderAccountAvailable, reminders]);

  const idempotencyKey = (fingerprint: string): string => {
    const existing = operations.current.get(fingerprint);
    if (existing !== undefined) return existing;
    const key = crypto.randomUUID();
    operations.current.set(fingerprint, key);
    return key;
  };

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    setMessage(null);
    try {
      const selectedId = window.sessionStorage.getItem(revisitIntentionStorageKey);
      const [listResponse, intentionResponse, reminderResponse] = await Promise.all([
        fetch(revisitEndpoints.revisits, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        }),
        selectedId !== null && uuidPattern.test(selectedId)
          ? fetch(`${revisitEndpoints.intentions}/${selectedId}`, {
              cache: "no-store",
              credentials: "same-origin",
              headers: { accept: "application/json" },
            })
          : Promise.resolve(null),
        fetch(revisitEndpoints.reminders, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        }),
      ]);
      const list = listResponse.ok ? parseList((await listResponse.json()) as unknown) : null;
      if (list === null) throw new TypeError("invalid revisit list");
      const selectedIntention =
        intentionResponse?.ok === true
          ? parseIntention((await intentionResponse.json()) as unknown)
          : null;
      setRevisits(list.items);
      setIntention(selectedIntention);
      if (reminderResponse.ok) {
        const parsedReminders = parseReminderList((await reminderResponse.json()) as unknown);
        if (parsedReminders === null) throw new TypeError("invalid reminder list");
        accountCsrfToken.current = null;
        setReminderAccountAvailable(parsedReminders.accountAvailable);
        setReminders(parsedReminders.reminders);
      } else {
        setReminderAccountAvailable(null);
        setReminders([]);
      }
      setPhase("idle");
    } catch {
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.errorDescription);
    }
  }, [messages.errorDescription]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const ensureCsrf = async (): Promise<string> => {
    if (csrfToken.current !== null) return csrfToken.current;
    const response = await fetch(revisitEndpoints.anonymousSession, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "idempotency-key": crypto.randomUUID() },
      method: "POST",
    });
    await throwIfRateLimited(response);
    const token = response.headers.get("x-csrf-token");
    if (!response.ok || token === null || !csrfPattern.test(token)) {
      throw new TypeError("csrf unavailable");
    }
    csrfToken.current = token;
    return token;
  };

  const ensureAccountCsrf = async (): Promise<string> => {
    if (accountCsrfToken.current !== null) return accountCsrfToken.current;
    const response = await fetch(revisitEndpoints.account, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const token = response.headers.get("x-csrf-token");
    if (response.status === 401) {
      setReminderAccountAvailable(false);
      throw new TypeError("account session unavailable");
    }
    if (!response.ok || token === null || !csrfPattern.test(token)) {
      throw new TypeError("account csrf unavailable");
    }
    accountCsrfToken.current = token;
    setReminderAccountAvailable(true);
    return token;
  };

  const toggleReminder = async (
    resource: RevisitResourceV1,
    subscribed: boolean,
  ): Promise<void> => {
    if (!navigator.onLine || reminderSavingId !== null) {
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.reminderError);
      return;
    }
    setReminderSavingId(resource.id);
    setMessage(null);
    try {
      const token = await ensureAccountCsrf();
      const body = {
        action: subscribed ? "subscribe" : "unsubscribe",
        channel: revisitReminderChannel,
        frequency: revisitReminderFrequency,
        noticeVersion: revisitReminderNoticeVersion,
        schemaVersion: revisitReminderSchemaVersion,
      };
      const endpoint = `${revisitEndpoints.revisits}/${resource.id}/reminder`;
      const fingerprint = `POST:${endpoint}:${JSON.stringify(body)}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey(fingerprint),
          "x-csrf-token": token,
        },
        method: "POST",
      });
      if (!response.ok) throw new TypeError("reminder unavailable");
      const payload = (await response.json()) as unknown;
      const reminder = isRecord(payload) ? parseReminderState(payload.reminder) : null;
      if (reminder === null) throw new TypeError("invalid reminder response");
      operations.current.delete(fingerprint);
      setReminders((current) => [
        reminder,
        ...current.filter((candidate) => candidate.revisitId !== reminder.revisitId),
      ]);
      setPhase("success");
      setMessage(subscribed ? messages.reminderEnabled : messages.reminderDisabled);
    } catch {
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.reminderError);
    } finally {
      setReminderSavingId(null);
    }
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (mutationRateLimited) return;
    if (
      intention === null ||
      (scheduleKind === "custom" && !datePattern.test(customDate)) ||
      !navigator.onLine
    ) {
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.errorDescription);
      return;
    }
    setPhase("loading");
    setMessage(null);
    try {
      const token = await ensureCsrf();
      const current = revisits.find((item) => item.id === rescheduleId);
      const quietHours = quietHoursEnabled
        ? { endLocalTime: quietHoursEnd, startLocalTime: quietHoursStart }
        : null;
      const body =
        current === undefined
          ? {
              customDate: scheduleKind === "custom" ? customDate : null,
              intentionId: intention.id,
              quietHours,
              reminderChannel: null,
              reminderPreference: "none",
              scheduleKind,
              schemaVersion: "reflection-revisit.v1",
              timeZone,
            }
          : {
              action: "reschedule",
              customDate: scheduleKind === "custom" ? customDate : null,
              expectedRevision: current.revision,
              quietHours,
              reminderChannel: null,
              reminderPreference: "none",
              scheduleKind,
              schemaVersion: "reflection-revisit-mutation.v1",
              timeZone,
            };
      const endpoint =
        current === undefined
          ? revisitEndpoints.revisits
          : `${revisitEndpoints.revisits}/${current.id}`;
      const method = current === undefined ? "POST" : "PATCH";
      const fingerprint = `${method}:${endpoint}:${JSON.stringify(body)}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey(fingerprint),
          "x-csrf-token": token,
        },
        method,
      });
      await throwIfRateLimited(response);
      if (!response.ok) throw new TypeError("schedule unavailable");
      const resource = parseRevisitResourceV1((await response.json()) as unknown);
      const refreshedCsrf = response.headers.get("x-csrf-token");
      if (refreshedCsrf !== null && csrfPattern.test(refreshedCsrf)) {
        csrfToken.current = refreshedCsrf;
      }
      operations.current.delete(fingerprint);
      setRevisits((currentItems) => [
        resource,
        ...currentItems.filter((item) => item.id !== resource.id),
      ]);
      setRescheduleId(null);
      window.sessionStorage.removeItem(revisitIntentionStorageKey);
      setPhase("success");
      setMessage(messages.scheduled);
    } catch (error) {
      if (error instanceof ProtectedBetaMutationRateLimitError) {
        setPhase("rate_limited");
        setMessage(messages.rateLimited);
        return;
      }
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.errorDescription);
    }
  };

  const mutate = async (
    resource: RevisitResourceV1,
    action: "archive" | "complete" | "delete",
  ): Promise<void> => {
    if (mutationRateLimited) return;
    if (!navigator.onLine) {
      setPhase("offline");
      setMessage(messages.errorDescription);
      return;
    }
    if (action === "archive" && !window.confirm(messages.confirmArchive)) return;
    if (action === "delete" && !window.confirm(messages.confirmDelete)) return;
    setPhase("loading");
    setMessage(null);
    try {
      const token = await ensureCsrf();
      const endpoint =
        action === "complete"
          ? `${revisitEndpoints.revisits}/${resource.id}/complete`
          : `${revisitEndpoints.revisits}/${resource.id}`;
      const body =
        action === "complete"
          ? {
              action,
              expectedRevision: resource.revision,
              outcomeTags,
              reflection,
              schemaVersion: "reflection-revisit-mutation.v1",
            }
          : action === "archive"
            ? {
                action,
                expectedRevision: resource.revision,
                schemaVersion: "reflection-revisit-mutation.v1",
              }
            : null;
      const method = action === "delete" ? "DELETE" : action === "complete" ? "POST" : "PATCH";
      const fingerprint = `${method}:${endpoint}:${
        body === null ? resource.revision : JSON.stringify(body)
      }`;
      const response = await fetch(endpoint, {
        ...(body === null ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          ...(body === null ? { "if-match": `"revision-${resource.revision}"` } : {}),
          ...(body === null ? {} : { "content-type": "application/json" }),
          "idempotency-key": idempotencyKey(fingerprint),
          "x-csrf-token": token,
        },
        method,
      });
      await throwIfRateLimited(response);
      if (!response.ok) throw new TypeError("mutation unavailable");
      const refreshedCsrf = response.headers.get("x-csrf-token");
      if (refreshedCsrf !== null && csrfPattern.test(refreshedCsrf)) {
        csrfToken.current = refreshedCsrf;
      }
      operations.current.delete(fingerprint);
      if (action === "delete") {
        setRevisits((items) => items.filter((item) => item.id !== resource.id));
        setMessage(messages.deleted);
      } else {
        const updated = parseRevisitResourceV1((await response.json()) as unknown);
        setRevisits((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        setMessage(action === "complete" ? messages.completed : messages.archived);
      }
      setCompletionId(null);
      setReflection("");
      setOutcomeTags([]);
      setPhase("success");
    } catch (error) {
      if (error instanceof ProtectedBetaMutationRateLimitError) {
        setPhase("rate_limited");
        setMessage(messages.rateLimited);
        return;
      }
      setPhase(navigator.onLine ? "error" : "offline");
      setMessage(messages.errorDescription);
    }
  };

  const beginReschedule = (resource: RevisitResourceV1): void => {
    if (mutationRateLimited) return;
    setRescheduleId(resource.id);
    setScheduleKind(resource.scheduleKind);
    setCustomDate(resource.scheduleKind === "custom" ? resource.scheduledLocalDate : "");
    setTimeZone(resource.timeZone);
    setQuietHoursEnabled(resource.quietHours !== null);
    setQuietHoursStart(resource.quietHours?.startLocalTime ?? "22:00");
    setQuietHoursEnd(resource.quietHours?.endLocalTime ?? "08:00");
    setMessage(null);
    setPhase("idle");
  };

  const tagEntries = Object.entries(messages.outcomeTags) as readonly [RevisitOutcomeTag, string][];

  return (
    <div className="revisit-experience">
      {phase === "loading" && revisits.length === 0 ? (
        <p aria-live="polite" className="revisit-loading">
          {messages.loading}
        </p>
      ) : null}
      {message === null ? null : (
        <div ref={statusRegion} tabIndex={-1}>
          <InlineAlert
            live={phase === "error" || phase === "offline" ? "assertive" : "polite"}
            message={message}
            title={
              phase === "rate_limited"
                ? messages.rateLimitTitle
                : phase === "error" || phase === "offline"
                  ? messages.errorTitle
                  : messages.title
            }
            tone={
              phase === "rate_limited"
                ? "warning"
                : phase === "error" || phase === "offline"
                  ? "error"
                  : "success"
            }
          />
        </div>
      )}
      {phase === "error" || phase === "offline" ? (
        <Button label={messages.retry} onPress={() => void load()} tone="secondary" />
      ) : null}

      {intention === null ? (
        <section className="revisit-empty">
          <h2>{messages.emptyTitle}</h2>
          <p>{messages.emptyDescription}</p>
          <a className="rvt-action rvt-action--primary" href={sanctuaryHref}>
            {messages.backToSanctuary}
          </a>
        </section>
      ) : (
        <section className="revisit-schedule" aria-labelledby="revisit-schedule-title">
          <h2 id="revisit-schedule-title">{messages.saveSchedule}</h2>
          <dl className="revisit-original">
            <div>
              <dt>{messages.intentionLabel}</dt>
              <dd>
                <bdi dir="auto">{intention.intentionText}</bdi>
              </dd>
            </div>
            <div>
              <dt>{messages.smallActionLabel}</dt>
              <dd>
                <bdi dir="auto">{intention.smallAction}</bdi>
              </dd>
            </div>
          </dl>
          <form aria-busy={phase === "loading" || undefined} onSubmit={submitSchedule}>
            <fieldset>
              <legend>{messages.customDateDescription}</legend>
              <div className="revisit-choice-grid">
                {(
                  [
                    ["next_day", messages.nextDay],
                    ["seven_days", messages.sevenDays],
                    ["custom", messages.customDate],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={scheduleKind === value}
                      name="revisit-schedule-kind"
                      onChange={() => setScheduleKind(value)}
                      type="radio"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {scheduleKind === "custom" ? (
              <TextField
                description={messages.customDateDescription}
                dir="ltr"
                id={customDateId}
                label={messages.customDate}
                {...(minimumCustomDate === null ? {} : { minimum: minimumCustomDate })}
                onValueChange={setCustomDate}
                required
                requiredLabel={messages.required}
                type="date"
                value={customDate}
              />
            ) : null}
            <TextField
              description={messages.timeZoneDescription}
              id={timeZoneId}
              label={messages.timeZone}
              onValueChange={setTimeZone}
              required
              requiredLabel={messages.required}
              value={timeZone}
            />
            <Checkbox
              checked={quietHoursEnabled}
              id={quietHoursId}
              label={messages.quietHoursLabel}
              onCheckedChange={setQuietHoursEnabled}
            />
            {quietHoursEnabled ? (
              <div className="revisit-quiet-hours">
                <label>
                  <span>{messages.quietHoursStart}</span>
                  <input
                    dir="ltr"
                    onChange={(event) => setQuietHoursStart(event.currentTarget.value)}
                    required
                    type="time"
                    value={quietHoursStart}
                  />
                </label>
                <label>
                  <span>{messages.quietHoursEnd}</span>
                  <input
                    dir="ltr"
                    onChange={(event) => setQuietHoursEnd(event.currentTarget.value)}
                    required
                    type="time"
                    value={quietHoursEnd}
                  />
                </label>
              </div>
            ) : null}
            <p>{messages.quietHoursDescription}</p>
            <p>{messages.noReminder}</p>
            <div className="revisit-actions">
              <Button
                disabled={mutationRateLimited}
                label={rescheduleId === null ? messages.saveSchedule : messages.reschedule}
                {...(phase === "loading"
                  ? { loading: true, loadingLabel: messages.scheduling }
                  : {})}
                type="submit"
              />
              {rescheduleId === null ? null : (
                <Button
                  label={messages.cancel}
                  onPress={() => setRescheduleId(null)}
                  tone="quiet"
                />
              )}
            </div>
          </form>
        </section>
      )}

      <section
        aria-labelledby="revisit-list-title"
        className="revisit-list"
        id="reminder-preferences"
        ref={reminderPreferencesRegion}
        tabIndex={-1}
      >
        <h2 id="revisit-list-title">{messages.title}</h2>
        {revisits.length === 0 ? <p>{messages.emptyDescription}</p> : null}
        {revisits.map((resource) => (
          <article className="revisit-card" key={resource.id}>
            <header>
              <p className="eyebrow">{statusLabel(resource, messages)}</p>
              <h3>
                <time dateTime={resource.scheduledLocalDate} dir="ltr">
                  {resource.scheduledLocalDate}
                </time>
              </h3>
              <p dir="ltr">{resource.timeZone}</p>
            </header>
            <dl className="revisit-original">
              <div>
                <dt>{messages.intentionLabel}</dt>
                <dd>
                  <bdi dir="auto">{resource.intentionText}</bdi>
                </dd>
              </div>
              <div>
                <dt>{messages.smallActionLabel}</dt>
                <dd>
                  <bdi dir="auto">{resource.smallAction}</bdi>
                </dd>
              </div>
            </dl>
            <p>{messages.reminderBoundary}</p>
            {resource.status === "scheduled" ? (
              <>
                <p>{resource.isDue ? messages.due : messages.early}</p>
                <div className="revisit-reminder-control">
                  {reminderAccountAvailable === false ? (
                    <p>{messages.reminderSignIn}</p>
                  ) : reminderAccountAvailable === null ? (
                    <p>{messages.reminderUnavailable}</p>
                  ) : (
                    <>
                      <Checkbox
                        checked={
                          reminders.find((candidate) => candidate.revisitId === resource.id)
                            ?.preferenceState === "subscribed"
                        }
                        disabled={
                          reminderSavingId !== null ||
                          reminders.find((candidate) => candidate.revisitId === resource.id)
                            ?.deliveryState === "delivered"
                        }
                        id={createUiControlId(`revisit-reminder-${resource.id}`)}
                        label={messages.reminderOptIn}
                        onCheckedChange={(checked) => void toggleReminder(resource, checked)}
                      />
                      <p>{messages.reminderDescription}</p>
                      {reminderSavingId === resource.id ? (
                        <p aria-live="polite">{messages.reminderSaving}</p>
                      ) : null}
                      {reminders.find((candidate) => candidate.revisitId === resource.id)
                        ?.deliveryState === "retry_wait" ? (
                        <p>{messages.reminderRetrying}</p>
                      ) : null}
                      {reminders.find((candidate) => candidate.revisitId === resource.id)
                        ?.deliveryState === "dead_lettered" ? (
                        <p>{messages.reminderFailed}</p>
                      ) : null}
                      {reminders.find((candidate) => candidate.revisitId === resource.id)
                        ?.deliveryState === "delivered" ? (
                        <p>{messages.reminderDelivered}</p>
                      ) : null}
                    </>
                  )}
                </div>
                {completionId === resource.id ? (
                  <form
                    aria-busy={phase === "loading" || undefined}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(resource, "complete");
                    }}
                  >
                    <TextAreaField
                      description={messages.reflectionDescription}
                      id={reflectionId}
                      label={messages.reflectionLabel}
                      maxLength={3000}
                      onValueChange={setReflection}
                      placeholder={messages.reflectionPlaceholder}
                      required
                      requiredLabel={messages.required}
                      rows={5}
                      value={reflection}
                    />
                    <fieldset>
                      <legend>{messages.outcomeLegend}</legend>
                      <div className="revisit-tag-grid">
                        {tagEntries.map(([tag, label]) => (
                          <Checkbox
                            checked={outcomeTags.includes(tag)}
                            disabled={!outcomeTags.includes(tag) && outcomeTags.length >= 3}
                            id={createUiControlId(`revisit-outcome-${tag.replaceAll("_", "-")}`)}
                            key={tag}
                            label={label}
                            onCheckedChange={(checked) =>
                              setOutcomeTags((current) =>
                                checked
                                  ? [...current, tag]
                                  : current.filter((candidate) => candidate !== tag),
                              )
                            }
                          />
                        ))}
                      </div>
                    </fieldset>
                    <div className="revisit-actions">
                      <Button
                        disabled={mutationRateLimited}
                        label={messages.complete}
                        {...(phase === "loading"
                          ? { loading: true, loadingLabel: messages.completing }
                          : {})}
                        type="submit"
                      />
                      <Button
                        label={messages.cancel}
                        onPress={() => setCompletionId(null)}
                        tone="quiet"
                      />
                    </div>
                  </form>
                ) : (
                  <div className="revisit-actions">
                    <Button
                      disabled={mutationRateLimited}
                      label={messages.complete}
                      onPress={() => setCompletionId(resource.id)}
                    />
                    <Button
                      disabled={mutationRateLimited}
                      label={messages.reschedule}
                      onPress={() => beginReschedule(resource)}
                      tone="secondary"
                    />
                    <Button
                      disabled={mutationRateLimited}
                      label={messages.archive}
                      onPress={() => void mutate(resource, "archive")}
                      tone="quiet"
                    />
                    <Button
                      disabled={mutationRateLimited}
                      label={messages.delete}
                      onPress={() => void mutate(resource, "delete")}
                      tone="danger"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {resource.completionReflection === null ? null : (
                  <p className="revisit-completion-text">
                    <bdi dir="auto">{resource.completionReflection}</bdi>
                  </p>
                )}
                <div className="revisit-actions">
                  {resource.status === "completed" ? (
                    <Button
                      disabled={mutationRateLimited}
                      label={messages.archive}
                      onPress={() => void mutate(resource, "archive")}
                      tone="quiet"
                    />
                  ) : null}
                  <Button
                    disabled={mutationRateLimited}
                    label={messages.delete}
                    onPress={() => void mutate(resource, "delete")}
                    tone="danger"
                  />
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
