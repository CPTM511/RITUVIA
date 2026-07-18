import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../server/account-auth";
import { loadWebCommerceApplicationService } from "../../../../server/commerce";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedCommerceJsonMetadata,
  hasAcceptedCommerceOrigin,
  readCommerceJson,
} from "../_commerce-http";

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
  if (idempotencyKey === null) return rejected(400);

  let body: unknown;
  try {
    body = await readCommerceJson(request);
  } catch (error) {
    return rejected(error instanceof CommerceBodyTooLargeError ? 413 : 400);
  }

  try {
    const result = await loadWebCommerceApplicationService().createOrder({
      idempotencyKey,
      request: body,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { ...result, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: result.kind === "created" ? 201 : 200 },
    );
  } catch (error) {
    return commerceProblem(error);
  }
};
