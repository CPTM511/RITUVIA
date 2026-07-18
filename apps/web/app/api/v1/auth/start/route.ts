import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../config/server";
import { startWebAccountAuth, WebAccountAuthError } from "../../../../../server/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

const problem = (status: number, code: string) =>
  NextResponse.json({ code, status }, { headers, status });

const sameOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  (request.headers.get("sec-fetch-site") === null ||
    request.headers.get("sec-fetch-site") === "same-origin");

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!sameOrigin(request) || request.headers.get("content-type") !== "application/json") {
    return problem(403, "ACCOUNT_AUTH_REQUEST_REJECTED");
  }
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > 1_024)) {
    return problem(400, "ACCOUNT_AUTH_INPUT_INVALID");
  }
  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 1_024) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return problem(400, "ACCOUNT_AUTH_INPUT_INVALID");
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).sort().join("\u0000") !== "email\u0000returnTo"
  ) {
    return problem(400, "ACCOUNT_AUTH_INPUT_INVALID");
  }
  const input = body as Record<string, unknown>;
  try {
    const started = await startWebAccountAuth({ email: input.email, returnTo: input.returnTo });
    return NextResponse.json(started, { headers, status: 201 });
  } catch (error) {
    return problem(
      error instanceof WebAccountAuthError && error.code === "invalid" ? 400 : 503,
      error instanceof WebAccountAuthError && error.code === "invalid"
        ? "ACCOUNT_AUTH_INPUT_INVALID"
        : "ACCOUNT_AUTH_UNAVAILABLE",
    );
  }
};
