import nextEnvironment from "@next/env";
import { parseServerConfiguration } from "@rituvia/config/server";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnvironment;
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
loadEnvConfig(repositoryRoot, false);
parseServerConfiguration(process.env);

process.argv.splice(2, 0, "start");
await import("next/dist/bin/next");
