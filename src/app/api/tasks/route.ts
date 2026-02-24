import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { readLimit, taskCreateLimit } from '@/lib/rate-limit'
import { isValidJsonSchema } from '@/lib/validate'
import { expireStaleTasks } from '@/lib/expiry'
import { sanitizeTaskInput } from '@/lib/sanitize'

function rateLimitResponse(retryAfterMs: number, message?: string) {
  return NextResponse.json(
    { error: message || 'Rate limited. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
    }
  )
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = readLimit(ip)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

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
  // Require API key for all writes
  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  // 1 task per 10 minutes per API key
  const rl = taskCreateLimit(apiKey)
  if (!rl.allowed) {
    return rateLimitResponse(rl.retryAfterMs, 'Task creation limited to 1 per 10 minutes.')
  }

  const body = await req.json()

  // Sanitize all input
  const { clean, error: sanitizeError } = sanitizeTaskInput(body)
  if (sanitizeError) {
    return NextResponse.json({ error: sanitizeError }, { status: 400 })
  }

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

  // Validate output_schema if provided
  if (output_schema && !isValidJsonSchema(output_schema)) {
    return NextResponse.json(
      { error: 'output_schema must be a valid JSON Schema (needs type, properties, items, or combinators)' },
      { status: 400 }
    )
  }

  // Validate timeout_minutes if provided
  const timeout = timeout_minutes ? Math.max(1, Math.min(timeout_minutes, 1440)) : 60

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
