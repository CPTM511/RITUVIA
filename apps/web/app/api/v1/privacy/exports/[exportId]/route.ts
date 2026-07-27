import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebPrivacyExportMetadata } from "../../../../../../server/privacy-export";
import {
  hasValidPrivacyReadBoundary,
  privacyErrorResponse,
  privacyPrivateHeaders,
  privacySessionToken,
} from "../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ exportId: string }> },
): Promise<NextResponse> => {
  if (!hasValidPrivacyReadBoundary(request)) {
    return new NextResponse(null, { headers: privacyPrivateHeaders, status: 404 });
  }
  try {
    const { exportId } = await context.params;
    const result = await getWebPrivacyExportMetadata({
      exportId,
      sessionToken: privacySessionToken(request),
    });
    return NextResponse.json(result, { headers: privacyPrivateHeaders, status: 200 });
  } catch (error) {
    return privacyErrorResponse(error);
  }
};
