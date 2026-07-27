import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../../../config/server";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import {
  getWebRevisitReminder,
  mutateWebRevisitReminder,
  WebRevisitReminderError,
} from "../../../../../../server/revisit-reminder";
import { hasValidAccountSessionCsrf } from "../../../auth/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ revisitId: string }>> }>;

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

const problem = (error: unknown): NextResponse => {
  const code = error instanceof WebRevisitReminderError ? error.code : "unavailable";
  const status =
    code === "session_unavailable"
      ? 401
      : code === "invalid"
        ? 400
        : code === "not_found"
          ? 404
          : code === "conflict"
            ? 409
            : 503;
  return NextResponse.json(
    {
      code:
        code === "session_unavailable"
          ? "ACCOUNT_SESSION_UNAVAILABLE"
          : code === "invalid"
            ? "REVISIT_REMINDER_INPUT_INVALID"
            : code === "not_found"
              ? "REVISIT_REMINDER_NOT_FOUND"
              : code === "conflict"
                ? "REVISIT_REMINDER_CONFLICT"
                : "REVISIT_REMINDER_UNAVAILABLE",
      status,
    },
    { headers: privateHeaders, status },
  );
};

export const GET = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const { revisitId } = await context.params;
  try {
    const reminder = await getWebRevisitReminder({
      revisitId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { reminder, schemaVersion: 1 },
      { headers: privateHeaders, status: 200 },
    );
  } catch (error) {
    return problem(error);
  }
};

export const POST = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  if (
    request.headers.get("origin") !== getWebRuntimeConfiguration().brand.canonicalOrigin ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")) ||
    !hasValidAccountSessionCsrf(request) ||
    request.headers.get("content-type") !== "application/json"
  ) {
    return NextResponse.json(
      { code: "REVISIT_REMINDER_REQUEST_REJECTED", status: 403 },
      { headers: privateHeaders, status: 403 },
    );
  }
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > 1_024)) {
    return problem(new WebRevisitReminderError("invalid"));
  }

  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 1_024) throw new TypeError();
    body = JSON.parse(source);
  } catch {
    return problem(new WebRevisitReminderError("invalid"));
  }

  const { revisitId } = await context.params;
  try {
    const reminder = await mutateWebRevisitReminder({
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      request: body,
      revisitId,
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      { reminder, schemaVersion: 1 },
      { headers: privateHeaders, status: 200 },
    );
  } catch (error) {
    return problem(error);
  }
};
