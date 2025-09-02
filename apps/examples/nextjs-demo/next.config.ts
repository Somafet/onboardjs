import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: '/buda/static/:path*',
                destination: 'https://eu-assets.i.posthog.com/static/:path*',
            },
            {
                source: '/buda/:path*',
                destination: 'https://eu.i.posthog.com/:path*',
            },
            {
                source: '/buda/decide',
                destination: 'https://eu.i.posthog.com/decide',
            },
        ]
    },
}

export default nextConfig
