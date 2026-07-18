import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { stripeHostedCheckoutProviderId } from "../../../../../../server/payment-provider";
import { handlePaymentWebhook } from "../_route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (request: NextRequest): Promise<NextResponse> =>
  handlePaymentWebhook(request, stripeHostedCheckoutProviderId);
