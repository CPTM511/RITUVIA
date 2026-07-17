"use client";

import {
  parseQuestionIntakeThemeCode,
  questionIntakeThemeCodes,
  type QuestionIntakeThemeCode,
  type TarotReadingType,
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

import type { TarotReadingMessages } from "../_i18n/tarot-one-card-messages";
import {
  createTarotOneCardOperation,
  initialTarotOneCardState,
  reduceTarotOneCardState,
  type TarotOneCardFailure,
  type TarotOneCardOperation,
} from "./tarot-one-card-machine";
import {
  executeTarotReadingOperation,
  TarotReadingTransportError,
} from "./tarot-one-card-transport";
import { TarotReadingReport } from "./tarot-reading-report";

const themeGroupName = createUiControlName("tarot-theme-code");
const subscribeToHydration = (): (() => void) => () => undefined;

const themeLabel = (code: QuestionIntakeThemeCode, messages: TarotReadingMessages): string => {
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
  messages: TarotReadingMessages,
): string =>
  orientation === "upright"
    ? messages.result.orientation.upright
    : messages.result.orientation.reversed;

const failureMessages = (failure: TarotOneCardFailure, messages: TarotReadingMessages) => {
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

const formatRetryAfter = (seconds: number): string => {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "long" });
  if (seconds < 90) return formatter.format(seconds, "second");
  if (seconds < 5_400) return formatter.format(Math.ceil(seconds / 60), "minute");
  return formatter.format(Math.ceil(seconds / 3_600), "hour");
};

export type TarotReadingFlowProps = Readonly<{
  messages: TarotReadingMessages;
  methodologyHref: LocalActionHref;
  readingType: TarotReadingType;
}>;

export function TarotReadingFlow({
  messages,
  methodologyHref,
  readingType,
}: TarotReadingFlowProps) {
  const flowSlug = readingType === "one_card" ? "one-card" : "three-card";
  const flowId = `tarot-${flowSlug}`;
  const themeGroupId = createUiControlId(`${flowId}-theme`);
  const expectedCardCount = readingType === "one_card" ? 1 : 3;
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
      const result = await executeTarotReadingOperation({
        fetcher: fetch,
        onSessionReady: () => {
          if (sequence === requestSequence.current) dispatch({ type: "session_ready" });
        },
        operation,
        readingType,
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
          error instanceof TarotReadingTransportError
            ? error.failure
            : navigator.onLine
              ? "error"
              : "offline",
        ...(error instanceof TarotReadingTransportError && error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
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
      document.getElementById(`${flowId}-theme-option-1`)?.focus();
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
    const form = document.getElementById(`${flowId}-form`);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  };

  const startOver = (): void => {
    cancelCurrentRequest();
    dispatch({ type: "start_over" });
    requestAnimationFrame(() => document.getElementById(`${flowId}-theme-option-1`)?.focus());
  };

  const startNewReflection = (): void => {
    cancelCurrentRequest();
    dispatch({ type: "new_reflection" });
    requestAnimationFrame(() => document.getElementById(`${flowId}-theme-option-1`)?.focus());
  };

  const busy = state.phase === "ensuring_session" || state.phase === "drawing";
  const controlsLocked =
    !hydrated ||
    busy ||
    state.phase === "ready_to_reveal" ||
    state.phase === "revealed" ||
    (state.phase === "failed" && state.failure === "conflict");
  const failure = state.failure === null ? null : failureMessages(state.failure, messages);
  const displayedResult =
    state.phase === "revealed" && state.response !== null
      ? Object.freeze({ replayed: state.replayed, response: state.response })
      : state.previousResult;
  const response = displayedResult?.response ?? null;
  const cards = response?.presentation.cards ?? [];

  return (
    <div className="tarot-flow">
      <form
        action="/api/v1/readings/tarot"
        aria-busy={busy || undefined}
        className="tarot-panel tarot-form"
        id={`${flowId}-form`}
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
            {state.failure !== "conflict" && state.failure !== "limit_reached" ? (
              <Button
                label={"retry" in failure ? failure.retry : messages.states.error.retry}
                onPress={retry}
              />
            ) : null}
            {state.failure === "conflict" || state.failure === "limit_reached" ? (
              <Button
                label={
                  state.failure === "conflict"
                    ? messages.states.conflict.startOver
                    : messages.states.limitReached.returnToThemes
                }
                onPress={startOver}
                tone="secondary"
              />
            ) : null}
          </div>
          {state.failure === "limit_reached" && state.failureRetryAfterSeconds !== null ? (
            <p className="tarot-limit-wait">
              <span>{messages.states.limitReached.retryAfterLabel}</span>{" "}
              <time>{formatRetryAfter(state.failureRetryAfterSeconds)}</time>
            </p>
          ) : null}
        </section>
      ) : null}

      {state.phase === "ready_to_reveal" ? (
        <section
          aria-labelledby={`${flowId}-ready-title`}
          className="tarot-panel tarot-reveal"
          ref={revealButtonRegion}
          tabIndex={-1}
        >
          <div aria-hidden="true" className="tarot-card-stack">
            {Array.from({ length: expectedCardCount }, (_, index) => (
              <div className="tarot-card tarot-card-back" key={index}>
                <span className="tarot-card-mark" />
              </div>
            ))}
          </div>
          <div>
            <h2 id={`${flowId}-ready-title`}>{messages.states.ready.title}</h2>
            <p>{messages.states.ready.message}</p>
            {state.replayed ? <p>{messages.states.replayed}</p> : null}
            <Button
              label={messages.states.ready.reveal}
              onPress={() => dispatch({ type: "reveal" })}
            />
          </div>
        </section>
      ) : null}

      {displayedResult !== null &&
      response !== null &&
      response.readingType === readingType &&
      cards.length === expectedCardCount ? (
        <section
          aria-labelledby={`${flowId}-result-title`}
          className="tarot-panel tarot-result"
          ref={responseRegion}
          tabIndex={-1}
        >
          <header className="tarot-result-heading">
            <h2 id={`${flowId}-result-title`}>{messages.result.title}</h2>
            <p aria-live="polite" className="tarot-result-eyebrow" role="status">
              {messages.result.cardsLabel}
            </p>
          </header>

          {state.previousResult === displayedResult ? (
            <p className="tarot-position-boundary">{messages.result.previousPreserved}</p>
          ) : null}

          <p className="tarot-position-boundary">{messages.result.positionBoundary}</p>
          <p className="tarot-ai-boundary">{messages.result.aiBoundary}</p>
          <ol aria-label={messages.result.cardsLabel} className="tarot-result-cards">
            {cards.map((card) => {
              const cardId = `${flowId}-card-${card.order}`;
              return (
                <li className="tarot-result-card" key={card.positionId}>
                  <article aria-labelledby={`${cardId}-title`}>
                    <header className="tarot-result-heading">
                      <p className="tarot-result-eyebrow">{card.positionTitle}</p>
                      <h3 id={`${cardId}-title`}>{card.cardTitle}</h3>
                      <p className="tarot-result-eyebrow">
                        {orientationLabel(card.orientation, messages)}
                      </p>
                    </header>

                    <figure className="tarot-card tarot-card-face">
                      <span aria-hidden="true" className="tarot-card-mark" />
                      <figcaption>
                        <strong>{card.cardTitle}</strong>
                        <span>{orientationLabel(card.orientation, messages)}</span>
                      </figcaption>
                    </figure>

                    <section
                      aria-labelledby={`${cardId}-perspective-title`}
                      className="tarot-result-section"
                    >
                      <h4 id={`${cardId}-perspective-title`}>{messages.result.perspectiveTitle}</h4>
                      <p>{card.invitation}</p>
                    </section>
                    <section
                      aria-labelledby={`${cardId}-themes-title`}
                      className="tarot-result-section"
                    >
                      <h4 id={`${cardId}-themes-title`}>{messages.result.themesTitle}</h4>
                      <ul className="tarot-theme-list">
                        {card.coreThemes.map((theme) => (
                          <li key={theme}>{theme}</li>
                        ))}
                      </ul>
                    </section>
                    <section
                      aria-labelledby={`${cardId}-alternatives-title`}
                      className="tarot-result-section"
                    >
                      <h4 id={`${cardId}-alternatives-title`}>
                        {messages.result.alternativeTitle}
                      </h4>
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
                    <section
                      aria-labelledby={`${cardId}-limit-title`}
                      className="tarot-result-section"
                    >
                      <h4 id={`${cardId}-limit-title`}>{messages.result.cannotDetermineTitle}</h4>
                      <p>{card.cannotDetermine}</p>
                    </section>
                    <div className="tarot-reflection-grid">
                      <section
                        aria-labelledby={`${cardId}-question-title`}
                        className="tarot-prompt-card"
                      >
                        <h4 id={`${cardId}-question-title`}>{messages.result.reflectionTitle}</h4>
                        <p>{card.reflectionQuestion}</p>
                      </section>
                      <section
                        aria-labelledby={`${cardId}-action-title`}
                        className="tarot-prompt-card"
                      >
                        <h4 id={`${cardId}-action-title`}>{messages.result.actionTitle}</h4>
                        <p>{card.smallAction}</p>
                      </section>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
          <p>{messages.result.saved}</p>
          {displayedResult.replayed ? <p>{messages.result.replayed}</p> : null}
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
          <TarotReadingReport
            key={response.readingId}
            messages={messages.result.report}
            positions={cards.map(({ positionId, positionTitle }) => ({
              positionId,
              positionTitle,
            }))}
            readingId={response.readingId}
          />
          <div className="tarot-completion">
            <p>{messages.result.completion}</p>
            <ActionLink href={methodologyHref} variant="secondary">
              {messages.result.methodologyAction}
            </ActionLink>
            {state.phase === "revealed" ? (
              <div className="tarot-new-reflection">
                <p>{messages.result.newReflectionBoundary}</p>
                <Button
                  label={messages.result.newReflection}
                  onPress={startNewReflection}
                  tone="secondary"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function TarotOneCardFlow(props: Omit<TarotReadingFlowProps, "readingType">) {
  return <TarotReadingFlow {...props} readingType="one_card" />;
}
