import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', 'pg', 'web-push'],
  experimental: {
    // Server Actions handle every write in this app.
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
