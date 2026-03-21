import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow workspace dependency resolution
  transpilePackages: ['@sidclaw/sdk', '@sidclaw/shared'],
};

export default nextConfig;
