import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { downloadWebPrivacyExport } from "../../../../../../../server/privacy-export";
import {
  hasValidPrivacyMutation,
  privacyErrorResponse,
  privacyPrivateHeaders,
  privacySessionToken,
} from "../../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ exportId: string }> },
): Promise<NextResponse> => {
  if (!(await hasValidPrivacyMutation(request))) {
    return NextResponse.json(
      { code: "PRIVACY_EXPORT_DOWNLOAD_REJECTED", status: 403 },
      { headers: privacyPrivateHeaders, status: 403 },
    );
  }
  try {
    const { exportId } = await context.params;
    const plaintext = await downloadWebPrivacyExport({
      exportId,
      sessionToken: privacySessionToken(request),
    });
    return new NextResponse(plaintext, {
      headers: {
        ...privacyPrivateHeaders,
        "content-disposition": `attachment; filename="rituvia-privacy-export-${exportId}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  } catch (error) {
    return privacyErrorResponse(error);
  }
};
