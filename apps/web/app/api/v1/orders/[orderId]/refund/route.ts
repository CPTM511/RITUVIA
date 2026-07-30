import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../../server/account-auth";
import {
  hasValidSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../../../server/session-csrf";
import { loadWebStripeRefundApplicationService } from "../../../../../../server/stripe-refund";
import {
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedCommerceOrigin,
  hasNoCommerceBody,
} from "../../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

const rejected = (status: 400 | 403): NextResponse =>
  NextResponse.json(
    {
      code: status === 403 ? "COMMERCE_REQUEST_REJECTED" : "COMMERCE_INPUT_INVALID",
      schemaVersion: 1,
      status,
    },
    { headers: commercePrivateHeaders, status },
  );

export const POST = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const idempotencyKey = request.headers.get("idempotency-key");
  const sessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (
    !hasAcceptedCommerceOrigin(request) ||
    !(await hasNoCommerceBody(request)) ||
    idempotencyKey === null ||
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [sessionToken])
  ) {
    return rejected(idempotencyKey === null ? 400 : 403);
  }
  const { orderId } = await context.params;
  try {
    const result = await loadWebStripeRefundApplicationService().requestRefund({
      idempotencyKey,
      orderId,
      sessionToken,
    });
    return NextResponse.json(
      { ...result, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 202 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
