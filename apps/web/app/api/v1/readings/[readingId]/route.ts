import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { tarotReadingApiMessages } from "../../../../_i18n/api-messages";
import { accountSessionCookieName } from "../../../../../server/account-auth";
import { getWebTarotReading } from "../../../../../server/tarot-reading-runtime";
import { TarotReadingApplicationError } from "../../../../../server/tarot-reading";
import {
  applyPrivateHeaders,
  hasAcceptedPrivateReadRequest,
  problem,
  readingIdPattern,
  tarotReadingResourceApiPath,
  tarotReadingSessionCookieName,
} from "../tarot/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ readingId: string }>> }>;

const notFound = (request: NextRequest): NextResponse =>
  problem(request, {
    code: "TAROT_READING_NOT_FOUND",
    ...tarotReadingApiMessages.notFound,
    instance: tarotReadingResourceApiPath,
    status: 404,
  });

export const GET = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  if (!hasAcceptedPrivateReadRequest(request) || request.nextUrl.search !== "") {
    return notFound(request);
  }
  const { readingId } = await context.params;
  if (!readingIdPattern.test(readingId)) return notFound(request);
  const accountToken = request.cookies.get(accountSessionCookieName)?.value;
  const anonymousToken = request.cookies.get(tarotReadingSessionCookieName)?.value;
  const sessionToken = accountToken ?? anonymousToken;
  if (sessionToken === undefined) return notFound(request);

  try {
    const reading =
      accountToken === undefined
        ? await getWebTarotReading(readingId, sessionToken)
        : await getWebTarotReading(readingId, sessionToken, "account");
    return reading === null
      ? notFound(request)
      : applyPrivateHeaders(NextResponse.json(reading, { status: 200 }));
  } catch (error) {
    if (
      error instanceof TarotReadingApplicationError &&
      (error.code === "not_found" || error.code === "session_required")
    ) {
      return notFound(request);
    }
    return problem(request, {
      code: "TAROT_READING_UNAVAILABLE",
      ...tarotReadingApiMessages.unavailable,
      instance: tarotReadingResourceApiPath,
      status: 503,
    });
  }
};
