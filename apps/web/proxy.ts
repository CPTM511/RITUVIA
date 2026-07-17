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
  localeQuestionIntakePath,
  localeTarotOneCardPath,
  localeTarotThreeCardPath,
} from "./app/_i18n/routing";

const isUngatedInfrastructureRequest = (
  pathname: string,
  deploymentEnvironment: ReturnType<typeof getWebRuntimeConfiguration>["deploymentEnvironment"],
): boolean =>
  pathname === "/icon.svg" ||
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
  "style-src-attr 'none'",
  "worker-src 'none'",
].join("; ");

const noIndexDirective = "noindex, nofollow, noarchive";
const anonymousSessionApiPathname = "/api/v1/anonymous/session";
const questionIntakeApiPathname = "/api/v1/intake/evaluate";
const tarotReadingApiPathname = "/api/v1/readings/tarot";
const tarotReadingPathPattern =
  /^\/api\/v1\/readings\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const questionIntakePagePathname = localeQuestionIntakePath("en");
const tarotReadingPagePathnames = Object.freeze([
  localeTarotOneCardPath("en"),
  localeTarotThreeCardPath("en"),
]);

const isSafeReadMethod = (method: string): boolean => method === "GET" || method === "HEAD";

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
  const infrastructure = isUngatedInfrastructureRequest(
    pathname,
    configuration.deploymentEnvironment,
  );
  const publicDocument = isPublicShellPathname(pathname);
  const discovery = isPublicDiscoveryPathname(pathname);
  const frameworkRepresentation = isFrameworkRepresentationRequest(request);
  const anonymousSessionApi = pathname === anonymousSessionApiPathname;
  const questionIntakeApi = pathname === questionIntakeApiPathname;
  const tarotReadingCreateApi = pathname === tarotReadingApiPathname;
  const tarotReadingReadApi = tarotReadingPathPattern.test(pathname);
  const tarotReadingApi = tarotReadingCreateApi || tarotReadingReadApi;
  const questionIntakeDocument = isQuestionIntakePagePathname(pathname);
  const tarotReadingDocument = isTarotReadingPagePathname(pathname);
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
      (tarotReadingReadApi && request.method === "GET")) &&
    request.nextUrl.search === "" &&
    !frameworkRepresentation;
  const unreviewedFrameworkRepresentation =
    frameworkRepresentation && !hasReviewedFrameworkNavigationSignal(request);
  const invalidRequest =
    !infrastructure &&
    !reviewedAnonymousSessionRequest &&
    !reviewedQuestionIntakeRequest &&
    !reviewedTarotReadingRequest &&
    (unreviewedFrameworkRepresentation ||
      !isSafeReadMethod(request.method) ||
      (request.nextUrl.search !== "" && !hasOnlyReviewedFrameworkQuery(request)));
  const shouldLoadShellState =
    !invalidRequest &&
    (publicDocument ||
      reviewedAnonymousSessionRequest ||
      reviewedQuestionIntakeRequest ||
      reviewedTarotReadingRequest ||
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
    tarotReadingDocument
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
