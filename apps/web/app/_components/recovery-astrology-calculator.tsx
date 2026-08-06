"use client";

import {
  Button,
  createUiControlId,
  createUiControlName,
  createUiControlValue,
  InlineAlert,
  SelectField,
  TextField,
} from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { AstrologyNatalPresentation } from "./astrology-natal-result";
import type { AstrologyNatalViewItem } from "../_contracts/astrology-natal-response";
import {
  recoveryAstrologyLocationOptions,
  recoveryAstrologyRequestSchemaVersion,
  type RecoveryAstrologyRequest,
  type RecoveryAstrologyTimeCertainty,
} from "../_contracts/recovery-astrology";
import type { RecoveryAstrologyMessages } from "../_i18n/recovery-astrology-messages";
import type { Locale } from "../_i18n/routing";
import {
  requestRecoveryAstrology,
  type RecoveryAstrologyTransportResult,
} from "./recovery-astrology-transport";

type Phase =
  | Exclude<RecoveryAstrologyTransportResult["kind"], "aborted" | "success">
  | "idle"
  | "loading"
  | "result";

const ids = Object.freeze({
  approximation: createUiControlId("recovery-astrology-approximation"),
  birthDate: createUiControlId("recovery-astrology-birth-date"),
  birthTime: createUiControlId("recovery-astrology-birth-time"),
  certainty: createUiControlId("recovery-astrology-certainty"),
  disambiguation: createUiControlId("recovery-astrology-disambiguation"),
  location: createUiControlId("recovery-astrology-location"),
});

const names = Object.freeze({
  approximation: createUiControlName("approximation-window"),
  birthDate: createUiControlName("birth-date"),
  birthTime: createUiControlName("birth-time"),
  certainty: createUiControlName("time-certainty"),
  disambiguation: createUiControlName("disambiguation"),
  location: createUiControlName("location"),
});

const locationOptions = Object.freeze([
  Object.freeze({
    contractValue: recoveryAstrologyLocationOptions[0].value,
    label: recoveryAstrologyLocationOptions[0].label,
    value: "kathmandu",
  }),
  Object.freeze({
    contractValue: recoveryAstrologyLocationOptions[1].value,
    label: recoveryAstrologyLocationOptions[1].label,
    value: "new-york",
  }),
  Object.freeze({
    contractValue: recoveryAstrologyLocationOptions[2].value,
    label: recoveryAstrologyLocationOptions[2].label,
    value: "shanghai",
  }),
] as const);

type LocationControlValue = (typeof locationOptions)[number]["value"];
const contractLocation = (value: LocationControlValue): RecoveryAstrologyRequest["locationId"] =>
  locationOptions.find((option) => option.value === value)?.contractValue ??
  recoveryAstrologyLocationOptions[1].value;

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    year >= 1800 &&
    year <= 2199 &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const failure = (
  phase: Exclude<Phase, "idle" | "loading" | "result">,
  messages: RecoveryAstrologyMessages,
) => {
  switch (phase) {
    case "ambiguous":
      return messages.states.ambiguous;
    case "error":
      return messages.states.error;
    case "invalid":
      return messages.states.invalid;
    case "nonexistent":
      return messages.states.nonexistent;
    case "offline":
      return messages.states.offline;
    case "unavailable":
      return messages.states.unavailable;
  }
};

type Props = Readonly<{
  locale: Locale;
  messages: RecoveryAstrologyMessages;
  sourceSha: string;
}>;

export function RecoveryAstrologyCalculator({ locale, messages, sourceSha }: Props) {
  const [birthDate, setBirthDate] = useState("");
  const [birthDateError, setBirthDateError] = useState<string>();
  const [birthTime, setBirthTime] = useState("");
  const [birthTimeError, setBirthTimeError] = useState<string>();
  const [certainty, setCertainty] = useState<RecoveryAstrologyTimeCertainty>("exact");
  const [location, setLocation] = useState<LocationControlValue>("new-york");
  const [approximationWindow, setApproximationWindow] = useState("90");
  const [disambiguation, setDisambiguation] = useState<"automatic" | "earlier" | "later">(
    "automatic",
  );
  const [item, setItem] = useState<AstrologyNatalViewItem | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const abortController = useRef<AbortController | null>(null);
  const resultRegion = useRef<HTMLElement | null>(null);

  useEffect(() => () => abortController.current?.abort(), []);
  useEffect(() => {
    if (phase !== "idle" && phase !== "loading") resultRegion.current?.focus();
  }, [phase]);

  const clearResult = (): void => {
    abortController.current?.abort();
    abortController.current = null;
    setItem(null);
    setPhase("idle");
  };

  const clearAll = (): void => {
    clearResult();
    setBirthDate("");
    setBirthDateError(undefined);
    setBirthTime("");
    setBirthTimeError(undefined);
    setCertainty("exact");
    setLocation("new-york");
    setApproximationWindow("90");
    setDisambiguation("automatic");
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const dateError = validDate(birthDate) ? undefined : messages.form.invalidDate;
    const timeError =
      certainty === "unknown" || /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(birthTime)
        ? undefined
        : messages.form.invalidTime;
    setBirthDateError(dateError);
    setBirthTimeError(timeError);
    if (dateError !== undefined || timeError !== undefined) {
      setItem(null);
      setPhase("invalid");
      return;
    }
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    setItem(null);
    setPhase("loading");
    const result = await requestRecoveryAstrology({
      isOnline: () => navigator.onLine,
      request: {
        approximationWindowMinutes:
          certainty === "approximate" ? Number(approximationWindow) : null,
        birthDate,
        birthTime: certainty === "unknown" ? null : birthTime,
        disambiguation:
          certainty === "unknown" || disambiguation === "automatic" ? null : disambiguation,
        locationId: contractLocation(location),
        schemaVersion: recoveryAstrologyRequestSchemaVersion,
        timeCertainty: certainty,
      },
      signal: controller.signal,
    });
    if (abortController.current !== controller || result.kind === "aborted") return;
    abortController.current = null;
    if (result.kind === "success") {
      setItem(result.item);
      setPhase("result");
    } else {
      setPhase(result.kind);
    }
  };

  const state =
    phase !== "idle" && phase !== "loading" && phase !== "result" ? failure(phase, messages) : null;

  return (
    <div className="recovery-astrology-layout">
      <section aria-labelledby="recovery-astrology-form-title" className="astrology-viewer-state">
        <h2 id="recovery-astrology-form-title">Synthetic calculation input</h2>
        <InlineAlert
          message={messages.privacy.boundary}
          title={messages.privacy.title}
          tone="info"
        />
        <form className="recovery-astrology-form" onSubmit={(event) => void submit(event)}>
          <TextField
            {...(birthDateError === undefined ? {} : { error: birthDateError })}
            id={ids.birthDate}
            label={messages.form.birthDate}
            minimum="1800-01-01"
            name={names.birthDate}
            onValueChange={(value) => {
              clearResult();
              setBirthDate(value);
              setBirthDateError(undefined);
            }}
            required
            requiredLabel={messages.form.required}
            type="date"
            value={birthDate}
          />
          <SelectField
            id={ids.location}
            label={messages.form.location}
            name={names.location}
            onValueChange={(value) => {
              clearResult();
              setLocation(value as LocationControlValue);
            }}
            options={locationOptions.map((option) => ({
              label: option.label,
              value: createUiControlValue(option.value),
            }))}
            required
            requiredLabel={messages.form.required}
            value={createUiControlValue(location)}
          />
          <SelectField
            id={ids.certainty}
            label={messages.form.timeCertainty}
            name={names.certainty}
            onValueChange={(value) => {
              clearResult();
              setCertainty(value as RecoveryAstrologyTimeCertainty);
              setBirthTimeError(undefined);
              setDisambiguation("automatic");
            }}
            options={[
              { label: messages.form.exact, value: createUiControlValue("exact") },
              { label: messages.form.approximate, value: createUiControlValue("approximate") },
              { label: messages.form.unknown, value: createUiControlValue("unknown") },
            ]}
            required
            requiredLabel={messages.form.required}
            value={createUiControlValue(certainty)}
          />
          {certainty === "unknown" ? null : (
            <TextField
              {...(birthTimeError === undefined ? {} : { error: birthTimeError })}
              description="24-hour local civil time, HH:MM."
              dir="ltr"
              id={ids.birthTime}
              inputMode="numeric"
              label={messages.form.birthTime}
              maxLength={5}
              name={names.birthTime}
              onValueChange={(value) => {
                clearResult();
                setBirthTime(value);
                setBirthTimeError(undefined);
              }}
              placeholder="07:00"
              required
              requiredLabel={messages.form.required}
              value={birthTime}
            />
          )}
          {certainty === "approximate" ? (
            <SelectField
              id={ids.approximation}
              label={messages.form.approximationWindow}
              name={names.approximation}
              onValueChange={(value) => {
                clearResult();
                setApproximationWindow(value);
              }}
              options={[
                { label: "±30 minutes", value: createUiControlValue("30") },
                { label: "±90 minutes", value: createUiControlValue("90") },
                { label: "±180 minutes", value: createUiControlValue("180") },
              ]}
              value={createUiControlValue(approximationWindow)}
            />
          ) : null}
          {certainty === "unknown" ? null : (
            <SelectField
              id={ids.disambiguation}
              label={messages.form.disambiguation}
              name={names.disambiguation}
              onValueChange={(value) => {
                clearResult();
                setDisambiguation(value as "automatic" | "earlier" | "later");
              }}
              options={[
                {
                  label: messages.form.disambiguationAutomatic,
                  value: createUiControlValue("automatic"),
                },
                {
                  label: messages.form.disambiguationEarlier,
                  value: createUiControlValue("earlier"),
                },
                { label: messages.form.disambiguationLater, value: createUiControlValue("later") },
              ]}
              value={createUiControlValue(disambiguation)}
            />
          )}
          <div className="recovery-astrology-actions">
            {phase === "loading" ? (
              <Button
                label={messages.form.calculate}
                loading
                loadingLabel="Calculating"
                type="submit"
              />
            ) : (
              <Button label={messages.form.calculate} type="submit" />
            )}
            <Button
              disabled={phase === "loading"}
              label={messages.form.clear}
              onPress={clearAll}
              tone="secondary"
              type="button"
            />
          </div>
        </form>
      </section>
      <section
        aria-busy={phase === "loading" || undefined}
        aria-live="polite"
        className="astrology-viewer"
        ref={resultRegion}
        tabIndex={-1}
      >
        {phase === "idle" ? (
          <InlineAlert
            message="Enter synthetic details to begin. Nothing is calculated automatically."
            title="Ready for a bounded test"
            tone="info"
          />
        ) : null}
        {phase === "loading" ? (
          <InlineAlert
            live="polite"
            message={messages.states.calculating.message}
            title={messages.states.calculating.title}
            tone="info"
          />
        ) : null}
        {state === null ? null : (
          <InlineAlert
            live="assertive"
            message={state.message}
            title={state.title}
            tone={phase === "offline" || phase === "unavailable" ? "warning" : "error"}
          />
        )}
        {phase === "result" && item !== null ? (
          <AstrologyNatalPresentation item={item} locale={locale} messages={messages.astrology} />
        ) : null}
      </section>
      <aside className="recovery-astrology-source">
        <h2>{messages.source.title}</h2>
        <p>{messages.source.body}</p>
        <ul>
          <li>{messages.source.engine}</li>
          <li>{messages.source.geonames}</li>
          <li>{messages.source.runtime}</li>
          <li>{messages.source.license}</li>
        </ul>
        <a href={`https://github.com/CPTM511/RITUVIA/tree/${sourceSha}`} rel="noreferrer">
          {messages.source.sourceCode}: <code>{sourceSha}</code>
        </a>
      </aside>
    </div>
  );
}
