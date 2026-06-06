// ==========================================================================
// db/sim-harness.mjs  -  Validacao OFFLINE do pipeline "so jogadores reais".
// --------------------------------------------------------------------------
// Sem internet/Postgres: le os seeds de db/seed/ direto, replica o getWorld
// do servidor usando server/mapper.js, injeta nos containers do front e roda
// uma temporada completa + virada de temporada para garantir que tudo
// funciona usando EXCLUSIVAMENTE dados reais.
//
// Uso:  node db/sim-harness.mjs [Pais]      (default: Brasil)
// ==========================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(__dirname, 'seed');
const mapper = require(path.join(ROOT, 'server', 'mapper.js'));

const REGION = process.argv[2] || 'Brasil';
const CONTINENTAL_POOL = 48;

function parseCsv(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
  const head = lines.shift().split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
}

function assert(cond, msg) { if (!cond) { throw new Error('ASSERT: ' + msg); } }

console.log('[harness] lendo seeds de', SEED);
const leagues = parseCsv(path.join(SEED, 'leagues.csv'));
const clubs = parseCsv(path.join(SEED, 'clubs.csv'));
const players = parseCsv(path.join(SEED, 'players.csv'));
console.log('[harness] ligas=%d clubes=%d jogadores=%d', leagues.length, clubs.length, players.length);

const clubsByLeague = new Map();
clubs.forEach((c) => {
  const k = String(c.league_id);
  if (!clubsByLeague.has(k)) clubsByLeague.set(k, []);
  clubsByLeague.get(k).push(c);
});
const playersByClub = new Map();
players.forEach((p) => {
  const k = String(p.club_id);
  if (!playersByClub.has(k)) playersByClub.set(k, []);
  playersByClub.get(k).push(p);
});

const lvl = (l) => parseInt(l.level, 10) || 9;

function buildWorld(country) {
  const regionLeagues = leagues
    .filter((l) => l.country === country && lvl(l) <= 2)
    .sort((a, b) => lvl(a) - lvl(b));
  assert(regionLeagues.length, 'regiao sem ligas jogaveis: ' + country);
  const confederation = regionLeagues[0].confederation;

  const regionClubs = [];
  const worldPlayers = {};
  regionLeagues.forEach((l) => {
    const division = Math.min(2, lvl(l));
    (clubsByLeague.get(String(l.id)) || []).forEach((c) => {
      const raw = playersByClub.get(String(c.id)) || [];
      const m = mapper.mapClub(c, raw, { country, leagueId: l.id, region: country, division, continental: false });
      regionClubs.push(m.club);
      worldPlayers[m.club.id] = m.players;
    });
  });

  const contLeagues = leagues.filter((l) => l.confederation === confederation && l.country !== country && lvl(l) === 1);
  const contCandidates = [];
  contLeagues.forEach((l) => {
    (clubsByLeague.get(String(l.id)) || []).forEach((c) => {
      const raw = playersByClub.get(String(c.id)) || [];
      if (!raw.length) return;
      const avg = raw.reduce((s, p) => s + (parseFloat(p.overall) || 0), 0) / raw.length;
      contCandidates.push({ club: c, league: l, avg });
    });
  });
  contCandidates.sort((a, b) => b.avg - a.avg);
  const continental = [];
  contCandidates.slice(0, CONTINENTAL_POOL).forEach((x) => {
    const raw = playersByClub.get(String(x.club.id)) || [];
    const m = mapper.mapClub(x.club, raw, { country: x.league.country, leagueId: x.league.id, region: x.league.country, division: 0, continental: true });
    continental.push(m.club);
    worldPlayers[m.club.id] = m.players;
  });

  const regionMeta = {
    id: country, name: country, confederation,
    clubCount: regionClubs.length,
    leagues: regionLeagues.map((l) => ({ id: String(l.id), name: l.name, division: Math.min(2, lvl(l)) })),
  };
  return { region: regionMeta, clubs: regionClubs, continental, players: worldPlayers };
}

const sandbox = {
  window: {}, console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  parseInt, parseFloat, isFinite, isNaN, setTimeout, clearTimeout,
};
sandbox.window.BF = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.BF = sandbox.window.BF;

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
  sandbox.BF = sandbox.window.BF;
}

[
  'src/data/clubs.js',
  'src/data/regions.js',
  'src/data/realPlayers.js',
  'src/core/rng.js',
  'src/core/players.js',
  'src/core/fixtures.js',
  'src/core/engine.js',
  'src/core/league.js',
  'src/core/cups.js',
  'src/core/transfers.js',
  'src/core/state.js',
  'src/core/presets.js',
].forEach(load);

const BF = sandbox.window.BF;
const D = BF.data, C = BF.core;
assert(C && C.buildWorld, 'core.buildWorld nao carregou');

const world = buildWorld(REGION);
D._regionClubs = world.clubs;
D._continentalClubs = world.continental;
D.REAL_PLAYERS_FULL = world.players;
D._worldRegionId = REGION;
D.REGIONS = [D.decorateRegion(world.region)];
console.log('[harness] regiao=%s confed=%s clubes_regiao=%d pool_continental=%d',
  REGION, world.region.confederation, world.clubs.length, world.continental.length);

let S = C.buildWorld('HARNESS-SEED', REGION);
console.log('[harness] buildWorld -> clubes=%d (esperado %d), jogadores=%d, totalRounds=%d',
  S.clubs.length, world.clubs.length, S.players.length, S.totalRounds);
assert(S.clubs.length > 0, 'nenhum clube no mundo');
assert(S.players.length > 0, 'nenhum jogador gerado');

let emptyClubs = 0, ovrSum = 0;
S.clubs.forEach((c) => {
  const sq = C.squad(S, c.id);
  if (!sq.length) emptyClubs++;
  ovrSum += c.strength;
});
console.log('[harness] XI medio forca=%d, clubes sem elenco=%d, total jogadores=%d',
  Math.round(ovrSum / S.clubs.length), emptyClubs, S.players.length);
assert(emptyClubs === 0, emptyClubs + ' clubes da regiao sem jogadores reais');

console.log('[harness] copas:', C.CUP_DEFS.libertadores.name, '/', C.CUP_DEFS.sulamericana.name, '/', C.CUP_DEFS.copaBrasil.name);

const strongest = S.clubs.slice().sort((a, b) => b.strength - a.strength)[0];
const sample = C.squad(S, strongest.id).slice(0, 3).map((p) => p.name + ' ' + p.pos + ' ovr' + p.ovr + ' R$' + p.value);
console.log('[harness] %s (forca %d, caixa %dmi):', strongest.name, strongest.strength, strongest.budget, sample.join(' | '));

let guard = 0;
while (S.round <= S.totalRounds && guard++ < 500) C.playRound(S);
assert(S.round > S.totalRounds, 'temporada nao terminou');
console.log('[harness] temporada 1 concluida em %d rodadas.', S.totalRounds);

C.nextSeason(S);
assert(S.season === 2, 'nextSeason nao avancou a temporada');
assert(S.players.length > 0, 'jogadores sumiram apos virada de temporada');
console.log('[harness] virada de temporada OK -> temporada %d, ano %d, jogadores=%d', S.season, S.year, S.players.length);

console.log('\n\u2705 HARNESS OK: pipeline 100%% jogadores reais valido (montagem + temporada + virada).');
