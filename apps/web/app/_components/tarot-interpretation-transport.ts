import { isTarotReadingId } from "../_contracts/tarot-reading-response";
import {
  parseTarotInterpretationResponseV1,
  tarotInterpretationMaximumResponseBytes,
  type TarotInterpretationResponseV1,
} from "../_contracts/tarot-interpretation-response";
import {
  isTarotInterpretationOperationId,
  type TarotInterpretationFailure,
} from "./tarot-interpretation-machine";

export const tarotInterpretationEndpoint = (readingId: string): string =>
  `/api/v1/readings/${readingId}/interpretation`;

export class TarotInterpretationTransportError extends Error {
  public readonly failure: TarotInterpretationFailure;
  public readonly retryAfterSeconds: number | undefined;

  public constructor(failure: TarotInterpretationFailure, retryAfterSeconds?: number) {
    super("The tarot interpretation request did not complete.");
    this.name = "TarotInterpretationTransportError";
    this.failure = failure;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const fail = (failure: TarotInterpretationFailure, retryAfterSeconds?: number): never => {
  throw new TarotInterpretationTransportError(failure, retryAfterSeconds);
};

const responseLengthPattern = /^(?:0|[1-9][0-9]{0,5})$/u;

const responseMediaType = (response: Response): string | null => {
  const value = response.headers.get("content-type");
  return value === null ? null : (value.split(";", 1)[0]?.trim().toLowerCase() ?? null);
};

const validateResponseMetadata = (response: Response, expectedMediaType: string): void => {
  const contentLength = response.headers.get("content-length");
  if (
    responseMediaType(response) !== expectedMediaType ||
    (contentLength !== null &&
      (!responseLengthPattern.test(contentLength) ||
        Number(contentLength) > tarotInterpretationMaximumResponseBytes))
  ) {
    throw new TypeError("The interpretation response metadata is invalid.");
  }
};

const readBoundedResponseBytes = async (response: Response): Promise<Uint8Array> => {
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > tarotInterpretationMaximumResponseBytes) {
        try {
          await reader.cancel();
        } catch {
          // A failed cancellation cannot make oversized bytes acceptable.
        }
        throw new TypeError("The interpretation response is too large.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const parseBoundedJson = async (
  response: Response,
  expectedMediaType: string,
): Promise<unknown> => {
  validateResponseMetadata(response, expectedMediaType);
  const bytes = await readBoundedResponseBytes(response);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
};

const parseRetryAfterSeconds = (response: Response, maximum: number): number | undefined => {
  const value = response.headers.get("retry-after");
  if (value === null || !/^[1-9][0-9]{0,5}$/u.test(value)) return undefined;
  const seconds = Number(value);
  return seconds <= maximum ? seconds : undefined;
};

type ProblemFailureDefinition = Readonly<{
  failure: Exclude<TarotInterpretationFailure, "invalid_response" | "offline">;
  status: number;
}>;

const problemFailureDefinition = (code: string): ProblemFailureDefinition | null => {
  switch (code) {
    case "TAROT_INTERPRETATION_CONFLICT":
      return Object.freeze({ failure: "conflict", status: 409 });
    case "TAROT_INTERPRETATION_PERMISSION_DENIED":
      return Object.freeze({ failure: "permission", status: 403 });
    case "TAROT_INTERPRETATION_RATE_LIMITED":
      return Object.freeze({ failure: "rate_limited", status: 429 });
    case "TAROT_INTERPRETATION_UNAVAILABLE":
      return Object.freeze({ failure: "unavailable", status: 503 });
    case "TAROT_READING_NOT_FOUND":
      return Object.freeze({ failure: "not_found", status: 404 });
    case "TAROT_READING_SESSION_REQUIRED":
      return Object.freeze({ failure: "session_expired", status: 401 });
    default:
      return null;
  }
};

const problemKeys = Object.freeze([
  "code",
  "detail",
  "fields",
  "instance",
  "requestId",
  "status",
  "title",
  "type",
] as const);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactProblemKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === problemKeys.length && problemKeys.every((key) => keys.includes(key));
};

const parseProblemFailure = (
  value: unknown,
  responseStatus: number,
): ProblemFailureDefinition | null => {
  if (!isRecord(value) || !hasExactProblemKeys(value)) return null;
  if (
    typeof value.code !== "string" ||
    typeof value.detail !== "string" ||
    !Array.isArray(value.fields) ||
    value.fields.length !== 0 ||
    typeof value.instance !== "string" ||
    !/^req_[0-9a-f]{32}$/u.test(String(value.requestId)) ||
    value.status !== responseStatus ||
    typeof value.title !== "string" ||
    typeof value.type !== "string"
  ) {
    return null;
  }
  const definition = problemFailureDefinition(value.code);
  return definition?.status === responseStatus ? definition : null;
};

const parseSuccessfulResponse = async (
  response: Response,
  readingId: string,
): Promise<TarotInterpretationResponseV1> => {
  let parsed: TarotInterpretationResponseV1;
  try {
    parsed = parseTarotInterpretationResponseV1(
      await parseBoundedJson(response, "application/json"),
      readingId,
    );
  } catch {
    return fail("invalid_response");
  }

  if (response.status === 202) {
    if (parsed.status !== "processing") return fail("invalid_response");
    const retryAfterSeconds = parseRetryAfterSeconds(response, 30);
    if (
      retryAfterSeconds === undefined ||
      retryAfterSeconds !== Math.ceil(parsed.pollAfterMs / 1_000)
    ) {
      return fail("invalid_response");
    }
    return parsed;
  }

  if (
    response.status !== 200 ||
    parsed.status === "processing" ||
    response.headers.get("retry-after") !== null
  ) {
    return fail("invalid_response");
  }
  return parsed;
};

const failFromProblemResponse = async (response: Response): Promise<never> => {
  let definition: ProblemFailureDefinition | null;
  try {
    definition = parseProblemFailure(
      await parseBoundedJson(response, "application/problem+json"),
      response.status,
    );
  } catch {
    return fail("invalid_response");
  }
  if (definition === null) return fail("invalid_response");
  return fail(
    definition.failure,
    definition.failure === "rate_limited" ? parseRetryAfterSeconds(response, 604_800) : undefined,
  );
};

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  (error as Readonly<{ name?: unknown }>).name === "AbortError";

const executeTarotInterpretationRequest = async (
  input: Readonly<{
    fetcher: typeof fetch;
    operationId?: string | undefined;
    readingId: string;
    signal: AbortSignal;
  }>,
  method: "GET" | "POST",
): Promise<TarotInterpretationResponseV1> => {
  if (!isTarotReadingId(input.readingId)) return fail("invalid_response");

  let requestInit: RequestInit;
  if (method === "POST") {
    if (!isTarotInterpretationOperationId(input.operationId)) return fail("invalid_response");
    requestInit = {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "idempotency-key": input.operationId },
      method: "POST",
      redirect: "error",
      signal: input.signal,
    };
  } else {
    requestInit = {
      cache: "no-store",
      credentials: "same-origin",
      method: "GET",
      redirect: "error",
      signal: input.signal,
    };
  }

  const fetcher = input.fetcher;
  let response: Response;
  try {
    response = await fetcher(tarotInterpretationEndpoint(input.readingId), requestInit);
  } catch (error) {
    if (input.signal.aborted || isAbortError(error)) throw error;
    return fail("offline");
  }

  return response.status === 200 || response.status === 202
    ? parseSuccessfulResponse(response, input.readingId)
    : failFromProblemResponse(response);
};

export const executeTarotInterpretationStart = async (
  input: Readonly<{
    fetcher: typeof fetch;
    operationId: string;
    readingId: string;
    signal: AbortSignal;
  }>,
): Promise<TarotInterpretationResponseV1> => executeTarotInterpretationRequest(input, "POST");

export const executeTarotInterpretationPoll = async (
  input: Readonly<{
    fetcher: typeof fetch;
    readingId: string;
    signal: AbortSignal;
  }>,
): Promise<TarotInterpretationResponseV1> => executeTarotInterpretationRequest(input, "GET");
