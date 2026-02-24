import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
