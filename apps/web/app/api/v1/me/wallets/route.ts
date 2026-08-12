import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import { listWebWalletIdentities, WebWalletAuthError } from "../../../../../server/wallet-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const wallets = await listWebWalletIdentities(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json({ schemaVersion: 1, wallets }, { headers, status: 200 });
  } catch (error) {
    const unauthorized =
      error instanceof WebWalletAuthError && error.code === "session_unavailable";
    return NextResponse.json(
      { code: unauthorized ? "ACCOUNT_SESSION_UNAVAILABLE" : "WALLET_AUTH_UNAVAILABLE" },
      { headers, status: unauthorized ? 401 : 503 },
    );
  }
};
