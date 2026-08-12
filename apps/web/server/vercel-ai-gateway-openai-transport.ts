import "server-only";

import type { StructuredGenerationFailureV1, VercelAiGatewayOpenAiTransportV1 } from "@rituvia/ai";

const endpoint = "https://ai-gateway.vercel.sh/v1/chat/completions" as const;

export type VercelAiGatewayOpenAiSendRequest = (
  input: string,
  init: Readonly<{
    body: string;
    headers: Readonly<Record<string, string>>;
    method: "POST";
    signal: AbortSignal;
  }>,
) => Promise<Response>;

const failure = (
  code: StructuredGenerationFailureV1["code"],
  retryable: boolean,
): StructuredGenerationFailureV1 => Object.freeze({ code, retryable, status: "failed" as const });

const isAbortError = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "name" in value && value.name === "AbortError";

export const createVercelAiGatewayOpenAiTransport = (options: {
  bearerToken: string;
  sendRequest?: VercelAiGatewayOpenAiSendRequest;
}): VercelAiGatewayOpenAiTransportV1 => {
  if (options.bearerToken.trim() === "") {
    throw new TypeError("The Vercel AI Gateway bearer token is invalid.");
  }
  const sendRequest = options.sendRequest ?? fetch;
  return async (request, executionContext) => {
    if (executionContext.cancellation.aborted) return failure("aborted", true);
    const controller = new AbortController();
    let externallyAborted = false;
    let timedOut = false;
    const unsubscribe = executionContext.cancellation.subscribe(() => {
      externallyAborted = true;
      controller.abort();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);
    try {
      return await sendRequest(endpoint, {
        body: request.body,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${options.bearerToken}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) return failure("timeout", true);
      if (externallyAborted) return failure("aborted", true);
      if (isAbortError(error)) return failure("unknown", false);
      if (error instanceof TypeError) return failure("unavailable", true);
      return failure("unknown", false);
    } finally {
      clearTimeout(timer);
      unsubscribe();
    }
  };
};
