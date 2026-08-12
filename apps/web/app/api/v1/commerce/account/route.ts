import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import { loadWebCommercialAccountApplicationService } from "../../../../../server/commercial-account";
import {
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedPrivateCommerceRead,
} from "../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedPrivateCommerceRead(request) || request.nextUrl.search !== "") {
    return NextResponse.json({ code: "COMMERCE_NOT_FOUND" }, { status: 404 });
  }
  try {
    const snapshot = await loadWebCommercialAccountApplicationService().readSnapshot(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json(
      { ...snapshot, schemaVersion: "commercial-account.v1" },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return commerceProblem(error, "not_found");
  }
};
