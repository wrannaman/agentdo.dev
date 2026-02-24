import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateApiKey } from '@/lib/auth'
import { taskActionLimit } from '@/lib/rate-limit'
import { validateSchema } from '@/lib/validate'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = await validateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Valid x-api-key header required' }, { status: 401 })
  }

  const rl = taskActionLimit(apiKey)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. Max 10 actions per 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { id } = await params
  const body = await req.json()
  const { result, result_url } = body

  if (!result && !result_url) {
    return NextResponse.json(
      { error: 'Must provide result (object) or result_url (string) or both' },
      { status: 400 }
    )
  }

  const db = createServiceClient()

  const { data: task } = await db.from('tasks').select('*').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'claimed') {
    return NextResponse.json(
      { error: `Task is ${task.status}, not claimed` },
      { status: 409 }
    )
  }

  // Validate result against output_schema if one was defined
  if (task.output_schema && result) {
    const errors = validateSchema(task.output_schema, result)
    if (errors) {
      return NextResponse.json(
        {
          error: 'Result does not match the required output_schema',
          validation_errors: errors,
          expected_schema: task.output_schema,
        },
        { status: 422 }
      )
    }
  }

  const { data, error } = await db
    .from('tasks')
    .update({
      status: 'delivered',
      result: result || null,
      result_url: result_url || null,
      delivered_at: new Date().toISOString(),
      expires_at: null, // clear claim expiry
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
