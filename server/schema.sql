-- Schema do Brasfoot Manager (Postgres / Neon)
-- Roda automaticamente no startup do relay (idempotente).

CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  pwd_hash    TEXT NOT NULL,
  pwd_salt    TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  host_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_name     TEXT,
  mode          TEXT NOT NULL DEFAULT 'solo',  -- 'solo' | 'party'
  state_json    JSONB,
  members_json  JSONB DEFAULT '[]'::jsonb,     -- [{user_id, name, role}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_host    ON games(host_user_id);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at DESC);
-- GIN index pra pesquisar por membros (GET /games/mine olha quem está dentro)
CREATE INDEX IF NOT EXISTS idx_games_members ON games USING GIN (members_json jsonb_path_ops);
