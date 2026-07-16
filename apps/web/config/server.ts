import "server-only";

import { parseServerConfiguration } from "@rituvia/config/server";

const runtimeConfiguration = parseServerConfiguration(process.env);

export const getWebRuntimeConfiguration = () => runtimeConfiguration;
