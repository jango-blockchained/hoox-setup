import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: '/home/jango/Git/hoox-setup',
  },
};

export default nextConfig;