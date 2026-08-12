import { describe, expect, it, vi } from "vitest";

import {
  AccountAuthEmailUnavailableError,
  createResendAccountAuthEmailSender,
} from "../server/account-auth-email";

describe("production account authentication email", () => {
  it("sends one idempotent short-lived magic link without logging or provider SDK state", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Promise.resolve(new Response(JSON.stringify({ id: "email_123" }), { status: 200 })),
    );
    const sender = createResendAccountAuthEmailSender({
      apiKey: `re_${"a".repeat(24)}`,
      brandName: "RITUVIA",
      fetcher,
      sender: "RITUVIA <access@example.com>",
    });

    await expect(
      sender.send({
        callbackUrl:
          "https://example.com/api/v1/auth/callback?challenge=11111111-1111-4111-8111-111111111111&state=state&token=token",
        challengeId: "11111111-1111-4111-8111-111111111111",
        email: "person@example.net",
        expiresAt: "2026-08-12T08:15:00.000Z",
      }),
    ).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails");
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      authorization: `Bearer re_${"a".repeat(24)}`,
      "content-type": "application/json",
      "idempotency-key": "account-sign-in/11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      from: "RITUVIA <access@example.com>",
      subject: "RITUVIA secure sign-in link",
      to: ["person@example.net"],
    });
  });

  it.each([
    vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Promise.resolve(new Response("unavailable", { status: 503 })),
    ),
    vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => {
      throw new Error("synthetic network failure");
    }),
  ])("fails closed when delivery is not acknowledged", async (fetcher) => {
    const sender = createResendAccountAuthEmailSender({
      apiKey: `re_${"a".repeat(24)}`,
      brandName: "RITUVIA",
      fetcher,
      sender: "RITUVIA <access@example.com>",
    });

    await expect(
      sender.send({
        callbackUrl: "https://example.com/api/v1/auth/callback",
        challengeId: "11111111-1111-4111-8111-111111111111",
        email: "person@example.net",
        expiresAt: "2026-08-12T08:15:00.000Z",
      }),
    ).rejects.toBeInstanceOf(AccountAuthEmailUnavailableError);
  });
});
