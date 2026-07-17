import { tarotReadingCreateSchemaVersion, type QuestionIntakeThemeCode } from "@rituvia/domain";

import {
  parseTarotOneCardResponse,
  type TarotReadingPublicResponseV2,
} from "../_contracts/tarot-reading-response";
import type { TarotOneCardFailure, TarotOneCardOperation } from "./tarot-one-card-machine";

export const anonymousSessionEndpoint = "/api/v1/anonymous/session";
export const tarotReadingEndpoint = "/api/v1/readings/tarot";
export const tarotOneCardMaximumResponseBytes = 65_536;

export class TarotOneCardTransportError extends Error {
  public readonly failure: TarotOneCardFailure;

  public constructor(failure: TarotOneCardFailure) {
    super("The one-card request did not complete.");
    this.name = "TarotOneCardTransportError";
    this.failure = failure;
  }
}

const fail = (failure: TarotOneCardFailure): never => {
  throw new TarotOneCardTransportError(failure);
};

const failureForStatus = (status: number): TarotOneCardFailure => {
  switch (status) {
    case 401:
      return "session_required";
    case 409:
      return "conflict";
    case 429:
      return "limit_reached";
    case 503:
      return "unavailable";
    default:
      return "error";
  }
};

const parseBoundedResponse = async (response: Response): Promise<TarotReadingPublicResponseV2> => {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  const contentLength = response.headers.get("content-length");
  if (
    contentType !== "application/json" ||
    (contentLength !== null &&
      (!/^(?:0|[1-9][0-9]{0,5})$/u.test(contentLength) ||
        Number(contentLength) > tarotOneCardMaximumResponseBytes))
  ) {
    return fail("error");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > tarotOneCardMaximumResponseBytes) {
    return fail("error");
  }
  try {
    return parseTarotOneCardResponse(JSON.parse(text) as unknown);
  } catch {
    return fail("error");
  }
};

export const executeTarotOneCardOperation = async (
  input: Readonly<{
    fetcher: typeof fetch;
    onSessionReady: () => void;
    operation: TarotOneCardOperation;
    signal: AbortSignal;
    themeCode: QuestionIntakeThemeCode;
  }>,
): Promise<Readonly<{ replayed: boolean; response: TarotReadingPublicResponseV2 }>> => {
  const fetcher = input.fetcher;
  const session = await fetcher(anonymousSessionEndpoint, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "idempotency-key": input.operation.sessionIdempotencyKey },
    method: "POST",
    signal: input.signal,
  });
  if (session.status !== 204) return fail(failureForStatus(session.status));
  input.onSessionReady();

  const reading = await fetcher(tarotReadingEndpoint, {
    body: JSON.stringify({
      locale: "en",
      readingType: "one_card",
      schemaVersion: tarotReadingCreateSchemaVersion,
      themeCode: input.themeCode,
    }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "idempotency-key": input.operation.readingIdempotencyKey,
    },
    method: "POST",
    signal: input.signal,
  });
  if (reading.status !== 200 && reading.status !== 201) {
    return fail(failureForStatus(reading.status));
  }
  const response = await parseBoundedResponse(reading);
  if (response.themeCode !== input.themeCode) return fail("error");
  return Object.freeze({ replayed: reading.status === 200, response });
};
