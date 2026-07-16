import type { TelemetryRuntime } from "../src/index.js";

export const createDeterministicRuntime = (): TelemetryRuntime => {
  let seed = 1;
  let monotonic = 100;
  return Object.freeze({
    monotonicTime() {
      monotonic += 5;
      return monotonic;
    },
    randomBytes(length: number) {
      const bytes = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        bytes[index] = seed;
        seed = (seed % 254) + 1;
      }
      return bytes;
    },
    wallTime: () => "2026-07-17T00:00:00.000Z",
  });
};
