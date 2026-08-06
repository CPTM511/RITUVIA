import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../../config/server";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { startWebWalletAuth, WebWalletAuthError } from "../../../../../../server/wallet-auth";
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
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null) return problem(403, "WALLET_AUTH_REQUEST_REJECTED");
  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 1_024) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return problem(400, "WALLET_AUTH_INPUT_INVALID");
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).sort().join("\u0000") !== "address\u0000chainId\u0000purpose"
  ) {
    return problem(400, "WALLET_AUTH_INPUT_INVALID");
  }
  const input = body as Record<string, unknown>;
  if (input.purpose === "link_wallet" && !hasValidAccountSessionCsrf(request)) {
    return problem(403, "WALLET_AUTH_REQUEST_REJECTED");
  }
  if (
    input.purpose === "sign_in" &&
    request.cookies.get(accountSessionCookieName)?.value !== undefined
  ) {
    return problem(409, "WALLET_AUTH_SESSION_CONFLICT");
  }
  try {
    const result = await startWebWalletAuth({
      address: input.address,
      chainId: input.chainId,
      idempotencyKey,
      purpose: input.purpose,
      ...(input.purpose === "link_wallet"
        ? { sessionToken: request.cookies.get(accountSessionCookieName)?.value }
        : {}),
    });
    return NextResponse.json(result, { headers: accountAuthPrivateHeaders, status: 200 });
  } catch (error) {
    const conflict = error instanceof WebWalletAuthError && error.code === "conflict";
    const session = error instanceof WebWalletAuthError && error.code === "session_unavailable";
    const invalid = error instanceof WebWalletAuthError && error.code === "invalid";
    return problem(
      session ? 401 : invalid ? 400 : conflict ? 409 : 503,
      session
        ? "WALLET_AUTH_SESSION_UNAVAILABLE"
        : invalid
          ? "WALLET_AUTH_INPUT_INVALID"
          : conflict
            ? "WALLET_AUTH_CONFLICT"
            : "WALLET_AUTH_UNAVAILABLE",
    );
  }
};
