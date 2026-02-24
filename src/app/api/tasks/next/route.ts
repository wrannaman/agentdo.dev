import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { expireStaleTasks } from '@/lib/expiry'

/**
 * GET /api/tasks/next — Worker endpoint.
 *
 * Finds the next available task matching the worker's skills.
 * Polls internally (up to timeout) so the agent doesn't have to spin.
 *
 * Query params:
 *   skills — comma-separated tags to match (optional, returns any open task if omitted)
 *   requires_human — filter by requires_human (optional)
 *   timeout — max seconds to wait (default 8, max 25 for Vercel compat)
 *
 * Returns:
 *   { task: {...} } if found
 *   { task: null, retry: true } if nothing found within timeout — agent should reconnect immediately
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 120)) { // higher limit for polling workers
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const skills = searchParams.get('skills')
  const requiresHuman = searchParams.get('requires_human')
  const timeout = Math.min(parseInt(searchParams.get('timeout') || '8'), 25)

  // Expire stale tasks first
  await expireStaleTasks().catch(() => {})

  const startTime = Date.now()
  const pollIntervalMs = 2000 // check every 2s
  const deadlineMs = startTime + timeout * 1000

  while (Date.now() < deadlineMs) {
    const task = await findMatchingTask(skills, requiresHuman)
    if (task) {
      return NextResponse.json({ task, retry: false })
    }

    // If we'd exceed the deadline on next sleep, bail now
    if (Date.now() + pollIntervalMs >= deadlineMs) break

    await sleep(pollIntervalMs)
  }

  return NextResponse.json({ task: null, retry: true })
}

async function findMatchingTask(
  skills: string | null,
  requiresHuman: string | null
) {
  const db = createServiceClient()
  let query = db
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true }) // FIFO — oldest first
    .limit(1)

  if (skills) {
    query = query.overlaps('tags', skills.split(',').map((s) => s.trim()))
  }
  if (requiresHuman !== null && requiresHuman !== undefined) {
    query = query.eq('requires_human', requiresHuman === 'true')
  }

  const { data } = await query
  return data && data.length > 0 ? data[0] : null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
