// ==========================================================================
// db/import.mjs  -  Cria as tabelas e popula com os seeds (Node + pg).
// Uso (Windows cmd):
//   set "DATABASE_URL=postgresql://...:5432/neondb?sslmode=require"
//   node db/import.mjs
// Le os CSVs de db/seed/ (gere-os antes com: python db/make_seeds.py).
// Idempotente: usa ON CONFLICT DO UPDATE.
// ==========================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, 'seed');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL antes de rodar. Ex (cmd): set "DATABASE_URL=postgresql://..."');
  process.exit(1);
}

const needsSsl = /sslmode=require|neon\.tech|render\.com|amazonaws\.com/.test(DATABASE_URL);
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, max: 4 });

// ---- mini parser CSV (aspas + virgulas) ---------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}
function readCsv(name) {
  const rows = parseCsv(fs.readFileSync(path.join(SEED, name), 'utf8'));
  const head = rows[0];
  return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => (o[h] = r[i])); return o; });
}
const n = (v) => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : null; };
const big = (v) => { const x = Math.round(parseFloat(v)); return Number.isFinite(x) ? x : null; };
const s = (v) => (v == null || v === '' ? null : String(v));

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('schema OK');

  const confeds = readCsv('confederations.csv');
  for (const c of confeds) await pool.query('INSERT INTO confederations(code,name) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name', [c.code, c.name]);
  console.log('confederations:', confeds.length);

  const leagues = readCsv('leagues.csv');
  for (const l of leagues) await pool.query(
    `INSERT INTO leagues(id,name,country,confederation,level,most_titled,current_champion)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,country=EXCLUDED.country,confederation=EXCLUDED.confederation,level=EXCLUDED.level,most_titled=EXCLUDED.most_titled,current_champion=EXCLUDED.current_champion`,
    [n(l.id), l.name, l.country, l.confederation, n(l.level) || 1, s(l.most_titled), s(l.current_champion)]
  );
  console.log('leagues:', leagues.length);

  const clubs = readCsv('clubs.csv');
  for (const c of clubs) await pool.query(
    'INSERT INTO clubs(id,name,league_id) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,league_id=EXCLUDED.league_id',
    [n(c.id), c.name, n(c.league_id)]
  );
  console.log('clubs:', clubs.length);

  const players = readCsv('players.csv');
  const cols = ['player_id','short_name','long_name','positions','main_position','overall','potential','value_eur','wage_eur','age','dob','height_cm','weight_kg','league_id','club_id','nationality','preferred_foot','weak_foot','skill_moves','intl_reputation','pace','shooting','passing','dribbling','defending','physic','face_url'];
  const BATCH = 500;
  for (let i = 0; i < players.length; i += BATCH) {
    const slice = players.slice(i, i + BATCH);
    const values = [];
    const tuples = slice.map((p, j) => {
      const base = j * cols.length;
      values.push(big(p.player_id), s(p.short_name), s(p.long_name), s(p.positions), s(p.main_position),
        n(p.overall), n(p.potential), big(p.value_eur), big(p.wage_eur), n(p.age), s(p.dob),
        n(p.height_cm), n(p.weight_kg), big(p.league_id), big(p.club_id), s(p.nationality),
        s(p.preferred_foot), n(p.weak_foot), n(p.skill_moves), n(p.intl_reputation),
        n(p.pace), n(p.shooting), n(p.passing), n(p.dribbling), n(p.defending), n(p.physic), s(p.face_url));
      return '(' + cols.map((_, k) => '$' + (base + k + 1)).join(',') + ')';
    });
    await pool.query(
      `INSERT INTO players(${cols.join(',')}) VALUES ${tuples.join(',')}
       ON CONFLICT(player_id) DO UPDATE SET overall=EXCLUDED.overall, club_id=EXCLUDED.club_id, league_id=EXCLUDED.league_id`,
      values
    );
    process.stdout.write(`players ${Math.min(i + BATCH, players.length)}/${players.length}\r`);
  }
  console.log('\nplayers:', players.length);
  console.log('IMPORT COMPLETO.');
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
