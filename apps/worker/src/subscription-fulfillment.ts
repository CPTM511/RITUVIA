import { createHash, randomBytes } from "node:crypto";

import {
  CommercialSubscriptionPersistenceError,
  type CommercialSubscriptionPersistence,
} from "@rituvia/db";

export type SubscriptionFulfillmentDisposition =
  | "cancelled"
  | "dead_lettered"
  | "duplicate"
  | "event_processed"
  | "event_review_required"
  | "granted"
  | "idle"
  | "retried"
  | "skipped"
  | "stale";

export type SubscriptionFulfillmentWorkerEvent = Readonly<{
  disposition: SubscriptionFulfillmentDisposition | "persistence_unavailable";
}>;

const digest = (value: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value).digest());

const retryAt = (failedAt: Date, attempt: number, outboxId: string): string => {
  const exponential = Math.min(300_000, 5_000 * 2 ** Math.min(attempt - 1, 6));
  const jitter = createHash("sha256").update(outboxId, "utf8").digest().readUInt16BE(0) % 1_001;
  return new Date(failedAt.getTime() + exponential + jitter).toISOString();
};

export const runOneSubscriptionFulfillment = async (input: {
  clock?: () => string;
  signal?: AbortSignal;
  store: CommercialSubscriptionPersistence;
}): Promise<SubscriptionFulfillmentDisposition> => {
  const isAborted = (): boolean => input.signal?.aborted ?? false;
  if (isAborted()) return "cancelled";
  const now = input.clock ?? (() => new Date().toISOString());
  try {
    const processedEvent = await input.store.processNextSubscriptionEvent();
    if (processedEvent !== null) return "event_processed";
  } catch (error) {
    if (
      error instanceof CommercialSubscriptionPersistenceError &&
      (error.code === "COMMERCIAL_SUBSCRIPTION_CONFLICT" ||
        error.code === "COMMERCIAL_SUBSCRIPTION_NOT_FOUND") &&
      error.eventId !== null
    ) {
      const quarantined = await input.store.quarantineSubscriptionEvent({
        eventId: error.eventId,
        processedAt: new Date(now()).toISOString(),
      });
      return quarantined === null ? "stale" : "event_review_required";
    }
    throw error;
  }
  const claimedAt = new Date(now());
  if (!Number.isFinite(claimedAt.getTime())) {
    throw new TypeError("Subscription fulfillment worker clock is invalid.");
  }
  const leaseTokenHash = digest(randomBytes(32));
  const claim = await input.store.claimNextAllocation({
    claimedAt: claimedAt.toISOString(),
    leaseTokenHash,
    leasedUntil: new Date(claimedAt.getTime() + 60_000).toISOString(),
  });
  if (claim === null) return "idle";
  if (isAborted()) {
    await input.store.failAllocation({
      failedAt: claimedAt.toISOString(),
      leaseTokenHash,
      outboxId: claim.outboxId,
      retryAt: new Date(claimedAt.getTime() + 5_000).toISOString(),
    });
    return "cancelled";
  }
  try {
    const result = await input.store.fulfillAllocation({
      completedAt: new Date(now()).toISOString(),
      leaseTokenHash,
      outboxId: claim.outboxId,
    });
    return result?.disposition ?? "stale";
  } catch (error) {
    const terminal =
      error instanceof CommercialSubscriptionPersistenceError &&
      error.code === "COMMERCIAL_SUBSCRIPTION_CONFLICT";
    const failedAt = new Date(now());
    const disposition = await input.store.failAllocation({
      failedAt: failedAt.toISOString(),
      leaseTokenHash,
      outboxId: claim.outboxId,
      retryAt: terminal ? null : retryAt(failedAt, claim.attempt, claim.outboxId),
    });
    return disposition === "dead_lettered" ? "dead_lettered" : "retried";
  }
};

const delay = (signal: AbortSignal, milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });

export const runSubscriptionFulfillmentLoop = async (input: {
  failureDelayMilliseconds?: number;
  observe?: (event: SubscriptionFulfillmentWorkerEvent) => void;
  signal: AbortSignal;
  store: CommercialSubscriptionPersistence;
}): Promise<void> => {
  const failureDelayMilliseconds = input.failureDelayMilliseconds ?? 1_000;
  if (
    !Number.isSafeInteger(failureDelayMilliseconds) ||
    failureDelayMilliseconds < 1 ||
    failureDelayMilliseconds > 60_000
  ) {
    throw new TypeError("Subscription fulfillment failure delay is invalid.");
  }
  while (!input.signal.aborted) {
    try {
      const disposition = await runOneSubscriptionFulfillment(input);
      input.observe?.({ disposition });
      if (disposition === "idle" || disposition === "retried") {
        await delay(input.signal, disposition === "idle" ? 1_000 : 250);
      }
    } catch {
      input.observe?.({ disposition: "persistence_unavailable" });
      await delay(input.signal, failureDelayMilliseconds);
    }
  }
};
