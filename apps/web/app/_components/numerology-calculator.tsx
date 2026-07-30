"use client";

import {
  Button,
  createUiControlId,
  createUiControlName,
  InlineAlert,
  TextField,
} from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  createNumerologyCalculationRequest,
  parseNumerologyBirthDateInput,
  type NumerologyCalculationCode,
  type NumerologyCalculationFacts,
  type NumerologyFormulaEvidence,
} from "../_contracts/numerology-calculation-response";
import type { NumerologyMessages } from "../_i18n/numerology-messages";
import {
  numerologyCalculationEndpoint,
  requestNumerologyCalculation,
} from "./numerology-calculator-transport";

type CalculatorPhase =
  "error" | "idle" | "invalid" | "loading" | "offline" | "result" | "unavailable";

const birthDateFieldId = createUiControlId("numerology-birth-date");
const targetYearFieldId = createUiControlId("numerology-target-year");
const birthDateFieldName = createUiControlName("birth-date");
const targetYearFieldName = createUiControlName("target-year");
const subscribeToHydration = (): (() => void) => () => undefined;

const digitExpression = (digits: string): string => [...digits].join(" + ");

export const numerologyFormulaSummary = (evidence: NumerologyFormulaEvidence): string =>
  evidence.calculationCode === "birthday_number"
    ? String(evidence.initialValue)
    : `${digitExpression(evidence.canonicalDigits)} = ${evidence.initialValue}`;

export const numerologyReductionSummary = (evidence: NumerologyFormulaEvidence): string =>
  evidence.reductionSteps.join(" → ");

const evidenceFor = (
  facts: NumerologyCalculationFacts,
  calculationCode: NumerologyCalculationCode,
): NumerologyFormulaEvidence => {
  const evidence = facts.calculations.find(
    (candidate) => candidate.calculationCode === calculationCode,
  );
  if (evidence === undefined) throw new TypeError("The numerology result is incomplete.");
  return evidence;
};

const failureMessages = (
  phase: "error" | "invalid" | "offline" | "unavailable",
  messages: NumerologyMessages,
): Readonly<{ message: string; title: string }> => {
  switch (phase) {
    case "error":
      return messages.states.error;
    case "invalid":
      return messages.states.invalid;
    case "offline":
      return messages.states.offline;
    case "unavailable":
      return messages.states.unavailable;
  }
};

const retryLabel = (
  phase: "error" | "offline" | "unavailable",
  messages: NumerologyMessages,
): string => {
  switch (phase) {
    case "error":
      return messages.states.error.retry;
    case "offline":
      return messages.states.offline.retry;
    case "unavailable":
      return messages.states.unavailable.retry;
  }
};

const calculationLabel = (
  code: NumerologyCalculationCode,
  messages: NumerologyMessages,
): string => {
  switch (code) {
    case "life_path":
      return messages.result.calculationLabels.life_path;
    case "birthday_number":
      return messages.result.calculationLabels.birthday_number;
    case "personal_year":
      return messages.result.calculationLabels.personal_year;
  }
};

const formulaLabel = (code: NumerologyCalculationCode, messages: NumerologyMessages): string => {
  switch (code) {
    case "life_path":
      return messages.result.formulaLabels.life_path;
    case "birthday_number":
      return messages.result.formulaLabels.birthday_number;
    case "personal_year":
      return messages.result.formulaLabels.personal_year;
  }
};

type NumerologyResultProps = Readonly<{
  facts: NumerologyCalculationFacts;
  messages: NumerologyMessages;
}>;

const NumerologyResult = ({ facts, messages }: NumerologyResultProps) => {
  const codes = ["life_path", "birthday_number", "personal_year"] as const;
  return (
    <>
      <header className="numerology-result-heading">
        <p className="eyebrow">
          {messages.result.targetYear}: <bdi dir="ltr">{facts.input.targetYear}</bdi>
        </p>
        <h2>{messages.result.title}</h2>
      </header>
      <div className="numerology-result-grid">
        {codes.map((code) => {
          const evidence = evidenceFor(facts, code);
          return (
            <article className="numerology-result-card" key={code}>
              <p className="numerology-result-value">
                <span className="visually-hidden">{messages.result.result}: </span>
                <bdi dir="ltr">{evidence.result}</bdi>
              </p>
              <h3>{calculationLabel(code, messages)}</h3>
              <dl className="numerology-formula">
                <div>
                  <dt>{messages.result.digitSource}</dt>
                  <dd>
                    {formulaLabel(code, messages)}:{" "}
                    <code dir="ltr">{evidence.canonicalDigits}</code>
                  </dd>
                </div>
                <div>
                  <dt>{messages.result.initialValue}</dt>
                  <dd>
                    <code dir="ltr">{numerologyFormulaSummary(evidence)}</code>
                  </dd>
                </div>
                <div>
                  <dt>{messages.result.reduction}</dt>
                  <dd>
                    <code dir="ltr">{numerologyReductionSummary(evidence)}</code>
                  </dd>
                </div>
                <div>
                  <dt>{messages.result.result}</dt>
                  <dd>
                    <bdi dir="ltr">{evidence.result}</bdi>
                  </dd>
                </div>
              </dl>
              {evidence.masterNumberPreserved ? (
                <p className="numerology-master-note">{messages.result.masterPreserved}</p>
              ) : null}
            </article>
          );
        })}
      </div>
      <details className="numerology-method">
        <summary>{messages.result.methodDetails}</summary>
        <p>{messages.result.methodNote}</p>
        <dl>
          <div>
            <dt>{messages.result.engineVersion}</dt>
            <dd>
              <code dir="ltr">
                {facts.engineName}@{facts.engineVersion}
              </code>
            </dd>
          </div>
          {facts.calculations.map((evidence) => (
            <div key={evidence.calculationCode}>
              <dt>
                {messages.result.ruleVersion}:{" "}
                {calculationLabel(evidence.calculationCode, messages)}
              </dt>
              <dd>
                <code dir="ltr">
                  {evidence.rule.id}@{evidence.rule.version}
                </code>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
};

type NumerologyCalculatorProps = Readonly<{
  messages: NumerologyMessages;
}>;

export function NumerologyCalculator({ messages }: NumerologyCalculatorProps) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [birthDate, setBirthDate] = useState("");
  const [birthDateError, setBirthDateError] = useState<string | undefined>();
  const [facts, setFacts] = useState<NumerologyCalculationFacts | null>(null);
  const [phase, setPhase] = useState<CalculatorPhase>("idle");
  const [targetYear, setTargetYear] = useState("");
  const [targetYearError, setTargetYearError] = useState<string | undefined>();
  const abortController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const resultRegion = useRef<HTMLElement | null>(null);

  useEffect(() => () => abortController.current?.abort(), []);
  useEffect(() => {
    if (phase !== "idle" && phase !== "loading") resultRegion.current?.focus();
  }, [phase]);

  const clearResult = (): void => {
    requestSequence.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    setFacts(null);
    setPhase("idle");
  };

  const changeBirthDate = (value: string): void => {
    clearResult();
    setBirthDate(value);
    setBirthDateError(undefined);
  };

  const changeTargetYear = (value: string): void => {
    clearResult();
    setTargetYear(value);
    setTargetYearError(undefined);
  };

  const validatedRequest = () => {
    let invalidBirthDate = false;
    try {
      parseNumerologyBirthDateInput(birthDate);
    } catch {
      invalidBirthDate = true;
    }
    const invalidTargetYear = !/^[0-9]{4}$/u.test(targetYear);
    setBirthDateError(invalidBirthDate ? messages.form.birthDateError : undefined);
    setTargetYearError(invalidTargetYear ? messages.form.targetYearError : undefined);
    if (invalidBirthDate || invalidTargetYear) {
      document.getElementById(invalidBirthDate ? birthDateFieldId : targetYearFieldId)?.focus();
      return null;
    }
    try {
      return createNumerologyCalculationRequest(birthDate, Number(targetYear));
    } catch {
      setTargetYearError(messages.form.targetYearError);
      document.getElementById(targetYearFieldId)?.focus();
      return null;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!hydrated || phase === "loading") return;
    const request = validatedRequest();
    if (request === null) return;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    setFacts(null);
    setPhase("loading");
    const result = await requestNumerologyCalculation({
      isOnline: () => navigator.onLine,
      request,
      signal: controller.signal,
    });
    if (sequence !== requestSequence.current || result.kind === "aborted") return;
    if (result.kind === "success") {
      setFacts(result.facts);
      setPhase("result");
    } else {
      setPhase(result.kind);
    }
    if (abortController.current === controller) abortController.current = null;
  };

  const retry = (): void => {
    const form = document.getElementById("numerology-calculator-form");
    if (form instanceof HTMLFormElement) form.requestSubmit();
  };

  const reset = (): void => {
    clearResult();
    setBirthDate("");
    setBirthDateError(undefined);
    setTargetYear("");
    setTargetYearError(undefined);
    requestAnimationFrame(() => document.getElementById(birthDateFieldId)?.focus());
  };

  const failure =
    phase === "error" || phase === "invalid" || phase === "offline" || phase === "unavailable"
      ? failureMessages(phase, messages)
      : null;

  return (
    <div className="numerology-layout">
      <form
        action={numerologyCalculationEndpoint}
        aria-busy={phase === "loading" || undefined}
        className="numerology-form"
        id="numerology-calculator-form"
        method="post"
        onSubmit={submit}
      >
        <TextField
          autoComplete="off"
          description={messages.form.birthDateDescription}
          disabled={!hydrated || phase === "loading"}
          {...(birthDateError === undefined ? {} : { error: birthDateError })}
          id={birthDateFieldId}
          label={messages.form.birthDateLabel}
          minimum="0001-01-01"
          name={birthDateFieldName}
          onValueChange={changeBirthDate}
          required
          requiredLabel={messages.form.required}
          type="date"
          value={birthDate}
        />
        <TextField
          autoComplete="off"
          description={messages.form.targetYearDescription}
          disabled={!hydrated || phase === "loading"}
          {...(targetYearError === undefined ? {} : { error: targetYearError })}
          id={targetYearFieldId}
          inputMode="numeric"
          label={messages.form.targetYearLabel}
          maxLength={4}
          name={targetYearFieldName}
          onValueChange={changeTargetYear}
          placeholder={messages.form.targetYearPlaceholder}
          required
          requiredLabel={messages.form.required}
          value={targetYear}
        />
        <div className="numerology-actions">
          <Button
            disabled={!hydrated}
            label={messages.form.submit}
            {...(phase === "loading"
              ? { loading: true as const, loadingLabel: messages.form.loading }
              : {})}
            type="submit"
          />
          <Button
            disabled={!hydrated || (birthDate === "" && targetYear === "" && facts === null)}
            label={messages.form.reset}
            onPress={reset}
            tone="quiet"
          />
        </div>
        <noscript>
          <p className="numerology-noscript">{messages.form.noScript}</p>
        </noscript>
      </form>

      <section aria-live="polite" className="numerology-result" ref={resultRegion} tabIndex={-1}>
        {phase === "loading" ? (
          <p aria-busy="true" className="numerology-progress">
            {messages.form.loading}
          </p>
        ) : facts !== null && phase === "result" ? (
          <NumerologyResult facts={facts} messages={messages} />
        ) : failure !== null ? (
          <>
            <InlineAlert message={failure.message} title={failure.title} tone="error" />
            {phase === "error" || phase === "offline" || phase === "unavailable" ? (
              <Button label={retryLabel(phase, messages)} onPress={retry} tone="secondary" />
            ) : null}
          </>
        ) : (
          <div className="numerology-empty">
            <p aria-hidden="true" className="numerology-empty-symbol">
              ∑
            </p>
            <h2>{messages.states.empty.title}</h2>
            <p>{messages.states.empty.message}</p>
          </div>
        )}
      </section>
    </div>
  );
}
