"use client";

import { tarotReadingReportCategories, type TarotReadingReportCategory } from "@rituvia/domain";
import { Button, InlineAlert } from "@rituvia/ui";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { TarotReadingMessages } from "../_i18n/tarot-one-card-messages";
import {
  executeTarotReadingReport,
  TarotReadingReportTransportError,
  type TarotReadingReportFailure,
  type TarotReadingReportOperation,
} from "./tarot-reading-report-transport";

type ReportStatus = "idle" | "submitting" | "success" | TarotReadingReportFailure;

export type TarotReadingReportProps = Readonly<{
  interpretationRequestId?: string;
  messages: TarotReadingMessages["result"]["report"];
  positions: readonly Readonly<{ positionId: string; positionTitle: string }>[];
  readingId: string;
}>;

const categoryLabel = (
  category: TarotReadingReportCategory,
  messages: TarotReadingReportProps["messages"],
): string => {
  switch (category) {
    case "accessibility":
      return messages.categories.accessibility;
    case "cultural":
      return messages.categories.cultural;
    case "factual":
      return messages.categories.factual;
    case "rights":
      return messages.categories.rights;
    case "safety":
      return messages.categories.safety;
    case "translation":
      return messages.categories.translation;
  }
};

const failureMessage = (
  failure: TarotReadingReportFailure,
  messages: TarotReadingReportProps["messages"],
): string => {
  switch (failure) {
    case "conflict":
      return messages.conflict;
    case "error":
      return messages.error;
    case "not_found":
      return messages.notFound;
    case "offline":
      return messages.offline;
    case "unavailable":
      return messages.unavailable;
  }
};

export function TarotReadingReport({
  interpretationRequestId,
  messages,
  positions,
  readingId,
}: TarotReadingReportProps) {
  const [category, setCategory] = useState<TarotReadingReportCategory | "">("");
  const [target, setTarget] = useState(
    interpretationRequestId === undefined ? "reading" : "interpretation",
  );
  const [operation, setOperation] = useState<TarotReadingReportOperation | null>(null);
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  useEffect(() => () => abortController.current?.abort(), []);

  const resetOperation = (): void => {
    abortController.current?.abort();
    abortController.current = null;
    inFlight.current = false;
    setOperation(null);
    setStatus("idle");
    setValidationError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (inFlight.current || status === "success") return;
    if (category === "") {
      setValidationError(messages.selectCategory);
      return;
    }
    const position = positions.find(({ positionId }) => positionId === target);
    if (interpretationRequestId === undefined && target !== "reading" && position === undefined) {
      setValidationError(messages.selectTarget);
      return;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    let nextOperation = operation;
    if (nextOperation === null) {
      try {
        nextOperation = Object.freeze({
          category,
          idempotencyKey: crypto.randomUUID(),
          target:
            interpretationRequestId !== undefined
              ? Object.freeze({
                  interpretationRequestId,
                  kind: "interpretation" as const,
                })
              : target === "reading"
                ? Object.freeze({ kind: "reading" as const })
                : Object.freeze({ kind: "position" as const, positionId: target }),
        });
      } catch {
        setStatus("error");
        return;
      }
      setOperation(nextOperation);
    }
    inFlight.current = true;
    setStatus("submitting");
    setValidationError(null);
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    try {
      await executeTarotReadingReport({
        fetcher: fetch,
        operation: nextOperation,
        readingId,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setStatus("success");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(error instanceof TarotReadingReportTransportError ? error.failure : "error");
    } finally {
      if (abortController.current === controller) abortController.current = null;
      inFlight.current = false;
    }
  };

  const failure =
    status === "conflict" ||
    status === "error" ||
    status === "not_found" ||
    status === "offline" ||
    status === "unavailable"
      ? status
      : null;

  return (
    <details className="tarot-methodology tarot-report">
      <summary>
        {interpretationRequestId === undefined ? messages.summary : messages.interpretationSummary}
      </summary>
      <p>
        {interpretationRequestId === undefined
          ? messages.disclosure
          : messages.interpretationDisclosure}
      </p>
      <form aria-busy={status === "submitting" || undefined} onSubmit={submit}>
        <div className="tarot-report-fields">
          <label className="rvt-field">
            <span className="rvt-field__label">{messages.categoryLabel}</span>
            <select
              className="rvt-field__control rvt-field__control--select"
              aria-invalid={validationError === messages.selectCategory || undefined}
              disabled={status === "submitting" || status === "success"}
              onChange={(event) => {
                const value = event.target.value;
                setCategory(
                  value === ""
                    ? ""
                    : (tarotReadingReportCategories.find((candidate) => candidate === value) ?? ""),
                );
                resetOperation();
              }}
              value={category}
            >
              <option value="">{messages.selectCategory}</option>
              {tarotReadingReportCategories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value, messages)}
                </option>
              ))}
            </select>
          </label>
          {interpretationRequestId === undefined ? (
            <label className="rvt-field">
              <span className="rvt-field__label">{messages.targetLabel}</span>
              <select
                className="rvt-field__control rvt-field__control--select"
                aria-invalid={validationError === messages.selectTarget || undefined}
                disabled={status === "submitting" || status === "success"}
                onChange={(event) => {
                  setTarget(event.target.value);
                  resetOperation();
                }}
                value={target}
              >
                <option value="reading">{messages.targetReading}</option>
                {positions.map((position) => (
                  <option key={position.positionId} value={position.positionId}>
                    {messages.targetPosition.replace("{position}", position.positionTitle)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="privacy-note">
              <strong>{messages.targetLabel}:</strong> {messages.targetInterpretation}
            </p>
          )}
        </div>
        {validationError === null ? null : <p role="alert">{validationError}</p>}
        {status === "success" ? (
          <InlineAlert
            live="polite"
            message={messages.success}
            title={
              interpretationRequestId === undefined
                ? messages.summary
                : messages.interpretationSummary
            }
            tone="success"
          />
        ) : null}
        {failure === null ? null : (
          <InlineAlert
            message={failureMessage(failure, messages)}
            title={
              interpretationRequestId === undefined
                ? messages.summary
                : messages.interpretationSummary
            }
            live={failure === "conflict" || failure === "not_found" ? "assertive" : "polite"}
            tone="error"
          />
        )}
        {status === "success" || status === "not_found" ? null : (
          <div className="tarot-actions">
            {failure === "conflict" ? null : (
              <Button
                label={
                  status === "submitting"
                    ? messages.submitting
                    : failure === null
                      ? messages.submit
                      : messages.retry
                }
                {...(status === "submitting"
                  ? { loading: true, loadingLabel: messages.submitting }
                  : {})}
                type="submit"
              />
            )}
            {failure === "conflict" ? (
              <Button label={messages.startNew} onPress={resetOperation} tone="secondary" />
            ) : null}
          </div>
        )}
      </form>
    </details>
  );
}
