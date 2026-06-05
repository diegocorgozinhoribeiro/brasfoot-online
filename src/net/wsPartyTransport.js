// ==========================================================================
// net/wsPartyTransport.js  -  Multiplayer real via WebSocket relay
// --------------------------------------------------------------------------
// Implementacao do Transport baseada em um servidor WebSocket que apenas
// retransmite mensagens entre os membros de uma sala (party code). O HOST
// continua sendo a autoridade do estado; o servidor nao executa logica.
//
// Mesma interface de PartyTransport. Opts esperados:
//   { code, name, host: bool, serverUrl: 'wss://meu-relay.com' }
//
// Protocolo (cliente <-> servidor):
//   c -> s : {t:'hello', code, name, role}
//   c -> s : {t:'action', action}     (guest -> host)
//   c -> s : {t:'claim',  clubId, name} (guest -> host)
//   c -> s : {t:'state',  S, members} (host -> guests, via servidor)
//   s -> c : {t:'welcome', as, members, code}
//   s -> c : {t:'presence', members}
//   s -> c : {t:'join', name}         (host: novo guest)
//   s -> c : {t:'leave', name}        (host: guest saiu)
//   s -> c : {t:'host-left'}          (guest: host caiu)
//   s -> c : {t:'error', msg}
// ==========================================================================
window.BF = window.BF || {};
BF.net = BF.net || {};

BF.net.WsPartyTransport = function (opts) {
  this.code = opts.code;
  this.name = opts.name;
  this.role = opts.host ? 'host' : 'guest';
  this.serverUrl = opts.serverUrl;
  this.handlers = {};
  this.members = opts.host ? [{ name: opts.name, host: true }] : [];
  this.ws = null;
  this._queue = [];
  this._opened = false;
  this._closedByUser = false;
  this._reconnectTimer = null;
  this._reconnectDelay = 1500;
};

BF.net.WsPartyTransport.prototype.on = function (ev, cb) {
  this.handlers[ev] = cb; return this;
};
BF.net.WsPartyTransport.prototype._emit = function (ev, data) {
  const h = this.handlers[ev]; if (h) try { h(data); } catch (e) { console.error(e); }
};
BF.net.WsPartyTransport.prototype._send = function (m) {
  if (this._opened && this.ws && this.ws.readyState === 1) {
    try { this.ws.send(JSON.stringify(m)); return; } catch (e) {}
  }
  // ainda nao conectou: enfileira (descarta mensagens muito grandes em fila
  // para evitar estouro de memoria se a conexao demorar)
  if (this._queue.length < 16) this._queue.push(m);
};

BF.net.WsPartyTransport.prototype._normalizeUrl = function (url) {
  url = String(url || '').trim();
  if (!url) return '';
  // ja vem com protocolo
  if (/^wss?:\/\//i.test(url)) return url;
  // se o usuario digitou http(s)://, converte
  if (/^https?:\/\//i.test(url)) return url.replace(/^http/i, 'ws');
  // so o host (ex.: meu-relay.onrender.com) -> infere ws/wss pelo protocolo da pagina
  const proto = (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss://' : 'ws://';
  return proto + url.replace(/^\/+/, '');
};

BF.net.WsPartyTransport.prototype.start = function () {
  const self = this;
  this._closedByUser = false;
  const url = this._normalizeUrl(this.serverUrl);
  if (!url) { this._emit('error', 'URL do servidor n\u00e3o informada.'); return; }
  if (typeof WebSocket === 'undefined') { this._emit('error', 'Este navegador n\u00e3o suporta WebSocket.'); return; }
  try { this.ws = new WebSocket(url); }
  catch (e) { this._emit('error', 'Falha ao conectar: ' + (e && e.message || e)); return; }

  this.ws.onopen = function () {
    self._opened = true;
    self._reconnectDelay = 1500;
    self._send({ t: 'hello', code: self.code, name: self.name, role: self.role });
    // libera mensagens enfileiradas (na pratica, host pode ter chamado
    // broadcastState antes de o socket abrir; reenviamos agora)
    const q = self._queue.slice(); self._queue.length = 0;
    q.forEach(function (m) { self._send(m); });
  };
  this.ws.onmessage = function (e) {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (!m || typeof m.t !== 'string') return;
    self._onMsg(m);
  };
  this.ws.onerror = function () {
    // erros pontuais; deixamos onclose tratar a reconexao
  };
  this.ws.onclose = function (ev) {
    self._opened = false;
    if (self._closedByUser) return;
    self._emit('presence', self.members); // forca UI a re-renderizar com state local
    // tenta reconectar com backoff suave (max 15s)
    if (self._reconnectTimer) return;
    self._reconnectTimer = setTimeout(function () {
      self._reconnectTimer = null;
      self._reconnectDelay = Math.min(15000, Math.round(self._reconnectDelay * 1.6));
      self.start();
    }, self._reconnectDelay);
    // mostra aviso amigavel apos primeira queda
    if (ev && (ev.code === 1006 || ev.code === 1011)) {
      self._emit('error', 'Conex\u00e3o perdida. Tentando reconectar...');
    }
  };
};

BF.net.WsPartyTransport.prototype._onMsg = function (m) {
  if (m.t === 'error') { this._emit('error', m.msg || 'Erro do servidor'); return; }
  if (m.t === 'welcome') {
    this.members = m.members || [];
    this._emit('ready');
    this._emit('presence', this.members);
    // se for host reconectando, reenvia o estado para todos
    if (this.role === 'host') this._emit('requestSync');
    return;
  }
  if (m.t === 'presence') {
    this.members = m.members || [];
    this._emit('presence', this.members);
    return;
  }
  if (this.role === 'host') {
    if (m.t === 'join') {
      this._emit('requestSync'); // host envia broadcastState para todos
    } else if (m.t === 'action') {
      this._emit('action', m.action);
    } else if (m.t === 'claim') {
      this._emit('action', { type: 'CLAIM_CLUB', clubId: m.clubId, name: m.name });
    } else if (m.t === 'leave') {
      // membros ja atualizado via presence
    }
  } else { // guest
    if (m.t === 'state') {
      this.members = m.members || this.members;
      this._emit('presence', this.members);
      this._emit('state', m.S);
    } else if (m.t === 'host-left') {
      this._emit('error', 'O anfitri\u00e3o saiu da sala. Aguardando reconex\u00e3o...');
    }
  }
};

BF.net.WsPartyTransport.prototype.broadcastState = function (S) {
  this._send({ t: 'state', S: S, members: this.members });
};
BF.net.WsPartyTransport.prototype.sendAction = function (action) {
  this._send({ t: 'action', action: action });
};
BF.net.WsPartyTransport.prototype.claimClub = function (clubId, name) {
  if (this.role === 'host') this._emit('action', { type: 'CLAIM_CLUB', clubId: clubId, name: name });
  else this._send({ t: 'claim', clubId: clubId, name: name });
};
BF.net.WsPartyTransport.prototype.close = function () {
  this._closedByUser = true;
  if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
  if (this.ws) { try { this.ws.close(); } catch (e) {} }
};
