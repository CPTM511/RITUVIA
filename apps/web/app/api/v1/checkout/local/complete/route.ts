import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { loadWebCommerceApplicationService } from "../../../../../../server/commerce";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedCommerceJsonMetadata,
  hasAcceptedCommerceOrigin,
  readCommerceJson,
} from "../../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isExactRequest = (value: unknown): value is Readonly<{ checkoutSessionId: string }> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  typeof (value as Record<string, unknown>).checkoutSessionId === "string";

const rejected = (status: 400 | 403 | 413): NextResponse =>
  NextResponse.json(
    {
      code:
        status === 403
          ? "LOCAL_CHECKOUT_REQUEST_REJECTED"
          : status === 413
            ? "COMMERCE_BODY_TOO_LARGE"
            : "COMMERCE_INPUT_INVALID",
      schemaVersion: 1,
      status,
    },
    { headers: commercePrivateHeaders, status },
  );

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedCommerceOrigin(request)) return rejected(403);
  if (!hasAcceptedCommerceJsonMetadata(request)) return rejected(400);
  let body: unknown;
  try {
    body = await readCommerceJson(request);
  } catch (error) {
    return rejected(error instanceof CommerceBodyTooLargeError ? 413 : 400);
  }
  if (!isExactRequest(body)) return rejected(400);
  try {
    const order = await loadWebCommerceApplicationService().completeLocalCheckout({
      checkoutSessionId: body.checkoutSessionId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { ...order, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
