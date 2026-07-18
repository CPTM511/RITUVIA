import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import {
  loadWebCommerceApplicationService,
  WebCommerceError,
} from "../../../../../server/commerce";
import {
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedPrivateCommerceRead,
} from "../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

const notFound = (): NextResponse =>
  commerceProblem(new WebCommerceError("not_found"), "not_found");

export const GET = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  if (!hasAcceptedPrivateCommerceRead(request) || request.nextUrl.search !== "") return notFound();
  const { orderId } = await context.params;
  try {
    const order = await loadWebCommerceApplicationService().getOrder({
      orderId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { ...order, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    if (
      error instanceof WebCommerceError &&
      (error.code === "input_invalid" ||
        error.code === "not_found" ||
        error.code === "session_required")
    ) {
      return notFound();
    }
    return commerceProblem(error);
  }
};
