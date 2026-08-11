import { loadEnvConfig } from "@next/env";
import { parseBuildConfiguration } from "@rituvia/config/server";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
loadEnvConfig(repositoryRoot, process.env.NODE_ENV === "development");
parseBuildConfiguration(process.env);

const nextConfig: NextConfig = {
  experimental: {
    caseSensitiveRoutes: true,
  },
  outputFileTracingIncludes: {
    "/api/recovery/item-8/astrology": [
      "../../packages/astrology-engine-native/.native-cache/bin/rituvia-swisseph",
      "../../packages/astrology-engine-native/.native-cache/build-metadata.json",
      "../../packages/astrology-engine-native/.native-cache/ephe/*.se1",
    ],
  },
  outputFileTracingRoot: "../..",
  poweredByHeader: false,
  reactStrictMode: true,
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  typedRoutes: true,
};

export default nextConfig;
