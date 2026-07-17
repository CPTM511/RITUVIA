import "server-only";

import type { TarotInterpretationOutputV1 } from "@rituvia/ai";

import {
  tarotInterpretationResponseSchemaVersion,
  type TarotInterpretationOutputProjectionV1,
  type TarotInterpretationResponseV1,
} from "../app/_contracts/tarot-interpretation-response";
import type { WebInterpretationGenerationResultV1 } from "./interpretation-generation";

export type WebInterpretationRuntimeErrorCode =
  "conflict" | "not_found" | "permission_denied" | "rate_limited" | "unavailable";

export class WebInterpretationRuntimeError extends Error {
  readonly code: WebInterpretationRuntimeErrorCode;

  constructor(code: WebInterpretationRuntimeErrorCode) {
    super("The private interpretation operation failed.");
    this.name = "WebInterpretationRuntimeError";
    this.code = code;
  }
}

const unavailable = (): never => {
  throw new WebInterpretationRuntimeError("unavailable");
};

const projectOutput = (
  output: TarotInterpretationOutputV1,
): TarotInterpretationOutputProjectionV1 =>
  Object.freeze({
    boundaryNote: output.boundaryNote,
    perspectives: Object.freeze([...output.perspectives]),
    reflectionQuestions: Object.freeze([...output.reflectionQuestions]),
    ...(output.ritualSuggestion === undefined
      ? {}
      : { ritualSuggestion: Object.freeze({ reason: output.ritualSuggestion.reason }) }),
    smallAction: Object.freeze({
      label: output.smallAction.label,
      rationale: output.smallAction.rationale,
      timeHorizon: output.smallAction.timeHorizon,
    }),
    summary: output.summary,
    symbols: Object.freeze(
      output.symbols.map((symbol) =>
        Object.freeze({
          ...(symbol.limitation === undefined ? {} : { limitation: symbol.limitation }),
          meaning: symbol.meaning,
          possibility: symbol.possibility,
        }),
      ),
    ),
    title: output.title,
  });

/**
 * The only approved projection from the internal generation result to browser
 * bytes. It deliberately strips provider, model, provenance, digest, cost,
 * source identifiers, fact identifiers, lease, and reviewer metadata.
 */
export const projectWebInterpretationGenerationResult = (
  readingId: string,
  result: WebInterpretationGenerationResultV1,
): TarotInterpretationResponseV1 => {
  if (result.kind === "in_progress") {
    return Object.freeze({
      displayable: false,
      pollAfterMs: 1_500,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "processing" as const,
    });
  }

  if (result.status === "pending_verification" || result.status === "failed") {
    return Object.freeze({
      displayable: false,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "failed" as const,
    });
  }

  return Object.freeze({
    displayable: true,
    output: projectOutput(result.output),
    readingId,
    schemaVersion: tarotInterpretationResponseSchemaVersion,
    status: result.status === "verified" ? ("verified" as const) : ("reviewed_fallback" as const),
  });
};

// RIT-035 ships the complete browser/API boundary while paid/provider runtime
// activation remains explicitly safe-off. Future composition must rebuild all
// generation inputs from the owner-bound reading and approved server content;
// it must never accept those inputs from this browser route.
type StartWebTarotInterpretation = (
  readingId: string,
  idempotencyKey: string,
  sessionToken: string,
) => Promise<TarotInterpretationResponseV1>;

export const startWebTarotInterpretation: StartWebTarotInterpretation = async () => unavailable();

// Polling is intentionally a distinct read operation. It must never call the
// claim/reclaim path or invoke a provider/reviewer when production composition
// is added.
type GetWebTarotInterpretation = (
  readingId: string,
  sessionToken: string,
) => Promise<TarotInterpretationResponseV1>;

export const getWebTarotInterpretation: GetWebTarotInterpretation = async () => unavailable();
