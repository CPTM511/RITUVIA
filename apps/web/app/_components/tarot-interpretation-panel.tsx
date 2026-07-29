"use client";

import { Button, InlineAlert } from "@rituvia/ui";
import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";

import type { TarotReadingMessages } from "../_i18n/tarot-one-card-messages";
import type { Locale } from "../_i18n/routing";
import {
  canPollTarotInterpretation,
  createTarotInterpretationOperationId,
  initialTarotInterpretationState,
  reduceTarotInterpretationState,
  type TarotInterpretationFailure,
} from "./tarot-interpretation-machine";
import {
  executeTarotInterpretationPoll,
  executeTarotInterpretationStart,
  TarotInterpretationTransportError,
} from "./tarot-interpretation-transport";
import { TarotReadingReport } from "./tarot-reading-report";

type Messages = TarotReadingMessages["result"]["interpretation"];

export type TarotInterpretationPanelProps = Readonly<{
  locale: Locale;
  messages: Messages;
  reportMessages: TarotReadingMessages["result"]["report"];
  readingId: string;
}>;

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  (error as Readonly<{ name?: unknown }>).name === "AbortError";

const fallbackFailure = (): TarotInterpretationFailure =>
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "invalid_response";

const failureMessages = (failure: TarotInterpretationFailure, messages: Messages) => {
  switch (failure) {
    case "conflict":
      return messages.failures.conflict;
    case "invalid_response":
      return messages.failures.invalid_response;
    case "not_found":
      return messages.failures.not_found;
    case "offline":
      return messages.failures.offline;
    case "permission":
      return messages.failures.permission;
    case "rate_limited":
      return messages.failures.rate_limited;
    case "session_expired":
      return messages.failures.session_expired;
    case "unavailable":
      return messages.failures.unavailable;
  }
};

const timeHorizonLabel = (
  timeHorizon: "open" | "this_week" | "today",
  messages: Messages,
): string => {
  switch (timeHorizon) {
    case "open":
      return messages.timeHorizon.open;
    case "this_week":
      return messages.timeHorizon.this_week;
    case "today":
      return messages.timeHorizon.today;
  }
};

export function TarotInterpretationPanel({
  locale,
  messages,
  reportMessages,
  readingId,
}: TarotInterpretationPanelProps) {
  const [state, dispatch] = useReducer(
    reduceTarotInterpretationState,
    initialTarotInterpretationState,
  );
  const controlId = useId();
  const [visibilityVersion, setVisibilityVersion] = useState(0);
  const abortController = useRef<AbortController | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalRegion = useRef<HTMLElement | null>(null);

  const clearPollTimer = useCallback((): void => {
    if (pollTimer.current === null) return;
    clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(
    () => () => {
      clearPollTimer();
      abortController.current?.abort();
    },
    [clearPollTimer],
  );

  useEffect(() => {
    const onVisibilityChange = (): void => setVisibilityVersion((value) => value + 1);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (
      state.phase === "verified" ||
      state.phase === "reviewed_fallback" ||
      state.phase === "terminal_failed" ||
      state.phase === "transient_failed"
    ) {
      terminalRegion.current?.focus();
    }
  }, [state.phase]);

  const completeRequest = useCallback(
    async (operationId: string, requestSequence: number, kind: "poll" | "start"): Promise<void> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        dispatch({
          failure: "offline",
          operationId,
          requestSequence,
          type: "request_failed",
        });
        return;
      }

      const controller = new AbortController();
      abortController.current?.abort();
      abortController.current = controller;
      try {
        const response =
          kind === "start"
            ? await executeTarotInterpretationStart({
                fetcher: fetch,
                operationId,
                readingId,
                signal: controller.signal,
              })
            : await executeTarotInterpretationPoll({
                fetcher: fetch,
                readingId,
                signal: controller.signal,
              });
        dispatch({
          operationId,
          requestSequence,
          response,
          type: "request_succeeded",
        });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const failure =
          error instanceof TarotInterpretationTransportError ? error.failure : fallbackFailure();
        dispatch({
          failure,
          operationId,
          requestSequence,
          ...(error instanceof TarotInterpretationTransportError &&
          error.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
          type: "request_failed",
        });
      } finally {
        if (abortController.current === controller) abortController.current = null;
      }
    },
    [readingId],
  );

  useEffect(() => {
    clearPollTimer();
    if (
      !canPollTarotInterpretation(state) ||
      document.visibilityState === "hidden" ||
      state.operationId === null ||
      state.pollAfterMs === null
    ) {
      return;
    }
    const operationId = state.operationId;
    const requestSequence = state.requestSequence + 1;
    pollTimer.current = setTimeout(() => {
      pollTimer.current = null;
      dispatch({ type: "poll" });
      void completeRequest(operationId, requestSequence, "poll");
    }, state.pollAfterMs);
    return clearPollTimer;
  }, [clearPollTimer, completeRequest, state, visibilityVersion]);

  const start = (): void => {
    if (state.phase !== "idle") return;
    try {
      const operationId = createTarotInterpretationOperationId(() => crypto.randomUUID());
      dispatch({ operationId, type: "begin" });
      void completeRequest(operationId, 1, "start");
    } catch {
      // A missing secure UUID capability is a local fail-closed condition. No
      // request or fallback text is created.
    }
  };

  const retry = (): void => {
    if (state.phase !== "transient_failed" || state.operationId === null) return;
    const operationId = state.operationId;
    const requestSequence = state.requestSequence + 1;
    dispatch({ type: "retry" });
    void completeRequest(operationId, requestSequence, "start");
  };

  const stop = (): void => {
    clearPollTimer();
    abortController.current?.abort();
    abortController.current = null;
    dispatch({ type: "stop" });
  };

  const busy = state.phase === "requesting" || state.phase === "processing";
  const failureMessage = state.failure === null ? null : failureMessages(state.failure, messages);
  const finalResponse = state.response;
  const headingId = `${controlId}-heading`;

  return (
    <section
      aria-busy={busy || undefined}
      aria-labelledby={headingId}
      className="principles-section"
    >
      <div className="principle-card">
        <header className="tarot-result-heading">
          <p className="eyebrow">{messages.kicker}</p>
          <h3 id={headingId}>{messages.heading}</h3>
          <p className="privacy-note">{messages.boundary}</p>
        </header>

        {state.phase === "idle" ? (
          <div className="tarot-result-section">
            <p>{messages.idleDescription}</p>
            <p className="privacy-note">{messages.privacy}</p>
            <Button label={messages.start} onPress={start} />
          </div>
        ) : null}

        {busy ? (
          <div aria-live="polite" className="tarot-result-section" role="status">
            <strong>{messages.processingTitle}</strong>
            <p>{messages.processingDescription}</p>
            <Button label={messages.cancel} onPress={stop} tone="secondary" />
          </div>
        ) : null}

        {(state.phase === "transient_failed" || state.phase === "terminal_failed") &&
        finalResponse === null ? (
          <section
            aria-label={(failureMessage ?? messages.terminal).title}
            className="tarot-result-section"
            ref={terminalRegion}
            tabIndex={-1}
          >
            <InlineAlert
              message={(failureMessage ?? messages.terminal).message}
              title={(failureMessage ?? messages.terminal).title}
              tone={state.failure === "rate_limited" ? "warning" : "error"}
            />
            {state.phase === "transient_failed" ? (
              <Button label={messages.retry} onPress={retry} />
            ) : null}
          </section>
        ) : null}

        {finalResponse !== null ? (
          <div className="tarot-result-card">
            <article aria-labelledby={`${headingId}-result`} ref={terminalRegion} tabIndex={-1}>
              <header className="tarot-result-heading">
                <p className="eyebrow">
                  {finalResponse.status === "verified"
                    ? messages.verifiedLabel
                    : messages.fallbackLabel}
                </p>
                <h4 id={`${headingId}-result`}>{finalResponse.output.title}</h4>
                {finalResponse.status === "reviewed_fallback" ? (
                  <p className="privacy-note">{messages.fallbackNotice}</p>
                ) : null}
                <p>{finalResponse.output.summary}</p>
              </header>

              <div className="tarot-result-section">
                <h5 id={`${headingId}-symbols`}>{messages.symbolsTitle}</h5>
                <div className="tarot-reflection-grid">
                  {finalResponse.output.symbols.map((symbol, index) => (
                    <dl className="principle-card tarot-lenses" key={`${index}-${symbol.meaning}`}>
                      <div>
                        <dt>{messages.meaningLabel}</dt>
                        <dd>{symbol.meaning}</dd>
                      </div>
                      <div>
                        <dt>{messages.possibilityLabel}</dt>
                        <dd>{symbol.possibility}</dd>
                      </div>
                      {symbol.limitation === undefined ? null : (
                        <div>
                          <dt>{messages.limitsTitle}</dt>
                          <dd>{symbol.limitation}</dd>
                        </div>
                      )}
                    </dl>
                  ))}
                </div>
              </div>

              <div className="tarot-result-section">
                <h5 id={`${headingId}-perspectives`}>{messages.perspectivesTitle}</h5>
                <ul>
                  {finalResponse.output.perspectives.map((perspective) => (
                    <li key={perspective}>{perspective}</li>
                  ))}
                </ul>
              </div>

              <div className="tarot-result-section">
                <h5 id={`${headingId}-questions`}>{messages.questionsTitle}</h5>
                <ul>
                  {finalResponse.output.reflectionQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>

              <div className="privacy-note">
                <h5 id={`${headingId}-action`}>{messages.actionTitle}</h5>
                <p>
                  <strong>{finalResponse.output.smallAction.label}</strong>
                </p>
                <p>{finalResponse.output.smallAction.rationale}</p>
                <p className="eyebrow">
                  {timeHorizonLabel(finalResponse.output.smallAction.timeHorizon, messages)}
                </p>
              </div>

              {finalResponse.output.ritualSuggestion === undefined ? null : (
                <div className="tarot-result-section">
                  <h5 id={`${headingId}-ritual`}>{messages.ritualTitle}</h5>
                  <p>{finalResponse.output.ritualSuggestion.reason}</p>
                </div>
              )}

              <footer className="privacy-note">
                <p>{finalResponse.output.boundaryNote}</p>
                <p>{messages.boundary}</p>
              </footer>
            </article>
            {state.operationId === null ? null : (
              <TarotReadingReport
                interpretationRequestId={state.operationId}
                locale={locale}
                messages={reportMessages}
                positions={[]}
                readingId={readingId}
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
