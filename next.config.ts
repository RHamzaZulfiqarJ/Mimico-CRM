import type { NextConfig } from "next";

import { getSecurityHeaders } from "./src/lib/http/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: getSecurityHeaders() }];
  },
};

export default nextConfig;
