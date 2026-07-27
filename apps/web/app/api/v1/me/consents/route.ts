import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../config/server";
import { accountSessionCookieName } from "../../../../../server/account-auth";
import {
  listWebAccountConsentControls,
  recordWebAccountConsentControl,
  WebAccountConsentError,
} from "../../../../../server/account-consent";
import { hasValidAccountSessionCsrf } from "../../auth/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

const problem = (error: unknown): NextResponse => {
  const code = error instanceof WebAccountConsentError ? error.code : "unavailable";
  const status =
    code === "session_unavailable"
      ? 401
      : code === "invalid"
        ? 400
        : code === "conflict"
          ? 409
          : 503;
  return NextResponse.json(
    {
      code:
        code === "session_unavailable"
          ? "ACCOUNT_SESSION_UNAVAILABLE"
          : code === "invalid"
            ? "ACCOUNT_CONSENT_INPUT_INVALID"
            : code === "conflict"
              ? "ACCOUNT_CONSENT_CONFLICT"
              : "ACCOUNT_CONSENT_UNAVAILABLE",
      status,
    },
    { headers: privateHeaders, status },
  );
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const controls = await listWebAccountConsentControls(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json(
      { controls, schemaVersion: 1 },
      { headers: privateHeaders, status: 200 },
    );
  } catch (error) {
    return problem(error);
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    !hasValidAccountSessionCsrf(request) ||
    request.headers.get("content-type") !== "application/json"
  ) {
    return NextResponse.json(
      { code: "ACCOUNT_CONSENT_REQUEST_REJECTED", status: 403 },
      { headers: privateHeaders, status: 403 },
    );
  }
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > 1_024)) {
    return problem(new WebAccountConsentError("invalid"));
  }

  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 1_024) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return problem(new WebAccountConsentError("invalid"));
  }

  try {
    const control = await recordWebAccountConsentControl({
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      request: body,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { control, schemaVersion: 1 },
      { headers: privateHeaders, status: 200 },
    );
  } catch (error) {
    return problem(error);
  }
};
