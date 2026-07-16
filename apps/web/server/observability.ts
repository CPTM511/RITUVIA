import "server-only";

import { createObservability, type Observability } from "@rituvia/observability";

import { getWebRuntimeConfiguration } from "../config/server";

let observability: Observability | undefined;

export const getWebObservability = (): Observability => {
  if (observability !== undefined) return observability;
  const configuration = getWebRuntimeConfiguration();
  observability = createObservability({
    environment: configuration.deploymentEnvironment,
    releaseVersion: "0.0.0",
    service: "web",
    writer: {
      writeLine: (line) => console.info(line),
    },
  });
  return observability;
};
