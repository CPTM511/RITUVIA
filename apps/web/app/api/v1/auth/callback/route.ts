import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { anonymousSessionCookieName } from "../../anonymous/session/route";
import { getWebRuntimeConfiguration } from "../../../../../config/server";
import {
  accountSessionCookieName,
  completeWebAccountAuth,
  mergeWebAnonymousSubject,
  WebAccountAuthError,
} from "../../../../../server/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const entries = [...request.nextUrl.searchParams.entries()];
  const challengeId = request.nextUrl.searchParams.get("challenge");
  const state = request.nextUrl.searchParams.get("state");
  const token = request.nextUrl.searchParams.get("token");
  if (
    entries.length !== 3 ||
    entries[0]?.[0] !== "challenge" ||
    entries[1]?.[0] !== "state" ||
    entries[2]?.[0] !== "token" ||
    challengeId === null ||
    state === null ||
    token === null
  ) {
    return NextResponse.json(
      { code: "ACCOUNT_AUTH_CALLBACK_INVALID", status: 400 },
      { headers: privateHeaders, status: 400 },
    );
  }
  try {
    const anonymousSessionToken = request.cookies.get(anonymousSessionCookieName)?.value;
    const completed = await completeWebAccountAuth({
      challengeId,
      previousSessionToken: request.cookies.get(accountSessionCookieName)?.value,
      state,
      token,
    });
    if (anonymousSessionToken !== undefined) {
      await mergeWebAnonymousSubject({
        accountSessionToken: completed.sessionToken,
        anonymousSessionToken,
        idempotencyKey: `auth_callback_${completed.sessionToken}`,
      });
    }
    const response = NextResponse.redirect(
      new URL(completed.returnTo, getWebRuntimeConfiguration().brand.canonicalOrigin),
      303,
    );
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    const expires = new Date(completed.context.expiresAt);
    response.cookies.set({
      expires,
      httpOnly: true,
      maxAge: Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1_000)),
      name: accountSessionCookieName,
      path: "/",
      sameSite: "strict",
      secure: true,
      value: completed.sessionToken,
    });
    if (anonymousSessionToken !== undefined) {
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
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        code:
          error instanceof WebAccountAuthError && error.code === "invalid"
            ? "ACCOUNT_AUTH_CALLBACK_INVALID"
            : "ACCOUNT_AUTH_UNAVAILABLE",
        status: error instanceof WebAccountAuthError && error.code === "invalid" ? 400 : 503,
      },
      {
        headers: privateHeaders,
        status: error instanceof WebAccountAuthError && error.code === "invalid" ? 400 : 503,
      },
    );
  }
};
