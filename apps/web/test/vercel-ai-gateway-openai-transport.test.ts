import { afterEach, describe, expect, it, vi } from "vitest";

import type { StructuredGenerationExecutionContextV1 } from "@rituvia/ai";

import {
  createVercelAiGatewayOpenAiTransport,
  type VercelAiGatewayOpenAiSendRequest,
} from "../server/vercel-ai-gateway-openai-transport";

const executionContext = (): StructuredGenerationExecutionContextV1 =>
  Object.freeze({
    attempt: 1,
    attemptId: "22222222-2222-4222-8222-222222222222",
    cancellation: Object.freeze({
      aborted: false,
      subscribe: () => () => undefined,
    }),
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("Vercel AI Gateway OpenAI transport", () => {
  it("sends only to the exact gateway with the server OIDC bearer token", async () => {
    const sendRequest = vi.fn<VercelAiGatewayOpenAiSendRequest>(
      async () => new Response("{}", { status: 200 }),
    );
    const transport = createVercelAiGatewayOpenAiTransport({
      bearerToken: "oidc-test-token",
      sendRequest,
    });

    await expect(
      transport(Object.freeze({ body: "{}", timeoutMs: 8_000 }), executionContext()),
    ).resolves.toBeInstanceOf(Response);

    expect(sendRequest).toHaveBeenCalledOnce();
    const [url, init] = sendRequest.mock.calls[0]!;
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
    expect(init).toMatchObject({
      body: "{}",
      headers: {
        accept: "application/json",
        authorization: "Bearer oidc-test-token",
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts at the bounded timeout and returns a provider-neutral failure", async () => {
    vi.useFakeTimers();
    const sendRequest = vi.fn<VercelAiGatewayOpenAiSendRequest>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const transport = createVercelAiGatewayOpenAiTransport({
      bearerToken: "oidc-test-token",
      sendRequest,
    });
    const result = transport(Object.freeze({ body: "{}", timeoutMs: 25 }), executionContext());

    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toEqual({
      code: "timeout",
      retryable: true,
      status: "failed",
    });
  });
});
