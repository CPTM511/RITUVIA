import "server-only";

import {
  accountConsentNoticeVersions,
  accountConsentNoticeVersionFor,
  type AccountConsentPurpose,
  type AccountConsentState,
} from "@rituvia/domain";
import {
  AccountConsentError,
  createAccountConsentService,
  type AccountConsentService,
} from "@rituvia/db";

import { loadWebDatabase } from "./database";

export type WebAccountConsentErrorCode =
  "conflict" | "invalid" | "session_unavailable" | "unavailable";

export class WebAccountConsentError extends Error {
  readonly code: WebAccountConsentErrorCode;

  constructor(code: WebAccountConsentErrorCode) {
    super("The account consent operation failed.");
    this.name = "WebAccountConsentError";
    this.code = code;
  }
}

const mapError = (error: unknown): never => {
  if (error instanceof WebAccountConsentError) throw error;
  if (error instanceof AccountConsentError) {
    if (error.code === "ACCOUNT_CONSENT_INVALID") {
      throw new WebAccountConsentError("invalid");
    }
    if (error.code === "ACCOUNT_CONSENT_CONFLICT") {
      throw new WebAccountConsentError("conflict");
    }
    if (error.code === "ACCOUNT_CONSENT_SESSION_UNAVAILABLE") {
      throw new WebAccountConsentError("session_unavailable");
    }
  }
  throw new WebAccountConsentError("unavailable");
};

let consentService: AccountConsentService | undefined;

export const loadWebAccountConsentService = (): AccountConsentService => {
  consentService ??= createAccountConsentService(loadWebDatabase());
  return consentService;
};

export const listWebAccountConsentControls = async (
  sessionToken: string | undefined,
): Promise<readonly AccountConsentState[]> => {
  if (sessionToken === undefined) throw new WebAccountConsentError("session_unavailable");
  try {
    return await loadWebAccountConsentService().list(sessionToken);
  } catch (error) {
    return mapError(error);
  }
};

export const recordWebAccountConsentControl = async (input: {
  idempotencyKey: string | undefined;
  request: unknown;
  sessionToken: string | undefined;
}): Promise<AccountConsentState> => {
  if (input.sessionToken === undefined) {
    throw new WebAccountConsentError("session_unavailable");
  }
  if (input.idempotencyKey === undefined) {
    throw new WebAccountConsentError("invalid");
  }
  try {
    return await loadWebAccountConsentService().record({
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const allowsWebAccountConsent = async (input: {
  purpose: AccountConsentPurpose;
  sessionToken: string | undefined;
}): Promise<boolean> =>
  input.sessionToken !== undefined &&
  loadWebAccountConsentService().allows({
    noticeVersion: accountConsentNoticeVersionFor(input.purpose),
    purpose: input.purpose,
    sessionToken: input.sessionToken,
  });

export const selectConsentedAiPersonalizationExcerpt = async (input: {
  selectedExcerpt: string | null;
  sessionToken: string | undefined;
}): Promise<string | null> =>
  selectConsentedAiPersonalizationExcerptWithService(loadWebAccountConsentService(), input);

export const selectConsentedAiPersonalizationExcerptWithService = async (
  service: Pick<AccountConsentService, "allows">,
  input: {
    selectedExcerpt: string | null;
    sessionToken: string | undefined;
  },
): Promise<string | null> => {
  if (
    input.sessionToken === undefined ||
    input.selectedExcerpt === null ||
    input.selectedExcerpt.length < 1 ||
    input.selectedExcerpt.length > 5_200
  ) {
    return null;
  }
  return (await service.allows({
    noticeVersion: accountConsentNoticeVersions.ai_personalization,
    purpose: "ai_personalization",
    sessionToken: input.sessionToken,
  }))
    ? input.selectedExcerpt
    : null;
};
