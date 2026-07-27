import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  accountAuthStateCookieName,
  completeWebLocalPreviewAuth,
  WebAccountAuthError,
} from "../../../../../server/account-auth";
import { anonymousSessionCookieName } from "../../anonymous/session/route";
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
  if (
    request.nextUrl.search !== "" ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
  ) {
    return problem(400, "ACCOUNT_AUTH_CALLBACK_INVALID", true);
  }
  try {
    const completed = await completeWebLocalPreviewAuth({
      anonymousSessionToken: request.cookies.get(anonymousSessionCookieName)?.value,
      stateToken: request.cookies.get(accountAuthStateCookieName)?.value,
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
