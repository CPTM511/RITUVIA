import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createAstrologyNatalViewResponse } from "../../../../_contracts/astrology-natal-response";
import { anonymousSessionCookieName } from "../../../v1/anonymous/session/route";
import { getWebRuntimeConfiguration } from "../../../../../config/server";
import { resolveWebAnonymousSession } from "../../../../../server/anonymous-session";
import {
  loadRecoveryAstrologyService,
  RecoveryAstrologyServiceError,
} from "../../../../../server/recovery-item-8-astrology";
import { inspectRecoveryStagingRuntime } from "../../../../../server/recovery-staging";
import {
  deriveSessionCsrfToken,
  hasValidSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../../server/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const recoveryAstrologyEndpoint = "/api/recovery/item-8/astrology" as const;
const maximumBodyBytes = 4_096;
const privateNoStoreHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

type ProblemCode =
  | "RECOVERY_ASTROLOGY_AMBIGUITY_REQUIRED"
  | "RECOVERY_ASTROLOGY_BODY_INVALID"
  | "RECOVERY_ASTROLOGY_BODY_TOO_LARGE"
  | "RECOVERY_ASTROLOGY_LOCAL_TIME_NONEXISTENT"
  | "RECOVERY_ASTROLOGY_REQUEST_REJECTED"
  | "RECOVERY_ASTROLOGY_SESSION_REQUIRED"
  | "RECOVERY_ASTROLOGY_UNAVAILABLE";

const applyPrivateHeaders = (response: NextResponse, sessionToken?: string): NextResponse => {
  for (const [key, value] of Object.entries(privateNoStoreHeaders))
    response.headers.set(key, value);
  if (sessionToken !== undefined) {
    response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(sessionToken));
  }
  return response;
};

const problem = (code: ProblemCode, status: number, sessionToken?: string): NextResponse =>
  applyPrivateHeaders(
    NextResponse.json(
      {
        code,
        status,
      },
      { status },
    ),
    sessionToken,
  );

const acceptedOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  (request.headers.get("sec-fetch-site") === null ||
    request.headers.get("sec-fetch-site") === "same-origin");

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
      if (total > maximumBodyBytes) throw new BodyTooLargeError();
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
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const recovery = inspectRecoveryStagingRuntime();
  if (!recovery.ready || recovery.recoveryItem !== 8 || !acceptedOrigin(request)) {
    return problem("RECOVERY_ASTROLOGY_REQUEST_REJECTED", 403);
  }
  if (
    request.nextUrl.search !== "" ||
    request.headers.get("content-type") !== "application/json" ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null
  ) {
    return problem("RECOVERY_ASTROLOGY_BODY_INVALID", 400);
  }
  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^(?:0|[1-9][0-9]{0,4})$/u.test(contentLength) || Number(contentLength) > maximumBodyBytes)
  ) {
    return problem("RECOVERY_ASTROLOGY_BODY_TOO_LARGE", 413);
  }
  const sessionToken = request.cookies.get(anonymousSessionCookieName)?.value;
  if (
    sessionToken === undefined ||
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [sessionToken])
  ) {
    return problem("RECOVERY_ASTROLOGY_SESSION_REQUIRED", 401);
  }
  try {
    if ((await resolveWebAnonymousSession(sessionToken)) === null) {
      return problem("RECOVERY_ASTROLOGY_SESSION_REQUIRED", 401);
    }
    const calculation = await loadRecoveryAstrologyService().calculate(
      await readBoundedJson(request),
    );
    return applyPrivateHeaders(
      NextResponse.json(createAstrologyNatalViewResponse(calculation), { status: 200 }),
      sessionToken,
    );
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return problem("RECOVERY_ASTROLOGY_BODY_TOO_LARGE", 413, sessionToken);
    }
    if (error instanceof RecoveryAstrologyServiceError) {
      if (error.code === "RECOVERY_ASTROLOGY_INPUT_INVALID") {
        return problem("RECOVERY_ASTROLOGY_BODY_INVALID", 400, sessionToken);
      }
      if (error.code === "RECOVERY_ASTROLOGY_AMBIGUITY_REQUIRED") {
        return problem(error.code, 409, sessionToken);
      }
      if (error.code === "RECOVERY_ASTROLOGY_LOCAL_TIME_NONEXISTENT") {
        return problem(error.code, 422, sessionToken);
      }
    }
    return problem("RECOVERY_ASTROLOGY_UNAVAILABLE", 503, sessionToken);
  }
};
