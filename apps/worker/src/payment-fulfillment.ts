import { createHash, randomBytes } from "node:crypto";

import {
  CommercialFulfillmentPersistenceError,
  type CommercialCreditPackFulfillmentPlanner,
  type CommercialFulfillmentPersistence,
} from "@rituvia/db";

export type CommercialPaymentFulfillmentWorkerEvent = Readonly<{
  attempt: number;
  disposition:
    | "adjusted"
    | "cancelled"
    | "dead_lettered"
    | "granted"
    | "granted_and_adjusted"
    | "granted_and_held"
    | "held"
    | "idle"
    | "persistence_unavailable"
    | "retried"
    | "review_required"
    | "stale"
    | "unchanged";
  paymentStateVersion: number;
}>;

const digest = (value: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value).digest());

const retryDelayMilliseconds = (attempt: number, outboxId: string): number => {
  const exponential = Math.min(300_000, 5_000 * 2 ** Math.min(attempt - 1, 6));
  const jitter = createHash("sha256").update(outboxId, "utf8").digest().readUInt16BE(0) % 1_001;
  return exponential + jitter;
};

export const runOneCommercialPaymentFulfillment = async (input: {
  clock?: () => string;
  observe?: (event: CommercialPaymentFulfillmentWorkerEvent) => void;
  plan: CommercialCreditPackFulfillmentPlanner;
  signal?: AbortSignal;
  store: CommercialFulfillmentPersistence;
}): Promise<
  | "adjusted"
  | "cancelled"
  | "dead_lettered"
  | "granted"
  | "granted_and_adjusted"
  | "granted_and_held"
  | "held"
  | "idle"
  | "retried"
  | "review_required"
  | "stale"
  | "unchanged"
> => {
  const isAborted = (): boolean => input.signal?.aborted ?? false;
  if (isAborted()) return "cancelled";
  const now = input.clock ?? (() => new Date().toISOString());
  const claimedAt = new Date(now());
  if (!Number.isFinite(claimedAt.getTime())) {
    throw new TypeError("Commercial fulfillment worker clock is invalid.");
  }
  const leaseTokenHash = digest(randomBytes(32));
  const claim = await input.store.claimNextPaymentState({
    claimedAt: claimedAt.toISOString(),
    leaseTokenHash,
    leasedUntil: new Date(claimedAt.getTime() + 60_000).toISOString(),
  });
  if (claim === null) {
    input.observe?.({ attempt: 0, disposition: "idle", paymentStateVersion: 0 });
    return "idle";
  }
  const observe = (disposition: CommercialPaymentFulfillmentWorkerEvent["disposition"]): void =>
    input.observe?.({
      attempt: claim.attempt,
      disposition,
      paymentStateVersion: claim.paymentStateVersion,
    });
  if (isAborted()) {
    const failedAt = new Date(now());
    await input.store.failPaymentState({
      failedAt: failedAt.toISOString(),
      failureCode: "worker_cancelled",
      leaseTokenHash,
      outboxId: claim.outboxId,
      retryAt: new Date(failedAt.getTime() + 5_000).toISOString(),
    });
    observe("cancelled");
    return "cancelled";
  }

  try {
    const result = await input.store.fulfillPaymentState(
      {
        completedAt: new Date(now()).toISOString(),
        leaseTokenHash,
        outboxId: claim.outboxId,
      },
      input.plan,
    );
    if (result === null) {
      observe("stale");
      return "stale";
    }
    observe(result.disposition);
    return result.disposition;
  } catch (error) {
    const terminal =
      error instanceof CommercialFulfillmentPersistenceError &&
      error.code === "COMMERCIAL_FULFILLMENT_CONFLICT";
    const failedAt = new Date(now());
    const retryAt = terminal
      ? null
      : new Date(
          failedAt.getTime() + retryDelayMilliseconds(claim.attempt, claim.outboxId),
        ).toISOString();
    const disposition = await input.store.failPaymentState({
      failedAt: failedAt.toISOString(),
      failureCode: terminal ? "fulfillment_conflict" : "fulfillment_unavailable",
      leaseTokenHash,
      outboxId: claim.outboxId,
      retryAt,
    });
    const outcome = disposition === "dead_lettered" ? "dead_lettered" : "retried";
    observe(outcome);
    return outcome;
  }
};

const abortableDelay = (signal: AbortSignal, milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });

export const runCommercialPaymentFulfillmentLoop = async (input: {
  failureDelayMilliseconds?: number;
  observe?: (event: CommercialPaymentFulfillmentWorkerEvent) => void;
  plan: CommercialCreditPackFulfillmentPlanner;
  signal: AbortSignal;
  store: CommercialFulfillmentPersistence;
}): Promise<void> => {
  const failureDelayMilliseconds = input.failureDelayMilliseconds ?? 1_000;
  if (
    !Number.isSafeInteger(failureDelayMilliseconds) ||
    failureDelayMilliseconds < 1 ||
    failureDelayMilliseconds > 60_000
  ) {
    throw new TypeError("Commercial fulfillment failure delay is invalid.");
  }
  while (!input.signal.aborted) {
    try {
      const result = await runOneCommercialPaymentFulfillment(input);
      if (result === "idle" || result === "retried") {
        await abortableDelay(input.signal, result === "idle" ? 1_000 : 250);
      }
    } catch {
      input.observe?.({
        attempt: 0,
        disposition: "persistence_unavailable",
        paymentStateVersion: 0,
      });
      await abortableDelay(input.signal, failureDelayMilliseconds);
    }
  }
};
