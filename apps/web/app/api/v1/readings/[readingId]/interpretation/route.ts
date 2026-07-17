import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { parseTarotInterpretationResponseV1 } from "../../../../../_contracts/tarot-interpretation-response";
import {
  tarotInterpretationApiMessages,
  tarotReadingApiMessages,
} from "../../../../../_i18n/api-messages";
import {
  getWebTarotInterpretation,
  startWebTarotInterpretation,
  WebInterpretationRuntimeError,
} from "../../../../../../server/interpretation-runtime";
import {
  applyPrivateHeaders,
  hasAcceptedPostOrigin,
  hasAcceptedPrivateReadRequest,
  hasNoRequestBody,
  idempotencyKeyPattern,
  problem,
  readingIdPattern,
  tarotInterpretationApiPath,
  tarotReadingResourceApiPath,
  tarotReadingSessionCookieName,
} from "../../tarot/_http";

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

const success = (value: unknown, readingId: string): NextResponse => {
  const response = parseTarotInterpretationResponseV1(value, readingId);
  const nextResponse = applyPrivateHeaders(
    NextResponse.json(response, { status: response.status === "processing" ? 202 : 200 }),
  );
  if (response.status === "processing") {
    nextResponse.headers.set("retry-after", String(Math.ceil(response.pollAfterMs / 1_000)));
  }
  return nextResponse;
};

const mapRuntimeError = (request: NextRequest, error: unknown): NextResponse => {
  if (error instanceof WebInterpretationRuntimeError) {
    switch (error.code) {
      case "not_found":
        return notFound(request);
      case "conflict":
        return problem(request, {
          code: "TAROT_INTERPRETATION_CONFLICT",
          ...tarotInterpretationApiMessages.conflict,
          instance: tarotReadingResourceApiPath,
          status: 409,
        });
      case "permission_denied":
        return problem(request, {
          code: "TAROT_INTERPRETATION_PERMISSION_DENIED",
          ...tarotInterpretationApiMessages.permissionDenied,
          instance: tarotReadingResourceApiPath,
          status: 403,
        });
      case "rate_limited":
        return problem(request, {
          code: "TAROT_INTERPRETATION_RATE_LIMITED",
          ...tarotInterpretationApiMessages.rateLimited,
          instance: tarotReadingResourceApiPath,
          retryAfterSeconds: 30,
          status: 429,
        });
      case "unavailable":
        break;
    }
  }
  return problem(request, {
    code: "TAROT_INTERPRETATION_UNAVAILABLE",
    ...tarotInterpretationApiMessages.unavailable,
    instance: tarotReadingResourceApiPath,
    status: 503,
  });
};

const validatedResource = async (
  request: NextRequest,
  context: Context,
): Promise<Readonly<{ readingId: string; sessionToken: string }> | null> => {
  const { readingId } = await context.params;
  if (
    !readingIdPattern.test(readingId) ||
    request.nextUrl.search !== "" ||
    request.nextUrl.pathname !== tarotInterpretationApiPath(readingId)
  ) {
    return null;
  }
  const sessionToken = request.cookies.get(tarotReadingSessionCookieName)?.value;
  return sessionToken === undefined ? null : Object.freeze({ readingId, sessionToken });
};

export const POST = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const resource = await validatedResource(request, context);
  if (resource === null) return notFound(request);
  if (!hasAcceptedPostOrigin(request) || !hasNoRequestBody(request)) {
    return problem(request, {
      code: "TAROT_INTERPRETATION_REQUEST_REJECTED",
      ...tarotInterpretationApiMessages.invalidRequest,
      instance: tarotReadingResourceApiPath,
      status: 403,
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !idempotencyKeyPattern.test(idempotencyKey)) {
    return problem(request, {
      code: "IDEMPOTENCY_KEY_INVALID",
      ...tarotInterpretationApiMessages.invalidIdempotency,
      instance: tarotReadingResourceApiPath,
      status: 400,
    });
  }

  try {
    return success(
      await startWebTarotInterpretation(resource.readingId, idempotencyKey, resource.sessionToken),
      resource.readingId,
    );
  } catch (error) {
    return mapRuntimeError(request, error);
  }
};

export const GET = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  if (!hasAcceptedPrivateReadRequest(request) || !hasNoRequestBody(request)) {
    return notFound(request);
  }
  const resource = await validatedResource(request, context);
  if (resource === null) return notFound(request);

  try {
    return success(
      await getWebTarotInterpretation(resource.readingId, resource.sessionToken),
      resource.readingId,
    );
  } catch (error) {
    return mapRuntimeError(request, error);
  }
};
