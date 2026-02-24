import { createServiceClient } from './supabase'

/**
 * Lazy expiry: check if a task's claim has expired.
 * Called on read operations. If expired, resets to open (or failed if max attempts hit).
 * Returns the updated task if it was expired, null otherwise.
 */
export async function checkAndExpireTask(task: {
  id: string
  status: string
  expires_at: string | null
  attempts: number
  max_attempts: number
}) {
  if (task.status !== 'claimed' || !task.expires_at) return null
  if (new Date(task.expires_at) > new Date()) return null

  const db = createServiceClient()
  const newStatus = task.attempts >= task.max_attempts ? 'failed' : 'open'

  const { data } = await db
    .from('tasks')
    .update({
      status: newStatus,
      claimed_by: null,
      claimed_at: null,
      expires_at: null,
    })
    .eq('id', task.id)
    .eq('status', 'claimed') // optimistic lock
    .select()
    .single()

  return data
}

/**
 * Batch expire stale tasks. Called opportunistically on list queries.
 */
export async function expireStaleTasks() {
  const db = createServiceClient()
  await db.rpc('expire_stale_tasks')
}
