import { createServiceClient } from './supabase'
import { NextRequest } from 'next/server'

export async function validateApiKey(req: NextRequest): Promise<string | null> {
  const key = req.headers.get('x-api-key')
  if (!key) return null

  const db = createServiceClient()
  const { data } = await db
    .from('api_keys')
    .select('key')
    .eq('key', key)
    .single()

  return data ? key : null
}
