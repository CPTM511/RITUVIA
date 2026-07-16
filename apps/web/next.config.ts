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
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
