import { prisma } from '@/lib/db'

/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-process deployments. For multi-instance production,
 * replace with Redis (e.g. @upstash/ratelimit).
 */

const store = new Map<string, number[]>()

// Clean up old entries every 5 minutes to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000 // 15 min max window
  for (const [key, timestamps] of store.entries()) {
    const filtered = timestamps.filter((t) => t > cutoff)
    if (filtered.length === 0) {
      store.delete(key)
    } else {
      store.set(key, filtered)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if a key is within the rate limit.
 * @returns true if the request is allowed, false if rate limited
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart)

  if (timestamps.length >= limit) {
    store.set(key, timestamps)
    return false
  }

  timestamps.push(now)
  store.set(key, timestamps)
  return true
}

/**
 * Database-backed rate limiter for serverless environments.
 * Uses AIInteraction count as a proxy for AI rate limiting.
 * Safe for multi-instance Vercel deployments.
 */
export async function rateLimitDb(
  userId: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs)
  try {
    const count = await prisma.aIInteraction.count({
      where: {
        userId,
        createdAt: { gte: windowStart },
      },
    })
    return count < limit
  } catch {
    return true // fail open — don't block users if DB is unavailable
  }
}

/**
 * Get the client IP from a Request for use as a rate limit key.
 * Falls back to a fixed string if no IP is available.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Pre-configured limiters
export const LIMITS = {
  AI: { limit: 30, windowMs: 60_000 },          // 30 req/min
  SMS_SEND: { limit: 10, windowMs: 60_000 },     // 10 req/min
  CHAT_POST: { limit: 20, windowMs: 60_000 },    // 20 req/min
  LOGIN: { limit: 5, windowMs: 15 * 60_000 },    // 5 req/15 min
}
