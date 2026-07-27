import "server-only";

import {
  createRevisitReminderService,
  RevisitReminderError,
  type RevisitReminderService,
} from "@rituvia/db";

import { loadWebDatabase } from "./database";

export class WebRevisitReminderError extends Error {
  readonly code: "conflict" | "invalid" | "not_found" | "session_unavailable" | "unavailable";

  constructor(code: "conflict" | "invalid" | "not_found" | "session_unavailable" | "unavailable") {
    super("The Revisit reminder operation failed.");
    this.name = "WebRevisitReminderError";
    this.code = code;
  }
}

let service: RevisitReminderService | undefined;

export const loadWebRevisitReminderService = (): RevisitReminderService => {
  service ??= createRevisitReminderService(loadWebDatabase());
  return service;
};

const mapError = (error: unknown): never => {
  if (error instanceof WebRevisitReminderError) throw error;
  if (error instanceof RevisitReminderError) {
    switch (error.code) {
      case "REVISIT_REMINDER_CONFLICT":
        throw new WebRevisitReminderError("conflict");
      case "REVISIT_REMINDER_INVALID":
        throw new WebRevisitReminderError("invalid");
      case "REVISIT_REMINDER_NOT_FOUND":
        throw new WebRevisitReminderError("not_found");
      case "REVISIT_REMINDER_SESSION_UNAVAILABLE":
        throw new WebRevisitReminderError("session_unavailable");
      case "REVISIT_REMINDER_UNAVAILABLE":
        throw new WebRevisitReminderError("unavailable");
    }
  }
  throw new WebRevisitReminderError("unavailable");
};

export const getWebRevisitReminder = async (input: {
  revisitId: string;
  sessionToken: string | undefined;
}) => {
  if (input.sessionToken === undefined) {
    throw new WebRevisitReminderError("session_unavailable");
  }
  try {
    return await loadWebRevisitReminderService().get({
      revisitId: input.revisitId,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const listWebRevisitReminders = async (sessionToken: string | undefined) => {
  if (sessionToken === undefined) {
    throw new WebRevisitReminderError("session_unavailable");
  }
  try {
    return await loadWebRevisitReminderService().list(sessionToken);
  } catch (error) {
    return mapError(error);
  }
};

export const mutateWebRevisitReminder = async (input: {
  idempotencyKey: string | undefined;
  request: unknown;
  revisitId: string;
  sessionToken: string | undefined;
}) => {
  if (input.sessionToken === undefined) {
    throw new WebRevisitReminderError("session_unavailable");
  }
  if (input.idempotencyKey === undefined) {
    throw new WebRevisitReminderError("invalid");
  }
  try {
    return await loadWebRevisitReminderService().mutate({
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      revisitId: input.revisitId,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};
