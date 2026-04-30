import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // No turbopack root - let it infer automatically
  // This works for direct builds
};

export default nextConfig;