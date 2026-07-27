import { NumerologyCalculationError } from "@rituvia/divination";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../config/server";
import { calculateWebNumerology } from "../../../../../server/numerology-calculation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const numerologyCalculationApiPath = "/api/v1/numerology/calculate";
export const numerologyCalculationMaximumBodyBytes = 512;

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

type ProblemCode =
  | "NUMEROLOGY_BODY_INVALID"
  | "NUMEROLOGY_BODY_TOO_LARGE"
  | "NUMEROLOGY_REQUEST_REJECTED"
  | "NUMEROLOGY_UNAVAILABLE";

const problem = (code: ProblemCode, status: number): NextResponse =>
  NextResponse.json({ code, status }, { headers: privateHeaders, status });

const hasAcceptedOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  [null, "same-origin"].includes(request.headers.get("sec-fetch-site"));

type RequestMetadata = "accepted" | "invalid" | "too_large";

const classifyRequestMetadata = (request: NextRequest): RequestMetadata => {
  if (
    request.headers.get("content-type") !== "application/json" ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null
  ) {
    return "invalid";
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return "accepted";
  if (!/^(?:0|[1-9][0-9]{0,3})$/u.test(contentLength)) return "invalid";
  return Number(contentLength) > numerologyCalculationMaximumBodyBytes ? "too_large" : "accepted";
};

class BodyTooLargeError extends Error {}

const readBoundedJson = async (request: NextRequest): Promise<unknown> => {
  if (request.body === null) throw new SyntaxError("missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > numerologyCalculationMaximumBodyBytes) throw new BodyTooLargeError();
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
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

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedOrigin(request)) return problem("NUMEROLOGY_REQUEST_REJECTED", 403);
  const metadata = classifyRequestMetadata(request);
  if (metadata === "too_large") return problem("NUMEROLOGY_BODY_TOO_LARGE", 413);
  if (metadata === "invalid") return problem("NUMEROLOGY_BODY_INVALID", 400);

  try {
    return NextResponse.json(calculateWebNumerology(await readBoundedJson(request)), {
      headers: privateHeaders,
      status: 200,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return problem("NUMEROLOGY_BODY_TOO_LARGE", 413);
    if (
      error instanceof NumerologyCalculationError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      return problem("NUMEROLOGY_BODY_INVALID", 400);
    }
    return problem("NUMEROLOGY_UNAVAILABLE", 503);
  }
};
