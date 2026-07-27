import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import { requestWebPrivacyDeletion } from "../../../../../server/privacy-deletion";
import {
  hasValidPrivacyRequestBoundary,
  privacyDeletionErrorResponse,
  privacyPrivateHeaders,
  privacySessionToken,
} from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const parseBody = async (request: NextRequest): Promise<"account" | "private_content"> => {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentType !== "application/json" ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 0 ||
    contentLength > 1_024
  ) {
    throw new TypeError("Invalid privacy deletion body.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 1_024) {
    throw new TypeError("Invalid privacy deletion body.");
  }
  const parsed = JSON.parse(text) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !("scope" in parsed) ||
    (parsed.scope !== "private_content" && parsed.scope !== "account")
  ) {
    throw new TypeError("Invalid privacy deletion body.");
  }
  return parsed.scope;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!hasValidPrivacyRequestBoundary(request) || idempotencyKey === null) {
    return NextResponse.json(
      { code: "PRIVACY_DELETION_REQUEST_REJECTED", status: 403 },
      { headers: privacyPrivateHeaders, status: 403 },
    );
  }
  let scope: "account" | "private_content";
  try {
    scope = await parseBody(request);
  } catch {
    return NextResponse.json(
      { code: "PRIVACY_DELETION_INPUT_INVALID", status: 400 },
      { headers: privacyPrivateHeaders, status: 400 },
    );
  }
  try {
    const result = await requestWebPrivacyDeletion({
      idempotencyKey,
      scope,
      sessionToken: privacySessionToken(request),
    });
    const response = NextResponse.json(result, { headers: privacyPrivateHeaders, status: 202 });
    if (scope === "account") {
      response.cookies.set({
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        name: accountSessionCookieName,
        path: "/",
        sameSite: "strict",
        secure: true,
        value: "",
      });
    }
    return response;
  } catch (error) {
    return privacyDeletionErrorResponse(error);
  }
};
