import type { NextConfig } from "next";

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
