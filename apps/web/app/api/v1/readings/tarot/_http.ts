import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../config/server";

export const tarotReadingApiPath = "/api/v1/readings/tarot";
export const tarotReadingResourceApiPath = "/api/v1/readings";
export const tarotReadingMaximumBodyBytes = 1_024;
export const tarotReadingSessionCookieName = "__Host-rituvia-anonymous-session";

export const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
export const readingIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const requestIdPattern = /^req_[0-9a-f]{32}$/u;
const privateNoStore = "private, no-store, max-age=0";
const noIndex = "noindex, nofollow, noarchive";

export type TarotReadingProblemCode =
  | "IDEMPOTENCY_KEY_INVALID"
  | "TAROT_READING_BODY_INVALID"
  | "TAROT_READING_BODY_TOO_LARGE"
  | "TAROT_READING_CONFLICT"
  | "TAROT_READING_NOT_FOUND"
  | "TAROT_READING_RATE_LIMITED"
  | "TAROT_READING_REPORT_BODY_INVALID"
  | "TAROT_READING_REPORT_BODY_TOO_LARGE"
  | "TAROT_READING_REPORT_CONFLICT"
  | "TAROT_READING_REPORT_REQUEST_REJECTED"
  | "TAROT_READING_REPORT_UNAVAILABLE"
  | "TAROT_READING_REQUEST_REJECTED"
  | "TAROT_READING_SESSION_REQUIRED"
  | "TAROT_READING_UNAVAILABLE";

export const applyPrivateHeaders = (response: NextResponse): NextResponse => {
  response.headers.set("cache-control", privateNoStore);
  response.headers.set("x-robots-tag", noIndex);
  return response;
};

const safeRequestId = (request: NextRequest): string => {
  const candidate = request.headers.get("x-rituvia-correlation-id");
  return candidate !== null && requestIdPattern.test(candidate)
    ? candidate
    : "req_00000000000000000000000000000000";
};

export const problem = (
  request: NextRequest,
  input: Readonly<{
    code: TarotReadingProblemCode;
    detail: string;
    retryAfterSeconds?: number | undefined;
    instance?: string | undefined;
    status: number;
    title: string;
  }>,
): NextResponse => {
  const response = applyPrivateHeaders(
    NextResponse.json(
      {
        code: input.code,
        detail: input.detail,
        fields: [],
        instance: input.instance ?? tarotReadingApiPath,
        requestId: safeRequestId(request),
        status: input.status,
        title: input.title,
        type: `${getWebRuntimeConfiguration().brand.canonicalOrigin}/problems/${input.code
          .toLowerCase()
          .replaceAll("_", "-")}`,
      },
      { status: input.status },
    ),
  );
  response.headers.set("content-type", "application/problem+json");
  if (
    input.retryAfterSeconds !== undefined &&
    Number.isSafeInteger(input.retryAfterSeconds) &&
    input.retryAfterSeconds >= 1 &&
    input.retryAfterSeconds <= 604_800
  ) {
    response.headers.set("retry-after", String(input.retryAfterSeconds));
  }
  return response;
};

export const hasAcceptedPostOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  (request.headers.get("sec-fetch-site") === null ||
    request.headers.get("sec-fetch-site") === "same-origin");

export const tarotReadingReportApiPath = (readingId: string): string =>
  `${tarotReadingResourceApiPath}/${readingId}/report`;

export const hasAcceptedPrivateReadOrigin = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    (origin === null || origin === getWebRuntimeConfiguration().brand.canonicalOrigin) &&
    (fetchSite === null || fetchSite === "same-origin")
  );
};

export type RequestMetadata = "accepted" | "invalid" | "too_large";

export const classifyJsonRequest = (request: NextRequest): RequestMetadata => {
  if (
    request.headers.get("content-type") !== "application/json" ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null
  ) {
    return "invalid";
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return "accepted";
  if (!/^(?:0|[1-9][0-9]{0,4})$/u.test(contentLength)) return "invalid";
  return Number(contentLength) > tarotReadingMaximumBodyBytes ? "too_large" : "accepted";
};

export class TarotReadingBodyTooLargeError extends Error {}

export const readBoundedJson = async (request: NextRequest): Promise<unknown> => {
  if (request.body === null) throw new SyntaxError("missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > tarotReadingMaximumBodyBytes) throw new TarotReadingBodyTooLargeError();
      chunks.push(result.value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Cancellation failure cannot make rejected bytes acceptable.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
};
