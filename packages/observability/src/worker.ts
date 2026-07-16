import type { ActiveOperation, JobOperationStart, Observability } from "./contracts.js";
import { continueTrustedJob as continueInternalJob } from "./runtime.js";

export const continueTrustedJob = (
  observability: Observability,
  carrier: unknown,
  input: JobOperationStart,
): ActiveOperation => continueInternalJob(observability, carrier, input);
