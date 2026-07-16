import type { ActiveOperation, JobOperationStart, Observability } from "@rituvia/observability";
import { continueTrustedJob } from "@rituvia/observability/worker";

const persistedEnvelopeBrand: unique symbol = Symbol("persisted-internal-job-envelope");

type PersistedInternalJobEnvelope = Readonly<{
  readonly [persistedEnvelopeBrand]: true;
  traceCarrier: unknown;
}>;

export const continuePersistedJobObservability = (
  observability: Observability,
  envelope: PersistedInternalJobEnvelope,
  input: JobOperationStart,
): ActiveOperation => continueTrustedJob(observability, envelope.traceCarrier, input);
