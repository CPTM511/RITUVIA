import {
  createObservability,
  type Observability,
  type TelemetryEnvironment,
} from "@rituvia/observability";

export const createWorkerObservability = (environment: TelemetryEnvironment): Observability =>
  createObservability({
    environment,
    releaseVersion: "0.0.0",
    service: "worker",
    writer: {
      writeLine: (line) => console.info(line),
    },
  });
