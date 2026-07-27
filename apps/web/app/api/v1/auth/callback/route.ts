import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { anonymousSessionCookieName } from "../../anonymous/session/route";
import {
  accountAuthStateCookieName,
  completeWebAccountAuth,
  hasMatchingAccountAuthState,
  WebAccountAuthError,
} from "../../../../../server/account-auth";
import {
  accountAuthPrivateHeaders,
  clearAccountAuthStateCookie,
  finalizeAccountAuth,
} from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const problem = (status: 400 | 409 | 503, code: string, clearState: boolean): NextResponse => {
  const response = NextResponse.json(
    { code, status },
    { headers: accountAuthPrivateHeaders, status },
  );
  if (clearState) clearAccountAuthStateCookie(response);
  return response;
};

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
    token === null ||
    !hasMatchingAccountAuthState(state, request.cookies.get(accountAuthStateCookieName)?.value)
  ) {
    return problem(400, "ACCOUNT_AUTH_CALLBACK_INVALID", true);
  }
  try {
    const completed = await completeWebAccountAuth({
      anonymousSessionToken: request.cookies.get(anonymousSessionCookieName)?.value,
      challengeId,
      state,
      token,
    });
    return await finalizeAccountAuth(request, completed);
  } catch (error) {
    const conflict = error instanceof WebAccountAuthError && error.code === "conflict";
    const invalid = error instanceof WebAccountAuthError && error.code === "invalid";
    return problem(
      invalid ? 400 : conflict ? 409 : 503,
      invalid
        ? "ACCOUNT_AUTH_CALLBACK_INVALID"
        : conflict
          ? "ACCOUNT_AUTH_MERGE_CONFLICT"
          : "ACCOUNT_AUTH_UNAVAILABLE",
      invalid,
    );
  }
};
