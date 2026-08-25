import type { NextConfig } from 'next';

const isGitHubPages = process.env.DEPLOY_TARGET === 'github-pages';

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        assetPrefix: '/t-day',
        output: 'export' as const,
      }
    : {}),
};

export default nextConfig;
