import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // The workbook restore uploads a multi-MB .xlsx via a Server Action.
    serverActions: { bodySizeLimit: '30mb' },
  },
};

export default nextConfig;
