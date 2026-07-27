import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../config/server";
import {
  accountSessionCookieName,
  logoutWebAccountSession,
} from "../../../../../server/account-auth";
import { hasNoAuthRequestBody, hasValidAccountSessionCsrf } from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const sameOrigin =
    request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
    (request.headers.get("sec-fetch-site") === null ||
      request.headers.get("sec-fetch-site") === "same-origin") &&
    hasValidAccountSessionCsrf(request) &&
    (await hasNoAuthRequestBody(request));
  if (!sameOrigin) {
    return NextResponse.json({ code: "ACCOUNT_LOGOUT_REJECTED", status: 403 }, { status: 403 });
  }
  try {
    await logoutWebAccountSession(request.cookies.get(accountSessionCookieName)?.value);
  } catch {
    return NextResponse.json({ code: "ACCOUNT_LOGOUT_UNAVAILABLE", status: 503 }, { status: 503 });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    name: accountSessionCookieName,
    path: "/",
    sameSite: "strict",
    secure: true,
    value: "",
  });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
};
