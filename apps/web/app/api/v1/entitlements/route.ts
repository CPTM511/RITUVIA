import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../server/account-auth";
import { loadWebCommerceApplicationService } from "../../../../server/commerce";
import {
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedPrivateCommerceRead,
} from "../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedPrivateCommerceRead(request) || request.nextUrl.search !== "") {
    return commerceProblem(new Error(), "not_found");
  }
  try {
    const items = await loadWebCommerceApplicationService().listEntitlements(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json(
      { items, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
