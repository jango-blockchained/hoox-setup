import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;