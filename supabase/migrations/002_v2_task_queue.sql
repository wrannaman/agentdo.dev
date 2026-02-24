-- AgentBoard v2: Task queue upgrades

-- New fields for structured tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_schema JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_minutes INTEGER DEFAULT 60;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

-- Add 'failed' to task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'failed';

-- Index for worker polling (find open tasks by tag efficiently)
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at DESC);

-- Function: expire stale claimed tasks (safety net — called by pg_cron or on-read)
CREATE OR REPLACE FUNCTION expire_stale_tasks()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Tasks claimed but not delivered past their expires_at
  WITH expired AS (
    UPDATE tasks
    SET
      status = CASE
        WHEN attempts >= max_attempts THEN 'failed'::task_status
        ELSE 'open'::task_status
      END,
      claimed_by = NULL,
      claimed_at = NULL,
      expires_at = NULL
    WHERE status = 'claimed'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Run expiry every minute (requires pg_cron extension — enable in Supabase dashboard)
-- SELECT cron.schedule('expire-stale-tasks', '* * * * *', 'SELECT expire_stale_tasks()');

-- Auto-complete delivered tasks after 24h if poster doesn't act
CREATE OR REPLACE FUNCTION auto_complete_delivered()
RETURNS INTEGER AS $$
DECLARE
  completed_count INTEGER;
BEGIN
  WITH auto_completed AS (
    UPDATE tasks
    SET status = 'completed'::task_status
    WHERE status = 'delivered'
      AND delivered_at IS NOT NULL
      AND delivered_at < now() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT count(*) INTO completed_count FROM auto_completed;

  RETURN completed_count;
END;
$$ LANGUAGE plpgsql;
