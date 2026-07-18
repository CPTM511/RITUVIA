import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { loadWebCommerceApplicationService } from "../../../../../../server/commerce";
import {
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedCommerceOrigin,
  hasNoCommerceBody,
} from "../../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

const rejected = (): NextResponse =>
  NextResponse.json(
    { code: "COMMERCE_CHECKOUT_REQUEST_REJECTED", schemaVersion: 1, status: 403 },
    { headers: commercePrivateHeaders, status: 403 },
  );

export const POST = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (
    !hasAcceptedCommerceOrigin(request) ||
    !(await hasNoCommerceBody(request)) ||
    idempotencyKey === null
  ) {
    return rejected();
  }
  const { orderId } = await context.params;
  try {
    const result = await loadWebCommerceApplicationService().startCheckout({
      idempotencyKey,
      orderId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { ...result, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
