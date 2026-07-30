import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loadWebStripeWebhookApplicationService } from "../../../../../../server/stripe-webhook";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedWebhookMetadata,
  readRawPaymentWebhook,
  webhookHeaders,
} from "../../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rejected = (status: 400 | 413): NextResponse =>
  NextResponse.json(
    {
      code: status === 413 ? "PAYMENT_WEBHOOK_TOO_LARGE" : "PAYMENT_WEBHOOK_INVALID",
      schemaVersion: 1,
      status,
    },
    { headers: commercePrivateHeaders, status },
  );

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedWebhookMetadata(request) || request.nextUrl.search !== "") {
    return rejected(400);
  }
  let rawBody: Uint8Array;
  try {
    rawBody = await readRawPaymentWebhook(request);
  } catch (error) {
    return rejected(error instanceof CommerceBodyTooLargeError ? 413 : 400);
  }
  try {
    await loadWebStripeWebhookApplicationService().processWebhook({
      headers: webhookHeaders(request),
      rawBody,
    });
    return new NextResponse(null, { headers: commercePrivateHeaders, status: 204 });
  } catch (error) {
    return commerceProblem(error, "webhook_invalid");
  }
};
