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

// ---- /api/market : catalogo COMPLETO da base (todos os clubes + jogadores)
// Usado pelo Mercado do jogo: lista todos os clubes (com preferencia de liga
// no front) e todos os jogadores reais de qualquer pais. Cache em memoria
// (dados estaticos da base) para nao reconsultar a cada request.
let _marketCache = null;
async function getMarket() {
  if (_marketCache) return _marketCache;
  const lg = await pool().query(
    `SELECT id, name, country, confederation, LEAST(level,2) AS division FROM leagues`
  );
  const leagueById = {};
  for (const l of lg.rows) leagueById[String(l.id)] = l;

  const cl = await pool().query(`SELECT id, name, league_id FROM clubs`);
  const pl = await pool().query(
    `SELECT player_id, short_name, long_name, positions, main_position,
            overall, potential, age, nationality, club_id
     FROM players`
  );
  const byClub = groupPlayers(pl.rows);

  const clubs = [];
  const players = [];
  for (const cr of cl.rows) {
    const lgRow = leagueById[String(cr.league_id)] || {};
    const raw = byClub[cr.id] || [];
    const mc = mapper.mapClub(cr, raw, {
      division: lgRow.division || 1,
      region: lgRow.country || '',
      country: lgRow.country || '',
      leagueId: cr.league_id,
      continental: false,
    });
    const club = mc.club;
    club.leagueName = lgRow.name || '';
    club.country = lgRow.country || '';
    club.confederation = lgRow.confederation || '';
    clubs.push(club);

    // Perfil de mercado por jogador (inclui player_id real = pid estavel).
    let prof = raw.map((r) => {
      const ovr = Math.round(Number(r.overall) || 60);
      const age = Math.round(Number(r.age) || 25);
      const value = mapper.playerValue(ovr, age);
      return {
        pid: Number(r.player_id),
        name: String(r.short_name || r.long_name || 'Jogador').trim(),
        pos: mapper.mapPosition(r.positions || r.main_position),
        ovr: ovr,
        age: age,
        value: value,
        salary: mapper.playerSalary(value),
        pot: Math.round(Number(r.potential) || ovr),
        nationality: String(r.nationality || '').trim(),
        clubId: Number(cr.id),
        clubName: club.name,
        clubShort: club.short,
        leagueId: String(cr.league_id),
        country: club.country,
        division: club.division,
      };
    });
    prof.sort((a, b) => b.ovr - a.ovr);
    prof = prof.slice(0, 30); // espelha o teto de elenco do motor
    for (const p of prof) players.push(p);
  }

  clubs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  _marketCache = { clubs, players };
  return _marketCache;
}

module.exports = { getRegions, getWorld, getMarket };
