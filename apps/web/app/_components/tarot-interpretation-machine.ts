import type { TarotInterpretationResponseV1 } from "../_contracts/tarot-interpretation-response";

export const tarotInterpretationMaximumPollCount = 8;

export type TarotInterpretationFailure =
  | "conflict"
  | "invalid_response"
  | "not_found"
  | "offline"
  | "permission"
  | "rate_limited"
  | "session_expired"
  | "unavailable";

export type TarotInterpretationFinalResponse = Extract<
  TarotInterpretationResponseV1,
  { status: "reviewed_fallback" | "verified" }
>;

export type TarotInterpretationState = Readonly<{
  failure: TarotInterpretationFailure | null;
  operationId: string | null;
  phase:
    | "idle"
    | "processing"
    | "requesting"
    | "reviewed_fallback"
    | "terminal_failed"
    | "transient_failed"
    | "verified";
  pollAfterMs: number | null;
  pollCount: number;
  requestInFlight: boolean;
  requestSequence: number;
  response: TarotInterpretationFinalResponse | null;
  retryAfterSeconds: number | null;
}>;

export type TarotInterpretationEvent =
  | Readonly<{ operationId: string; type: "begin" }>
  | Readonly<{ type: "poll" }>
  | Readonly<{
      operationId: string;
      requestSequence: number;
      response: TarotInterpretationResponseV1;
      type: "request_succeeded";
    }>
  | Readonly<{
      failure: TarotInterpretationFailure;
      operationId: string;
      requestSequence: number;
      retryAfterSeconds?: number | undefined;
      type: "request_failed";
    }>
  | Readonly<{ type: "retry" }>
  | Readonly<{ type: "stop" }>;

export const initialTarotInterpretationState: TarotInterpretationState = Object.freeze({
  failure: null,
  operationId: null,
  phase: "idle",
  pollAfterMs: null,
  pollCount: 0,
  requestInFlight: false,
  requestSequence: 0,
  response: null,
  retryAfterSeconds: null,
});

const operationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const isTarotInterpretationOperationId = (value: unknown): value is string =>
  typeof value === "string" && operationIdPattern.test(value);

export const createTarotInterpretationOperationId = (randomUuid: () => string): string => {
  const operationId = randomUuid();
  if (!isTarotInterpretationOperationId(operationId)) {
    throw new TypeError("A valid interpretation operation identifier is unavailable.");
  }
  return operationId;
};

export const canPollTarotInterpretation = (state: TarotInterpretationState): boolean =>
  state.phase === "processing" &&
  state.operationId !== null &&
  state.pollAfterMs !== null &&
  !state.requestInFlight &&
  state.pollCount < tarotInterpretationMaximumPollCount;

const isCurrentRequest = (
  state: TarotInterpretationState,
  event: Readonly<{ operationId: string; requestSequence: number }>,
): boolean =>
  state.requestInFlight &&
  state.operationId === event.operationId &&
  state.requestSequence === event.requestSequence &&
  (state.phase === "processing" || state.phase === "requesting");

const isTransientFailure = (failure: TarotInterpretationFailure): boolean =>
  failure === "offline" || failure === "rate_limited" || failure === "unavailable";

const boundedRetryAfter = (
  failure: TarotInterpretationFailure,
  retryAfterSeconds: number | undefined,
): number | null =>
  failure === "rate_limited" &&
  Number.isSafeInteger(retryAfterSeconds) &&
  retryAfterSeconds !== undefined &&
  retryAfterSeconds >= 1 &&
  retryAfterSeconds <= 604_800
    ? retryAfterSeconds
    : null;

const withoutPendingRequest = (): Pick<
  TarotInterpretationState,
  "pollAfterMs" | "requestInFlight" | "response" | "retryAfterSeconds"
> => ({
  pollAfterMs: null,
  requestInFlight: false,
  response: null,
  retryAfterSeconds: null,
});

export const reduceTarotInterpretationState = (
  state: TarotInterpretationState,
  event: TarotInterpretationEvent,
): TarotInterpretationState => {
  switch (event.type) {
    case "begin":
      return state.phase === "idle" && isTarotInterpretationOperationId(event.operationId)
        ? Object.freeze({
            ...state,
            operationId: event.operationId,
            phase: "requesting",
            requestInFlight: true,
            requestSequence: 1,
          })
        : state;
    case "poll":
      return canPollTarotInterpretation(state) && state.requestSequence < Number.MAX_SAFE_INTEGER
        ? Object.freeze({
            ...state,
            pollCount: state.pollCount + 1,
            requestInFlight: true,
            requestSequence: state.requestSequence + 1,
          })
        : state;
    case "request_succeeded": {
      if (!isCurrentRequest(state, event)) return state;
      switch (event.response.status) {
        case "processing":
          return state.pollCount >= tarotInterpretationMaximumPollCount
            ? Object.freeze({
                ...state,
                ...withoutPendingRequest(),
                failure: "unavailable" as const,
                phase: "transient_failed" as const,
              })
            : Object.freeze({
                ...state,
                failure: null,
                phase: "processing" as const,
                pollAfterMs: event.response.pollAfterMs,
                requestInFlight: false,
                response: null,
                retryAfterSeconds: null,
              });
        case "verified":
        case "reviewed_fallback":
          return Object.freeze({
            ...state,
            failure: null,
            phase: event.response.status,
            pollAfterMs: null,
            requestInFlight: false,
            response: event.response,
            retryAfterSeconds: null,
          });
        case "failed":
          return Object.freeze({
            ...state,
            ...withoutPendingRequest(),
            failure: null,
            phase: "terminal_failed" as const,
          });
      }
    }
    case "request_failed":
      if (!isCurrentRequest(state, event)) return state;
      return Object.freeze({
        ...state,
        ...withoutPendingRequest(),
        failure: event.failure,
        phase: isTransientFailure(event.failure)
          ? ("transient_failed" as const)
          : ("terminal_failed" as const),
        retryAfterSeconds: boundedRetryAfter(event.failure, event.retryAfterSeconds),
      });
    case "stop":
      return state.phase === "requesting" || state.phase === "processing"
        ? Object.freeze({
            ...state,
            ...withoutPendingRequest(),
            failure: "unavailable" as const,
            phase: "transient_failed" as const,
          })
        : state;
    case "retry":
      return state.phase === "transient_failed" &&
        state.operationId !== null &&
        state.requestSequence < Number.MAX_SAFE_INTEGER
        ? Object.freeze({
            ...state,
            failure: null,
            phase: "requesting",
            pollAfterMs: null,
            pollCount: 0,
            requestInFlight: true,
            requestSequence: state.requestSequence + 1,
            response: null,
            retryAfterSeconds: null,
          })
        : state;
  }
};
