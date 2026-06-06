// relay.js - Brasfoot Manager relay v2
// HTTP (auth + games CRUD) + WebSocket (multiplayer com persistencia + lobby gate)
'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./db');
const auth = require('./auth');

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '500', 10);
const MAX_MEMBERS = parseInt(process.env.MAX_MEMBERS || '8', 10);
const PING_MS = parseInt(process.env.PING_MS || '25000', 10);
const STATE_SAVE_DEBOUNCE_MS = parseInt(process.env.STATE_SAVE_MS || '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ============================== HTTP helpers ==============================
function send(res, status, body, extra) {
  const headers = {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    ...(extra || {}),
  };
  if (body == null) {
    res.writeHead(status, headers);
    return res.end();
  }
  if (typeof body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'text/plain; charset=utf-8';
    res.writeHead(status, headers);
    return res.end(body);
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2_000_000) { req.destroy(); return reject(new Error('Body too large')); }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON inv\u00e1lido')); }
    });
    req.on('error', reject);
  });
}

function getToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return null;
}
function requireAuth(req, res) {
  const tok = getToken(req);
  const payload = auth.verify(tok);
  if (!payload) { send(res, 401, { error: 'N\u00e3o autenticado' }); return null; }
  return payload;
}

function validEmail(s)    { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200; }
function validPassword(s) { return typeof s === 'string' && s.length >= 6 && s.length <= 200; }
function validName(s)     { return typeof s === 'string' && s.trim().length >= 2 && s.trim().length <= 40; }
function sanitizeCode(s)  { return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16); }

// ============================== Rotas ==============================
const routes = [];
function route(method, pattern, handler) { routes.push({ method, pattern, handler }); }

route('GET', /^\/health$/, (req, res) => send(res, 200, {
  ok: true, service: 'brasfoot-relay', rooms: rooms.size, uptimeSec: Math.round(process.uptime()),
}));
route('GET', /^\/$/, (req, res) => send(res, 200, {
  ok: true, service: 'brasfoot-relay', rooms: rooms.size, uptimeSec: Math.round(process.uptime()),
}));

// --- AUTH ---
route('POST', /^\/auth\/register$/, async (req, res) => {
  let body;
  try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  const email = String(body.email || '').trim().toLowerCase();
  const name  = String(body.name  || '').trim();
  const pwd   = String(body.password || '');
  if (!validEmail(email))   return send(res, 400, { error: 'E-mail inv\u00e1lido' });
  if (!validName(name))     return send(res, 400, { error: 'Nome deve ter entre 2 e 40 caracteres' });
  if (!validPassword(pwd))  return send(res, 400, { error: 'Senha deve ter no m\u00ednimo 6 caracteres' });
  if (await db.findUserByEmail(email)) return send(res, 409, { error: 'J\u00e1 existe conta com esse e-mail' });
  const { hash, salt } = auth.hashPassword(pwd);
  const user = await db.createUser({ email, name, pwdHash: hash, pwdSalt: salt });
  const token = auth.sign({ uid: user.id, name: user.name });
  send(res, 200, { token, user: { id: user.id, email: user.email, name: user.name } });
});

route('POST', /^\/auth\/login$/, async (req, res) => {
  let body;
  try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  const email = String(body.email || '').trim().toLowerCase();
  const pwd   = String(body.password || '');
  const user  = await db.findUserByEmail(email);
  if (!user || !auth.verifyPassword(pwd, user.pwd_hash, user.pwd_salt)) {
    return send(res, 401, { error: 'E-mail ou senha incorretos' });
  }
  const token = auth.sign({ uid: user.id, name: user.name });
  send(res, 200, { token, user: { id: user.id, email: user.email, name: user.name } });
});

route('GET', /^\/auth\/me$/, async (req, res) => {
  const p = requireAuth(req, res); if (!p) return;
  const user = await db.findUserById(p.uid);
  if (!user) return send(res, 401, { error: 'Usu\u00e1rio n\u00e3o existe mais' });
  send(res, 200, { user });
});

// --- GAMES ---
route('GET', /^\/games\/mine$/, async (req, res) => {
  const p = requireAuth(req, res); if (!p) return;
  const rows = await db.listGamesForUser(p.uid);
  const out = rows.map((g) => ({
    code: g.code,
    host: { id: Number(g.host_user_id), name: g.host_name },
    mode: g.mode || 'party',
    myRole: Number(g.host_user_id) === Number(p.uid) ? 'host' : 'guest',
    members: g.members_json || [],
    round: g.round ? parseInt(g.round, 10) : null,
    year:  g.year  ? parseInt(g.year,  10) : null,
    updatedAt: g.updated_at,
    isOnline: rooms.has(g.code) && !!rooms.get(g.code).host,
  }));
  send(res, 200, { games: out });
});

route('DELETE', /^\/games\/([A-Z0-9-]+)$/, async (req, res, match) => {
  const p = requireAuth(req, res); if (!p) return;
  const code = sanitizeCode(match[1]);
  const ok = await db.deleteGame(code, p.uid);
  if (!ok) return send(res, 404, { error: 'Jogo n\u00e3o encontrado ou voc\u00ea n\u00e3o \u00e9 o anfitri\u00e3o' });
  const room = rooms.get(code);
  if (room) {
    if (room.host) try { room.host.close(1000, 'deleted'); } catch (_) {}
    for (const g of room.guests.values()) try { g.close(1000, 'deleted'); } catch (_) {}
    rooms.delete(code);
  }
  send(res, 200, { ok: true });
});

// ============================== HTTP dispatch ==============================
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);
  const url = (req.url || '/').split('?')[0];
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.match(r.pattern);
    if (m) {
      try { await r.handler(req, res, m); }
      catch (e) {
        console.error('[handler]', req.method, url, e);
        if (!res.headersSent) send(res, 500, { error: 'Erro interno' });
      }
      return;
    }
  }
  send(res, 404, { error: 'Rota n\u00e3o encontrada' });
});

// ============================== WebSocket ==============================
const wss = new WebSocketServer({ server, perMessageDeflate: false, maxPayload: 4_000_000 });

// rooms: code -> { host: ws|null, guests: Map<uid, ws>, hostUid, lastState, saveTimer }
const rooms = new Map();

function jsend(ws, m) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(m)); } catch (_) {}
}
function broadcast(room, m, except) {
  if (room.host && room.host !== except) jsend(room.host, m);
  for (const g of room.guests.values()) if (g !== except) jsend(g, m);
}
function membersOf(room) {
  const list = [];
  if (room.host) list.push({ userId: room.host._uid, name: room.host._name, host: true });
  for (const g of room.guests.values()) list.push({ userId: g._uid, name: g._name, host: false });
  return list;
}
function emitPresence(room) { broadcast(room, { t: 'presence', members: membersOf(room) }); }

// v10.6: auto-save DESLIGADO. Save acontece SOMENTE quando o cliente envia
// {t:'save'} (botao Salvar no topo). Isso alivia o Postgres durante partidas
// longas com varias acoes seguidas. O state ainda eh broadcastado em tempo
// real para os peers (eles tem a versao mais recente em memoria); so o disco
// que so persiste sob comando.
function scheduleSave(room, code) {
  // no-op. Mantido para retrocompat.
}
async function flushSave(room, code) {
  if (room.saveTimer) { clearTimeout(room.saveTimer); room.saveTimer = null; }
  if (!room.lastState) return;
  try { await db.updateGameState(code, room.lastState); }
  catch (e) { console.error('[flush save]', code, e.message); }
}

async function cleanupClient(ws) {
  if (!ws._code) return;
  const code = ws._code;
  const room = rooms.get(code);
  if (!room) return;
  if (ws._role === 'host' && room.host === ws) {
    room.host = null;
    await flushSave(room, code);
    // avisa e desconecta guests (eles reconectam quando o host voltar)
    for (const g of room.guests.values()) {
      jsend(g, { t: 'host-left' });
      try { g.close(1000, 'host-left'); } catch (_) {}
    }
    room.guests.clear();
    rooms.delete(code);
  } else if (ws._role === 'guest') {
    if (room.guests.get(ws._uid) === ws) room.guests.delete(ws._uid);
    if (room.host) jsend(room.host, { t: 'leave', userId: ws._uid, name: ws._name });
    emitPresence(room);
  }
}

wss.on('connection', (ws) => {
  ws._uid = null; ws._name = null; ws._code = null; ws._role = null; ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });
  ws.on('error', () => { try { ws.terminate(); } catch (_) {} });
  ws.on('close', () => { cleanupClient(ws).catch((e) => console.error('[cleanup]', e)); });

  ws.on('message', async (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;

    // === HELLO (autenticacao e join) ===
    if (m.t === 'hello') {
      const payload = auth.verify(m.token);
      if (!payload) { jsend(ws, { t: 'error', msg: 'Sess\u00e3o inv\u00e1lida. Fa\u00e7a login novamente.', fatal: true }); return ws.close(1000, 'invalid-token'); }
      const code = sanitizeCode(m.code);
      const role = m.role === 'host' ? 'host' : 'guest';
      const mode = m.mode === 'solo' ? 'solo' : 'party';
      if (!code) { jsend(ws, { t: 'error', msg: 'C\u00f3digo inv\u00e1lido' }); return ws.close(); }

      ws._uid = Number(payload.uid);
      ws._name = String(payload.name || 'Jogador').slice(0, 24);

      let game;
      try { game = await db.getGame(code); }
      catch (e) { console.error('[getGame]', e); jsend(ws, { t: 'error', msg: 'Erro ao consultar o banco' }); return ws.close(); }

      if (role === 'host') {
        if (game && Number(game.host_user_id) !== ws._uid) {
          jsend(ws, { t: 'error', msg: 'Este c\u00f3digo j\u00e1 pertence a outro anfitri\u00e3o.', fatal: true });
          return ws.close();
        }
        if (!game) {
          if (!m.state) { jsend(ws, { t: 'error', msg: 'Estado inicial necess\u00e1rio para criar a sala.', fatal: true }); return ws.close(); }
          try { game = await db.createGame({ code, hostUserId: ws._uid, hostName: ws._name, mode, state: m.state }); }
          catch (e) { console.error('[createGame]', e); jsend(ws, { t: 'error', msg: 'Erro ao criar o jogo.', fatal: true }); return ws.close(); }
        }
        if (rooms.size >= MAX_ROOMS && !rooms.has(code)) {
          jsend(ws, { t: 'error', msg: 'Servidor cheio. Tente mais tarde.', fatal: true }); return ws.close();
        }
        let room = rooms.get(code);
        if (room && room.host && room.host !== ws && room.host.readyState === room.host.OPEN) {
          // anfitriao ja conectado em outra aba: substitui (kicka o antigo)
          try { room.host.close(1000, 'replaced'); } catch (_) {}
        }
        if (!room) { room = { host: null, guests: new Map(), hostUid: ws._uid, lastState: null, saveTimer: null }; rooms.set(code, room); }
        room.host = ws; room.hostUid = ws._uid; room.lastState = game.state_json;
        ws._code = code; ws._role = 'host';
        jsend(ws, { t: 'welcome', as: 'host', code, mode: game.mode, state: game.state_json, members: membersOf(room) });
        emitPresence(room);
        return;
      }

      // === GUEST ===
      if (!game) { jsend(ws, { t: 'error', msg: 'Sala n\u00e3o encontrada. Verifique o c\u00f3digo.', fatal: true }); return ws.close(); }
      if (game.mode === 'solo') { jsend(ws, { t: 'error', msg: 'Esse jogo \u00e9 individual e n\u00e3o aceita convidados.', fatal: true }); return ws.close(); }
      const room = rooms.get(code);
      if (!room || !room.host) {
        jsend(ws, { t: 'error', msg: 'O anfitri\u00e3o est\u00e1 offline. Pe\u00e7a para ele entrar primeiro.', fatal: true });
        return ws.close();
      }
      if (room.guests.size + 1 >= MAX_MEMBERS) { jsend(ws, { t: 'error', msg: 'Sala cheia.', fatal: true }); return ws.close(); }

      // registra o usu\u00e1rio como membro (idempotente)
      try { await db.addMember(code, ws._uid, ws._name); } catch (e) { console.error('[addMember]', e); }

      // se este uid j\u00e1 estiver conectado em outra aba, desconecta a antiga
      const prev = room.guests.get(ws._uid);
      if (prev && prev !== ws) { try { prev.close(1000, 'replaced'); } catch (_) {} }

      room.guests.set(ws._uid, ws);
      ws._code = code; ws._role = 'guest';
      jsend(ws, { t: 'welcome', as: 'guest', code, mode: 'party', members: membersOf(room) });
      // pede ao host pra mandar o state mais recente pra este guest
      jsend(room.host, { t: 'join', userId: ws._uid, name: ws._name });
      emitPresence(room);
      return;
    }

    // mensagens p\u00f3s-hello
    if (!ws._code) return;
    const room = rooms.get(ws._code); if (!room) return;

    if (ws._role === 'guest') {
      if (m.t === 'action' || m.t === 'claim') {
        if (room.host) jsend(room.host, m);
      }
      return;
    }

    if (ws._role === 'host') {
      if (m.t === 'state') {
        if (m.S) {
          // guarda em memoria (para o save sob demanda + para enviar a guests
          // que conectarem depois), mas NAO grava no Postgres.
          room.lastState = m.S;
        }
        broadcast(room, m, ws);
      } else if (m.t === 'signal') {
        // v10.7: broadcast de sinal generico (countdown, etc) para todos os
        // peers da sala INCLUINDO o host (broadcast sem 'except' ja inclui
        // o host). NAO duplica com jsend(ws, m), senao o host recebia o
        // signal 2x e abria 2 partidas.
        broadcast(room, m);
      } else if (m.t === 'save') {
        // forca gravar JA no Postgres (sem debounce) e confirma ao cliente
        try {
          await flushSave(room, ws._code);
          jsend(ws, { t: 'saved', ok: true, ts: Date.now() });
        } catch (e) {
          jsend(ws, { t: 'saved', ok: false, msg: e.message });
        }
      } else if (m.t === 'sync-request') {
        // host re-pediu sync (raro)
        return;
      } else {
        broadcast(room, m, ws);
      }
      return;
    }
  });
});

// keep-alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._alive === false) { try { ws.terminate(); } catch (_) {} return; }
    ws._alive = false;
    try { ws.ping(); } catch (_) {}
  });
}, PING_MS);

// graceful shutdown - salva tudo
async function shutdown(signal) {
  console.log('[shutdown]', signal, '- salvando estados...');
  for (const [code, room] of rooms.entries()) {
    await flushSave(room, code);
  }
  try { await db.pool.end(); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// boot
(async () => {
  await db.init();
  server.listen(PORT, () => {
    console.log('Brasfoot relay v2 listening on :' + PORT + '  (max ' + MAX_ROOMS + ' rooms, ' + MAX_MEMBERS + '/room, save debounce ' + STATE_SAVE_DEBOUNCE_MS + 'ms)');
  });
})().catch((e) => { console.error('[startup]', e); process.exit(1); });
