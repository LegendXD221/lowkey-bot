ALTER TABLE api_providers
  ADD COLUMN IF NOT EXISTS url_patterns JSONB DEFAULT '[]'::jsonb;
