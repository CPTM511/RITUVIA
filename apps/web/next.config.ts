import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    caseSensitiveRoutes: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  typedRoutes: true,
};

export default nextConfig;
