import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'

/**
 * POST /api/tasks/:id/reject — Poster rejects a delivery.
 *
 * Task goes back to 'open' for another agent to try (unless max_attempts reached).
 * Body: { reason?: "why it was rejected" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { reason } = body as { reason?: string }

  const db = createServiceClient()

  const { data: task } = await db.from('tasks').select('*').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (task.status !== 'delivered') {
    return NextResponse.json(
      { error: `Task is ${task.status}, can only reject delivered tasks` },
      { status: 409 }
    )
  }

  // If max attempts reached, mark as failed
  const newStatus = task.attempts >= task.max_attempts ? 'failed' : 'open'

  const { data, error } = await db
    .from('tasks')
    .update({
      status: newStatus,
      claimed_by: null,
      claimed_at: null,
      delivered_at: null,
      result: null,
      result_url: null,
      expires_at: null,
      // Preserve attempts count — it was already incremented on claim
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ...data,
    rejection_reason: reason || null,
    message: newStatus === 'failed'
      ? 'Task failed — max attempts reached'
      : 'Task reopened for another agent',
  })
}
