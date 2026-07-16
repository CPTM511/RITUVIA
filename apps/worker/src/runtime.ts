export type WorkerState = "idle" | "running" | "stopped";

export interface WorkerRuntime {
  readonly state: WorkerState;
  start(signal: AbortSignal): Promise<void>;
  stop(): void;
}

export const createWorkerRuntime = (): WorkerRuntime => {
  let state: WorkerState = "idle";
  let stopRunning: (() => void) | undefined;

  return {
    get state() {
      return state;
    },

    start(signal) {
      if (state !== "idle") {
        throw new Error(`Worker cannot start from the ${state} state.`);
      }

      if (signal.aborted) {
        state = "stopped";
        return Promise.resolve();
      }

      state = "running";

      return new Promise<void>((resolve) => {
        const finish = () => {
          signal.removeEventListener("abort", finish);
          stopRunning = undefined;
          state = "stopped";
          resolve();
        };

        stopRunning = finish;
        signal.addEventListener("abort", finish, { once: true });
      });
    },

    stop() {
      if (state === "idle") {
        state = "stopped";
        return;
      }

      stopRunning?.();
    },
  };
};
