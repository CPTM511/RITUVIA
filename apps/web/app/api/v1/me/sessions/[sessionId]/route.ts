import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../../config/server";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { revokeWebAccountSession, WebAccountError } from "../../../../../../server/account";
import { hasNoAuthRequestBody, hasValidAccountSessionCsrf } from "../../../auth/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const DELETE = async (
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    !hasValidAccountSessionCsrf(request) ||
    !(await hasNoAuthRequestBody(request))
  ) {
    return NextResponse.json(
      { code: "ACCOUNT_SESSION_REQUEST_REJECTED", status: 403 },
      { headers, status: 403 },
    );
  }
  const { sessionId } = await context.params;
  try {
    await revokeWebAccountSession({
      sessionId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return new NextResponse(null, { headers, status: 204 });
  } catch (error) {
    const unauthorized = error instanceof WebAccountError && error.code === "session_unavailable";
    const notFound = error instanceof WebAccountError && error.code === "not_found";
    const status = unauthorized ? 401 : notFound ? 404 : 503;
    return NextResponse.json(
      {
        code: unauthorized
          ? "ACCOUNT_SESSION_UNAVAILABLE"
          : notFound
            ? "ACCOUNT_SESSION_NOT_FOUND"
            : "ACCOUNT_UNAVAILABLE",
        status,
      },
      { headers, status },
    );
  }
};
