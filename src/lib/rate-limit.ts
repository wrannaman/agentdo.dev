const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++
  if (entry.count > limit) return false
  return true
}
