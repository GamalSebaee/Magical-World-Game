import type { NextConfig } from 'next';

/**
 * Static export: the MVP needs no server (02-architecture §9).
 * Security headers (CSP, Permissions-Policy) are set by the static host; see docs/deployment.md.
 */
/** Same rule as the `devPlayground` flag: development and test builds only (D20). */
const devPages = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_TEST_HOOKS === '1';

const nextConfig: NextConfig = {
  output: 'export',
  // `page.dev.tsx` files are routes only when dev pages are on.
  pageExtensions: devPages ? ['dev.tsx', 'tsx', 'ts'] : ['tsx', 'ts'],
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
