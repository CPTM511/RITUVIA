import "server-only";

import type { ActiveOperation, HttpOperationStart } from "@rituvia/observability";

import { getWebObservability } from "./observability";

export const classifyHttpMethod = (method: string): HttpOperationStart["method"] => {
  switch (method.toUpperCase()) {
    case "DELETE":
    case "GET":
    case "HEAD":
    case "OPTIONS":
    case "PATCH":
    case "POST":
    case "PUT":
      return method.toUpperCase() as HttpOperationStart["method"];
    default:
      return "OTHER";
  }
};

export const startWebRequestObservability = (
  method: HttpOperationStart["method"],
): ActiveOperation =>
  getWebObservability().start({
    kind: "http",
    method,
    operation: "http.proxy_handoff",
  });
