const { withSentryConfig } = require('@sentry/nextjs');

/**
 * @type {import('next').NextConfig}
 */

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, content-type, Authorization',
          },
        ],
      },
    ];
  },
  // temp fix for reown package issue: https://github.com/MetaMask/metamask-sdk/issues/1376
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Suppress source map upload logs in CI
  silent: true,

  // Source map upload config (requires SENTRY_AUTH_TOKEN)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tree-shake Sentry debug logs (new recommended pattern)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Route events through your domain to reduce ad-blocker drops
  tunnelRoute: '/monitoring',

  // Hide source maps from users
  hideSourceMaps: true,

  // Disable telemetry
  telemetry: false,
});
