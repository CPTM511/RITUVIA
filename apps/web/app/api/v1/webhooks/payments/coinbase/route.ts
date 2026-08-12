import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loadWebCoinbaseWebhookApplicationService } from "../../../../../../server/coinbase-webhook";
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

const hasAcceptedProtectionBypassQuery = (request: NextRequest): boolean => {
  if (request.nextUrl.search === "") return true;
  const entries = [...request.nextUrl.searchParams.entries()];
  return (
    entries.length === 1 &&
    entries[0]?.[0] === "x-vercel-protection-bypass" &&
    /^[A-Za-z0-9_-]{32,256}$/u.test(entries[0][1])
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedWebhookMetadata(request) || !hasAcceptedProtectionBypassQuery(request)) {
    return rejected(400);
  }
  let rawBody: Uint8Array;
  try {
    rawBody = await readRawPaymentWebhook(request);
  } catch (error) {
    return rejected(error instanceof CommerceBodyTooLargeError ? 413 : 400);
  }
  try {
    await loadWebCoinbaseWebhookApplicationService().processWebhook({
      headers: webhookHeaders(request),
      rawBody,
    });
    return new NextResponse(null, { headers: commercePrivateHeaders, status: 204 });
  } catch (error) {
    return commerceProblem(error, "webhook_invalid");
  }
};
