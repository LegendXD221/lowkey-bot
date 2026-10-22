CREATE TABLE IF NOT EXISTS bot_owners (
  user_id TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT 'The bot is currently under maintenance. Please try again later.',
  autobypass_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_timeout_ms INTEGER NOT NULL DEFAULT 10000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO bot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS api_providers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL CHECK (http_method IN ('GET', 'POST')),
  url_parameter TEXT,
  request_body_template TEXT,
  custom_headers JSONB DEFAULT '{}'::jsonb,
  authentication_type TEXT NOT NULL DEFAULT 'none'
    CHECK (authentication_type IN ('none', 'bearer', 'api_key_header', 'api_key_query')),
  secret_env_key TEXT,
  response_format TEXT NOT NULL DEFAULT 'json' CHECK (response_format IN ('json', 'text', 'url')),
  response_path TEXT,
  encoding_type TEXT NOT NULL DEFAULT 'none' CHECK (encoding_type IN ('none', 'url', 'base64', 'base64url')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_providers_enabled_priority ON api_providers (enabled, priority);
CREATE TABLE IF NOT EXISTS api_metrics (
  provider_id INTEGER PRIMARY KEY REFERENCES api_providers(id) ON DELETE CASCADE,
  total_requests BIGINT NOT NULL DEFAULT 0,
  successful_requests BIGINT NOT NULL DEFAULT 0,
  failed_requests BIGINT NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  average_latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_latency_ms INTEGER,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  circuit_state TEXT NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
  circuit_opened_at TIMESTAMPTZ,
  half_open_successes INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS autobypass_channels (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_autobypass_channels_lookup ON autobypass_channels (guild_id, channel_id);
CREATE TABLE IF NOT EXISTS bypass_cache (
  normalized_url_hash TEXT NOT NULL,
  provider_id INTEGER REFERENCES api_providers(id) ON DELETE CASCADE,
  result_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (normalized_url_hash, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_bypass_cache_expires ON bypass_cache (expires_at);
CREATE TABLE IF NOT EXISTS custom_emojis (
  emoji_key TEXT PRIMARY KEY,
  emoji_id TEXT NOT NULL,
  guild_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
