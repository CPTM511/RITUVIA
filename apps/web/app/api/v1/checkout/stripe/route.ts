import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import {
  hasValidSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../../server/session-csrf";
import { loadWebStripeCheckoutApplicationService } from "../../../../../server/stripe-checkout";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedCommerceJsonMetadata,
  hasAcceptedCommerceOrigin,
  readCommerceJson,
} from "../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rejected = (status: 400 | 403 | 413): NextResponse =>
  NextResponse.json(
    {
      code:
        status === 403
          ? "COMMERCE_REQUEST_REJECTED"
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
  const idempotencyKey = request.headers.get("idempotency-key");
  const sessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (
    idempotencyKey === null ||
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [sessionToken])
  ) {
    return rejected(idempotencyKey === null ? 400 : 403);
  }

  let body: unknown;
  try {
    body = await readCommerceJson(request);
  } catch (error) {
    return rejected(error instanceof CommerceBodyTooLargeError ? 413 : 400);
  }

  try {
    const result = await loadWebStripeCheckoutApplicationService().createCheckout({
      idempotencyKey,
      request: body,
      sessionToken,
    });
    return NextResponse.json(
      { ...result, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: result.kind === "created" ? 201 : 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
