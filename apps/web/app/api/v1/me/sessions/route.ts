import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import { listWebAccountSessions, WebAccountError } from "../../../../../server/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const items = await listWebAccountSessions(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json({ items, schemaVersion: 1 }, { headers, status: 200 });
  } catch (error) {
    const unauthorized = error instanceof WebAccountError && error.code === "session_unavailable";
    return NextResponse.json(
      {
        code: unauthorized ? "ACCOUNT_SESSION_UNAVAILABLE" : "ACCOUNT_UNAVAILABLE",
        status: unauthorized ? 401 : 503,
      },
      { headers, status: unauthorized ? 401 : 503 },
    );
  }
};
