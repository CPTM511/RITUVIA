import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  loadWebCommerceApplicationService,
  type WebCommerceError,
} from "../../../../../server/commerce";
import type { WebPaymentProviderId } from "../../../../../server/payment-provider";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  commerceProblem,
  hasAcceptedWebhookMetadata,
  readRawPaymentWebhook,
  webhookHeaders,
} from "../../_commerce-http";

const rejected = (status: 400 | 413): NextResponse =>
  NextResponse.json(
    {
      code: status === 413 ? "PAYMENT_WEBHOOK_TOO_LARGE" : "PAYMENT_WEBHOOK_INVALID",
      schemaVersion: 1,
      status,
    },
    { headers: commercePrivateHeaders, status },
  );

export const handlePaymentWebhook = async (
  request: NextRequest,
  providerId: WebPaymentProviderId,
): Promise<NextResponse> => {
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
    await loadWebCommerceApplicationService().processWebhook({
      providerId,
      request: { headers: webhookHeaders(request), rawBody },
    });
    return new NextResponse(null, { headers: commercePrivateHeaders, status: 204 });
  } catch (error) {
    return commerceProblem(error as WebCommerceError, "webhook_invalid");
  }
};
