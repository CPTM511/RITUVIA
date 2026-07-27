import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { anonymousSessionCookieName } from "../anonymous/session/route";
import { getWebRuntimeConfiguration } from "../../../../config/server";
import {
  accountAuthStateCookieName,
  accountSessionCookieName,
} from "../../../../server/account-auth";
import { hasValidSessionCsrfToken, sessionCsrfHeaderName } from "../../../../server/session-csrf";

export const accountAuthPrivateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const clearAccountAuthStateCookie = (response: NextResponse): void => {
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    name: accountAuthStateCookieName,
    path: "/",
    sameSite: "lax",
    secure: true,
    value: "",
  });
};

export const finalizeAccountAuth = async (
  request: NextRequest,
  completed: Readonly<{
    context: Readonly<{ expiresAt: string }>;
    mergeStatus: "created" | "replayed" | null;
    returnTo: string;
    sessionToken: string;
  }>,
): Promise<NextResponse> => {
  const anonymousSessionToken = request.cookies.get(anonymousSessionCookieName)?.value;
  const response = NextResponse.redirect(
    new URL(completed.returnTo, getWebRuntimeConfiguration().brand.canonicalOrigin),
    303,
  );
  for (const [name, value] of Object.entries(accountAuthPrivateHeaders)) {
    response.headers.set(name, value);
  }
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
  clearAccountAuthStateCookie(response);
  if (anonymousSessionToken !== undefined && completed.mergeStatus !== null) {
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
};

export const hasValidAccountSessionCsrf = (request: NextRequest): boolean =>
  hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [
    request.cookies.get(accountSessionCookieName)?.value,
  ]);

export const hasNoAuthRequestBody = async (request: NextRequest): Promise<boolean> => {
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
