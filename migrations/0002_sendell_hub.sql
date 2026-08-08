-- Sendell hub durable sessions + messages (VPS / Docker Postgres)
-- Hub still uses in-memory for live link; these tables are the persistence layer
-- we wire next. Safe to apply early so deploys already have schema.

CREATE TABLE IF NOT EXISTS sendell_sessions (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT 'Remote',
  provider_id   TEXT NOT NULL DEFAULT 'grok-build',
  status        TEXT NOT NULL DEFAULT 'waiting_link',
  link_state    TEXT NOT NULL DEFAULT 'waiting',
  link_source   TEXT,
  host_label    TEXT,
  cwd           TEXT,
  model         TEXT,
  demo          BOOLEAN NOT NULL DEFAULT FALSE,
  pairing_code  TEXT,
  meta_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sendell_sessions_updated_idx
  ON sendell_sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS sendell_messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sendell_sessions (id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  content_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  streaming     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sendell_messages_session_idx
  ON sendell_messages (session_id, created_at);
