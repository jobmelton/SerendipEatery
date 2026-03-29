/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@serendipeatery/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'serendip.app' },
    ],
  },
  async redirects() {
    return [
      // Referral deep link redirect - captured by Netlify then handled here
      {
        source: '/r/:code',
        destination: '/join/:code',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
