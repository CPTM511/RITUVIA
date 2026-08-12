import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../../server/account-auth";
import {
  loadWebRecoveryItem11AiApplicationService,
  RecoveryItem11AiError,
  type RecoveryItem11AiErrorCode,
} from "../../../../../../server/recovery-item-11-ai";
import {
  hasValidSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../../../server/session-csrf";
import {
  CommerceBodyTooLargeError,
  commercePrivateHeaders,
  hasAcceptedCommerceJsonMetadata,
  hasAcceptedCommerceOrigin,
  readCommerceJson,
} from "../../../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusFor = (code: RecoveryItem11AiErrorCode): number => {
  switch (code) {
    case "input_invalid":
      return 400;
    case "session_required":
      return 401;
    case "insufficient_credits":
    case "not_eligible":
      return 403;
    case "daily_limit":
      return 429;
    case "conflict":
      return 409;
    case "unavailable":
      return 503;
  }
};

const problem = (code: RecoveryItem11AiErrorCode): NextResponse => {
  const status = statusFor(code);
  return NextResponse.json(
    { code: `RECOVERY_ITEM_11_AI_${code.toUpperCase()}`, schemaVersion: 1, status },
    { headers: commercePrivateHeaders, status },
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedCommerceOrigin(request)) return problem("not_eligible");
  if (!hasAcceptedCommerceJsonMetadata(request)) return problem("input_invalid");
  const idempotencyKey = request.headers.get("idempotency-key");
  const sessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (
    idempotencyKey === null ||
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [sessionToken])
  ) {
    return problem(idempotencyKey === null ? "input_invalid" : "not_eligible");
  }
  let body: unknown;
  try {
    body = await readCommerceJson(request);
  } catch (error) {
    if (error instanceof CommerceBodyTooLargeError) {
      return NextResponse.json(
        { code: "RECOVERY_ITEM_11_AI_BODY_TOO_LARGE", schemaVersion: 1, status: 413 },
        { headers: commercePrivateHeaders, status: 413 },
      );
    }
    return problem("input_invalid");
  }
  try {
    const result = await loadWebRecoveryItem11AiApplicationService().generate({
      idempotencyKey,
      request: body,
      sessionToken,
    });
    return NextResponse.json(
      { ...result, schemaVersion: 1 },
      { headers: commercePrivateHeaders, status: 200 },
    );
  } catch (error) {
    return problem(error instanceof RecoveryItem11AiError ? error.code : "unavailable");
  }
};
