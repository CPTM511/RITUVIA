import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../server/account-auth";
import { loadWebCommercialPurchaseApplicationService } from "../../../../server/commercial-purchases";
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
    const restored = await loadWebCommercialPurchaseApplicationService().restore(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    const { promotional, purchased, subscription, total, version } = restored.credits;
    return NextResponse.json(
      { promotional, purchased, schemaVersion: 1, subscription, total, version },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
