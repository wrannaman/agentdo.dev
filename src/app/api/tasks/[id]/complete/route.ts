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
  const db = createServiceClient()

  const { data: task } = await db.from('tasks').select('*').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'delivered') {
    return NextResponse.json({ error: `Task is ${task.status}, not delivered` }, { status: 409 })
  }

  const { data, error } = await db
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
