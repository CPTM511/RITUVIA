import type { TarotReadingPublicResponseV2 } from "../_contracts/tarot-reading-response";
import type { QuestionIntakeThemeCode } from "@rituvia/domain";

export type TarotOneCardFailure =
  "conflict" | "error" | "limit_reached" | "offline" | "session_required" | "unavailable";

export type TarotOneCardOperation = Readonly<{
  readingIdempotencyKey: string;
  sessionIdempotencyKey: string;
}>;

export type TarotReadingResultSnapshot = Readonly<{
  replayed: boolean;
  response: TarotReadingPublicResponseV2;
}>;

export type TarotOneCardState = Readonly<{
  failure: TarotOneCardFailure | null;
  failureRetryAfterSeconds: number | null;
  operation: TarotOneCardOperation | null;
  phase: "choosing" | "drawing" | "ensuring_session" | "failed" | "ready_to_reveal" | "revealed";
  replayed: boolean;
  previousResult: TarotReadingResultSnapshot | null;
  response: TarotReadingPublicResponseV2 | null;
  themeCode: QuestionIntakeThemeCode | null;
  validationError: boolean;
}>;

export type TarotOneCardEvent =
  | Readonly<{ themeCode: QuestionIntakeThemeCode; type: "select_theme" }>
  | Readonly<{ operation: TarotOneCardOperation; type: "begin" }>
  | Readonly<{ type: "session_ready" }>
  | Readonly<{
      replayed: boolean;
      response: TarotReadingPublicResponseV2;
      type: "reading_ready";
    }>
  | Readonly<{
      failure: TarotOneCardFailure;
      retryAfterSeconds?: number | undefined;
      type: "fail_before_begin";
    }>
  | Readonly<{
      failure: TarotOneCardFailure;
      retryAfterSeconds?: number | undefined;
      type: "fail";
    }>
  | Readonly<{ type: "retry" }>
  | Readonly<{ type: "reveal" }>
  | Readonly<{ type: "new_reflection" }>
  | Readonly<{ type: "start_over" }>
  | Readonly<{ type: "validate" }>;

export const initialTarotOneCardState: TarotOneCardState = Object.freeze({
  failure: null,
  failureRetryAfterSeconds: null,
  operation: null,
  phase: "choosing",
  replayed: false,
  previousResult: null,
  response: null,
  themeCode: null,
  validationError: false,
});

const unchanged = (state: TarotOneCardState): TarotOneCardState => state;

export const reduceTarotOneCardState = (
  state: TarotOneCardState,
  event: TarotOneCardEvent,
): TarotOneCardState => {
  switch (event.type) {
    case "select_theme":
      if (
        state.phase === "ready_to_reveal" ||
        state.phase === "revealed" ||
        (state.phase === "failed" && state.failure === "conflict")
      ) {
        return unchanged(state);
      }
      return Object.freeze({
        ...initialTarotOneCardState,
        previousResult: state.previousResult,
        themeCode: event.themeCode,
      });
    case "validate":
      return state.phase === "choosing" && state.themeCode === null
        ? Object.freeze({ ...state, validationError: true })
        : unchanged(state);
    case "begin":
      return (state.phase === "choosing" ||
        (state.phase === "failed" && state.operation === null)) &&
        state.themeCode !== null
        ? Object.freeze({
            ...state,
            failure: null,
            failureRetryAfterSeconds: null,
            operation: event.operation,
            phase: "ensuring_session",
            validationError: false,
          })
        : unchanged(state);
    case "session_ready":
      return state.phase === "ensuring_session"
        ? Object.freeze({ ...state, phase: "drawing" })
        : unchanged(state);
    case "reading_ready":
      return state.phase === "drawing"
        ? Object.freeze({
            ...state,
            failure: null,
            failureRetryAfterSeconds: null,
            phase: "ready_to_reveal",
            replayed: event.replayed,
            response: event.response,
          })
        : unchanged(state);
    case "fail":
      return state.phase === "ensuring_session" || state.phase === "drawing"
        ? Object.freeze({
            ...state,
            failure: event.failure,
            failureRetryAfterSeconds: event.retryAfterSeconds ?? null,
            phase: "failed",
          })
        : unchanged(state);
    case "fail_before_begin":
      return (state.phase === "choosing" || state.phase === "failed") &&
        state.themeCode !== null &&
        state.operation === null
        ? Object.freeze({
            ...state,
            failure: event.failure,
            failureRetryAfterSeconds: event.retryAfterSeconds ?? null,
            phase: "failed",
          })
        : unchanged(state);
    case "retry":
      return state.phase === "failed" &&
        state.failure !== "conflict" &&
        state.failure !== "limit_reached" &&
        state.operation !== null &&
        state.themeCode !== null
        ? Object.freeze({
            ...state,
            failure: null,
            failureRetryAfterSeconds: null,
            phase: "ensuring_session",
          })
        : unchanged(state);
    case "reveal":
      return state.phase === "ready_to_reveal"
        ? Object.freeze({ ...state, phase: "revealed", previousResult: null })
        : unchanged(state);
    case "new_reflection":
      return state.phase === "revealed" && state.response !== null
        ? Object.freeze({
            ...initialTarotOneCardState,
            previousResult: Object.freeze({ replayed: state.replayed, response: state.response }),
          })
        : unchanged(state);
    case "start_over":
      return state.phase === "failed"
        ? state.previousResult === null
          ? initialTarotOneCardState
          : Object.freeze({ ...initialTarotOneCardState, previousResult: state.previousResult })
        : unchanged(state);
  }
};

export const createTarotOneCardOperation = (randomUuid: () => string): TarotOneCardOperation => {
  const sessionIdempotencyKey = randomUuid();
  const readingIdempotencyKey = randomUuid();
  if (sessionIdempotencyKey === readingIdempotencyKey) {
    throw new TypeError("Independent idempotency keys are unavailable.");
  }
  return Object.freeze({ readingIdempotencyKey, sessionIdempotencyKey });
};
