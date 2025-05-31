/** @type {import('next').NextConfig} */
const path = require('path');
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');

// Load environment variables
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
});

module.exports = (phase) => {
  // Determine if we're in development or production
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  const isProd = phase === PHASE_PRODUCTION_BUILD;

  // Setup bundle analyzer for production builds when enabled
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });

  // Base configuration
  const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    output: 'standalone',
    
    // TypeScript support is built-in
    typescript: {
      // Report TypeScript errors during builds
      ignoreBuildErrors: false,
    },
    
    // Transpile workspace packages
    transpilePackages: [
      '@sermonflow/ui',
      '@sermonflow/types',
      '@sermonflow/api',
      '@sermonflow/ai',
    ],
    
    // Environment variables
    env: {
      NEXT_PUBLIC_API_URL: process.env.API_URL || 'http://localhost:3000',
      NEXT_PUBLIC_WEB_URL: process.env.WEB_URL || 'http://localhost:3001',
      NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS || 'false',
    },
    
    // Image optimization settings
    images: {
      domains: [
        'localhost',
        'sermonflow.com',
        'images.unsplash.com',
        'avatars.githubusercontent.com',
      ],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      formats: ['image/webp'],
      minimumCacheTTL: 60,
    },
    
    // Custom webpack configuration
    webpack: (config, { isServer, dev }) => {
      // Fixes npm packages that depend on `fs` module
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
        };
      }
      
      // Optimize SVG handling
      config.module.rules.push({
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      });

      // Add support for monorepo packages
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.join(__dirname, './src'),
      };
      
      // Add support for watching changes in linked packages during development
      if (dev && !isServer) {
        const originalEntry = config.entry;
        config.entry = async () => {
          const entries = await originalEntry();
          
          // This ensures changes to these packages trigger HMR
          const packagePaths = [
            '@sermonflow/ui',
            '@sermonflow/types',
            '@sermonflow/api',
            '@sermonflow/ai',
          ];
          
          // Add watcher entries for packages
          packagePaths.forEach((pkg) => {
            const packagePath = path.join(__dirname, '../../packages', pkg.replace('@sermonflow/', ''));
            entries['main.js'].unshift(path.join(packagePath, 'src/index'));
          });
          
          return entries;
        };
      }
      
      return config;
    },
    
    // Security headers
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on',
            },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=()',
            },
          ],
        },
      ];
    },
    
    // Redirects for authentication flow
    async redirects() {
      return [
        {
          source: '/login',
          destination: '/auth/login',
          permanent: true,
        },
        {
          source: '/signup',
          destination: '/auth/signup',
          permanent: true,
        },
        {
          source: '/forgot-password',
          destination: '/auth/forgot-password',
          permanent: true,
        },
        {
          source: '/reset-password',
          destination: '/auth/reset-password',
          permanent: true,
        },
      ];
    },
    
    // Performance optimizations
    experimental: {
      // Enable React Server Components
      serverComponents: false, // Set to true when ready to adopt RSC
      
      // Optimize font loading
      fontLoaders: [
        { loader: '@next/font/google', options: { subsets: ['latin'] } },
      ],
      
      // Enable scroll restoration
      scrollRestoration: true,
      
      // Optimize images
      optimizeCss: true,
      
      // Optimize for modern browsers
      browsersListForSwc: true,
      
      // Reduce client-side JavaScript
      modularizeImports: {
        '@heroicons/react/24/outline': {
          transform: '@heroicons/react/24/outline/{{member}}',
        },
        '@heroicons/react/24/solid': {
          transform: '@heroicons/react/24/solid/{{member}}',
        },
        'lodash': {
          transform: 'lodash/{{member}}',
        },
      },
    },
    
    // Production optimizations
    ...(isProd && {
      compiler: {
        // Remove console.log in production
        removeConsole: {
          exclude: ['error', 'warn'],
        },
      },
      
      // Enable gzip compression
      compress: true,
      
      // Optimize build output
      poweredByHeader: false,
      generateEtags: true,
      
      // Cache optimization
      onDemandEntries: {
        maxInactiveAge: 60 * 60 * 1000, // 1 hour
        pagesBufferLength: 5,
      },
    }),
  };

  // Apply bundle analyzer wrapper for production builds
  return withBundleAnalyzer(nextConfig);
};
