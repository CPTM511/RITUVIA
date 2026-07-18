import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../config/server";
import { accountSessionCookieName } from "../../../../server/account-auth";
import {
  getWebAccountProfile,
  updateWebAccountProfile,
  WebAccountError,
} from "../../../../server/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

const responseFor = (profile: Awaited<ReturnType<typeof getWebAccountProfile>>) =>
  NextResponse.json({ ...profile, schemaVersion: 1 }, { headers: privateHeaders, status: 200 });

const problem = (error: unknown) => {
  const unauthorized = error instanceof WebAccountError && error.code === "session_unavailable";
  const conflict = error instanceof WebAccountError && error.code === "conflict";
  const invalid = error instanceof WebAccountError && error.code === "invalid";
  const status = unauthorized ? 401 : invalid ? 400 : conflict ? 409 : 503;
  return NextResponse.json(
    {
      code: unauthorized
        ? "ACCOUNT_SESSION_UNAVAILABLE"
        : invalid
          ? "ACCOUNT_PROFILE_INPUT_INVALID"
          : conflict
            ? "ACCOUNT_PROFILE_CONFLICT"
            : "ACCOUNT_UNAVAILABLE",
      status,
    },
    { headers: privateHeaders, status },
  );
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    return responseFor(
      await getWebAccountProfile(request.cookies.get(accountSessionCookieName)?.value),
    );
  } catch (error) {
    return problem(error);
  }
};

export const PATCH = async (request: NextRequest): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    request.headers.get("content-type") !== "application/json"
  ) {
    return NextResponse.json(
      { code: "ACCOUNT_PROFILE_REQUEST_REJECTED", status: 403 },
      { headers: privateHeaders, status: 403 },
    );
  }
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > 2_048)) {
    return NextResponse.json(
      { code: "ACCOUNT_PROFILE_INPUT_INVALID", status: 400 },
      { headers: privateHeaders, status: 400 },
    );
  }
  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 2_048) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return NextResponse.json(
      { code: "ACCOUNT_PROFILE_INPUT_INVALID", status: 400 },
      { headers: privateHeaders, status: 400 },
    );
  }
  try {
    return responseFor(
      await updateWebAccountProfile({
        request: body,
        sessionToken: request.cookies.get(accountSessionCookieName)?.value,
      }),
    );
  } catch (error) {
    return problem(error);
  }
};
