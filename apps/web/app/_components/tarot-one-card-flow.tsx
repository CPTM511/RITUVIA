"use client";

import {
  parseQuestionIntakeThemeCode,
  questionIntakeThemeCodes,
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
  type LocalActionHref,
} from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useReducer, useRef, useSyncExternalStore } from "react";

import type { TarotOneCardMessages } from "../_i18n/tarot-one-card-messages";
import {
  createTarotOneCardOperation,
  initialTarotOneCardState,
  reduceTarotOneCardState,
  type TarotOneCardFailure,
  type TarotOneCardOperation,
} from "./tarot-one-card-machine";
import {
  executeTarotOneCardOperation,
  TarotOneCardTransportError,
} from "./tarot-one-card-transport";

const themeGroupId = createUiControlId("tarot-one-card-theme");
const themeGroupName = createUiControlName("tarot-theme-code");
const subscribeToHydration = (): (() => void) => () => undefined;

const themeLabel = (code: QuestionIntakeThemeCode, messages: TarotOneCardMessages): string => {
  switch (code) {
    case "open_reflection":
      return messages.themes.open_reflection;
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
  }
};

const orientationLabel = (
  orientation: "reversed" | "upright",
  messages: TarotOneCardMessages,
): string =>
  orientation === "upright"
    ? messages.result.orientation.upright
    : messages.result.orientation.reversed;

const failureMessages = (failure: TarotOneCardFailure, messages: TarotOneCardMessages) => {
  switch (failure) {
    case "conflict":
      return messages.states.conflict;
    case "error":
      return messages.states.error;
    case "limit_reached":
      return messages.states.limitReached;
    case "offline":
      return messages.states.offline;
    case "session_required":
      return messages.states.sessionRequired;
    case "unavailable":
      return messages.states.unavailable;
  }
};

type TarotOneCardFlowProps = Readonly<{
  messages: TarotOneCardMessages;
  methodologyHref: LocalActionHref;
}>;

export function TarotOneCardFlow({ messages, methodologyHref }: TarotOneCardFlowProps) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [state, dispatch] = useReducer(reduceTarotOneCardState, initialTarotOneCardState);
  const abortController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const inFlight = useRef(false);
  const responseRegion = useRef<HTMLElement | null>(null);
  const revealButtonRegion = useRef<HTMLElement | null>(null);

  useEffect(() => () => abortController.current?.abort(), []);

  useEffect(() => {
    if (state.phase === "failed") responseRegion.current?.focus();
    if (state.phase === "ready_to_reveal") revealButtonRegion.current?.focus();
    if (state.phase === "revealed") responseRegion.current?.focus();
  }, [state.phase]);

  const options = questionIntakeThemeCodes.map((code) => ({
    label: themeLabel(code, messages),
    value: createUiControlValue(code),
  }));

  const cancelCurrentRequest = (): void => {
    requestSequence.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    inFlight.current = false;
  };

  const changeTheme = (value: string): void => {
    cancelCurrentRequest();
    dispatch({ themeCode: parseQuestionIntakeThemeCode(value), type: "select_theme" });
  };

  const perform = async (
    operation: TarotOneCardOperation,
    themeCode: QuestionIntakeThemeCode,
  ): Promise<void> => {
    if (inFlight.current) return;
    if (!navigator.onLine) {
      dispatch({ failure: "offline", type: "fail" });
      return;
    }
    inFlight.current = true;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    try {
      const result = await executeTarotOneCardOperation({
        fetcher: fetch,
        onSessionReady: () => {
          if (sequence === requestSequence.current) dispatch({ type: "session_ready" });
        },
        operation,
        signal: controller.signal,
        themeCode,
      });
      if (sequence === requestSequence.current) {
        dispatch({
          replayed: result.replayed,
          response: result.response,
          type: "reading_ready",
        });
      }
    } catch (error) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      dispatch({
        failure:
          error instanceof TarotOneCardTransportError
            ? error.failure
            : navigator.onLine
              ? "error"
              : "offline",
        type: "fail",
      });
    } finally {
      if (abortController.current === controller) abortController.current = null;
      if (sequence === requestSequence.current) inFlight.current = false;
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!hydrated || inFlight.current) return;
    if (state.themeCode === null) {
      dispatch({ type: "validate" });
      document.getElementById("tarot-one-card-theme-option-1")?.focus();
      return;
    }
    try {
      if (state.phase === "failed" && state.operation !== null) {
        dispatch({ type: "retry" });
        void perform(state.operation, state.themeCode);
        return;
      }
      if (state.phase !== "choosing" && !(state.phase === "failed" && state.operation === null)) {
        return;
      }
      const operation = createTarotOneCardOperation(() => crypto.randomUUID());
      dispatch({ operation, type: "begin" });
      void perform(operation, state.themeCode);
    } catch {
      dispatch({ failure: "error", type: "fail_before_begin" });
    }
  };

  const retry = (): void => {
    const form = document.getElementById("tarot-one-card-form");
    if (form instanceof HTMLFormElement) form.requestSubmit();
  };

  const startOver = (): void => {
    cancelCurrentRequest();
    dispatch({ type: "start_over" });
    requestAnimationFrame(() => document.getElementById("tarot-one-card-theme-option-1")?.focus());
  };

  const busy = state.phase === "ensuring_session" || state.phase === "drawing";
  const controlsLocked =
    !hydrated || busy || state.phase === "ready_to_reveal" || state.phase === "revealed";
  const failure = state.failure === null ? null : failureMessages(state.failure, messages);
  const response = state.response;
  const card = response?.presentation.cards[0];

  return (
    <div className="tarot-flow">
      <form
        action="/api/v1/readings/tarot"
        aria-busy={busy || undefined}
        className="tarot-panel tarot-form"
        id="tarot-one-card-form"
        method="post"
        onSubmit={submit}
      >
        <RadioGroup
          description={messages.form.themeDescription}
          disabled={controlsLocked}
          {...(state.validationError ? { error: messages.form.themeError } : {})}
          id={themeGroupId}
          label={messages.form.themeLabel}
          name={themeGroupName}
          onValueChange={changeTheme}
          options={options}
          required
          requiredLabel={messages.form.themeRequired}
          value={state.themeCode === null ? undefined : createUiControlValue(state.themeCode)}
        />

        {state.phase === "choosing" || busy ? (
          <div className="tarot-actions">
            <Button
              disabled={!hydrated}
              label={messages.form.submit}
              {...(busy ? { loading: true, loadingLabel: messages.form.loading } : {})}
              type="submit"
            />
          </div>
        ) : null}

        {busy ? (
          <div aria-live="polite" className="tarot-progress" role="status">
            <span aria-hidden="true" className="tarot-progress-mark" />
            <span>
              {state.phase === "ensuring_session"
                ? messages.states.session
                : messages.states.drawing}
            </span>
          </div>
        ) : null}
      </form>

      <noscript>
        <p className="tarot-no-script">{messages.form.noScript}</p>
      </noscript>

      {state.phase === "failed" && failure !== null ? (
        <section
          aria-label={failure.title}
          className="tarot-panel"
          ref={responseRegion}
          tabIndex={-1}
        >
          <InlineAlert
            message={failure.message}
            title={failure.title}
            tone={state.failure === "limit_reached" ? "warning" : "error"}
          />
          <div className="tarot-actions">
            {state.failure === "conflict" ? null : (
              <Button
                label={"retry" in failure ? failure.retry : messages.states.error.retry}
                onPress={retry}
              />
            )}
            {state.failure === "conflict" ? (
              <Button
                label={messages.states.conflict.startOver}
                onPress={startOver}
                tone="secondary"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {state.phase === "ready_to_reveal" ? (
        <section
          aria-labelledby="tarot-ready-title"
          className="tarot-panel tarot-reveal"
          ref={revealButtonRegion}
          tabIndex={-1}
        >
          <div aria-hidden="true" className="tarot-card tarot-card-back">
            <span className="tarot-card-mark" />
          </div>
          <div>
            <h2 id="tarot-ready-title">{messages.states.ready.title}</h2>
            <p>{messages.states.ready.message}</p>
            {state.replayed ? <p>{messages.states.replayed}</p> : null}
            <Button
              label={messages.states.ready.reveal}
              onPress={() => dispatch({ type: "reveal" })}
            />
          </div>
        </section>
      ) : null}

      {state.phase === "revealed" && response !== null && card !== undefined ? (
        <section
          aria-labelledby="tarot-result-title"
          className="tarot-panel tarot-result"
          ref={responseRegion}
          tabIndex={-1}
        >
          <header className="tarot-result-heading">
            <p className="tarot-result-eyebrow">{card.positionTitle}</p>
            <h2 id="tarot-result-title">{messages.result.title}</h2>
            <p aria-live="polite" className="tarot-result-eyebrow" role="status">
              {card.cardTitle}, {orientationLabel(card.orientation, messages)}
            </p>
          </header>

          <figure className="tarot-card tarot-card-face">
            <span aria-hidden="true" className="tarot-card-mark" />
            <figcaption>
              <strong>{card.cardTitle}</strong>
              <span>{orientationLabel(card.orientation, messages)}</span>
            </figcaption>
          </figure>

          <p className="tarot-ai-boundary">{messages.result.aiBoundary}</p>
          <section aria-labelledby="tarot-perspective-title" className="tarot-result-section">
            <h3 id="tarot-perspective-title">{messages.result.perspectiveTitle}</h3>
            <p>{card.invitation}</p>
          </section>
          <section aria-labelledby="tarot-themes-title" className="tarot-result-section">
            <h3 id="tarot-themes-title">{messages.result.themesTitle}</h3>
            <ul className="tarot-theme-list">
              {card.coreThemes.map((theme) => (
                <li key={theme}>{theme}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="tarot-alternatives-title" className="tarot-result-section">
            <h3 id="tarot-alternatives-title">{messages.result.alternativeTitle}</h3>
            <dl className="tarot-lenses">
              <div>
                <dt>{messages.result.constructiveLabel}</dt>
                <dd>{card.constructivePossibility}</dd>
              </div>
              <div>
                <dt>{messages.result.tensionLabel}</dt>
                <dd>{card.tension}</dd>
              </div>
            </dl>
          </section>
          <section aria-labelledby="tarot-limit-title" className="tarot-result-section">
            <h3 id="tarot-limit-title">{messages.result.cannotDetermineTitle}</h3>
            <p>{card.cannotDetermine}</p>
          </section>
          <div className="tarot-reflection-grid">
            <section aria-labelledby="tarot-question-title" className="tarot-prompt-card">
              <h3 id="tarot-question-title">{messages.result.reflectionTitle}</h3>
              <p>{card.reflectionQuestion}</p>
            </section>
            <section aria-labelledby="tarot-action-title" className="tarot-prompt-card">
              <h3 id="tarot-action-title">{messages.result.actionTitle}</h3>
              <p>{card.smallAction}</p>
            </section>
          </div>
          <p>{messages.result.saved}</p>
          {state.replayed ? <p>{messages.result.replayed}</p> : null}
          <details className="tarot-methodology">
            <summary>{messages.result.methodologySummary}</summary>
            <dl>
              <div>
                <dt>{messages.result.engineVersionLabel}</dt>
                <dd>{response.facts.engineVersion}</dd>
              </div>
              <div>
                <dt>{messages.result.versionLabel}</dt>
                <dd>{response.facts.catalog.version}</dd>
              </div>
            </dl>
          </details>
          <div className="tarot-completion">
            <p>{messages.result.completion}</p>
            <ActionLink href={methodologyHref} variant="secondary">
              {messages.result.methodologyAction}
            </ActionLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
