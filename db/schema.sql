-- ChatAzad schema (Postgres)
-- The app also auto-creates these tables with CREATE TABLE IF NOT EXISTS
-- on first use, so running this file manually is optional but recommended.

CREATE TABLE IF NOT EXISTS triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     TEXT NOT NULL,
  match_type  TEXT NOT NULL CHECK (match_type IN ('exact', 'contains', 'starts_with')),
  channel     TEXT NOT NULL CHECK (channel IN ('instagram_dm', 'instagram_comment', 'facebook_message', 'facebook_comment', 'any')),
  reply_text  TEXT NOT NULL,
  action      TEXT NOT NULL DEFAULT 'send_text' CHECK (action IN ('send_text', 'private_reply')),
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,          -- 'webhook' | 'trigger_matched' | 'flow_executed' |
                                     -- 'message_sent' | 'broadcast' | 'error'
  channel     TEXT NOT NULL,          -- 'instagram_dm' | 'instagram_comment' |
                                     -- 'facebook_message' | 'facebook_comment' | 'system'
  summary     TEXT NOT NULL,
  payload     JSONB,                  -- reserved for future use (raw Meta payload snapshots)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);

-- Visual automation flows (nodes/edges stored as JSON)
CREATE TABLE IF NOT EXISTS flows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  nodes       JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per unique sender (platform-scoped). Used for broadcasts and stats.
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  sender_id     TEXT NOT NULL,
  name          TEXT,
  channel       TEXT NOT NULL,        -- last channel seen on
  message_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, sender_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_last_seen ON contacts (last_seen_at DESC);

-- Simple key/value settings (e.g. retention_limit, webhook_url_override)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registered ChatAzad users (v2 email/password auth, bcrypt hashes)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
