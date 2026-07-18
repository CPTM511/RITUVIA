import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../../config/server";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { revokeWebAccountSession, WebAccountError } from "../../../../../../server/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const DELETE = async (
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
  ) {
    return NextResponse.json(
      { code: "ACCOUNT_SESSION_REQUEST_REJECTED", status: 403 },
      { status: 403 },
    );
  }
  const { sessionId } = await context.params;
  try {
    await revokeWebAccountSession({
      sessionId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("cache-control", "private, no-store, max-age=0");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
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
      { status },
    );
  }
};
