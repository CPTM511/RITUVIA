"use client";

import {
  parseQuestionIntakeResponse,
  parseQuestionIntakeThemeCode,
  questionIntakeMaximumLength,
  questionIntakeSchemaVersion,
  questionIntakeThemeCodes,
  type QuestionIntakeResponse,
  type QuestionIntakeSuggestionCode,
  type QuestionIntakeThemeCode,
} from "@rituvia/domain";
import {
  ActionLink,
  Button,
  createUiControlId,
  createUiControlName,
  createUiControlValue,
  InlineAlert,
  RadioGroup,
  TextAreaField,
  type AlertTone,
  type LocalActionHref,
} from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { QuestionIntakeMessages } from "../_i18n/question-intake-messages";

export const questionIntakeEndpoint = "/api/v1/intake/evaluate";

type RequestPhase = "error" | "idle" | "loading" | "offline" | "result" | "unavailable";

const themeGroupId = createUiControlId("question-intake-theme");
const themeGroupName = createUiControlName("theme-code");
const questionFieldId = createUiControlId("question-intake-question");
const subscribeToHydration = (): (() => void) => () => undefined;

const outcomeTone = (state: QuestionIntakeResponse["state"]): AlertTone => {
  switch (state) {
    case "allowed":
      return "success";
    case "reframed":
      return "info";
    case "blocked":
      return "warning";
    case "crisis":
      return "error";
  }
};

const themeLabel = (code: QuestionIntakeThemeCode, messages: QuestionIntakeMessages): string => {
  switch (code) {
    case "self":
      return messages.themes.self;
    case "relationships":
      return messages.themes.relationships;
    case "work":
      return messages.themes.work;
    case "creativity":
      return messages.themes.creativity;
    case "transition":
      return messages.themes.transition;
    case "grief":
      return messages.themes.grief;
    case "courage":
      return messages.themes.courage;
    case "gratitude":
      return messages.themes.gratitude;
    case "release":
      return messages.themes.release;
    case "open_reflection":
      return messages.themes.open_reflection;
  }
};

const questionForSuggestion = (
  code: QuestionIntakeSuggestionCode,
  messages: QuestionIntakeMessages,
): string => {
  switch (code) {
    case "agency_general":
      return messages.suggestions.agency_general;
    case "professional_preparation":
      return messages.suggestions.professional_preparation;
    case "relationship_agency":
      return messages.suggestions.relationship_agency;
    case "grounded_observation":
      return messages.suggestions.grounded_observation;
  }
};

const suggestedQuestion = (
  code: QuestionIntakeSuggestionCode | null,
  messages: QuestionIntakeMessages,
): string | null => (code === null ? null : questionForSuggestion(code, messages));

const failureOutcomeMessages = (
  phase: "error" | "offline" | "unavailable",
  messages: QuestionIntakeMessages,
) => {
  switch (phase) {
    case "error":
      return messages.outcomes.error;
    case "offline":
      return messages.outcomes.offline;
    case "unavailable":
      return messages.outcomes.unavailable;
  }
};

const resultOutcomeMessages = (
  state: QuestionIntakeResponse["state"],
  messages: QuestionIntakeMessages,
) => {
  switch (state) {
    case "allowed":
      return messages.outcomes.allowed;
    case "reframed":
      return messages.outcomes.reframed;
    case "blocked":
      return messages.outcomes.blocked;
    case "crisis":
      return messages.outcomes.crisis;
  }
};

type QuestionIntakeFormProps = Readonly<{
  messages: QuestionIntakeMessages;
  readingHref: LocalActionHref;
}>;

export function QuestionIntakeForm({ messages, readingHref }: QuestionIntakeFormProps) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [outcome, setOutcome] = useState<QuestionIntakeResponse | null>(null);
  const [phase, setPhase] = useState<RequestPhase>("idle");
  const [question, setQuestion] = useState("");
  const [themeCode, setThemeCode] = useState<QuestionIntakeThemeCode | "">("");
  const [themeError, setThemeError] = useState<string | undefined>();
  const abortController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const responseRegion = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => abortController.current?.abort();
  }, []);

  useEffect(() => {
    if (phase !== "idle" && phase !== "loading") responseRegion.current?.focus();
  }, [phase]);

  const options = questionIntakeThemeCodes.map((code) => ({
    label: themeLabel(code, messages),
    value: createUiControlValue(code),
  }));

  const clearPreviousResult = (): void => {
    requestSequence.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    setOutcome(null);
    setPhase("idle");
  };

  const changeTheme = (value: string): void => {
    clearPreviousResult();
    setThemeCode(parseQuestionIntakeThemeCode(value));
    setThemeError(undefined);
  };

  const changeQuestion = (value: string): void => {
    clearPreviousResult();
    setQuestion(value);
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!hydrated || phase === "loading") return;
    if (themeCode === "") {
      setThemeError(messages.form.themeError);
      document.getElementById("question-intake-theme-option-1")?.focus();
      return;
    }
    if (!navigator.onLine) {
      setOutcome(null);
      setPhase("offline");
      return;
    }

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    setOutcome(null);
    setPhase("loading");

    try {
      const response = await fetch(questionIntakeEndpoint, {
        body: JSON.stringify({
          locale: "en",
          ...(question.trim() === "" ? {} : { question }),
          schemaVersion: questionIntakeSchemaVersion,
          themeCode,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      if (sequence !== requestSequence.current) return;
      if (!response.ok) {
        setPhase(response.status === 503 ? "unavailable" : "error");
        return;
      }
      const parsed = parseQuestionIntakeResponse((await response.json()) as unknown);
      if (sequence !== requestSequence.current) return;
      if (parsed.state === "blocked" || parsed.state === "crisis") setQuestion("");
      setOutcome(parsed);
      setPhase("result");
    } catch {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setPhase(navigator.onLine ? "error" : "offline");
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  };

  const applySuggestion = (code: QuestionIntakeSuggestionCode): void => {
    const nextQuestion = questionForSuggestion(code, messages);
    clearPreviousResult();
    setQuestion(nextQuestion);
    requestAnimationFrame(() => document.getElementById(questionFieldId)?.focus());
  };

  const reset = (): void => {
    clearPreviousResult();
    setQuestion("");
    setThemeCode("");
    setThemeError(undefined);
    requestAnimationFrame(() => document.getElementById("question-intake-theme-option-1")?.focus());
  };

  const retry = (): void => {
    const form = document.getElementById("question-intake-form");
    if (form instanceof HTMLFormElement) form.requestSubmit();
  };

  const outcomeMessages = outcome === null ? null : resultOutcomeMessages(outcome.state, messages);
  const suggestion =
    outcome === null ? null : suggestedQuestion(outcome.suggestedQuestionCode, messages);
  const failureMessages =
    phase === "offline" || phase === "error" || phase === "unavailable"
      ? failureOutcomeMessages(phase, messages)
      : null;
  const useSuggestionLabel =
    outcome?.state === "reframed"
      ? messages.outcomes.reframed.useSuggestion
      : messages.outcomes.blocked.useSuggestion;
  const adoptSuggestion = (): void => {
    if (outcome?.suggestedQuestionCode !== null && outcome?.suggestedQuestionCode !== undefined) {
      applySuggestion(outcome.suggestedQuestionCode);
    }
  };

  return (
    <div className="question-intake-layout">
      <form
        action={questionIntakeEndpoint}
        aria-busy={phase === "loading" || undefined}
        className="question-intake-form"
        id="question-intake-form"
        method="post"
        onSubmit={submit}
      >
        <RadioGroup
          description={messages.form.themeDescription}
          disabled={!hydrated || phase === "loading"}
          {...(themeError === undefined ? {} : { error: themeError })}
          id={themeGroupId}
          label={messages.form.themeLabel}
          name={themeGroupName}
          onValueChange={changeTheme}
          options={options}
          required
          requiredLabel={messages.form.themeRequired}
          value={themeCode === "" ? undefined : createUiControlValue(themeCode)}
        />

        <TextAreaField
          autoComplete="off"
          description={`${messages.form.questionDescription} ${messages.form.example}`}
          dir="auto"
          disabled={!hydrated || phase === "loading"}
          id={questionFieldId}
          label={messages.form.questionLabel}
          maxLength={questionIntakeMaximumLength}
          name={createUiControlName("question")}
          onValueChange={changeQuestion}
          rows={5}
          value={question}
        />

        <div className="question-intake-actions">
          <Button
            disabled={!hydrated}
            label={messages.form.submit}
            {...(phase === "loading" ? { loading: true, loadingLabel: messages.form.loading } : {})}
            type="submit"
          />
        </div>
        {phase === "loading" ? (
          <p aria-live="polite" className="question-intake-progress" role="status">
            {messages.form.loading}
          </p>
        ) : null}
      </form>

      <noscript>
        <p className="question-intake-noscript">{messages.form.noScript}</p>
      </noscript>

      {failureMessages === null ? null : (
        <section
          aria-label={failureMessages.title}
          className="question-intake-result"
          ref={responseRegion}
          tabIndex={-1}
        >
          <InlineAlert
            message={failureMessages.message}
            title={failureMessages.title}
            tone={phase === "offline" ? "warning" : "error"}
          />
          <Button label={failureMessages.retry} onPress={retry} tone="secondary" />
        </section>
      )}

      {phase === "result" && outcome !== null && outcomeMessages !== null ? (
        <section
          aria-label={outcomeMessages.title}
          className="question-intake-result"
          ref={responseRegion}
          tabIndex={-1}
        >
          <InlineAlert
            message={outcomeMessages.message}
            title={outcomeMessages.title}
            tone={outcomeTone(outcome.state)}
          />
          {suggestion === null ? null : <p className="question-intake-suggestion">{suggestion}</p>}
          {outcome.state === "reframed" || outcome.state === "blocked" ? (
            <Button label={useSuggestionLabel} onPress={adoptSuggestion} tone="secondary" />
          ) : outcome.state === "allowed" ? (
            <div className="question-intake-actions">
              <ActionLink href={readingHref}>{messages.outcomes.allowed.continue}</ActionLink>
              <Button label={messages.outcomes.allowed.reset} onPress={reset} tone="secondary" />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
