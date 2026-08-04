import "server-only";

import { parseServerConfiguration } from "@rituvia/config/server";

import { resolveRecoveryDeploymentEnvironment } from "./recovery-environment";

const runtimeConfiguration = parseServerConfiguration({
  ...process.env,
  APP_ENV: resolveRecoveryDeploymentEnvironment(process.env),
});

export const getWebRuntimeConfiguration = () => runtimeConfiguration;
