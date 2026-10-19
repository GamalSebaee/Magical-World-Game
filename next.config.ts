import type { NextConfig } from 'next';

/**
 * Static export: the MVP needs no server (02-architecture §9).
 * Security headers (CSP, Permissions-Policy) are set by the static host; see docs/deployment.md.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
