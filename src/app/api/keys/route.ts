import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 5, 3600000)) { // 5 keys per hour
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { email } = body as { email?: string }

  const key = 'ab_' + randomBytes(24).toString('hex')

  const db = createServiceClient()
  const { data, error } = await db
    .from('api_keys')
    .insert({ key, email: email || null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ key: data.key, id: data.id }, { status: 201 })
}
