import { describe, expect, it } from "vitest";

import {
  canPollTarotInterpretation,
  createTarotInterpretationOperationId,
  initialTarotInterpretationState,
  reduceTarotInterpretationState,
  tarotInterpretationMaximumPollCount,
  type TarotInterpretationState,
} from "../app/_components/tarot-interpretation-machine";
import {
  parseTarotInterpretationResponseV1,
  tarotInterpretationResponseSchemaVersion,
  type TarotInterpretationResponseV1,
} from "../app/_contracts/tarot-interpretation-response";

const readingId = "33333333-3333-4333-8333-333333333333";
const operationId = "11111111-1111-4111-8111-111111111111";

const output = Object.freeze({
  boundaryNote: "Symbolic reflection only; it cannot determine an outcome.",
  perspectives: Object.freeze(["One possibility is to leave room for more context."]),
  reflectionQuestions: Object.freeze(["What choice would preserve your agency today?"]),
  smallAction: Object.freeze({
    label: "Write down one observable next step",
    rationale: "A small concrete step can keep this reflection grounded.",
    timeHorizon: "today" as const,
  }),
  summary: "This reflection invites a pause before choosing a practical next step.",
  symbols: Object.freeze([
    Object.freeze({
      limitation: "This symbol cannot establish what will happen.",
      meaning: "A pause can make another perspective easier to notice.",
      possibility: "You may have room to gather one more piece of information.",
    }),
  ]),
  title: "A grounded pause",
});

const response = (
  status: "failed" | "processing" | "reviewed_fallback" | "verified",
): TarotInterpretationResponseV1 =>
  parseTarotInterpretationResponseV1(
    {
      displayable: status === "reviewed_fallback" || status === "verified",
      ...(status === "processing" ? { pollAfterMs: 1_500 } : {}),
      ...(status === "reviewed_fallback" || status === "verified" ? { output } : {}),
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status,
    },
    readingId,
  );

const begin = (): TarotInterpretationState =>
  reduceTarotInterpretationState(initialTarotInterpretationState, {
    operationId,
    type: "begin",
  });

const completeCurrent = (
  state: TarotInterpretationState,
  nextResponse: TarotInterpretationResponseV1,
): TarotInterpretationState =>
  reduceTarotInterpretationState(state, {
    operationId,
    requestSequence: state.requestSequence,
    response: nextResponse,
    type: "request_succeeded",
  });

describe("tarot interpretation state machine", () => {
  it("starts one sequenced request and ignores invalid or duplicate starts", () => {
    const requesting = begin();

    expect(requesting).toMatchObject({
      operationId,
      phase: "requesting",
      pollCount: 0,
      requestInFlight: true,
      requestSequence: 1,
      response: null,
    });
    expect(
      reduceTarotInterpretationState(initialTarotInterpretationState, {
        operationId: "not-a-key",
        type: "begin",
      }),
    ).toBe(initialTarotInterpretationState);
    expect(
      reduceTarotInterpretationState(requesting, {
        operationId: "22222222-2222-4222-8222-222222222222",
        type: "begin",
      }),
    ).toBe(requesting);
  });

  it("allows only one poll in flight and rejects stale sequence completions", () => {
    const processing = completeCurrent(begin(), response("processing"));
    expect(canPollTarotInterpretation(processing)).toBe(true);

    const polling = reduceTarotInterpretationState(processing, { type: "poll" });
    expect(polling).toMatchObject({
      phase: "processing",
      pollCount: 1,
      requestInFlight: true,
      requestSequence: 2,
    });
    expect(canPollTarotInterpretation(polling)).toBe(false);
    expect(reduceTarotInterpretationState(polling, { type: "poll" })).toBe(polling);

    const stale = reduceTarotInterpretationState(polling, {
      operationId,
      requestSequence: 1,
      response: response("verified"),
      type: "request_succeeded",
    });
    const foreign = reduceTarotInterpretationState(polling, {
      operationId: "22222222-2222-4222-8222-222222222222",
      requestSequence: 2,
      response: response("verified"),
      type: "request_succeeded",
    });
    expect(stale).toBe(polling);
    expect(foreign).toBe(polling);
  });

  it("stops after the bounded poll window and permits only a manual same-operation retry", () => {
    let state = completeCurrent(begin(), response("processing"));
    for (let count = 1; count <= tarotInterpretationMaximumPollCount; count += 1) {
      expect(canPollTarotInterpretation(state)).toBe(true);
      state = reduceTarotInterpretationState(state, { type: "poll" });
      state = completeCurrent(state, response("processing"));
      if (count < tarotInterpretationMaximumPollCount) {
        expect(state.phase).toBe("processing");
      }
    }

    expect(state).toMatchObject({
      failure: "unavailable",
      operationId,
      phase: "transient_failed",
      pollAfterMs: null,
      pollCount: tarotInterpretationMaximumPollCount,
      requestInFlight: false,
      response: null,
    });
    expect(canPollTarotInterpretation(state)).toBe(false);

    const retrying = reduceTarotInterpretationState(state, { type: "retry" });
    expect(retrying).toMatchObject({
      failure: null,
      operationId,
      phase: "requesting",
      pollCount: 0,
      requestInFlight: true,
      requestSequence: state.requestSequence + 1,
    });
  });

  it.each(["verified", "reviewed_fallback"] as const)(
    "stores only the parsed %s final response in its matching terminal state",
    (status) => {
      const finalResponse = response(status);
      const finalState = completeCurrent(begin(), finalResponse);

      expect(finalState).toMatchObject({
        failure: null,
        operationId,
        phase: status,
        pollAfterMs: null,
        requestInFlight: false,
        response: finalResponse,
      });
      expect(reduceTarotInterpretationState(finalState, { type: "retry" })).toBe(finalState);
    },
  );

  it("turns a durable no-output failure into a non-retryable terminal state", () => {
    const failed = completeCurrent(begin(), response("failed"));

    expect(failed).toMatchObject({
      failure: null,
      operationId,
      phase: "terminal_failed",
      requestInFlight: false,
      response: null,
    });
    expect(JSON.stringify(failed)).not.toContain(output.summary);
    expect(reduceTarotInterpretationState(failed, { type: "retry" })).toBe(failed);
  });

  it.each([
    ["offline", "transient_failed"],
    ["rate_limited", "transient_failed"],
    ["unavailable", "transient_failed"],
    ["conflict", "terminal_failed"],
    ["invalid_response", "terminal_failed"],
    ["not_found", "terminal_failed"],
    ["permission", "terminal_failed"],
    ["session_expired", "terminal_failed"],
  ] as const)("classifies %s as %s", (failure, phase) => {
    const requesting = begin();
    const failed = reduceTarotInterpretationState(requesting, {
      failure,
      operationId,
      requestSequence: requesting.requestSequence,
      ...(failure === "rate_limited" ? { retryAfterSeconds: 30 } : {}),
      type: "request_failed",
    });

    expect(failed).toMatchObject({
      failure,
      operationId,
      phase,
      requestInFlight: false,
      retryAfterSeconds: failure === "rate_limited" ? 30 : null,
    });
    const next = reduceTarotInterpretationState(failed, { type: "retry" });
    if (phase === "transient_failed") {
      expect(next).toMatchObject({ operationId, phase: "requesting" });
    } else {
      expect(next).toBe(failed);
    }
  });

  it("stops an active request, rejects its late completion, and retries with the same operation", () => {
    const requesting = begin();
    const stopped = reduceTarotInterpretationState(requesting, { type: "stop" });

    expect(stopped).toMatchObject({
      failure: "unavailable",
      operationId,
      phase: "transient_failed",
      requestInFlight: false,
    });
    expect(completeCurrent(stopped, response("verified"))).toBe(stopped);
    expect(reduceTarotInterpretationState(stopped, { type: "retry" })).toMatchObject({
      operationId,
      phase: "requesting",
      requestSequence: 2,
    });
  });

  it("creates only canonical UUID v4 operation identifiers", () => {
    expect(createTarotInterpretationOperationId(() => operationId)).toBe(operationId);
    expect(() => createTarotInterpretationOperationId(() => "private key")).toThrow(
      "A valid interpretation operation identifier is unavailable.",
    );
  });
});
