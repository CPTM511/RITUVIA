import { describe, expect, it } from "vitest";

import {
  createTarotOneCardOperation,
  initialTarotOneCardState,
  reduceTarotOneCardState,
} from "../app/_components/tarot-one-card-machine";
import { parseTarotOneCardResponse } from "../app/_contracts/tarot-reading-response";
import { createTarotOneCardResponseFixture } from "./fixtures/tarot-reading-response";

const operation = Object.freeze({
  readingIdempotencyKey: "22222222-2222-4222-8222-222222222222",
  sessionIdempotencyKey: "11111111-1111-4111-8111-111111111111",
});

const nextOperation = Object.freeze({
  readingIdempotencyKey: "44444444-4444-4444-8444-444444444444",
  sessionIdempotencyKey: "33333333-3333-4333-8333-333333333333",
});

const reachRevealedState = () => {
  const selected = reduceTarotOneCardState(initialTarotOneCardState, {
    themeCode: "open_reflection",
    type: "select_theme",
  });
  const begun = reduceTarotOneCardState(selected, { operation, type: "begin" });
  const drawing = reduceTarotOneCardState(begun, { type: "session_ready" });
  const ready = reduceTarotOneCardState(drawing, {
    replayed: false,
    response: parseTarotOneCardResponse(createTarotOneCardResponseFixture()),
    type: "reading_ready",
  });
  return reduceTarotOneCardState(ready, { type: "reveal" });
};

describe("one-card interaction state machine", () => {
  it("draws, preserves the operation across explicit retry, and reveals without redrawing", () => {
    const selected = reduceTarotOneCardState(initialTarotOneCardState, {
      themeCode: "open_reflection",
      type: "select_theme",
    });
    const begun = reduceTarotOneCardState(selected, { operation, type: "begin" });
    const drawing = reduceTarotOneCardState(begun, { type: "session_ready" });
    const failed = reduceTarotOneCardState(drawing, { failure: "offline", type: "fail" });
    const retrying = reduceTarotOneCardState(failed, { type: "retry" });
    const retriedDrawing = reduceTarotOneCardState(retrying, { type: "session_ready" });
    const ready = reduceTarotOneCardState(retriedDrawing, {
      replayed: true,
      response: parseTarotOneCardResponse(createTarotOneCardResponseFixture()),
      type: "reading_ready",
    });
    const revealed = reduceTarotOneCardState(ready, { type: "reveal" });

    expect(retrying.operation).toBe(operation);
    expect(ready.phase).toBe("ready_to_reveal");
    expect(revealed).toMatchObject({ operation, phase: "revealed", replayed: true });
  });

  it("requires explicit start-over after a conflict and clears the saved operation", () => {
    const selected = reduceTarotOneCardState(initialTarotOneCardState, {
      themeCode: "work",
      type: "select_theme",
    });
    const begun = reduceTarotOneCardState(selected, { operation, type: "begin" });
    const failed = reduceTarotOneCardState(begun, { failure: "conflict", type: "fail" });

    expect(reduceTarotOneCardState(failed, { type: "retry" })).toBe(failed);
    expect(reduceTarotOneCardState(failed, { themeCode: "creativity", type: "select_theme" })).toBe(
      failed,
    );
    expect(reduceTarotOneCardState(failed, { type: "start_over" })).toBe(initialTarotOneCardState);
  });

  it("creates a new operation only after an explicit new-reflection transition", () => {
    const revealed = reachRevealedState();

    expect(reduceTarotOneCardState(revealed, { type: "begin", operation: nextOperation })).toBe(
      revealed,
    );
    expect(reduceTarotOneCardState(revealed, { type: "retry" })).toBe(revealed);

    const choosingAgain = reduceTarotOneCardState(revealed, { type: "new_reflection" });
    expect(choosingAgain).toMatchObject({
      operation: null,
      phase: "choosing",
      previousResult: {
        replayed: false,
        response: revealed.response,
      },
      response: null,
      themeCode: null,
    });

    const selectedAgain = reduceTarotOneCardState(choosingAgain, {
      themeCode: "creativity",
      type: "select_theme",
    });
    const begunAgain = reduceTarotOneCardState(selectedAgain, {
      operation: nextOperation,
      type: "begin",
    });
    expect(begunAgain).toMatchObject({
      operation: nextOperation,
      phase: "ensuring_session",
      previousResult: choosingAgain.previousResult,
    });
    expect(begunAgain.operation).not.toBe(operation);
  });

  it.each([
    ["offline", undefined],
    ["limit_reached", 3_600],
  ] as const)(
    "preserves the previous result when a new reflection fails with %s",
    (failure, retryAfterSeconds) => {
      const revealed = reachRevealedState();
      const choosingAgain = reduceTarotOneCardState(revealed, { type: "new_reflection" });
      const selectedAgain = reduceTarotOneCardState(choosingAgain, {
        themeCode: "work",
        type: "select_theme",
      });
      const begunAgain = reduceTarotOneCardState(selectedAgain, {
        operation: nextOperation,
        type: "begin",
      });
      const failed = reduceTarotOneCardState(begunAgain, {
        failure,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        type: "fail",
      });

      expect(failed).toMatchObject({
        failure,
        failureRetryAfterSeconds: retryAfterSeconds ?? null,
        operation: nextOperation,
        phase: "failed",
        previousResult: choosingAgain.previousResult,
      });
      if (failure === "limit_reached") {
        expect(reduceTarotOneCardState(failed, { type: "retry" })).toBe(failed);
      } else {
        expect(reduceTarotOneCardState(failed, { type: "retry" })).toMatchObject({
          operation: nextOperation,
          phase: "ensuring_session",
          previousResult: choosingAgain.previousResult,
        });
      }
    },
  );

  it("creates separate session and reading idempotency keys and fails on reuse", () => {
    const values = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    expect(createTarotOneCardOperation(() => values.shift() ?? "")).toEqual(operation);
    expect(() => createTarotOneCardOperation(() => "same")).toThrow(
      "Independent idempotency keys are unavailable.",
    );
  });
});
