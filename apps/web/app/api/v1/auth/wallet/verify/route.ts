import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../../config/server";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import {
  deriveSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../../../server/session-csrf";
import { verifyWebWalletAuth, WebWalletAuthError } from "../../../../../../server/wallet-auth";
import { accountAuthPrivateHeaders, hasValidAccountSessionCsrf } from "../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const problem = (status: number, code: string) =>
  NextResponse.json({ code, status }, { headers: accountAuthPrivateHeaders, status });

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return problem(403, "WALLET_AUTH_REQUEST_REJECTED");
  }
  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 6_144) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return problem(400, "WALLET_AUTH_INPUT_INVALID");
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).sort().join("\u0000") !== "message\u0000requestId\u0000signature"
  ) {
    return problem(400, "WALLET_AUTH_INPUT_INVALID");
  }
  const input = body as Record<string, unknown>;
  const sessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (sessionToken !== undefined && !hasValidAccountSessionCsrf(request)) {
    return problem(403, "WALLET_AUTH_REQUEST_REJECTED");
  }
  try {
    const result = await verifyWebWalletAuth({
      message: input.message,
      requestId: input.requestId,
      sessionToken,
      signature: input.signature,
    });
    const response = NextResponse.json(
      result.purpose === "sign_in"
        ? { purpose: result.purpose, redirectTo: "/en/account", schemaVersion: 1 }
        : { purpose: result.purpose, schemaVersion: 1, wallet: result.wallet },
      { headers: accountAuthPrivateHeaders, status: 200 },
    );
    if (result.purpose === "sign_in") {
      const expires = new Date(result.expiresAt);
      response.cookies.set({
        expires,
        httpOnly: true,
        maxAge: Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1_000)),
        name: accountSessionCookieName,
        path: "/",
        sameSite: "strict",
        secure: true,
        value: result.sessionToken,
      });
      response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(result.sessionToken));
    }
    return response;
  } catch (error) {
    const conflict = error instanceof WebWalletAuthError && error.code === "conflict";
    const session = error instanceof WebWalletAuthError && error.code === "session_unavailable";
    const invalid = error instanceof WebWalletAuthError && error.code === "invalid";
    return problem(
      session ? 401 : invalid ? 400 : conflict ? 409 : 503,
      session
        ? "WALLET_AUTH_SESSION_UNAVAILABLE"
        : invalid
          ? "WALLET_AUTH_INVALID"
          : conflict
            ? "WALLET_AUTH_CONFLICT"
            : "WALLET_AUTH_UNAVAILABLE",
    );
  }
};
