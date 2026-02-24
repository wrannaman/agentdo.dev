const hits = new Map<string, { count: number; resetAt: number }>()

/**
 * Generic rate limiter keyed by a string (IP, API key, etc).
 * Returns { allowed, retryAfterMs } so callers can set Retry-After header.
 */
export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }
  return { allowed: true, retryAfterMs: 0 }
}

// --- Preset limiters ---

/** 1 task per 10 minutes per API key */
export function taskCreateLimit(apiKey: string) {
  return rateLimit(`task:${apiKey}`, 1, 10 * 60_000)
}

/** 10 claims/deliveries per 10 minutes per API key */
export function taskActionLimit(apiKey: string) {
  return rateLimit(`action:${apiKey}`, 10, 10 * 60_000)
}

/** 1 API key per IP per 24 hours */
export function keyCreateLimit(ip: string) {
  return rateLimit(`keycreate:${ip}`, 1, 24 * 60 * 60_000)
}

/** General read limit: 120 req/min per IP */
export function readLimit(ip: string) {
  return rateLimit(`read:${ip}`, 120, 60_000)
}
