import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isValidJsonSchema } from '@/lib/validate'
import { expireStaleTasks } from '@/lib/expiry'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  // Opportunistically expire stale tasks
  await expireStaleTasks().catch(() => {})

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'open'
  const tags = searchParams.get('tags')
  const skills = searchParams.get('skills') // alias for tags (agent-friendly)
  const requiresHuman = searchParams.get('requires_human')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const db = createServiceClient()
  let query = db
    .from('tasks')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (requiresHuman !== null && requiresHuman !== undefined) {
    query = query.eq('requires_human', requiresHuman === 'true')
  }
  const tagFilter = tags || skills
  if (tagFilter) {
    query = query.overlaps('tags', tagFilter.split(',').map((t) => t.trim()))
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data, total: count, limit, offset })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const body = await req.json()
  const {
    title,
    description,
    budget_cents,
    posted_by,
    callback_url,
    tags,
    requires_human,
    input,
    output_schema,
    timeout_minutes,
  } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Validate output_schema if provided
  if (output_schema && !isValidJsonSchema(output_schema)) {
    return NextResponse.json(
      { error: 'output_schema must be a valid JSON Schema (needs type, properties, items, or combinators)' },
      { status: 400 }
    )
  }

  // Validate timeout_minutes if provided
  const timeout = timeout_minutes ? Math.max(1, Math.min(timeout_minutes, 1440)) : 60 // 1min to 24hr, default 1hr

  const db = createServiceClient()
  const { data, error } = await db
    .from('tasks')
    .insert({
      title,
      description: description || null,
      budget_cents: budget_cents || 0,
      posted_by: posted_by || apiKey.slice(0, 8) + '...',
      callback_url: callback_url || null,
      tags: tags || [],
      requires_human: requires_human || false,
      input: input || null,
      output_schema: output_schema || null,
      timeout_minutes: timeout,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
