-- Quiz Results Storage Schema for Supabase
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- =====================================================
-- FUCKULATOR QUIZ TABLES
-- =====================================================

-- Quiz session summaries
CREATE TABLE fuckulator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_count INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    score_percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual responses per term
CREATE TABLE fuckulator_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES fuckulator_sessions(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_fuckulator_responses_session ON fuckulator_responses(session_id);
CREATE INDEX idx_fuckulator_responses_term ON fuckulator_responses(term);
CREATE INDEX idx_fuckulator_sessions_score ON fuckulator_sessions(score_percentage);

-- =====================================================
-- JUDGMENT QUIZ TABLES
-- =====================================================

-- Quiz session tracking
CREATE TABLE judgment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Responses per scenario
CREATE TABLE judgment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES judgment_sessions(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    appropriate INTEGER NOT NULL CHECK (appropriate BETWEEN 1 AND 5),
    professional INTEGER NOT NULL CHECK (professional BETWEEN 1 AND 5),
    trust INTEGER NOT NULL CHECK (trust BETWEEN 1 AND 5),
    discipline INTEGER NOT NULL CHECK (discipline BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_judgment_responses_session ON judgment_responses(session_id);
CREATE INDEX idx_judgment_responses_scenario ON judgment_responses(scenario_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE fuckulator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuckulator_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgment_responses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for quiz submissions)
CREATE POLICY "Allow anonymous inserts on fuckulator_sessions"
ON fuckulator_sessions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on fuckulator_responses"
ON fuckulator_responses FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on judgment_sessions"
ON judgment_sessions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on judgment_responses"
ON judgment_responses FOR INSERT
TO anon
WITH CHECK (true);

-- Allow reads for aggregation (via service role only)
CREATE POLICY "Allow service role reads on fuckulator_sessions"
ON fuckulator_sessions FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Allow service role reads on fuckulator_responses"
ON fuckulator_responses FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Allow service role reads on judgment_sessions"
ON judgment_sessions FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Allow service role reads on judgment_responses"
ON judgment_responses FOR SELECT
TO service_role
USING (true);
