import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/docs/concepts/agent-identity', destination: '/docs/concepts/identity', permanent: true },
      { source: '/docs/concepts/policies', destination: '/docs/concepts/policy', permanent: true },
      { source: '/docs/concepts/approvals', destination: '/docs/concepts/approval', permanent: true },
      { source: '/docs/concepts/audit-traces', destination: '/docs/concepts/traces', permanent: true },
      { source: '/docs/sdk/python-sdk', destination: '/docs/sdk/python', permanent: true },
      { source: '/docs/enterprise/pricing-billing', destination: '/docs/enterprise/billing', permanent: true },
    ];
  },
};

const withMDX = createMDX();
export default withMDX(nextConfig);
