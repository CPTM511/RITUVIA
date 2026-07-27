import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { anonymousSessionCookieName } from "../../anonymous/session/route";
import { getWebRuntimeConfiguration } from "../../../../../config/server";
import {
  accountSessionCookieName,
  mergeWebAnonymousSubject,
  WebAccountAuthError,
} from "../../../../../server/account-auth";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../../../../../server/session-csrf";
import { hasNoAuthRequestBody, hasValidAccountSessionCsrf } from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    !hasValidAccountSessionCsrf(request) ||
    !(await hasNoAuthRequestBody(request)) ||
    idempotencyKey === null
  ) {
    return NextResponse.json({ code: "ACCOUNT_MERGE_REJECTED", status: 403 }, { status: 403 });
  }
  try {
    const merged = await mergeWebAnonymousSubject({
      accountSessionToken: request.cookies.get(accountSessionCookieName)?.value,
      anonymousSessionToken: request.cookies.get(anonymousSessionCookieName)?.value,
      idempotencyKey,
    });
    const response = new NextResponse(null, { status: 204 });
    const expires = new Date(merged.context.expiresAt);
    response.cookies.set({
      expires,
      httpOnly: true,
      maxAge: Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1_000)),
      name: accountSessionCookieName,
      path: "/",
      sameSite: "strict",
      secure: true,
      value: merged.sessionToken,
    });
    response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(merged.sessionToken));
    response.cookies.set({
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      name: anonymousSessionCookieName,
      path: "/",
      sameSite: "strict",
      secure: true,
      value: "",
    });
    response.headers.set("cache-control", "private, no-store, max-age=0");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  } catch (error) {
    const conflict = error instanceof WebAccountAuthError && error.code === "conflict";
    return NextResponse.json(
      {
        code: conflict ? "ACCOUNT_MERGE_CONFLICT" : "ACCOUNT_MERGE_UNAVAILABLE",
        status: conflict ? 409 : 503,
      },
      { status: conflict ? 409 : 503 },
    );
  }
};
