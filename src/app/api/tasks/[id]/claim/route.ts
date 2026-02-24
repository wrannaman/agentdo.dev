import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'

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
  const { agent_id, estimated_minutes } = body

  const db = createServiceClient()

  // Check task is open
  const { data: task } = await db.from('tasks').select('*').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'open') {
    return NextResponse.json({ error: `Task is ${task.status}, not open` }, { status: 409 })
  }

  const { data, error } = await db
    .from('tasks')
    .update({
      status: 'claimed',
      claimed_by: agent_id || apiKey.slice(0, 8) + '...',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'open') // optimistic lock
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to claim — may already be claimed' }, { status: 409 })
  }

  return NextResponse.json(data)
}
