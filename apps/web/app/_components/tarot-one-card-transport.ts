import {
  tarotReadingCreateSchemaVersion,
  type QuestionIntakeThemeCode,
  type TarotReadingType,
} from "@rituvia/domain";

import {
  parseTarotReadingResponse,
  type TarotReadingPublicResponseV2,
} from "../_contracts/tarot-reading-response";
import type { TarotOneCardFailure, TarotOneCardOperation } from "./tarot-one-card-machine";

export const anonymousSessionEndpoint = "/api/v1/anonymous/session";
export const tarotReadingEndpoint = "/api/v1/readings/tarot";
export const tarotReadingMaximumResponseBytes = 65_536;

export class TarotReadingTransportError extends Error {
  public readonly failure: TarotOneCardFailure;
  public readonly retryAfterSeconds: number | undefined;

  public constructor(failure: TarotOneCardFailure, retryAfterSeconds?: number) {
    super("The tarot reading request did not complete.");
    this.name = "TarotReadingTransportError";
    this.failure = failure;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const fail = (failure: TarotOneCardFailure, retryAfterSeconds?: number): never => {
  throw new TarotReadingTransportError(failure, retryAfterSeconds);
};

const parseRetryAfterSeconds = (response: Response): number | undefined => {
  const value = response.headers.get("retry-after");
  if (value === null || !/^[1-9][0-9]{0,5}$/u.test(value)) return undefined;
  const seconds = Number(value);
  return seconds <= 604_800 ? seconds : undefined;
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

const parseBoundedResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  const contentLength = response.headers.get("content-length");
  if (
    contentType !== "application/json" ||
    (contentLength !== null &&
      (!/^(?:0|[1-9][0-9]{0,5})$/u.test(contentLength) ||
        Number(contentLength) > tarotReadingMaximumResponseBytes))
  ) {
    return fail("error");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > tarotReadingMaximumResponseBytes) {
    return fail("error");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail("error");
  }
};

export const executeTarotReadingOperation = async (
  input: Readonly<{
    fetcher: typeof fetch;
    onSessionReady: () => void;
    operation: TarotOneCardOperation;
    readingType: TarotReadingType;
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
  if (session.status !== 204) {
    return fail(session.status === 429 ? "unavailable" : failureForStatus(session.status));
  }
  input.onSessionReady();

  const reading = await fetcher(tarotReadingEndpoint, {
    body: JSON.stringify({
      locale: "en",
      readingType: input.readingType,
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
    return fail(
      failureForStatus(reading.status),
      reading.status === 429 ? parseRetryAfterSeconds(reading) : undefined,
    );
  }
  let response: TarotReadingPublicResponseV2;
  try {
    response = parseTarotReadingResponse(await parseBoundedResponse(reading), input.readingType);
  } catch {
    return fail("error");
  }
  if (response.themeCode !== input.themeCode) return fail("error");
  return Object.freeze({ replayed: reading.status === 200, response });
};

export const executeTarotOneCardOperation = async (
  input: Omit<Parameters<typeof executeTarotReadingOperation>[0], "readingType">,
): ReturnType<typeof executeTarotReadingOperation> =>
  executeTarotReadingOperation({ ...input, readingType: "one_card" });

export { TarotReadingTransportError as TarotOneCardTransportError };
export const tarotOneCardMaximumResponseBytes = tarotReadingMaximumResponseBytes;
