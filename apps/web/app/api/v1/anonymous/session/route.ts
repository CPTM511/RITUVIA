import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { anonymousSessionApiMessages } from "../../../../_i18n/api-messages";
import { getWebRuntimeConfiguration } from "../../../../../config/server";
import {
  ensureWebAnonymousSession,
  WebAnonymousSessionError,
} from "../../../../../server/anonymous-session";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../../../../../server/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const anonymousSessionCookieName = "__Host-rituvia-anonymous-session";
const anonymousSessionPath = "/api/v1/anonymous/session";
const requestIdPattern = /^req_[0-9a-f]{32}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const privateNoStore = "private, no-store, max-age=0";
const noIndex = "noindex, nofollow, noarchive";

type ProblemCode =
  | "ANONYMOUS_SESSION_CONFLICT"
  | "ANONYMOUS_SESSION_RATE_LIMITED"
  | "ANONYMOUS_SESSION_UNAVAILABLE"
  | "IDEMPOTENCY_KEY_INVALID"
  | "REQUEST_BODY_INVALID"
  | "REQUEST_ORIGIN_REJECTED";

const safeRequestId = (request: NextRequest): string => {
  const candidate = request.headers.get("x-rituvia-correlation-id");
  return candidate !== null && requestIdPattern.test(candidate)
    ? candidate
    : "req_00000000000000000000000000000000";
};

const problem = (
  request: NextRequest,
  input: {
    code: ProblemCode;
    detail: string;
    retryAfterSeconds?: number | undefined;
    status: number;
    title: string;
  },
): NextResponse => {
  const response = NextResponse.json(
    {
      code: input.code,
      detail: input.detail,
      fields: [],
      instance: anonymousSessionPath,
      requestId: safeRequestId(request),
      status: input.status,
      title: input.title,
      type: `${getWebRuntimeConfiguration().brand.canonicalOrigin}/problems/${input.code.toLowerCase().replaceAll("_", "-")}`,
    },
    { status: input.status },
  );
  response.headers.set("cache-control", privateNoStore);
  response.headers.set("x-robots-tag", noIndex);
  if (input.retryAfterSeconds !== undefined) {
    response.headers.set("retry-after", String(input.retryAfterSeconds));
  }
  return response;
};

const acceptsRequest = (request: NextRequest): boolean => {
  const configuration = getWebRuntimeConfiguration();
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const contentLength = request.headers.get("content-length");
  return (
    origin === configuration.brand.canonicalOrigin &&
    (fetchSite === null || fetchSite === "same-origin") &&
    request.headers.get("transfer-encoding") === null &&
    (contentLength === null || contentLength === "0") &&
    request.headers.get("content-type") === null
  );
};

const requestHasBody = async (request: NextRequest): Promise<boolean> => {
  if (request.body === null) return false;
  const reader = request.body.getReader();
  try {
    const firstChunk = await reader.read();
    return !firstChunk.done;
  } catch {
    return true;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // A failed cancellation cannot make an unknown request body acceptable.
    }
    reader.releaseLock();
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!acceptsRequest(request)) {
    return problem(request, {
      code: "REQUEST_ORIGIN_REJECTED",
      ...anonymousSessionApiMessages.invalidRequest,
      status: 403,
    });
  }
  if (await requestHasBody(request)) {
    return problem(request, {
      code: "REQUEST_BODY_INVALID",
      ...anonymousSessionApiMessages.invalidRequest,
      status: 400,
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !idempotencyKeyPattern.test(idempotencyKey)) {
    return problem(request, {
      code: "IDEMPOTENCY_KEY_INVALID",
      ...anonymousSessionApiMessages.invalidIdempotency,
      status: 400,
    });
  }

  try {
    const existingToken = request.cookies.get(anonymousSessionCookieName)?.value;
    const ensured = await ensureWebAnonymousSession({
      idempotencyKey,
      token: existingToken,
    });
    const csrfSessionToken = ensured.kind === "created" ? ensured.token : existingToken;
    if (csrfSessionToken === undefined) {
      throw new WebAnonymousSessionError("unavailable");
    }
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("cache-control", privateNoStore);
    response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(csrfSessionToken));
    response.headers.set("x-robots-tag", noIndex);
    if (ensured.kind === "created") {
      const expires = new Date(ensured.context.expiresAt);
      response.cookies.set({
        expires,
        httpOnly: true,
        maxAge: Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1_000)),
        name: anonymousSessionCookieName,
        path: "/",
        sameSite: "strict",
        secure: true,
        value: ensured.token,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof WebAnonymousSessionError) {
      if (error.code === "rate_limited") {
        return problem(request, {
          code: "ANONYMOUS_SESSION_RATE_LIMITED",
          ...anonymousSessionApiMessages.rateLimited,
          retryAfterSeconds: error.retryAfterSeconds,
          status: 429,
        });
      }
      if (error.code === "conflict") {
        return problem(request, {
          code: "ANONYMOUS_SESSION_CONFLICT",
          ...anonymousSessionApiMessages.conflict,
          status: 409,
        });
      }
    }
    return problem(request, {
      code: "ANONYMOUS_SESSION_UNAVAILABLE",
      ...anonymousSessionApiMessages.unavailable,
      status: 503,
    });
  }
};
