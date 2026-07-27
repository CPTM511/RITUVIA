import {
  createRevisitReminderMessageV1,
  revisitReminderTemplateVersion,
  type RevisitReminderMessageV1,
} from "@rituvia/domain";

export type RevisitReminderDeliveryRequest = Readonly<{
  idempotencyKey: string;
  message: RevisitReminderMessageV1;
  recipientIdentityId: string;
  subscriptionId: string;
}>;

export type RevisitReminderDeliveryAdapter = Readonly<{
  deliver(
    request: RevisitReminderDeliveryRequest,
    signal: AbortSignal,
  ): Promise<Readonly<{ providerMessageReference: string }>>;
}>;

export type RevisitReminderJobStore = Readonly<{
  authorizeDelivery(input: { leaseToken: string; subscriptionId: string }): Promise<boolean>;
  claimDue(input: { leaseSeconds: number }): Promise<Readonly<{
    attempt: number;
    leaseToken: string;
    locale: "en";
    maxAttempts: 3;
    recipientIdentityId: string;
    revisitId: string;
    subscriptionId: string;
  }> | null>;
  completeDelivery(input: {
    leaseToken: string;
    providerMessageReference: string;
    subscriptionId: string;
  }): Promise<boolean>;
  failDelivery(input: {
    failureCode: "provider_disabled" | "provider_rejected" | "provider_unavailable" | "timeout";
    leaseToken: string;
    retryable: boolean;
    subscriptionId: string;
  }): Promise<"dead_lettered" | "retry_wait" | null>;
}>;

export type RevisitReminderWorkerEvent = Readonly<{
  attempt: number;
  event: "cancelled" | "dead_lettered" | "failed" | "retried" | "started" | "succeeded";
  templateVersion: typeof revisitReminderTemplateVersion;
}>;

export class RevisitReminderDeliveryError extends Error {
  readonly code: "provider_disabled" | "provider_rejected" | "provider_unavailable";
  readonly retryable: boolean;

  constructor(
    code: "provider_disabled" | "provider_rejected" | "provider_unavailable",
    retryable: boolean,
  ) {
    super("The Revisit reminder provider operation failed.");
    this.name = "RevisitReminderDeliveryError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const createDisabledRevisitReminderAdapter = (): RevisitReminderDeliveryAdapter =>
  Object.freeze({
    deliver() {
      throw new RevisitReminderDeliveryError("provider_disabled", false);
    },
  });

const idempotencyKeyFor = (subscriptionId: string): string =>
  `rituvia.revisit-reminder.delivery.v1:${subscriptionId}`;

export const runOneRevisitReminderDelivery = async (input: {
  adapter: RevisitReminderDeliveryAdapter;
  observe?: (event: RevisitReminderWorkerEvent) => void;
  signal?: AbortSignal;
  store: RevisitReminderJobStore;
  timeoutMs?: number;
}): Promise<"cancelled" | "dead_lettered" | "delivered" | "idle" | "retry_wait" | "stale"> => {
  const isAborted = (): boolean => input.signal?.aborted ?? false;
  if (isAborted()) return "cancelled";
  const timeoutMs = input.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 10_000) {
    throw new TypeError("Invalid Revisit reminder timeout.");
  }
  const job = await input.store.claimDue({ leaseSeconds: 60 });
  if (job === null) return "idle";
  const observe = (event: RevisitReminderWorkerEvent["event"]): void =>
    input.observe?.({
      attempt: job.attempt,
      event,
      templateVersion: revisitReminderTemplateVersion,
    });
  if (isAborted()) {
    await input.store.failDelivery({
      failureCode: "provider_unavailable",
      leaseToken: job.leaseToken,
      retryable: true,
      subscriptionId: job.subscriptionId,
    });
    observe("cancelled");
    return "cancelled";
  }
  if (
    !(await input.store.authorizeDelivery({
      leaseToken: job.leaseToken,
      subscriptionId: job.subscriptionId,
    }))
  ) {
    observe("cancelled");
    return "stale";
  }

  observe("started");
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  input.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    const delivered = await input.adapter.deliver(
      Object.freeze({
        idempotencyKey: idempotencyKeyFor(job.subscriptionId),
        message: createRevisitReminderMessageV1({
          actionUrl: "/en/revisit",
          preferenceUrl: "/en/revisit?settings=reminders",
        }),
        recipientIdentityId: job.recipientIdentityId,
        subscriptionId: job.subscriptionId,
      }),
      controller.signal,
    );
    const committed = await input.store.completeDelivery({
      leaseToken: job.leaseToken,
      providerMessageReference: delivered.providerMessageReference,
      subscriptionId: job.subscriptionId,
    });
    if (!committed) {
      observe("cancelled");
      return "stale";
    }
    observe("succeeded");
    return "delivered";
  } catch (error) {
    const failure =
      error instanceof RevisitReminderDeliveryError
        ? Object.freeze({ code: error.code, retryable: error.retryable })
        : controller.signal.aborted
          ? Object.freeze({ code: "timeout" as const, retryable: true })
          : Object.freeze({ code: "provider_unavailable" as const, retryable: true });
    const disposition = await input.store.failDelivery({
      failureCode: failure.code,
      leaseToken: job.leaseToken,
      retryable: failure.retryable,
      subscriptionId: job.subscriptionId,
    });
    if (disposition === "retry_wait") observe("retried");
    else if (disposition === "dead_lettered") observe("dead_lettered");
    else observe("failed");
    return disposition ?? "stale";
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", cancel);
  }
};
