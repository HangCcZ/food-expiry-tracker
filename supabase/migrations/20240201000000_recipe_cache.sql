-- ============================================
-- RECIPE CACHE TABLE
-- ============================================
-- Caches AI-generated recipe suggestions keyed by
-- a deterministic hash of the ingredient set, so
-- identical ingredient combinations reuse the same
-- AI output within a 24-hour window.

CREATE TABLE recipe_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Deterministic signature of the sorted, lowercased ingredient set
  ingredient_hash TEXT NOT NULL,

  -- The raw ingredient list that was sent to the AI
  ingredients TEXT[] NOT NULL,

  -- The AI-generated recipes (stored as JSONB for structured access)
  -- Expected shape: [{ title: string, description: string, ingredients_used: string[] }]
  recipes JSONB NOT NULL,

  -- The raw prompt sent to OpenAI (for debugging/auditing)
  prompt_text TEXT,

  -- The model used
  model TEXT NOT NULL DEFAULT 'gpt-5-mini',

  -- Token usage metrics from the OpenAI response
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  -- Generation timing
  generation_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for fast cache lookups by hash
CREATE INDEX idx_recipe_cache_hash ON recipe_cache(ingredient_hash);

-- Index for cache expiry cleanup
CREATE INDEX idx_recipe_cache_expires ON recipe_cache(expires_at);

-- Enable RLS (Edge Function uses service role key which bypasses RLS,
-- but we enable it for defense-in-depth)
ALTER TABLE recipe_cache ENABLE ROW LEVEL SECURITY;
