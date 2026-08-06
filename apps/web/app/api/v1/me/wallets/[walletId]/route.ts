import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { revokeWebWalletIdentity, WebWalletAuthError } from "../../../../../../server/wallet-auth";
import { hasValidAccountSessionCsrf } from "../../../auth/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const DELETE = async (
  request: NextRequest,
  context: { params: Promise<{ walletId: string }> },
): Promise<NextResponse> => {
  if (!hasValidAccountSessionCsrf(request)) {
    return NextResponse.json({ code: "WALLET_AUTH_REQUEST_REJECTED" }, { headers, status: 403 });
  }
  try {
    const removed = await revokeWebWalletIdentity({
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
      walletIdentityId: (await context.params).walletId,
    });
    return new NextResponse(null, { headers, status: removed ? 204 : 404 });
  } catch (error) {
    const unauthorized =
      error instanceof WebWalletAuthError && error.code === "session_unavailable";
    return NextResponse.json(
      { code: unauthorized ? "ACCOUNT_SESSION_UNAVAILABLE" : "WALLET_AUTH_UNAVAILABLE" },
      { headers, status: unauthorized ? 401 : 503 },
    );
  }
};
