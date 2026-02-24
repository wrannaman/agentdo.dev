-- AgentBoard schema

-- Task status enum
CREATE TYPE task_status AS ENUM ('open', 'claimed', 'delivered', 'completed', 'disputed', 'expired');

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  budget_cents INTEGER DEFAULT 0,
  posted_by TEXT,
  callback_url TEXT,
  tags TEXT[] DEFAULT '{}',
  requires_human BOOLEAN DEFAULT false,
  status task_status DEFAULT 'open',
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  result JSONB,
  result_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- API keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_requires_human ON tasks(requires_human);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_api_keys_key ON api_keys(key);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Anyone can read tasks
CREATE POLICY "Tasks are publicly readable" ON tasks
  FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access api_keys" ON api_keys
  FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
