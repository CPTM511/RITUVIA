import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { classifyHttpMethod, startWebRequestObservability } from "./server/request-observability";

export const proxy = (request: NextRequest): NextResponse => {
  const operation = startWebRequestObservability(classifyHttpMethod(request.method));
  const downstreamHeaders = new Headers(request.headers);
  downstreamHeaders.delete("baggage");
  downstreamHeaders.delete("tracestate");
  downstreamHeaders.delete("x-request-id");
  downstreamHeaders.set("x-rituvia-correlation-id", operation.context.correlationId);
  downstreamHeaders.set("traceparent", operation.toTraceHeaders().traceparent);
  const response = NextResponse.next({ request: { headers: downstreamHeaders } });
  response.headers.set("x-request-id", operation.context.correlationId);
  operation.end({ outcome: "success" });
  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
