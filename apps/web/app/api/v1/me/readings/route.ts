import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import { listWebAccountReadings, WebAccountError } from "../../../../../server/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const parseCursor = (
  value: string | null,
): Readonly<{ createdAt: string; readingId: string }> | undefined => {
  if (value === null) return undefined;
  if (!/^[A-Za-z0-9_-]{1,512}$/u.test(value)) throw new TypeError();
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join("\u0000") !== "createdAt\u0000readingId"
  ) {
    throw new TypeError();
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.createdAt !== "string" ||
    !utcInstantPattern.test(candidate.createdAt) ||
    !Number.isFinite(Date.parse(candidate.createdAt)) ||
    new Date(candidate.createdAt).toISOString() !== candidate.createdAt ||
    typeof candidate.readingId !== "string" ||
    !uuidV4Pattern.test(candidate.readingId)
  ) {
    throw new TypeError();
  }
  return Object.freeze({ createdAt: candidate.createdAt, readingId: candidate.readingId });
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const keys = [...new Set(request.nextUrl.searchParams.keys())];
  if (keys.some((key) => key !== "cursor" && key !== "limit")) {
    return NextResponse.json(
      { code: "ACCOUNT_HISTORY_INPUT_INVALID", status: 400 },
      { headers, status: 400 },
    );
  }
  try {
    const rawLimit = request.nextUrl.searchParams.get("limit") ?? "20";
    if (!/^(?:[1-9]|[1-4][0-9]|50)$/u.test(rawLimit)) throw new TypeError();
    const page = await listWebAccountReadings({
      cursor: parseCursor(request.nextUrl.searchParams.get("cursor")),
      limit: Number(rawLimit),
      sessionToken: request.cookies.get(accountSessionCookieName)?.value,
    });
    return NextResponse.json(
      {
        items: page.items,
        nextCursor:
          page.nextCursor === null
            ? null
            : Buffer.from(JSON.stringify(page.nextCursor)).toString("base64url"),
        schemaVersion: 1,
      },
      { headers, status: 200 },
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json(
        { code: "ACCOUNT_HISTORY_INPUT_INVALID", status: 400 },
        { headers, status: 400 },
      );
    }
    const unauthorized = error instanceof WebAccountError && error.code === "session_unavailable";
    return NextResponse.json(
      {
        code: unauthorized ? "ACCOUNT_SESSION_UNAVAILABLE" : "ACCOUNT_UNAVAILABLE",
        status: unauthorized ? 401 : 503,
      },
      { headers, status: unauthorized ? 401 : 503 },
    );
  }
};
