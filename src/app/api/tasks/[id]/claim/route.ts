import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { checkAndExpireTask } from '@/lib/expiry'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { agent_id } = body

  const db = createServiceClient()

  // Get and check task
  const { data: task } = await db.from('tasks').select('*').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Lazy expiry — might flip it back to open
  await checkAndExpireTask(task)

  // Re-fetch after potential expiry
  const { data: current } = await db.from('tasks').select('*').eq('id', id).single()
  if (!current || current.status !== 'open') {
    return NextResponse.json(
      { error: `Task is ${current?.status || 'gone'}, not open` },
      { status: 409 }
    )
  }

  // Check max attempts
  if (current.attempts >= current.max_attempts) {
    await db.from('tasks').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json(
      { error: 'Task has exceeded max attempts' },
      { status: 410 }
    )
  }

  // Calculate expiry
  const timeoutMinutes = current.timeout_minutes || 60
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString()

  // Atomic claim with optimistic lock
  const { data, error } = await db
    .from('tasks')
    .update({
      status: 'claimed',
      claimed_by: agent_id || apiKey.slice(0, 8) + '...',
      claimed_at: new Date().toISOString(),
      expires_at: expiresAt,
      attempts: current.attempts + 1,
    })
    .eq('id', id)
    .eq('status', 'open') // optimistic lock — fails if someone else claimed first
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to claim — may already be claimed by another agent' },
      { status: 409 }
    )
  }

  return NextResponse.json(data)
}
