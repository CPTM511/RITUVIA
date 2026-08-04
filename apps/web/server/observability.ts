import "server-only";

import { createObservability, type Observability } from "@rituvia/observability";

import { getWebRuntimeConfiguration } from "../config/server";

let observability: Observability | undefined;
const sourceRevision = process.env.RITUVIA_BUILD_SOURCE_SHA?.trim().toLowerCase() ?? "";
const releaseVersion = /^[0-9a-f]{40}$/u.test(sourceRevision)
  ? `0.0.0+sha.${sourceRevision.slice(0, 12)}`
  : "0.0.0";

export const getWebObservability = (): Observability => {
  if (observability !== undefined) return observability;
  const configuration = getWebRuntimeConfiguration();
  observability = createObservability({
    environment: configuration.deploymentEnvironment,
    releaseVersion,
    service: "web",
    writer: {
      writeLine: (line) => console.info(line),
    },
  });
  return observability;
};
