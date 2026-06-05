// ==========================================================================
// Brasfoot Manager - WebSocket Relay Server
// --------------------------------------------------------------------------
// Servidor leve (Node.js + ws) que apenas RETRANSMITE mensagens entre os
// membros de uma sala (party code). O HOST continua sendo a autoridade do
// estado do jogo - o servidor nao executa nenhuma logica de partida.
//
// Roda em qualquer host Node.js: Render, Railway, Fly.io, Glitch, Replit,
// VPS proprio, etc. Veja server/README.md para o passo-a-passo.
//
// Variaveis de ambiente opcionais:
//   PORT          porta TCP (default 8080)
//   MAX_ROOMS     limite de salas simultaneas (default 500)
//   MAX_MEMBERS   limite de membros por sala (default 8)
//   PING_MS       intervalo de keep-alive em ms (default 25000)
// ==========================================================================
'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '500', 10);
const MAX_MEMBERS = parseInt(process.env.MAX_MEMBERS || '8', 10);
const PING_MS = parseInt(process.env.PING_MS || '25000', 10);

// Pequeno HTTP server tambem responde GET / com status, util para health
// checks dos hosts (Render/Railway esperam um 200 OK na porta).
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'brasfoot-relay',
      rooms: rooms.size,
      uptimeSec: Math.round(process.uptime()),
    }));
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, perMessageDeflate: false });

/** rooms: code -> { host: ws|null, guests: Map<name, ws>, lastSeen: ms } */
const rooms = new Map();

function send(ws, m) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(m)); } catch (_) {}
}

function membersOf(room) {
  const list = [];
  if (room.host) list.push({ name: room.host._name, host: true });
  for (const g of room.guests.values()) list.push({ name: g._name, host: false });
  return list;
}

function broadcast(room, m, except) {
  if (room.host && room.host !== except) send(room.host, m);
  for (const g of room.guests.values()) if (g !== except) send(g, m);
}

function emitPresence(room) {
  broadcast(room, { t: 'presence', members: membersOf(room) });
}

function roomSize(room) {
  return (room.host ? 1 : 0) + room.guests.size;
}

function cleanupClient(ws) {
  if (!ws._code) return;
  const room = rooms.get(ws._code);
  if (!room) return;
  if (ws._role === 'host' && room.host === ws) {
    room.host = null;
    // notifica guests que o host caiu
    broadcast(room, { t: 'host-left' });
  } else if (ws._role === 'guest') {
    if (room.guests.get(ws._name) === ws) room.guests.delete(ws._name);
    if (room.host) send(room.host, { t: 'leave', name: ws._name });
  }
  if (!room.host && room.guests.size === 0) rooms.delete(ws._code);
  else emitPresence(room);
}

wss.on('connection', (ws, req) => {
  ws._code = null; ws._name = null; ws._role = null; ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello') {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
      const name = String(m.name || 'Jogador').slice(0, 24);
      const role = m.role === 'host' ? 'host' : 'guest';
      if (!code) { send(ws, { t: 'error', msg: 'C\u00f3digo inv\u00e1lido' }); return ws.close(); }

      let room = rooms.get(code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) { send(ws, { t: 'error', msg: 'Servidor cheio. Tente mais tarde.' }); return ws.close(); }
        room = { host: null, guests: new Map() };
        rooms.set(code, room);
      }

      if (role === 'host') {
        if (room.host && room.host !== ws && room.host.readyState === room.host.OPEN) {
          send(ws, { t: 'error', msg: 'J\u00e1 existe um anfitri\u00e3o nesta sala. Pe\u00e7a o c\u00f3digo certo ou entre como convidado.' });
          return ws.close();
        }
        ws._code = code; ws._name = name; ws._role = 'host';
        room.host = ws;
      } else {
        if (roomSize(room) >= MAX_MEMBERS) { send(ws, { t: 'error', msg: 'Sala cheia (' + MAX_MEMBERS + ' jogadores).' }); return ws.close(); }
        // reconexao: substitui conexao antiga do mesmo nome
        const prev = room.guests.get(name);
        if (prev && prev !== ws) { try { prev.close(); } catch (_) {} }
        ws._code = code; ws._name = name; ws._role = 'guest';
        room.guests.set(name, ws);
      }

      send(ws, { t: 'welcome', as: ws._role, members: membersOf(room), code: code });
      emitPresence(room);
      if (ws._role === 'guest' && room.host) send(room.host, { t: 'join', name: name });
      return;
    }

    // qualquer outra mensagem exige hello previo
    if (!ws._code) return;
    const room = rooms.get(ws._code); if (!room) return;

    // Guest -> Host
    if (ws._role === 'guest') {
      if (m.t === 'action' || m.t === 'claim') {
        if (room.host) send(room.host, m);
      }
      return;
    }

    // Host -> guests (ou todos)
    if (ws._role === 'host') {
      if (m.t === 'state') {
        // host envia estado completo para todos
        broadcast(room, m, ws);
      } else {
        broadcast(room, m, ws);
      }
      return;
    }
  });

  ws.on('close', () => cleanupClient(ws));
  ws.on('error', () => { try { ws.terminate(); } catch (_) {} });
});

// Keep-alive: derruba conexoes mortas para liberar slots
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._alive === false) {
      cleanupClient(ws);
      try { ws.terminate(); } catch (_) {}
      return;
    }
    ws._alive = false;
    try { ws.ping(); } catch (_) {}
  });
}, PING_MS);

server.listen(PORT, () => {
  console.log('Brasfoot relay listening on :' + PORT + '  (max ' + MAX_ROOMS + ' rooms, ' + MAX_MEMBERS + '/room)');
});
