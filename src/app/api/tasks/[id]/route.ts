import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { checkAndExpireTask } from '@/lib/expiry'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = rateLimit(`read:${ip}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
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

  // Lazy expiry check
  const expired = await checkAndExpireTask(data)
  if (expired) {
    return NextResponse.json(expired)
  }

  return NextResponse.json(data)
}
