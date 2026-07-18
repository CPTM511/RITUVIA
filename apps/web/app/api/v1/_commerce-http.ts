import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { webhookMaximumRawBodyBytes } from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../../../config/server";
import { WebCommerceError, type WebCommerceErrorCode } from "../../../server/commerce";

export const commerceMaximumJsonBodyBytes = 4_096;

export const commercePrivateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const commercePublicHeaders = Object.freeze({
  "cache-control": "public, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

const codeFor = (code: WebCommerceErrorCode): string => {
  switch (code) {
    case "conflict":
      return "COMMERCE_CONFLICT";
    case "input_invalid":
      return "COMMERCE_INPUT_INVALID";
    case "not_eligible":
      return "COMMERCE_NOT_ELIGIBLE";
    case "not_found":
      return "COMMERCE_NOT_FOUND";
    case "session_required":
      return "COMMERCE_SESSION_REQUIRED";
    case "unavailable":
      return "COMMERCE_UNAVAILABLE";
    case "webhook_invalid":
      return "PAYMENT_WEBHOOK_INVALID";
  }
};

const statusFor = (code: WebCommerceErrorCode): number => {
  switch (code) {
    case "input_invalid":
    case "webhook_invalid":
      return 400;
    case "session_required":
      return 401;
    case "not_eligible":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "unavailable":
      return 503;
  }
};

export const commerceProblem = (
  error: unknown,
  fallback: WebCommerceErrorCode = "unavailable",
): NextResponse => {
  const code = error instanceof WebCommerceError ? error.code : fallback;
  const status = statusFor(code);
  return NextResponse.json(
    { code: codeFor(code), schemaVersion: 1, status },
    { headers: commercePrivateHeaders, status },
  );
};

export const hasAcceptedCommerceOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  (request.headers.get("sec-fetch-site") === null ||
    request.headers.get("sec-fetch-site") === "same-origin");

export const hasAcceptedPrivateCommerceRead = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    (origin === null || origin === getWebRuntimeConfiguration().brand.canonicalOrigin) &&
    (fetchSite === null || fetchSite === "same-origin") &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    !request.headers.has("next-router-state-tree")
  );
};

export const hasNoCommerceBody = async (request: NextRequest): Promise<boolean> => {
  if (
    request.headers.get("content-type") !== null ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null ||
    (request.headers.get("content-length") !== null &&
      request.headers.get("content-length") !== "0")
  ) {
    return false;
  }
  if (request.body === null) return true;

  const reader = request.body.getReader();
  try {
    for (let emptyChunkCount = 0; emptyChunkCount < 8; emptyChunkCount += 1) {
      const result = await reader.read();
      if (result.done) return true;
      if (result.value.byteLength !== 0) {
        await reader.cancel().catch(() => undefined);
        return false;
      }
    }
    await reader.cancel().catch(() => undefined);
    return false;
  } catch {
    return false;
  } finally {
    reader.releaseLock();
  }
};

export class CommerceBodyTooLargeError extends Error {}

const readBoundedBytes = async (
  request: NextRequest,
  maximumBytes: number,
): Promise<Uint8Array> => {
  if (request.body === null) throw new SyntaxError("Missing body.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximumBytes) throw new CommerceBodyTooLargeError();
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
  if (total === 0) throw new SyntaxError("Missing body.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const validContentLength = (request: NextRequest, maximumBytes: number): boolean => {
  const value = request.headers.get("content-length");
  if (value === null) return true;
  return /^(?:0|[1-9][0-9]{0,6})$/u.test(value) && Number(value) <= maximumBytes;
};

export const hasAcceptedCommerceJsonMetadata = (request: NextRequest): boolean =>
  request.headers.get("content-type") === "application/json" &&
  request.headers.get("content-encoding") === null &&
  request.headers.get("transfer-encoding") === null &&
  validContentLength(request, commerceMaximumJsonBodyBytes);

export const readCommerceJson = async (request: NextRequest): Promise<unknown> => {
  const bytes = await readBoundedBytes(request, commerceMaximumJsonBodyBytes);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
};

export const hasAcceptedWebhookMetadata = (request: NextRequest): boolean =>
  request.headers.get("content-type") === "application/json" &&
  request.headers.get("content-encoding") === null &&
  request.headers.get("transfer-encoding") === null &&
  validContentLength(request, webhookMaximumRawBodyBytes);

export const readRawPaymentWebhook = (request: NextRequest): Promise<Uint8Array> =>
  readBoundedBytes(request, webhookMaximumRawBodyBytes);

export const webhookHeaders = (
  request: NextRequest,
): Readonly<Record<string, string | undefined>> =>
  Object.freeze(Object.fromEntries(request.headers.entries()));
