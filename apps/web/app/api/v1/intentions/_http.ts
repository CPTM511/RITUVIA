import { ReflectionError, RevisitContractError } from "@rituvia/domain";
import { NextRequest, NextResponse } from "next/server";

import { getWebRuntimeConfiguration } from "../../../../config/server";
import { accountSessionCookieName } from "../../../../server/account-auth";
import { ReflectionLoopApplicationError } from "../../../../server/reflection-loop";
import {
  admitWebProtectedBetaRequest,
  ProtectedBetaAdmissionError,
} from "../../../../server/protected-beta-abuse";
import {
  deriveSessionCsrfToken,
  hasValidSessionCsrfToken,
  sessionCsrfHeaderName,
} from "../../../../server/session-csrf";

export const reflectionSessionCookieName = "__Host-rituvia-anonymous-session";
export const reflectionMaximumBodyBytes = 16_384;
export const reflectionIdempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
export const reflectionResourceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type ReflectionResourceKind = "intention" | "journal" | "revisit" | "ritual";

export type ReflectionProblemCode =
  | "REFLECTION_BODY_INVALID"
  | "REFLECTION_BODY_TOO_LARGE"
  | "REFLECTION_CONFLICT"
  | "REFLECTION_DAILY_LIMIT"
  | "REFLECTION_ENTITLEMENT_REQUIRED"
  | "REFLECTION_IDEMPOTENCY_KEY_INVALID"
  | "REFLECTION_NOT_FOUND"
  | "REFLECTION_RATE_LIMITED"
  | "REFLECTION_REQUEST_REJECTED"
  | "REFLECTION_SCHEDULE_INVALID"
  | "REFLECTION_SESSION_REQUIRED"
  | "REFLECTION_UNAVAILABLE";

const privateNoStore = "private, no-store, max-age=0";
const noIndex = "noindex, nofollow, noarchive";
const requestIdPattern = /^req_[0-9a-f]{32}$/u;

export const applyReflectionPrivateHeaders = (response: NextResponse): NextResponse => {
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

export const reflectionProblem = (
  request: NextRequest,
  input: Readonly<{
    code: ReflectionProblemCode;
    detail: string;
    instance: string;
    retryAfterSeconds?: number | undefined;
    status: number;
    title: string;
  }>,
): NextResponse => {
  const response = applyReflectionPrivateHeaders(
    NextResponse.json(
      {
        code: input.code,
        detail: input.detail,
        fields: [],
        instance: input.instance,
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
  response.headers.set("content-type", "application/problem+json");
  if (
    input.retryAfterSeconds !== undefined &&
    Number.isSafeInteger(input.retryAfterSeconds) &&
    input.retryAfterSeconds >= 1 &&
    input.retryAfterSeconds <= 86_400
  ) {
    response.headers.set("retry-after", String(input.retryAfterSeconds));
  }
  return response;
};

export const hasAcceptedReflectionPostOrigin = (request: NextRequest): boolean =>
  request.headers.get("origin") === getWebRuntimeConfiguration().brand.canonicalOrigin &&
  (request.headers.get("sec-fetch-site") === null ||
    request.headers.get("sec-fetch-site") === "same-origin");

const isFrameworkPrivateRead = (request: NextRequest): boolean => {
  const accept = request.headers.get("accept");
  return (
    request.nextUrl.pathname.endsWith(".rsc") ||
    request.nextUrl.pathname.includes(".segments/") ||
    request.headers.has("rsc") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    request.headers.has("next-router-state-tree") ||
    (accept !== null &&
      accept
        .toLowerCase()
        .split(",")
        .some((value) => value.trim().split(";", 1)[0] === "text/x-component"))
  );
};

export const hasAcceptedReflectionPrivateRead = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    !isFrameworkPrivateRead(request) &&
    request.nextUrl.search === "" &&
    (origin === null || origin === getWebRuntimeConfiguration().brand.canonicalOrigin) &&
    (fetchSite === null || fetchSite === "same-origin")
  );
};

type RequestMetadata = "accepted" | "invalid" | "too_large";

export const classifyReflectionJsonRequest = (request: NextRequest): RequestMetadata => {
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
  return Number(contentLength) > reflectionMaximumBodyBytes ? "too_large" : "accepted";
};

export class ReflectionBodyTooLargeError extends Error {}

export const readReflectionBoundedJson = async (request: NextRequest): Promise<unknown> => {
  if (request.body === null) throw new SyntaxError("missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > reflectionMaximumBodyBytes) throw new ReflectionBodyTooLargeError();
      chunks.push(result.value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // A cancellation failure cannot make rejected private bytes acceptable.
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
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
};

const resourceLabel = (kind: ReflectionResourceKind): string => {
  switch (kind) {
    case "intention":
      return "intention";
    case "journal":
      return "journal entry";
    case "revisit":
      return "Revisit";
    case "ritual":
      return "ritual session";
  }
};

export const reflectionApplicationProblem = (
  request: NextRequest,
  input: Readonly<{
    error: ReflectionLoopApplicationError;
    instance: string;
    kind: ReflectionResourceKind;
  }>,
): NextResponse => {
  const label = resourceLabel(input.kind);
  switch (input.error.code) {
    case "conflict":
      return reflectionProblem(request, {
        code: "REFLECTION_CONFLICT",
        detail: `The ${label} request conflicts with an earlier request.`,
        instance: input.instance,
        status: 409,
        title: "Request conflict",
      });
    case "daily_limit":
      return reflectionProblem(request, {
        code: "REFLECTION_DAILY_LIMIT",
        detail:
          "Today's free ritual is complete. A free ritual will be available after UTC midnight.",
        instance: input.instance,
        retryAfterSeconds: input.error.retryAfterSeconds,
        status: 429,
        title: "Daily ritual complete",
      });
    case "entitlement_required":
      return reflectionProblem(request, {
        code: "REFLECTION_ENTITLEMENT_REQUIRED",
        detail:
          "This ritual object requires an active entitlement. Candle and incense remain free.",
        instance: input.instance,
        status: 402,
        title: "Ritual object entitlement required",
      });
    case "invalid":
      return reflectionProblem(request, {
        code: "REFLECTION_BODY_INVALID",
        detail: "The request body is invalid.",
        instance: input.instance,
        status: 400,
        title: "Invalid request body",
      });
    case "not_found":
      return reflectionNotFoundProblem(request, input.instance);
    case "schedule_invalid":
      return reflectionProblem(request, {
        code: "REFLECTION_SCHEDULE_INVALID",
        detail: "Choose a future Revisit date inside the private retention window.",
        instance: input.instance,
        status: 422,
        title: "Invalid Revisit schedule",
      });
    case "session_required":
      return reflectionProblem(request, {
        code: "REFLECTION_SESSION_REQUIRED",
        detail: "A private anonymous session is required.",
        instance: input.instance,
        status: 401,
        title: "Private session required",
      });
    case "unavailable":
      return reflectionProblem(request, {
        code: "REFLECTION_UNAVAILABLE",
        detail: `The private ${label} is temporarily unavailable.`,
        instance: input.instance,
        status: 503,
        title: "Private reflection unavailable",
      });
  }
};

export const reflectionNotFoundProblem = (request: NextRequest, instance: string): NextResponse =>
  reflectionProblem(request, {
    code: "REFLECTION_NOT_FOUND",
    detail: "The private reflection resource was not found.",
    instance,
    status: 404,
    title: "Private reflection not found",
  });

const admitReflectionMutation = async (
  request: NextRequest,
  instance: string,
  anonymousSessionToken: string | undefined,
): Promise<NextResponse | null> => {
  if (anonymousSessionToken === undefined) return null;
  try {
    await admitWebProtectedBetaRequest(anonymousSessionToken, "protected_beta_mutation");
    return null;
  } catch (error) {
    if (error instanceof ProtectedBetaAdmissionError) {
      if (error.code === "rate_limited") {
        return reflectionProblem(request, {
          code: "REFLECTION_RATE_LIMITED",
          detail: "Pause before making another private reflection change.",
          instance,
          retryAfterSeconds: error.retryAfterSeconds,
          status: 429,
          title: "Private reflection changes are temporarily limited",
        });
      }
      if (error.code === "session_required") {
        return reflectionProblem(request, {
          code: "REFLECTION_SESSION_REQUIRED",
          detail: "A private anonymous session is required.",
          instance,
          status: 401,
          title: "Private session required",
        });
      }
    }
    return reflectionProblem(request, {
      code: "REFLECTION_UNAVAILABLE",
      detail: "The private reflection service is temporarily unavailable.",
      instance,
      status: 503,
      title: "Private reflection unavailable",
    });
  }
};

export type ReflectionCreateFunction<Resource> = (
  body: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => Promise<Readonly<{ kind: "created" | "replayed"; resource: Resource }>>;

export type ReflectionMutationFunction<Resource> = (
  id: string,
  body: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => Promise<Readonly<{ kind: "mutated" | "replayed"; resource: Resource | null }>>;

export const handleReflectionCreate = async <Resource>(
  request: NextRequest,
  input: Readonly<{
    create: ReflectionCreateFunction<Resource>;
    csrfRequired?: boolean;
    kind: ReflectionResourceKind;
    path: string;
  }>,
): Promise<NextResponse> => {
  if (
    request.nextUrl.pathname !== input.path ||
    request.nextUrl.search !== "" ||
    !hasAcceptedReflectionPostOrigin(request)
  ) {
    return reflectionProblem(request, {
      code: "REFLECTION_REQUEST_REJECTED",
      detail: "The private reflection request was rejected.",
      instance: input.path,
      status: 403,
      title: "Request rejected",
    });
  }
  const metadata = classifyReflectionJsonRequest(request);
  if (metadata === "too_large") {
    return reflectionProblem(request, {
      code: "REFLECTION_BODY_TOO_LARGE",
      detail: "The request body is too large.",
      instance: input.path,
      status: 413,
      title: "Request too large",
    });
  }
  if (metadata === "invalid") {
    return reflectionProblem(request, {
      code: "REFLECTION_BODY_INVALID",
      detail: "The request body is invalid.",
      instance: input.path,
      status: 400,
      title: "Invalid request body",
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !reflectionIdempotencyKeyPattern.test(idempotencyKey)) {
    return reflectionProblem(request, {
      code: "REFLECTION_IDEMPOTENCY_KEY_INVALID",
      detail: "A valid idempotency key is required.",
      instance: input.path,
      status: 400,
      title: "Invalid idempotency key",
    });
  }
  const anonymousSessionToken = request.cookies.get(reflectionSessionCookieName)?.value;
  const accountSessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (anonymousSessionToken === undefined && accountSessionToken === undefined) {
    return reflectionProblem(request, {
      code: "REFLECTION_SESSION_REQUIRED",
      detail: "A private anonymous session is required.",
      instance: input.path,
      status: 401,
      title: "Private session required",
    });
  }
  if (
    input.csrfRequired === true &&
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [
      accountSessionToken,
      anonymousSessionToken,
    ])
  ) {
    return reflectionProblem(request, {
      code: "REFLECTION_REQUEST_REJECTED",
      detail: "The private reflection request was rejected.",
      instance: input.path,
      status: 403,
      title: "Request rejected",
    });
  }
  const admission = await admitReflectionMutation(request, input.path, anonymousSessionToken);
  if (admission !== null) return admission;
  try {
    const body = await readReflectionBoundedJson(request);
    if (accountSessionToken !== undefined && anonymousSessionToken !== undefined) {
      return reflectionProblem(request, {
        code: "REFLECTION_CONFLICT",
        detail: "Complete the private account merge before creating this reflection.",
        instance: input.path,
        status: 409,
        title: "Account merge required",
      });
    }
    const result =
      accountSessionToken === undefined
        ? await input.create(body, idempotencyKey, anonymousSessionToken)
        : await input.create(body, idempotencyKey, anonymousSessionToken, accountSessionToken);
    const response = applyReflectionPrivateHeaders(
      NextResponse.json(result.resource, { status: result.kind === "created" ? 201 : 200 }),
    );
    const responseSessionToken = accountSessionToken ?? anonymousSessionToken;
    if (responseSessionToken === undefined) {
      return reflectionProblem(request, {
        code: "REFLECTION_SESSION_REQUIRED",
        detail: "A private anonymous session is required.",
        instance: input.path,
        status: 401,
        title: "Private session required",
      });
    }
    response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(responseSessionToken));
    return response;
  } catch (error) {
    if (error instanceof ReflectionBodyTooLargeError) {
      return reflectionProblem(request, {
        code: "REFLECTION_BODY_TOO_LARGE",
        detail: "The request body is too large.",
        instance: input.path,
        status: 413,
        title: "Request too large",
      });
    }
    if (
      error instanceof ReflectionError ||
      error instanceof RevisitContractError ||
      error instanceof SyntaxError
    ) {
      return reflectionProblem(request, {
        code: "REFLECTION_BODY_INVALID",
        detail: "The request body is invalid.",
        instance: input.path,
        status: 400,
        title: "Invalid request body",
      });
    }
    if (error instanceof ReflectionLoopApplicationError) {
      return reflectionApplicationProblem(request, {
        error,
        instance: input.path,
        kind: input.kind,
      });
    }
    return reflectionProblem(request, {
      code: "REFLECTION_UNAVAILABLE",
      detail: `The private ${resourceLabel(input.kind)} is temporarily unavailable.`,
      instance: input.path,
      status: 503,
      title: "Private reflection unavailable",
    });
  }
};

export const handleReflectionGet = async <Resource>(
  request: NextRequest,
  input: Readonly<{
    get: (
      id: string,
      anonymousSessionToken: string | undefined,
      accountSessionToken?: string | undefined,
    ) => Promise<Resource | null>;
    id: string;
    kind: ReflectionResourceKind;
    path: string;
  }>,
): Promise<NextResponse> => {
  if (
    request.nextUrl.pathname !== input.path ||
    !reflectionResourceIdPattern.test(input.id) ||
    !hasAcceptedReflectionPrivateRead(request)
  ) {
    return reflectionNotFoundProblem(request, input.path);
  }
  const anonymousSessionToken = request.cookies.get(reflectionSessionCookieName)?.value;
  const accountSessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (anonymousSessionToken === undefined && accountSessionToken === undefined) {
    return reflectionNotFoundProblem(request, input.path);
  }
  try {
    const resource =
      accountSessionToken === undefined
        ? await input.get(input.id, anonymousSessionToken)
        : await input.get(input.id, anonymousSessionToken, accountSessionToken);
    return resource === null
      ? reflectionNotFoundProblem(request, input.path)
      : applyReflectionPrivateHeaders(NextResponse.json(resource));
  } catch (error) {
    if (error instanceof ReflectionLoopApplicationError) {
      if (error.code === "not_found" || error.code === "session_required") {
        return reflectionNotFoundProblem(request, input.path);
      }
      return reflectionApplicationProblem(request, {
        error,
        instance: input.path,
        kind: input.kind,
      });
    }
    return reflectionProblem(request, {
      code: "REFLECTION_UNAVAILABLE",
      detail: `The private ${resourceLabel(input.kind)} is temporarily unavailable.`,
      instance: input.path,
      status: 503,
      title: "Private reflection unavailable",
    });
  }
};

export const handleReflectionList = async <Resource>(
  request: NextRequest,
  input: Readonly<{
    kind: ReflectionResourceKind;
    list: (
      anonymousSessionToken: string | undefined,
      accountSessionToken?: string | undefined,
    ) => Promise<readonly Resource[]>;
    path: string;
  }>,
): Promise<NextResponse> => {
  if (request.nextUrl.pathname !== input.path || !hasAcceptedReflectionPrivateRead(request)) {
    return reflectionNotFoundProblem(request, input.path);
  }
  const anonymousSessionToken = request.cookies.get(reflectionSessionCookieName)?.value;
  const accountSessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (anonymousSessionToken === undefined && accountSessionToken === undefined) {
    return reflectionNotFoundProblem(request, input.path);
  }
  try {
    const resources =
      accountSessionToken === undefined
        ? await input.list(anonymousSessionToken)
        : await input.list(anonymousSessionToken, accountSessionToken);
    return applyReflectionPrivateHeaders(NextResponse.json({ items: resources }));
  } catch (error) {
    if (error instanceof ReflectionLoopApplicationError) {
      if (error.code === "not_found" || error.code === "session_required") {
        return reflectionNotFoundProblem(request, input.path);
      }
      return reflectionApplicationProblem(request, {
        error,
        instance: input.path,
        kind: input.kind,
      });
    }
    return reflectionProblem(request, {
      code: "REFLECTION_UNAVAILABLE",
      detail: `The private ${resourceLabel(input.kind)} is temporarily unavailable.`,
      instance: input.path,
      status: 503,
      title: "Private reflection unavailable",
    });
  }
};

const mutationSession = (request: NextRequest) =>
  Object.freeze({
    accountSessionToken: request.cookies.get(accountSessionCookieName)?.value,
    anonymousSessionToken: request.cookies.get(reflectionSessionCookieName)?.value,
  });

export const handleReflectionMutation = async <Resource>(
  request: NextRequest,
  input: Readonly<{
    id: string;
    kind: ReflectionResourceKind;
    mutate: ReflectionMutationFunction<Resource>;
    path: string;
  }>,
): Promise<NextResponse> => {
  if (
    request.nextUrl.pathname !== input.path ||
    request.nextUrl.search !== "" ||
    !reflectionResourceIdPattern.test(input.id) ||
    !hasAcceptedReflectionPostOrigin(request)
  ) {
    return reflectionProblem(request, {
      code: "REFLECTION_REQUEST_REJECTED",
      detail: "The private reflection request was rejected.",
      instance: input.path,
      status: 403,
      title: "Request rejected",
    });
  }
  const metadata = classifyReflectionJsonRequest(request);
  if (metadata !== "accepted") {
    return reflectionProblem(request, {
      code: metadata === "too_large" ? "REFLECTION_BODY_TOO_LARGE" : "REFLECTION_BODY_INVALID",
      detail:
        metadata === "too_large"
          ? "The request body is too large."
          : "The request body is invalid.",
      instance: input.path,
      status: metadata === "too_large" ? 413 : 400,
      title: metadata === "too_large" ? "Request too large" : "Invalid request body",
    });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey === null || !reflectionIdempotencyKeyPattern.test(idempotencyKey)) {
    return reflectionProblem(request, {
      code: "REFLECTION_IDEMPOTENCY_KEY_INVALID",
      detail: "A valid idempotency key is required.",
      instance: input.path,
      status: 400,
      title: "Invalid idempotency key",
    });
  }
  const session = mutationSession(request);
  if (session.anonymousSessionToken === undefined && session.accountSessionToken === undefined) {
    return reflectionNotFoundProblem(request, input.path);
  }
  if (
    !hasValidSessionCsrfToken(request.headers.get(sessionCsrfHeaderName), [
      session.accountSessionToken,
      session.anonymousSessionToken,
    ])
  ) {
    return reflectionProblem(request, {
      code: "REFLECTION_REQUEST_REJECTED",
      detail: "The private reflection request was rejected.",
      instance: input.path,
      status: 403,
      title: "Request rejected",
    });
  }
  const admission = await admitReflectionMutation(
    request,
    input.path,
    session.anonymousSessionToken,
  );
  if (admission !== null) return admission;
  try {
    const body = await readReflectionBoundedJson(request);
    if (session.accountSessionToken !== undefined && session.anonymousSessionToken !== undefined) {
      return reflectionProblem(request, {
        code: "REFLECTION_CONFLICT",
        detail: "Complete the private account merge before changing this reflection.",
        instance: input.path,
        status: 409,
        title: "Account merge required",
      });
    }
    const result =
      session.accountSessionToken === undefined
        ? await input.mutate(input.id, body, idempotencyKey, session.anonymousSessionToken)
        : await input.mutate(
            input.id,
            body,
            idempotencyKey,
            session.anonymousSessionToken,
            session.accountSessionToken,
          );
    const response =
      result.resource === null
        ? applyReflectionPrivateHeaders(new NextResponse(null, { status: 204 }))
        : applyReflectionPrivateHeaders(NextResponse.json(result.resource));
    const responseSessionToken = session.accountSessionToken ?? session.anonymousSessionToken;
    if (responseSessionToken !== undefined) {
      response.headers.set(sessionCsrfHeaderName, deriveSessionCsrfToken(responseSessionToken));
    }
    return response;
  } catch (error) {
    if (error instanceof ReflectionBodyTooLargeError) {
      return reflectionProblem(request, {
        code: "REFLECTION_BODY_TOO_LARGE",
        detail: "The request body is too large.",
        instance: input.path,
        status: 413,
        title: "Request too large",
      });
    }
    if (
      error instanceof ReflectionError ||
      error instanceof RevisitContractError ||
      error instanceof SyntaxError
    ) {
      return reflectionProblem(request, {
        code: "REFLECTION_BODY_INVALID",
        detail: "The request body is invalid.",
        instance: input.path,
        status: 400,
        title: "Invalid request body",
      });
    }
    if (error instanceof ReflectionLoopApplicationError) {
      return reflectionApplicationProblem(request, {
        error,
        instance: input.path,
        kind: input.kind,
      });
    }
    return reflectionProblem(request, {
      code: "REFLECTION_UNAVAILABLE",
      detail: `The private ${resourceLabel(input.kind)} is temporarily unavailable.`,
      instance: input.path,
      status: 503,
      title: "Private reflection unavailable",
    });
  }
};

const revisionHeaderPattern = /^"revision-([1-9][0-9]{0,9})"$/u;

export const handleReflectionDelete = async (
  request: NextRequest,
  input: Readonly<{
    id: string;
    kind: ReflectionResourceKind;
    mutate: ReflectionMutationFunction<unknown>;
    path: string;
    schemaVersion: string;
  }>,
): Promise<NextResponse> => {
  const revision = request.headers.get("if-match")?.match(revisionHeaderPattern)?.[1];
  if (
    request.body !== null ||
    request.headers.get("content-type") !== null ||
    revision === undefined
  ) {
    return reflectionProblem(request, {
      code: "REFLECTION_BODY_INVALID",
      detail: "The request body is invalid.",
      instance: input.path,
      status: 400,
      title: "Invalid request body",
    });
  }
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const synthetic = new NextRequest(request.url, {
    headers,
    method: "PATCH",
    body: JSON.stringify({
      action: "delete",
      expectedRevision: Number(revision),
      schemaVersion: input.schemaVersion,
    }),
  });
  return handleReflectionMutation(synthetic, input);
};
