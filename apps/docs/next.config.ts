import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/', destination: '/docs/quickstart', permanent: false },
      { source: '/docs/concepts/agent-identity', destination: '/docs/concepts/identity', permanent: true },
      { source: '/docs/concepts/policies', destination: '/docs/concepts/policy', permanent: true },
      { source: '/docs/concepts/approvals', destination: '/docs/concepts/approval', permanent: true },
      { source: '/docs/concepts/audit-traces', destination: '/docs/concepts/traces', permanent: true },
      { source: '/docs/sdk/python-sdk', destination: '/docs/sdk/python', permanent: true },
    ];
  },
};

const withMDX = createMDX();
export default withMDX(nextConfig);
