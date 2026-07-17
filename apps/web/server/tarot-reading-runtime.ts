import "server-only";

import {
  createTarotReadingApplicationService,
  TarotReadingApplicationError,
} from "./tarot-reading";

const unavailable = (): never => {
  throw new TarotReadingApplicationError("unavailable");
};

// The application service and database adapter are complete, but the canonical
// catalog is deliberately publication-ineligible. This second safe-off boundary
// prevents direct route invocation from bypassing the proxy activation gate.
type TarotReadingApplicationService = ReturnType<typeof createTarotReadingApplicationService>;

export const createWebTarotReading: TarotReadingApplicationService["create"] = async () =>
  unavailable();

export const getWebTarotReading: TarotReadingApplicationService["get"] = async () => unavailable();

export const reportWebTarotReading: TarotReadingApplicationService["report"] = async () =>
  unavailable();
