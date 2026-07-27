import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../config/server";
import { accountSessionCookieName } from "../../../../server/account-auth";
import { WebPrivacyExportError } from "../../../../server/privacy-export";
import { WebPrivacyDeletionError } from "../../../../server/privacy-deletion";
import { hasNoAuthRequestBody, hasValidAccountSessionCsrf } from "../auth/_http";

export const privacyPrivateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const privacySessionToken = (request: NextRequest): string | undefined =>
  request.cookies.get(accountSessionCookieName)?.value;

export const hasValidPrivacyReadBoundary = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  return (
    (origin === null || origin === getWebRuntimeConfiguration().brand.canonicalOrigin) &&
    [null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
  );
};

export const hasValidPrivacyRequestBoundary = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  [null, "same-origin"].includes(request.headers.get("sec-fetch-site")) &&
  hasValidAccountSessionCsrf(request);

export const hasValidPrivacyMutation = async (request: NextRequest): Promise<boolean> =>
  hasValidPrivacyRequestBoundary(request) && (await hasNoAuthRequestBody(request));

export const privacyDeletionErrorResponse = (error: unknown): NextResponse => {
  const code = error instanceof WebPrivacyDeletionError ? error.code : "unavailable";
  const status =
    code === "invalid"
      ? 400
      : code === "session_unavailable"
        ? 401
        : code === "recent_auth_required"
          ? 403
          : code === "conflict"
            ? 409
            : code === "rate_limited"
              ? 429
              : 503;
  const response = NextResponse.json(
    {
      code:
        code === "invalid"
          ? "PRIVACY_DELETION_INPUT_INVALID"
          : code === "session_unavailable"
            ? "ACCOUNT_SESSION_UNAVAILABLE"
            : code === "recent_auth_required"
              ? "PRIVACY_DELETION_RECENT_AUTH_REQUIRED"
              : code === "conflict"
                ? "PRIVACY_DELETION_CONFLICT"
                : code === "rate_limited"
                  ? "PRIVACY_DELETION_RATE_LIMITED"
                  : "PRIVACY_DELETION_UNAVAILABLE",
      status,
    },
    { headers: privacyPrivateHeaders, status },
  );
  if (error instanceof WebPrivacyDeletionError && error.retryAfterSeconds !== undefined) {
    response.headers.set("retry-after", String(error.retryAfterSeconds));
  }
  return response;
};

export const privacyErrorResponse = (error: unknown): NextResponse => {
  const code = error instanceof WebPrivacyExportError ? error.code : "unavailable";
  const status =
    code === "invalid"
      ? 400
      : code === "session_unavailable"
        ? 401
        : code === "recent_auth_required"
          ? 403
          : code === "not_found"
            ? 404
            : code === "conflict"
              ? 409
              : code === "expired"
                ? 410
                : code === "not_ready" || code === "rate_limited"
                  ? 429
                  : 503;
  const response = NextResponse.json(
    {
      code:
        code === "invalid"
          ? "PRIVACY_EXPORT_INPUT_INVALID"
          : code === "session_unavailable"
            ? "ACCOUNT_SESSION_UNAVAILABLE"
            : code === "recent_auth_required"
              ? "PRIVACY_EXPORT_RECENT_AUTH_REQUIRED"
              : code === "not_found"
                ? "PRIVACY_EXPORT_NOT_FOUND"
                : code === "conflict"
                  ? "PRIVACY_EXPORT_CONFLICT"
                  : code === "expired"
                    ? "PRIVACY_EXPORT_EXPIRED"
                    : code === "not_ready"
                      ? "PRIVACY_EXPORT_NOT_READY"
                      : code === "rate_limited"
                        ? "PRIVACY_EXPORT_RATE_LIMITED"
                        : "PRIVACY_EXPORT_UNAVAILABLE",
      status,
    },
    { headers: privacyPrivateHeaders, status },
  );
  if (error instanceof WebPrivacyExportError && error.retryAfterSeconds !== undefined) {
    response.headers.set("retry-after", String(error.retryAfterSeconds));
  }
  return response;
};
