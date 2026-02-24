import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { checkAndExpireTask } from '@/lib/expiry'

/**
 * GET /api/tasks/:id/result — Poster endpoint.
 *
 * Long polls until the task reaches 'delivered', 'completed', or 'failed'.
 * This is how the posting agent waits for results without a webhook.
 *
 * Query params:
 *   timeout — max seconds to wait (default 8, max 25)
 *
 * Returns:
 *   { status: "delivered", result: {...}, result_url: "..." } — results are in
 *   { status: "completed", result: {...} } — already completed
 *   { status: "open", retry: true } — not yet claimed, keep waiting
 *   { status: "claimed", retry: true } — claimed but not delivered yet, keep waiting
 *   { status: "failed", retry: false } — task failed (max attempts exceeded)
 *   { status: "expired", retry: false } — task expired
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 120)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const timeout = Math.min(parseInt(searchParams.get('timeout') || '8'), 25)

  const db = createServiceClient()
  const startTime = Date.now()
  const pollIntervalMs = 2000
  const deadlineMs = startTime + timeout * 1000

  while (Date.now() < deadlineMs) {
    const { data: task } = await db.from('tasks').select('*').eq('id', id).single()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check for lazy expiry
    const expired = await checkAndExpireTask(task)
    const current = expired || task

    // Terminal states — return immediately
    if (['delivered', 'completed'].includes(current.status)) {
      return NextResponse.json({
        status: current.status,
        result: current.result,
        result_url: current.result_url,
        task: current,
        retry: false,
      })
    }

    if (['failed', 'expired', 'disputed'].includes(current.status)) {
      return NextResponse.json({
        status: current.status,
        task: current,
        retry: false,
      })
    }

    // Still pending — check if we should keep waiting
    if (Date.now() + pollIntervalMs >= deadlineMs) break

    await sleep(pollIntervalMs)
  }

  // Timed out waiting — tell the agent to reconnect
  const { data: latest } = await db.from('tasks').select('status').eq('id', id).single()
  return NextResponse.json({
    status: latest?.status || 'unknown',
    retry: true,
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
