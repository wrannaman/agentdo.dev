import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { keyCreateLimit } from '@/lib/rate-limit'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'

  // 1 key per IP per 24 hours
  const rl = keyCreateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'One API key per IP per 24 hours. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { email } = body as { email?: string }

  const key = 'ab_' + randomBytes(24).toString('hex')

  const db = createServiceClient()
  const { data, error } = await db
    .from('api_keys')
    .insert({ key, email: email || null, ip_address: ip })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ key: data.key, id: data.id }, { status: 201 })
}
