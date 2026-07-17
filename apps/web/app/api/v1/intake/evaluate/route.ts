import {
  createQuestionIntakeResponse,
  evaluateQuestionIntake,
  QuestionIntakeError,
} from "@rituvia/domain";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { questionIntakeApiMessages } from "../../../../_i18n/api-messages";
import { getWebRuntimeConfiguration } from "../../../../../config/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const questionIntakeApiPath = "/api/v1/intake/evaluate";
export const questionIntakeMaximumBodyBytes = 4_096;

const requestIdPattern = /^req_[0-9a-f]{32}$/u;
const privateNoStore = "private, no-store, max-age=0";
const noIndex = "noindex, nofollow, noarchive";

type ProblemCode =
  | "INTAKE_BODY_INVALID"
  | "INTAKE_BODY_TOO_LARGE"
  | "INTAKE_REQUEST_REJECTED"
  | "INTAKE_UNAVAILABLE";

const applyPrivateHeaders = (response: NextResponse): NextResponse => {
  response.headers.set("cache-control", privateNoStore);
  response.headers.set("x-robots-tag", noIndex);
  return response;
};

const safeRequestId = (request: NextRequest): string => {
  const candidate = request.headers.get("x-rituvia-correlation-id");
  return candidate !== null && requestIdPattern.test(candidate)
    ? candidate
    : "req_00000000000000000000000000000000";
};

const problem = (
  request: NextRequest,
  input: Readonly<{
    code: ProblemCode;
    detail: string;
    status: number;
    title: string;
  }>,
): NextResponse =>
  applyPrivateHeaders(
    NextResponse.json(
      {
        code: input.code,
        detail: input.detail,
        fields: [],
        instance: questionIntakeApiPath,
        requestId: safeRequestId(request),
        status: input.status,
        title: input.title,
        type: `${getWebRuntimeConfiguration().brand.canonicalOrigin}/problems/${input.code
          .toLowerCase()
          .replaceAll("_", "-")}`,
      },
      { status: input.status },
    ),
  );

const hasAcceptedOrigin = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    origin === getWebRuntimeConfiguration().brand.canonicalOrigin &&
    (fetchSite === null || fetchSite === "same-origin")
  );
};

type RequestMetadata = "accepted" | "invalid" | "too_large";

const classifyRequestMetadata = (request: NextRequest): RequestMetadata => {
  if (
    request.headers.get("content-type") !== "application/json" ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null
  ) {
    return "invalid";
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return "accepted";
  if (!/^(?:0|[1-9][0-9]{0,4})$/u.test(contentLength)) return "invalid";
  return Number(contentLength) > questionIntakeMaximumBodyBytes ? "too_large" : "accepted";
};

class BodyTooLargeError extends Error {}

const readBoundedJson = async (request: NextRequest): Promise<unknown> => {
  if (request.body === null) throw new SyntaxError("missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > questionIntakeMaximumBodyBytes) throw new BodyTooLargeError();
      chunks.push(result.value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Cancellation failure cannot make a rejected request acceptable.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  if (!hasAcceptedOrigin(request)) {
    return problem(request, {
      code: "INTAKE_REQUEST_REJECTED",
      ...questionIntakeApiMessages.invalidRequest,
      status: 403,
    });
  }
  const metadata = classifyRequestMetadata(request);
  if (metadata === "too_large") {
    return problem(request, {
      code: "INTAKE_BODY_TOO_LARGE",
      ...questionIntakeApiMessages.tooLarge,
      status: 413,
    });
  }
  if (metadata === "invalid") {
    return problem(request, {
      code: "INTAKE_BODY_INVALID",
      ...questionIntakeApiMessages.invalidBody,
      status: 400,
    });
  }

  try {
    const input = await readBoundedJson(request);
    const response = createQuestionIntakeResponse(evaluateQuestionIntake(input));
    return applyPrivateHeaders(NextResponse.json(response, { status: 200 }));
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return problem(request, {
        code: "INTAKE_BODY_TOO_LARGE",
        ...questionIntakeApiMessages.tooLarge,
        status: 413,
      });
    }
    if (
      error instanceof QuestionIntakeError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      return problem(request, {
        code: "INTAKE_BODY_INVALID",
        ...questionIntakeApiMessages.invalidBody,
        status: 400,
      });
    }
    return problem(request, {
      code: "INTAKE_UNAVAILABLE",
      ...questionIntakeApiMessages.unavailable,
      status: 503,
    });
  }
};
