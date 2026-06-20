import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Only takes effect on actual HTTPS connections — harmless to ship over local http dev.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // No 'unsafe-eval' in production — verified the production build and runtime
      // (incl. client hydration, Stripe.js, and Supabase realtime) work without it.
      // React's dev mode (Fast Refresh, dev-time stack traces) does call eval() and
      // React's own docs say it never does in production, so this is dev-only.
      `script-src 'self' 'unsafe-inline' https://js.stripe.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // api.openai.com/Anthropic intentionally absent: every AI call happens server-side
      // in API routes, never from the browser, so the browser has no reason to connect
      // to either provider directly.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // pdf-parse pulls in pdfjs-dist, which loads a worker chunk at runtime — Next's bundler
  // can't resolve that chunk path. Opting it out of bundling lets it use native Node require.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
}

export default nextConfig
