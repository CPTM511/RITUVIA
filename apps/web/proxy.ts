import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { classifyHttpMethod, startWebRequestObservability } from "./server/request-observability";
import { loadPublicShellState } from "./server/public-shell-state";
import { loadQuestionIntakeAvailability } from "./server/question-intake-state";
import { loadTarotReadingAvailability } from "./server/tarot-reading-state";
import { getWebRuntimeConfiguration } from "./config/server";
import {
  isIndexablePublicPagePathname,
  isPublicDiscoveryPathname,
  isPublicShellPathname,
} from "./app/_i18n/public-routes";
import { createRobotsText, createSitemapXml, type PublicShellState } from "./app/_i18n/seo";
import {
  localeAccountPath,
  localeCheckoutReturnPath,
  localeLocalCheckoutPath,
  localeQuestionIntakePath,
  localeSanctuaryPath,
  localeSignInPath,
  localeTarotOneCardPath,
  localeTarotThreeCardPath,
} from "./app/_i18n/routing";

const isUngatedInfrastructureRequest = (
  pathname: string,
  deploymentEnvironment: ReturnType<typeof getWebRuntimeConfiguration>["deploymentEnvironment"],
): boolean =>
  pathname === "/icon.svg" ||
  pathname.startsWith("/images/") ||
  pathname.startsWith("/_next/static/") ||
  (deploymentEnvironment !== "production" && pathname === "/_next/webpack-hmr");

const shellContentSecurityPolicy = [
  "base-uri 'none'",
  "connect-src 'self'",
  "default-src 'self'",
  "font-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self'",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
  "worker-src 'none'",
].join("; ");

const noIndexDirective = "noindex, nofollow, noarchive";
const anonymousSessionApiPathname = "/api/v1/anonymous/session";
const questionIntakeApiPathname = "/api/v1/intake/evaluate";
const tarotReadingApiPathname = "/api/v1/readings/tarot";
const tarotReadingPathPattern =
  /^\/api\/v1\/readings\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const tarotReadingReportPathPattern =
  /^\/api\/v1\/readings\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/report$/u;
const tarotInterpretationPathPattern =
  /^\/api\/v1\/readings\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/interpretation$/u;
const questionIntakePagePathname = localeQuestionIntakePath("en");
const tarotReadingPagePathnames = Object.freeze([
  localeTarotOneCardPath("en"),
  localeTarotThreeCardPath("en"),
]);
const privateExperiencePagePathnames = Object.freeze([
  localeAccountPath("en"),
  localeCheckoutReturnPath("en"),
  localeLocalCheckoutPath("en"),
  localeSanctuaryPath("en"),
  localeSignInPath("en"),
]);
const uuidPathPart = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const reviewedMvpApiPatterns = Object.freeze([
  { methods: ["POST"], pattern: /^\/api\/v1\/auth\/account-merge$/u },
  { methods: ["GET"], pattern: /^\/api\/v1\/auth\/callback$/u, query: "auth_callback" },
  { methods: ["POST"], pattern: /^\/api\/v1\/auth\/(?:logout|logout-all|start)$/u },
  { methods: ["GET"], pattern: /^\/api\/v1\/(?:catalog|entitlements)$/u },
  { methods: ["POST"], pattern: /^\/api\/v1\/checkout\/local\/complete$/u },
  { methods: ["POST"], pattern: /^\/api\/v1\/(?:intentions|journal-entries|ritual-sessions)$/u },
  {
    methods: ["GET"],
    pattern: new RegExp(
      `^/api/v1/(?:intentions|journal-entries|ritual-sessions)/${uuidPathPart}$`,
      "u",
    ),
  },
  { methods: ["GET", "PATCH"], pattern: /^\/api\/v1\/me$/u },
  { methods: ["GET"], pattern: /^\/api\/v1\/me\/(?:readings|sessions)$/u },
  { methods: ["DELETE"], pattern: new RegExp(`^/api/v1/me/sessions/${uuidPathPart}$`, "u") },
  { methods: ["POST"], pattern: /^\/api\/v1\/orders$/u },
  { methods: ["GET"], pattern: new RegExp(`^/api/v1/orders/${uuidPathPart}$`, "u") },
  { methods: ["POST"], pattern: new RegExp(`^/api/v1/orders/${uuidPathPart}/checkout$`, "u") },
  {
    methods: ["POST"],
    pattern: /^\/api\/v1\/webhooks\/payments\/(?:local|stripe)$/u,
    webhook: true,
  },
] as const);

const isSafeReadMethod = (method: string): boolean => method === "GET" || method === "HEAD";

const hasExactAuthCallbackQuery = (request: NextRequest): boolean => {
  const entries = [...request.nextUrl.searchParams.entries()];
  return (
    entries.length === 3 &&
    entries[0]?.[0] === "challenge" &&
    entries[1]?.[0] === "state" &&
    entries[2]?.[0] === "token" &&
    entries.every(([, value]) => /^[A-Za-z0-9_-]{16,512}$/u.test(value))
  );
};

const classifyReviewedMvpApi = (
  request: NextRequest,
): Readonly<{ reviewed: boolean; webhook: boolean }> => {
  if (isFrameworkRepresentationRequest(request)) return { reviewed: false, webhook: false };
  for (const route of reviewedMvpApiPatterns) {
    if (
      !route.pattern.test(request.nextUrl.pathname) ||
      !(route.methods as readonly string[]).includes(request.method)
    ) {
      continue;
    }
    const queryAllowed =
      "query" in route && route.query === "auth_callback"
        ? hasExactAuthCallbackQuery(request)
        : request.nextUrl.search === "";
    if (!queryAllowed) return { reviewed: false, webhook: false };
    return { reviewed: true, webhook: "webhook" in route && route.webhook === true };
  }
  return { reviewed: false, webhook: false };
};

const matchesPrivateExperienceDocument = (pathname: string): boolean =>
  privateExperiencePagePathnames.some(
    (pagePathname) =>
      pathname === pagePathname ||
      pathname === `${pagePathname}.rsc` ||
      pathname.startsWith(`${pagePathname}.segments/`),
  );

const hasReviewedPrivateDocumentQuery = (request: NextRequest): boolean => {
  if (request.nextUrl.search === "") return true;
  const pathname = request.nextUrl.pathname;
  const entries = [...request.nextUrl.searchParams.entries()];
  if (pathname === localeLocalCheckoutPath("en")) {
    return (
      entries.length === 1 &&
      entries[0]?.[0] === "checkout_id" &&
      /^local_[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(entries[0][1])
    );
  }
  if (pathname === localeCheckoutReturnPath("en")) {
    return (
      entries.length === 1 &&
      entries[0]?.[0] === "order_id" &&
      new RegExp(`^${uuidPathPart}$`, "u").test(entries[0][1])
    );
  }
  if (pathname === localeSanctuaryPath("en")) {
    return (
      entries.length === 2 &&
      request.nextUrl.searchParams.get("checkout") === "canceled" &&
      new RegExp(`^${uuidPathPart}$`, "u").test(
        request.nextUrl.searchParams.get("order_id") ?? "",
      ) &&
      new Set(entries.map(([key]) => key)).size === 2
    );
  }
  if (pathname === localeSignInPath("en")) {
    if (entries.length < 1 || entries.length > 2) return false;
    const keys = new Set(entries.map(([key]) => key));
    if (
      keys.size !== entries.length ||
      [...keys].some((key) => key !== "returnTo" && key !== "status")
    )
      return false;
    return entries.every(([key, value]) =>
      key === "status"
        ? value === "invalid"
        : value.length >= 1 && value.length <= 512 && value.startsWith("/en/"),
    );
  }
  return hasOnlyReviewedFrameworkQuery(request);
};

const isFrameworkRepresentationRequest = (request: NextRequest): boolean =>
  request.nextUrl.pathname.endsWith(".rsc") ||
  request.nextUrl.pathname.includes(".segments/") ||
  request.headers.get("rsc") === "1" ||
  request.headers.has("next-router-prefetch") ||
  request.headers.has("next-router-segment-prefetch") ||
  request.headers.has("next-router-state-tree") ||
  request.headers.get("accept")?.toLowerCase().includes("text/x-component") === true;

const hasOnlyReviewedFrameworkQuery = (request: NextRequest): boolean => {
  const entries = [...request.nextUrl.searchParams.entries()];
  const [entry] = entries;
  return (
    isFrameworkRepresentationRequest(request) &&
    entries.length === 1 &&
    entry !== undefined &&
    entry[0] === "_rsc" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(entry[1])
  );
};

const hasReviewedFrameworkNavigationSignal = (request: NextRequest): boolean =>
  request.nextUrl.pathname.includes(".segments/") ||
  request.headers.has("next-router-prefetch") ||
  request.headers.has("next-router-segment-prefetch") ||
  request.headers.has("next-router-state-tree") ||
  hasOnlyReviewedFrameworkQuery(request);

const isQuestionIntakePagePathname = (pathname: string): boolean =>
  pathname === questionIntakePagePathname ||
  pathname === `${questionIntakePagePathname}.rsc` ||
  pathname.startsWith(`${questionIntakePagePathname}.segments/`);

const isTarotReadingPagePathname = (pathname: string): boolean =>
  tarotReadingPagePathnames.some(
    (pagePathname) =>
      pathname === pagePathname ||
      pathname === `${pagePathname}.rsc` ||
      pathname.startsWith(`${pagePathname}.segments/`),
  );

const discoveryResponse = (
  request: NextRequest,
  publicShellState: PublicShellState,
): NextResponse => {
  const configuration = getWebRuntimeConfiguration();
  const input = {
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    publicShellState,
  } as const;
  const isHead = request.method === "HEAD";

  if (request.nextUrl.pathname === "/robots.txt") {
    const body = createRobotsText(input);
    return new NextResponse(isHead ? null : body, {
      headers: { "content-type": "text/plain; charset=utf-8" },
      status: 200,
    });
  }

  const body = createSitemapXml(input);
  return new NextResponse(isHead || body === null ? null : body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
    status: body === null ? 404 : 200,
  });
};

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const operation = startWebRequestObservability(classifyHttpMethod(request.method));
  const downstreamHeaders = new Headers(request.headers);
  downstreamHeaders.delete("baggage");
  downstreamHeaders.delete("tracestate");
  downstreamHeaders.delete("x-request-id");
  downstreamHeaders.set("x-rituvia-correlation-id", operation.context.correlationId);
  downstreamHeaders.set("traceparent", operation.toTraceHeaders().traceparent);
  const pathname = request.nextUrl.pathname;
  const configuration = getWebRuntimeConfiguration();
  const infrastructure =
    isSafeReadMethod(request.method) &&
    isUngatedInfrastructureRequest(pathname, configuration.deploymentEnvironment);
  const publicDocument = isPublicShellPathname(pathname);
  const discovery = isPublicDiscoveryPathname(pathname);
  const frameworkRepresentation = isFrameworkRepresentationRequest(request);
  const anonymousSessionApi = pathname === anonymousSessionApiPathname;
  const questionIntakeApi = pathname === questionIntakeApiPathname;
  const tarotReadingCreateApi = pathname === tarotReadingApiPathname;
  const tarotReadingReadApi = tarotReadingPathPattern.test(pathname);
  const tarotReadingReportApi = tarotReadingReportPathPattern.test(pathname);
  const tarotInterpretationApi = tarotInterpretationPathPattern.test(pathname);
  const tarotReadingApi =
    tarotReadingCreateApi || tarotReadingReadApi || tarotReadingReportApi || tarotInterpretationApi;
  const questionIntakeDocument = isQuestionIntakePagePathname(pathname);
  const tarotReadingDocument = isTarotReadingPagePathname(pathname);
  const privateExperienceDocument = matchesPrivateExperienceDocument(pathname);
  const reviewedMvpApi = classifyReviewedMvpApi(request);
  const reviewedPrivateExperienceDocument =
    privateExperienceDocument &&
    isSafeReadMethod(request.method) &&
    hasReviewedPrivateDocumentQuery(request) &&
    (!frameworkRepresentation || hasReviewedFrameworkNavigationSignal(request));
  const reviewedAnonymousSessionRequest =
    anonymousSessionApi &&
    request.method === "POST" &&
    request.nextUrl.search === "" &&
    !frameworkRepresentation;
  const reviewedQuestionIntakeRequest =
    questionIntakeApi &&
    request.method === "POST" &&
    request.nextUrl.search === "" &&
    !frameworkRepresentation;
  const reviewedTarotReadingRequest =
    tarotReadingApi &&
    ((tarotReadingCreateApi && request.method === "POST") ||
      (tarotReadingReadApi && request.method === "GET") ||
      (tarotReadingReportApi && request.method === "POST") ||
      (tarotInterpretationApi && (request.method === "GET" || request.method === "POST"))) &&
    request.nextUrl.search === "" &&
    !frameworkRepresentation;
  const unreviewedFrameworkRepresentation =
    frameworkRepresentation && !hasReviewedFrameworkNavigationSignal(request);
  const invalidRequest =
    !infrastructure &&
    !reviewedAnonymousSessionRequest &&
    !reviewedQuestionIntakeRequest &&
    !reviewedTarotReadingRequest &&
    !reviewedMvpApi.reviewed &&
    !reviewedPrivateExperienceDocument &&
    (unreviewedFrameworkRepresentation ||
      !isSafeReadMethod(request.method) ||
      (request.nextUrl.search !== "" && !hasOnlyReviewedFrameworkQuery(request)));
  const shouldLoadShellState =
    !invalidRequest &&
    (publicDocument ||
      reviewedAnonymousSessionRequest ||
      reviewedQuestionIntakeRequest ||
      reviewedTarotReadingRequest ||
      (reviewedMvpApi.reviewed && !reviewedMvpApi.webhook) ||
      reviewedPrivateExperienceDocument ||
      questionIntakeDocument ||
      tarotReadingDocument ||
      (discovery && configuration.deploymentEnvironment === "production"));
  const shellState = shouldLoadShellState ? await loadPublicShellState() : null;
  const intakeAvailability =
    !invalidRequest && (questionIntakeDocument || reviewedQuestionIntakeRequest)
      ? loadQuestionIntakeAvailability()
      : "disabled";
  const tarotReadingAvailability =
    !invalidRequest && (reviewedTarotReadingRequest || tarotReadingDocument)
      ? loadTarotReadingAvailability()
      : "disabled";
  const unsupported =
    !infrastructure &&
    !publicDocument &&
    !discovery &&
    !anonymousSessionApi &&
    !questionIntakeApi &&
    !tarotReadingApi &&
    !reviewedMvpApi.reviewed &&
    !privateExperienceDocument &&
    !questionIntakeDocument &&
    !tarotReadingDocument;
  const enabledDocument = publicDocument && shellState === "enabled";
  const enabledQuestionIntake = shellState === "enabled" && intakeAvailability === "enabled";
  const enabledTarotReading = shellState === "enabled" && tarotReadingAvailability === "enabled";
  const response =
    invalidRequest || unsupported
      ? new NextResponse(null, { status: 404 })
      : discovery
        ? discoveryResponse(request, shellState ?? "disabled")
        : infrastructure ||
            enabledDocument ||
            (questionIntakeDocument && enabledQuestionIntake) ||
            (tarotReadingDocument && enabledTarotReading) ||
            (reviewedQuestionIntakeRequest && enabledQuestionIntake) ||
            (reviewedTarotReadingRequest && enabledTarotReading) ||
            reviewedMvpApi.webhook ||
            (reviewedMvpApi.reviewed && shellState === "enabled") ||
            (reviewedPrivateExperienceDocument && shellState === "enabled") ||
            (reviewedAnonymousSessionRequest && shellState === "enabled")
          ? NextResponse.next({ request: { headers: downstreamHeaders } })
          : new NextResponse(null, { status: 404 });
  response.headers.set("content-security-policy", shellContentSecurityPolicy);
  response.headers.set(
    "permissions-policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-request-id", operation.context.correlationId);
  response.headers.set("x-content-type-options", "nosniff");
  const indexableRepresentation =
    configuration.deploymentEnvironment === "production" &&
    shellState === "enabled" &&
    request.nextUrl.search === "" &&
    isSafeReadMethod(request.method) &&
    isIndexablePublicPagePathname(pathname) &&
    !frameworkRepresentation;
  if (!indexableRepresentation) {
    response.headers.set("x-robots-tag", noIndexDirective);
  }
  if (
    anonymousSessionApi ||
    questionIntakeApi ||
    questionIntakeDocument ||
    tarotReadingApi ||
    tarotReadingDocument ||
    reviewedMvpApi.reviewed ||
    privateExperienceDocument
  ) {
    response.headers.set("cache-control", "private, no-store, max-age=0");
  } else if (discovery || response.status === 404) {
    response.headers.set("cache-control", "no-store, max-age=0");
  } else if (frameworkRepresentation) {
    response.headers.set("cache-control", "private, no-store, max-age=0");
  }
  operation.end(
    shellState === "unavailable"
      ? {
          category: "dependency",
          errorCode: "dependency_error",
          outcome: "failure",
          retryable: true,
        }
      : response.status === 200
        ? { outcome: "success" }
        : { outcome: "success", statusCode: response.status },
  );
  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
