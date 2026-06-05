// db.js - cliente Postgres (Neon/Supabase/qualquer Postgres)
'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL n\u00e3o configurada. Veja server/README.md.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /sslmode=require|neon\.tech|supabase|render\.com/.test(DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
  max: 8,
  idleTimeoutMillis: 30000,
});
pool.on('error', (e) => console.error('[pg pool]', e));

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[db] schema verificado');
}

// ----- users -----
async function findUserByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE email=$1', [String(email).toLowerCase()]);
  return r.rows[0] || null;
}
async function findUserById(id) {
  const r = await pool.query('SELECT id, email, name, created_at FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}
async function createUser({ email, name, pwdHash, pwdSalt }) {
  const r = await pool.query(
    'INSERT INTO users (email, name, pwd_hash, pwd_salt) VALUES ($1,$2,$3,$4) RETURNING id, email, name',
    [String(email).toLowerCase(), name, pwdHash, pwdSalt]
  );
  return r.rows[0];
}

// ----- games -----
async function getGame(code) {
  const r = await pool.query('SELECT * FROM games WHERE code=$1', [String(code).toUpperCase()]);
  return r.rows[0] || null;
}
async function createGame({ code, hostUserId, hostName, mode, state }) {
  const members = JSON.stringify([{ user_id: Number(hostUserId), name: hostName, role: 'host' }]);
  const r = await pool.query(
    `INSERT INTO games (code, host_user_id, host_name, mode, state_json, members_json)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
    [String(code).toUpperCase(), hostUserId, hostName, mode || 'party', state || null, members]
  );
  return r.rows[0];
}
async function updateGameState(code, state) {
  await pool.query(
    'UPDATE games SET state_json=$1, updated_at=NOW() WHERE code=$2',
    [state, String(code).toUpperCase()]
  );
}
async function addMember(code, userId, name) {
  // adiciona se ainda n\u00e3o estiver em members_json
  await pool.query(
    `UPDATE games
        SET members_json = CASE
          WHEN NOT (members_json @> $2::jsonb)
          THEN members_json || $3::jsonb
          ELSE members_json
        END,
        updated_at = NOW()
      WHERE code = $1`,
    [
      String(code).toUpperCase(),
      JSON.stringify([{ user_id: Number(userId) }]),
      JSON.stringify([{ user_id: Number(userId), name: String(name), role: 'guest' }]),
    ]
  );
}
async function listGamesForUser(userId) {
  const r = await pool.query(
    `SELECT code, host_user_id, host_name, mode, members_json,
            state_json->>'round' AS round,
            state_json->>'year'  AS year,
            updated_at
       FROM games
      WHERE host_user_id = $1
         OR members_json @> $2::jsonb
      ORDER BY updated_at DESC
      LIMIT 50`,
    [userId, JSON.stringify([{ user_id: Number(userId) }])]
  );
  return r.rows;
}
async function getGameLite(code, userId) {
  const r = await pool.query(
    `SELECT code, host_user_id, host_name, mode, members_json, state_json, updated_at
       FROM games
      WHERE code = $1
        AND (host_user_id = $2 OR members_json @> $3::jsonb)`,
    [String(code).toUpperCase(), userId, JSON.stringify([{ user_id: Number(userId) }])]
  );
  return r.rows[0] || null;
}
async function deleteGame(code, userId) {
  const r = await pool.query(
    'DELETE FROM games WHERE code=$1 AND host_user_id=$2 RETURNING id',
    [String(code).toUpperCase(), userId]
  );
  return r.rowCount > 0;
}

module.exports = {
  init, pool,
  findUserByEmail, findUserById, createUser,
  getGame, createGame, updateGameState, addMember,
  listGamesForUser, getGameLite, deleteGame,
};
