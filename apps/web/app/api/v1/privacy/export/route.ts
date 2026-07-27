import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requestWebPrivacyExport } from "../../../../../server/privacy-export";
import {
  hasValidPrivacyMutation,
  privacyErrorResponse,
  privacyPrivateHeaders,
  privacySessionToken,
} from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!(await hasValidPrivacyMutation(request)) || idempotencyKey === null) {
    return NextResponse.json(
      { code: "PRIVACY_EXPORT_REQUEST_REJECTED", status: 403 },
      { headers: privacyPrivateHeaders, status: 403 },
    );
  }
  try {
    const result = await requestWebPrivacyExport({
      idempotencyKey,
      sessionToken: privacySessionToken(request),
    });
    return NextResponse.json(result, { headers: privacyPrivateHeaders, status: 202 });
  } catch (error) {
    return privacyErrorResponse(error);
  }
};
