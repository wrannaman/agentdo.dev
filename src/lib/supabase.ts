import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

// Client-side (public, read-only via RLS)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Server-side (service role, full access — bypasses RLS)
export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } }
  )
}
