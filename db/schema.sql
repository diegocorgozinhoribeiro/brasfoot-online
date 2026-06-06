-- ==========================================================================
-- db/schema.sql  -  Tabelas dos DADOS REAIS (idempotente).
-- Roda na MESMA base Neon do servidor (separado de server/schema.sql, que
-- cuida de users/games). Execute com:  psql "$DATABASE_URL" -f db/schema.sql
-- ==========================================================================

CREATE TABLE IF NOT EXISTS confederations (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leagues (
  id               BIGINT PRIMARY KEY,
  name             TEXT NOT NULL,
  country          TEXT NOT NULL,
  confederation    TEXT REFERENCES confederations(code),
  level            INTEGER NOT NULL DEFAULT 1,
  most_titled      TEXT,
  current_champion TEXT
);
CREATE INDEX IF NOT EXISTS idx_leagues_country ON leagues(country);
CREATE INDEX IF NOT EXISTS idx_leagues_confed  ON leagues(confederation);
CREATE INDEX IF NOT EXISTS idx_leagues_level   ON leagues(level);

CREATE TABLE IF NOT EXISTS clubs (
  id        BIGINT PRIMARY KEY,
  name      TEXT NOT NULL,
  league_id BIGINT REFERENCES leagues(id)
);
CREATE INDEX IF NOT EXISTS idx_clubs_league ON clubs(league_id);

CREATE TABLE IF NOT EXISTS players (
  player_id     BIGINT PRIMARY KEY,
  short_name    TEXT,
  long_name     TEXT,
  positions     TEXT,
  main_position TEXT,
  overall       INTEGER,
  potential     INTEGER,
  value_eur     BIGINT,
  wage_eur      BIGINT,
  age           INTEGER,
  dob           TEXT,
  height_cm     INTEGER,
  weight_kg     INTEGER,
  league_id     BIGINT REFERENCES leagues(id),
  club_id       BIGINT REFERENCES clubs(id),
  nationality   TEXT,
  preferred_foot TEXT,
  weak_foot     INTEGER,
  skill_moves   INTEGER,
  intl_reputation INTEGER,
  pace          INTEGER,
  shooting      INTEGER,
  passing       INTEGER,
  dribbling     INTEGER,
  defending     INTEGER,
  physic        INTEGER,
  face_url      TEXT
);
CREATE INDEX IF NOT EXISTS idx_players_club    ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_players_league  ON players(league_id);
CREATE INDEX IF NOT EXISTS idx_players_overall ON players(overall);
