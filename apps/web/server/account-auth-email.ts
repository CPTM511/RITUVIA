import "server-only";

import { englishAccountEmailMessages } from "../app/_i18n/account-email-messages";

export class AccountAuthEmailUnavailableError extends Error {
  constructor() {
    super("Account authentication email delivery is unavailable.");
    this.name = "AccountAuthEmailUnavailableError";
  }
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const createResendAccountAuthEmailSender = (input: {
  apiKey: string;
  brandName: string;
  fetcher?: Fetcher | undefined;
  sender: string;
}) => {
  const fetcher = input.fetcher ?? fetch;
  return Object.freeze({
    async send(message: {
      callbackUrl: string;
      challengeId: string;
      email: string;
      expiresAt: string;
    }): Promise<void> {
      const safeBrandName = escapeHtml(input.brandName);
      const safeCallbackUrl = escapeHtml(message.callbackUrl);
      const safeExpiresAt = escapeHtml(message.expiresAt);
      let response: Response;
      try {
        response = await fetcher("https://api.resend.com/emails", {
          body: JSON.stringify({
            from: input.sender,
            html: `<h1>${englishAccountEmailMessages.heading}</h1><p>${englishAccountEmailMessages.introduction}</p><p><a href="${safeCallbackUrl}">${englishAccountEmailMessages.action}</a></p><p>${englishAccountEmailMessages.expiry(safeExpiresAt)}</p><p>${englishAccountEmailMessages.ignored}</p><p>${safeBrandName}</p>`,
            subject: englishAccountEmailMessages.subject(input.brandName),
            text: `${englishAccountEmailMessages.introduction}\n\n${message.callbackUrl}\n\n${englishAccountEmailMessages.expiry(message.expiresAt)}\n${englishAccountEmailMessages.ignored}`,
            to: [message.email],
          }),
          headers: {
            authorization: `Bearer ${input.apiKey}`,
            "content-type": "application/json",
            "idempotency-key": `account-sign-in/${message.challengeId}`,
          },
          method: "POST",
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw new AccountAuthEmailUnavailableError();
      }
      if (!response.ok) throw new AccountAuthEmailUnavailableError();
    },
  });
};
