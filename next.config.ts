import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

// Content Security Policy
// Adjust sources as you add third-party services.
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + Next.js inline scripts (nonce-based CSP is ideal but requires middleware changes)
  `script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'"}`,
  // Styles: self + inline (Tailwind requires inline)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs (for base64 image previews)
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  // Fonts: self
  "font-src 'self'",
  // API calls: self + Supabase realtime
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} wss://*.supabase.co`,
  // Camera for photo upload on mobile
  "media-src 'self'",
  // No frames
  "frame-ancestors 'none'",
  "frame-src 'none'",
  // No object embeds
  "object-src 'none'",
  // Base URI locked to self
  "base-uri 'self'",
  // Form posts only to self
  "form-action 'self'",
]

const cspHeader = cspDirectives.join('; ')

const securityHeaders = [
  // Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deny framing (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // HSTS — only activate in prod (browsers cache this aggressively)
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features not used by the app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // CSP
  { key: 'Content-Security-Policy', value: cspHeader },
  // DNS prefetch control
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
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
}

export default nextConfig
