export const revisitReminderSchemaVersion = "revisit-reminder-preference.v1" as const;
export const revisitReminderNoticeVersion = "rituvia.revisit-reminder-notice.v1" as const;
export const revisitReminderTemplateVersion = "revisit-reminder.en.v1" as const;
export const revisitReminderChannel = "email" as const;
export const revisitReminderFrequency = "once" as const;

export const revisitReminderActions = Object.freeze(["subscribe", "unsubscribe"] as const);
export type RevisitReminderAction = (typeof revisitReminderActions)[number];

export type RevisitReminderMutationV1 = Readonly<{
  action: RevisitReminderAction;
  channel: typeof revisitReminderChannel;
  frequency: typeof revisitReminderFrequency;
  noticeVersion: typeof revisitReminderNoticeVersion;
  schemaVersion: typeof revisitReminderSchemaVersion;
}>;

export type RevisitReminderStateV1 = Readonly<{
  channel: typeof revisitReminderChannel;
  deliveryState: "cancelled" | "dead_lettered" | "delivered" | "pending" | "retry_wait";
  frequency: typeof revisitReminderFrequency;
  locale: "en";
  noticeVersion: typeof revisitReminderNoticeVersion;
  preferenceState: "subscribed" | "unsubscribed";
  recordedAt: string;
  revisitId: string;
  schemaVersion: typeof revisitReminderSchemaVersion;
}>;

export type RevisitReminderMessageV1 = Readonly<{
  actionLabel: string;
  actionUrl: string;
  bodyText: string;
  locale: "en";
  preferenceUrl: string;
  previewText: string;
  subject: string;
  templateVersion: typeof revisitReminderTemplateVersion;
}>;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
};

export const parseRevisitReminderMutationV1 = (value: unknown): RevisitReminderMutationV1 => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !hasExactKeys(value as Record<string, unknown>, [
      "action",
      "channel",
      "frequency",
      "noticeVersion",
      "schemaVersion",
    ])
  ) {
    throw new TypeError("Invalid Revisit reminder request.");
  }
  const input = value as Record<string, unknown>;
  if (
    !revisitReminderActions.includes(input.action as RevisitReminderAction) ||
    input.channel !== revisitReminderChannel ||
    input.frequency !== revisitReminderFrequency ||
    input.noticeVersion !== revisitReminderNoticeVersion ||
    input.schemaVersion !== revisitReminderSchemaVersion
  ) {
    throw new TypeError("Invalid Revisit reminder request.");
  }
  return Object.freeze({
    action: input.action as RevisitReminderAction,
    channel: revisitReminderChannel,
    frequency: revisitReminderFrequency,
    noticeVersion: revisitReminderNoticeVersion,
    schemaVersion: revisitReminderSchemaVersion,
  });
};

const parsePrivateRoute = (value: string): string => {
  if (!/^\/en\/(?:account|revisit)(?:[/?#]|$)/u.test(value) || value.length > 500) {
    throw new TypeError("Invalid Revisit reminder route.");
  }
  return value;
};

export const createRevisitReminderMessageV1 = (input: {
  actionUrl: string;
  preferenceUrl: string;
}): RevisitReminderMessageV1 =>
  Object.freeze({
    actionLabel: "Open your private Revisit",
    actionUrl: parsePrivateRoute(input.actionUrl),
    bodyText:
      "Your scheduled Revisit is ready when you are. Open your private space when you choose.",
    locale: "en",
    preferenceUrl: parsePrivateRoute(input.preferenceUrl),
    previewText: "Your private Revisit is ready when you are.",
    subject: "A quiet reminder from RITUVIA",
    templateVersion: revisitReminderTemplateVersion,
  });

export const revisitReminderBackoffSeconds = (input: { attempt: number; seed: string }): number => {
  if (
    !Number.isSafeInteger(input.attempt) ||
    input.attempt < 1 ||
    input.attempt > 8 ||
    !/^[0-9a-f-]{36}$/u.test(input.seed)
  ) {
    throw new TypeError("Invalid Revisit reminder retry input.");
  }
  const jitter =
    [...input.seed].reduce((total, character) => total + character.charCodeAt(0), 0) % 17;
  return Math.min(3_600, 30 * 2 ** (input.attempt - 1)) + jitter;
};
