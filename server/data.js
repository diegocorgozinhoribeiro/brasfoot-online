// ==========================================================================
// server/data.js  -  Camada de leitura dos DADOS REAIS no Postgres.
// Expoe a API consumida pelo front (relay.js): /api/regions e /api/world.
// Usa o mesmo pool de conexao do db.js. Converte as linhas para o shape do
// MOTOR usando server/mapper.js (regra de economia derivada do overall).
// ==========================================================================
'use strict';
const db = require('./db');
const mapper = require('./mapper');

// Quantos clubes da confederacao entram como adversarios continentais +
// alvos de mercado (lazy pool). Limita o tamanho do mundo/salvamento.
const CONTINENTAL_POOL = 48;

function pool() {
  if (!db.pool) throw Object.assign(new Error('Banco de dados nao configurado (DATABASE_URL ausente).'), { status: 503 });
  return db.pool;
}

function groupPlayers(rows) {
  const by = {};
  for (const r of rows) {
    const cid = r.club_id;
    (by[cid] = by[cid] || []).push(r);
  }
  return by;
}

// ---- /api/regions : lista de paises jogaveis (uma regiao = um pais) ------
async function getRegions() {
  const { rows } = await pool().query(
    `SELECT l.country AS country,
            MIN(l.confederation) AS confederation,
            COUNT(DISTINCT c.id) AS club_count,
            json_agg(DISTINCT jsonb_build_object(
              'id', l.id::text, 'name', l.name, 'level', LEAST(l.level, 2)
            )) AS leagues
     FROM leagues l
     LEFT JOIN clubs c ON c.league_id = l.id
     WHERE l.level <= 2
     GROUP BY l.country
     ORDER BY club_count DESC, l.country ASC`
  );
  return rows.map((r) => ({
    id: r.country,
    name: r.country,
    confederation: r.confederation,
    clubCount: Number(r.club_count) || 0,
    leagues: (r.leagues || [])
      .map((lg) => ({ id: String(lg.id), name: lg.name, division: Math.min(2, lg.level || 1) }))
      .sort((a, b) => a.division - b.division),
  }));
}

async function clubsOfCountry(country) {
  const { rows } = await pool().query(
    `SELECT c.id, c.name, c.league_id, LEAST(l.level,2) AS division, l.confederation
     FROM clubs c JOIN leagues l ON l.id = c.league_id
     WHERE l.country = $1 AND l.level <= 2
     ORDER BY c.id`,
    [country]
  );
  return rows;
}

async function continentalClubs(confederation, country) {
  const { rows } = await pool().query(
    `SELECT c.id, c.name, c.league_id, l.country AS country, AVG(p.overall) AS avg_ovr
     FROM clubs c
     JOIN leagues l ON l.id = c.league_id
     JOIN players p ON p.club_id = c.id
     WHERE l.confederation = $1 AND l.country <> $2 AND l.level = 1
     GROUP BY c.id, c.name, c.league_id, l.country
     ORDER BY avg_ovr DESC NULLS LAST
     LIMIT $3`,
    [confederation, country, CONTINENTAL_POOL]
  );
  return rows;
}

async function playersForClubIds(ids) {
  if (!ids.length) return {};
  const { rows } = await pool().query(
    `SELECT player_id, short_name, long_name, positions, main_position,
            overall, potential, age, nationality, club_id
     FROM players WHERE club_id = ANY($1::bigint[])`,
    [ids]
  );
  return groupPlayers(rows);
}

// ---- /api/world?region=<pais> : pacote completo de uma regiao -----------
async function getWorld(country) {
  const regionClubs = await clubsOfCountry(country);
  if (!regionClubs.length) throw Object.assign(new Error('Regiao sem clubes: ' + country), { status: 404 });
  const confederation = regionClubs[0].confederation;
  const contClubs = await continentalClubs(confederation, country);

  const allIds = regionClubs.map((c) => Number(c.id)).concat(contClubs.map((c) => Number(c.id)));
  const playersBy = await playersForClubIds(allIds);

  const players = {}; // clubId -> [profile real]
  function buildClub(row, opts) {
    const raw = playersBy[row.id] || [];
    const mc = mapper.mapClub(row, raw, opts);
    players[mc.club.id] = mc.players;
    return mc.club;
  }

  const clubs = regionClubs.map((row) =>
    buildClub(row, { division: Math.min(2, row.division || 1), region: country, country, continental: false })
  );
  const continental = contClubs.map((row) =>
    buildClub(row, { division: 0, region: row.country, country: row.country, continental: true })
  );

  return {
    region: { id: country, name: country, confederation },
    clubs,
    continental,
    players,
  };
}

module.exports = { getRegions, getWorld };
