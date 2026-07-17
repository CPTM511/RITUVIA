import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loadWebFeatureFlagEvaluator } from "./server/feature-flags";
import { classifyHttpMethod, startWebRequestObservability } from "./server/request-observability";
import { isPublicShellPathname } from "./app/_i18n/public-routes";

const isUngatedInfrastructureRequest = (pathname: string): boolean =>
  pathname === "/icon.svg" || pathname.startsWith("/_next/");

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

type PublicShellState = "disabled" | "enabled" | "unavailable";

const publicShellState = async (): Promise<PublicShellState> => {
  try {
    const evaluator = await loadWebFeatureFlagEvaluator();
    return evaluator.evaluate("experience.public_shell", { locale: "en" }).enabled
      ? "enabled"
      : "disabled";
  } catch {
    return "unavailable";
  }
};

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const operation = startWebRequestObservability(classifyHttpMethod(request.method));
  const downstreamHeaders = new Headers(request.headers);
  downstreamHeaders.delete("baggage");
  downstreamHeaders.delete("tracestate");
  downstreamHeaders.delete("x-request-id");
  downstreamHeaders.set("x-rituvia-correlation-id", operation.context.correlationId);
  downstreamHeaders.set("traceparent", operation.toTraceHeaders().traceparent);
  const shellState = isPublicShellPathname(request.nextUrl.pathname)
    ? await publicShellState()
    : null;
  const unsupported =
    shellState === null && !isUngatedInfrastructureRequest(request.nextUrl.pathname);
  const enabled = !unsupported && (shellState === null || shellState === "enabled");
  const response = enabled
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
  operation.end(
    shellState === "unavailable"
      ? {
          category: "dependency",
          errorCode: "dependency_error",
          outcome: "failure",
          retryable: true,
        }
      : enabled
        ? { outcome: "success" }
        : { outcome: "success", statusCode: 404 },
  );
  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
