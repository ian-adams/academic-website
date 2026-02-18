-- Killing Cascade quiz tables
-- Run this in the Supabase SQL Editor to create the required tables

CREATE TABLE IF NOT EXISTS cascade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_correct INTEGER NOT NULL,
  total_cases INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cascade_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cascade_sessions(id) ON DELETE CASCADE,
  case_id INTEGER NOT NULL,
  user_guess TEXT NOT NULL CHECK (user_guess IN ('survived', 'died')),
  actual_outcome TEXT NOT NULL CHECK (actual_outcome IN ('survived', 'died')),
  predicted_p_fatal REAL NOT NULL,
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cascade_responses_session ON cascade_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_cascade_responses_case ON cascade_responses(case_id);

-- Enable RLS (matching existing quiz table patterns)
ALTER TABLE cascade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_responses ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (functions use service key)
CREATE POLICY "Service role access" ON cascade_sessions FOR ALL USING (true);
CREATE POLICY "Service role access" ON cascade_responses FOR ALL USING (true);
