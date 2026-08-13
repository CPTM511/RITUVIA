import type { CommercialDisputeSupportPersistence } from "@rituvia/db";

export type CommercialDisputeSupportWorkerEvent = Readonly<{
  disposition: "cancelled" | "idle" | "persistence_unavailable" | "projected";
}>;

export const runOneCommercialDisputeSupportProjection = async (input: {
  observe?: (event: CommercialDisputeSupportWorkerEvent) => void;
  signal?: AbortSignal;
  store: CommercialDisputeSupportPersistence;
}): Promise<"cancelled" | "idle" | "projected"> => {
  if (input.signal?.aborted === true) {
    input.observe?.({ disposition: "cancelled" });
    return "cancelled";
  }
  const result = await input.store.projectNextDisputeSupportCase();
  const disposition = result === null ? "idle" : "projected";
  input.observe?.({ disposition });
  return disposition;
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

export const runCommercialDisputeSupportProjectionLoop = async (input: {
  failureDelayMilliseconds?: number;
  idleDelayMilliseconds?: number;
  observe?: (event: CommercialDisputeSupportWorkerEvent) => void;
  signal: AbortSignal;
  store: CommercialDisputeSupportPersistence;
}): Promise<void> => {
  const failureDelayMilliseconds = input.failureDelayMilliseconds ?? 1_000;
  const idleDelayMilliseconds = input.idleDelayMilliseconds ?? 1_000;
  if (
    !Number.isSafeInteger(failureDelayMilliseconds) ||
    failureDelayMilliseconds < 1 ||
    failureDelayMilliseconds > 60_000 ||
    !Number.isSafeInteger(idleDelayMilliseconds) ||
    idleDelayMilliseconds < 1 ||
    idleDelayMilliseconds > 60_000
  ) {
    throw new TypeError("Commercial dispute support delay is invalid.");
  }
  while (!input.signal.aborted) {
    try {
      const result = await runOneCommercialDisputeSupportProjection(input);
      if (result === "idle") {
        await abortableDelay(input.signal, idleDelayMilliseconds);
      }
    } catch {
      input.observe?.({ disposition: "persistence_unavailable" });
      await abortableDelay(input.signal, failureDelayMilliseconds);
    }
  }
};
