import { TarotReadingReportInputError } from "@rituvia/domain";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  tarotReadingApiMessages,
  tarotReadingReportApiMessages,
} from "../../../../../_i18n/api-messages";
import { TarotReadingApplicationError } from "../../../../../../server/tarot-reading";
import { reportWebTarotReading } from "../../../../../../server/tarot-reading-runtime";
import {
  admitWebProtectedBetaRequest,
  ProtectedBetaAdmissionError,
} from "../../../../../../server/protected-beta-abuse";
import {
  applyPrivateHeaders,
  classifyJsonRequest,
  hasAcceptedPostOrigin,
  idempotencyKeyPattern,
  problem,
  readBoundedJson,
  readingIdPattern,
  tarotReadingReportApiPath,
  tarotReadingResourceApiPath,
  tarotReadingSessionCookieName,
  TarotReadingBodyTooLargeError,
} from "../../tarot/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ readingId: string }>> }>;

const notFound = (request: NextRequest, instance: string): NextResponse =>
  problem(request, {
    code: "TAROT_READING_NOT_FOUND",
    ...tarotReadingApiMessages.notFound,
    instance,
    status: 404,
  });

export const POST = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const { readingId } = await context.params;
  if (!readingIdPattern.test(readingId) || request.nextUrl.search !== "") {
    return notFound(request, tarotReadingResourceApiPath);
  }
  const instance = tarotReadingReportApiPath(readingId);
  if (!hasAcceptedPostOrigin(request)) {
    return problem(request, {
      code: "TAROT_READING_REPORT_REQUEST_REJECTED",
      ...tarotReadingReportApiMessages.invalidRequest,
      instance,
      status: 403,
    });
  }
  const metadata = classifyJsonRequest(request);
  if (metadata === "too_large") {
    return problem(request, {
      code: "TAROT_READING_REPORT_BODY_TOO_LARGE",
      ...tarotReadingReportApiMessages.tooLarge,
      instance,
      status: 413,
    });
  }
  if (metadata === "invalid") {
    return problem(request, {
      code: "TAROT_READING_REPORT_BODY_INVALID",
      ...tarotReadingReportApiMessages.invalidBody,
      instance,
      status: 400,
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !idempotencyKeyPattern.test(idempotencyKey)) {
    return problem(request, {
      code: "IDEMPOTENCY_KEY_INVALID",
      ...tarotReadingReportApiMessages.invalidIdempotency,
      instance,
      status: 400,
    });
  }
  const sessionToken = request.cookies.get(tarotReadingSessionCookieName)?.value;
  if (sessionToken === undefined) return notFound(request, instance);

  try {
    await admitWebProtectedBetaRequest(sessionToken, "protected_beta_mutation");
    const body = await readBoundedJson(request);
    await reportWebTarotReading(readingId, body, idempotencyKey, sessionToken);
    return applyPrivateHeaders(new NextResponse(null, { status: 204 }));
  } catch (error) {
    if (error instanceof ProtectedBetaAdmissionError) {
      if (error.code === "rate_limited") {
        return problem(request, {
          code: "TAROT_READING_REPORT_RATE_LIMITED",
          ...tarotReadingReportApiMessages.rateLimited,
          instance,
          retryAfterSeconds: error.retryAfterSeconds,
          status: 429,
        });
      }
      if (error.code === "session_required") return notFound(request, instance);
    }
    if (error instanceof TarotReadingBodyTooLargeError) {
      return problem(request, {
        code: "TAROT_READING_REPORT_BODY_TOO_LARGE",
        ...tarotReadingReportApiMessages.tooLarge,
        instance,
        status: 413,
      });
    }
    if (error instanceof TarotReadingReportInputError || error instanceof SyntaxError) {
      return problem(request, {
        code: "TAROT_READING_REPORT_BODY_INVALID",
        ...tarotReadingReportApiMessages.invalidBody,
        instance,
        status: 400,
      });
    }
    if (error instanceof TarotReadingApplicationError) {
      if (error.code === "not_found" || error.code === "session_required") {
        return notFound(request, instance);
      }
      if (error.code === "conflict") {
        return problem(request, {
          code: "TAROT_READING_REPORT_CONFLICT",
          ...tarotReadingReportApiMessages.conflict,
          instance,
          status: 409,
        });
      }
    }
    return problem(request, {
      code: "TAROT_READING_REPORT_UNAVAILABLE",
      ...tarotReadingReportApiMessages.unavailable,
      instance,
      status: 503,
    });
  }
};
