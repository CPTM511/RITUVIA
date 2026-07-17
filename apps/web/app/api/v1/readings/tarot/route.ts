import { TarotReadingInputError } from "@rituvia/domain";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { tarotReadingApiMessages } from "../../../../_i18n/api-messages";
import { createWebTarotReading } from "../../../../../server/tarot-reading-runtime";
import { TarotReadingApplicationError } from "../../../../../server/tarot-reading";
import {
  applyPrivateHeaders,
  classifyJsonRequest,
  hasAcceptedPostOrigin,
  idempotencyKeyPattern,
  problem,
  readBoundedJson,
  tarotReadingApiPath,
  TarotReadingBodyTooLargeError,
  tarotReadingMaximumBodyBytes,
  tarotReadingSessionCookieName,
} from "./_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export { tarotReadingApiPath, tarotReadingMaximumBodyBytes };

const applicationProblem = (
  request: NextRequest,
  error: TarotReadingApplicationError,
): NextResponse => {
  switch (error.code) {
    case "conflict":
      return problem(request, {
        code: "TAROT_READING_CONFLICT",
        ...tarotReadingApiMessages.conflict,
        status: 409,
      });
    case "limit_reached":
      return problem(request, {
        code: "TAROT_READING_RATE_LIMITED",
        ...tarotReadingApiMessages.rateLimited,
        retryAfterSeconds: error.retryAfterSeconds,
        status: 429,
      });
    case "not_found":
      return problem(request, {
        code: "TAROT_READING_UNAVAILABLE",
        ...tarotReadingApiMessages.unavailable,
        status: 503,
      });
    case "session_required":
      return problem(request, {
        code: "TAROT_READING_SESSION_REQUIRED",
        ...tarotReadingApiMessages.sessionRequired,
        status: 401,
      });
    case "unavailable":
      return problem(request, {
        code: "TAROT_READING_UNAVAILABLE",
        ...tarotReadingApiMessages.unavailable,
        status: 503,
      });
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedPostOrigin(request)) {
    return problem(request, {
      code: "TAROT_READING_REQUEST_REJECTED",
      ...tarotReadingApiMessages.invalidRequest,
      status: 403,
    });
  }
  const metadata = classifyJsonRequest(request);
  if (metadata === "too_large") {
    return problem(request, {
      code: "TAROT_READING_BODY_TOO_LARGE",
      ...tarotReadingApiMessages.tooLarge,
      status: 413,
    });
  }
  if (metadata === "invalid") {
    return problem(request, {
      code: "TAROT_READING_BODY_INVALID",
      ...tarotReadingApiMessages.invalidBody,
      status: 400,
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !idempotencyKeyPattern.test(idempotencyKey)) {
    return problem(request, {
      code: "IDEMPOTENCY_KEY_INVALID",
      ...tarotReadingApiMessages.invalidIdempotency,
      status: 400,
    });
  }
  const sessionToken = request.cookies.get(tarotReadingSessionCookieName)?.value;
  if (sessionToken === undefined) {
    return problem(request, {
      code: "TAROT_READING_SESSION_REQUIRED",
      ...tarotReadingApiMessages.sessionRequired,
      status: 401,
    });
  }

  try {
    const body = await readBoundedJson(request);
    const result = await createWebTarotReading(body, idempotencyKey, sessionToken);
    return applyPrivateHeaders(
      NextResponse.json(result.response, { status: result.kind === "created" ? 201 : 200 }),
    );
  } catch (error) {
    if (error instanceof TarotReadingBodyTooLargeError) {
      return problem(request, {
        code: "TAROT_READING_BODY_TOO_LARGE",
        ...tarotReadingApiMessages.tooLarge,
        status: 413,
      });
    }
    if (error instanceof TarotReadingInputError || error instanceof SyntaxError) {
      return problem(request, {
        code: "TAROT_READING_BODY_INVALID",
        ...tarotReadingApiMessages.invalidBody,
        status: 400,
      });
    }
    if (error instanceof TarotReadingApplicationError) return applicationProblem(request, error);
    return problem(request, {
      code: "TAROT_READING_UNAVAILABLE",
      ...tarotReadingApiMessages.unavailable,
      status: 503,
    });
  }
};
