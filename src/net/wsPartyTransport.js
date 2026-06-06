// wsPartyTransport.js - cliente WebSocket para multiplayer online
// Implementa a mesma interface de PartyTransport: { role, on, start, broadcastState, sendAction, claimClub, close }
// Opcoes: { code, name, host:bool, mode:'solo'|'party', serverUrl, token, initialState }
(function () {
  window.BF = window.BF || {};
  BF.net = BF.net || {};

  function WsPartyTransport(opts) {
    this.role = opts.host ? 'host' : 'guest';
    this.code = String(opts.code || '').toUpperCase();
    this.name = String(opts.name || 'Jogador');
    this.mode = opts.mode === 'solo' ? 'solo' : 'party';
    this.serverUrl = this._normalizeUrl(opts.serverUrl || '');
    this.token = opts.token || (BF.api && BF.api.getToken && BF.api.getToken()) || '';
    this.initialState = opts.initialState || null;
    this._listeners = {};
    this._ws = null;
    this._queue = [];
    this._closed = false;
    this._fatal = false;
    this._reconnectDelay = 1500;
    this._members = [];
  }

  WsPartyTransport.prototype._normalizeUrl = function (u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^wss?:\/\//.test(u)) return u;
    if (/^https:\/\//.test(u))  return 'wss://' + u.slice(8);
    if (/^http:\/\//.test(u))   return 'ws://'  + u.slice(7);
    const proto = (location.protocol === 'https:') ? 'wss://' : 'ws://';
    return proto + u;
  };

  WsPartyTransport.prototype.on = function (ev, fn) {
    (this._listeners[ev] = this._listeners[ev] || []).push(fn);
  };
  WsPartyTransport.prototype._emit = function (ev) {
    const args = [].slice.call(arguments, 1);
    (this._listeners[ev] || []).forEach((fn) => { try { fn.apply(null, args); } catch (e) { console.error(e); } });
  };

  WsPartyTransport.prototype.start = function () {
    this._connect();
  };

  WsPartyTransport.prototype._connect = function () {
    if (this._closed) return;
    if (!this.serverUrl) {
      this._emit('error', { msg: 'Servidor relay n\u00e3o configurado.', fatal: true });
      return;
    }
    let ws;
    try { ws = new WebSocket(this.serverUrl); }
    catch (e) { this._scheduleReconnect(); return; }
    this._ws = ws;
    const self = this;

    ws.onopen = function () {
      self._reconnectDelay = 1500;
      const hello = {
        t: 'hello',
        token: self.token,
        code: self.code,
        role: self.role,
        mode: self.mode,
      };
      if (self.role === 'host' && self.initialState) hello.state = self.initialState;
      self._send(hello);
      // drena fila acumulada antes do open
      while (self._queue.length) self._send(self._queue.shift());
      self._emit('status', 'connected');
    };

    ws.onmessage = function (ev) {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || !m.t) return;
      switch (m.t) {
        case 'welcome':
          self._members = m.members || [];
          self._emit('welcome', m);
          self._emit('members', self._members);
          if (m.state && self.role === 'host') self._emit('state', m.state); // host retomando jogo salvo
          break;
        case 'presence':
          self._members = m.members || [];
          self._emit('members', self._members);
          break;
        case 'join':
          self._emit('peer-join', m);
          break;
        case 'leave':
          self._emit('peer-leave', m);
          break;
        case 'state':
          self._emit('state', m.S);
          break;
        case 'signal':
          // v10.6: sinal generico (ex: countdown da rodada).
          self._emit('signal', m.d || {});
          break;
        case 'action':
          self._emit('action', m.action);
          break;
        case 'claim':
          // chega no host quando um guest reivindica clube
          self._emit('action', { type: 'CLAIM_CLUB', clubId: m.clubId, name: m.name });
          break;
        case 'host-left':
          self._emit('error', { msg: 'O anfitri\u00e3o desconectou. Tentando reconectar...', fatal: false });
          break;
        case 'error':
          self._emit('error', { msg: m.msg || 'Erro do servidor', fatal: !!m.fatal });
          if (m.fatal) self._fatal = true;
          break;
      }
    };

    ws.onclose = function () {
      self._ws = null;
      self._emit('status', 'disconnected');
      if (!self._closed && !self._fatal) self._scheduleReconnect();
      else if (self._fatal) self._emit('fatal');
    };
    ws.onerror = function () { /* tratado em onclose */ };
  };

  WsPartyTransport.prototype._scheduleReconnect = function () {
    const self = this;
    const d = this._reconnectDelay;
    setTimeout(function () { self._connect(); }, d);
    this._reconnectDelay = Math.min(15000, Math.round(d * 1.6));
  };

  WsPartyTransport.prototype._send = function (m) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      if (this._queue.length < 32) this._queue.push(m);
      return;
    }
    try { this._ws.send(JSON.stringify(m)); } catch (e) {}
  };

  WsPartyTransport.prototype.requestSave = function () {
    // pede ao servidor para gravar JA o estado atual no Postgres (ignora debounce)
    this._send({ t: 'save' });
  };

  // v10.6: envia um sinal generico para TODOS os peers (incluindo eco para o host).
  // Usado para countdown da rodada, etc.
  WsPartyTransport.prototype.broadcastSignal = function (data) {
    if (this.role !== 'host') return;
    this._send({ t: 'signal', d: data || {} });
  };

  WsPartyTransport.prototype.broadcastState = function (S) {
    if (this.role !== 'host') return;
    this._send({ t: 'state', S: S });
  };
  WsPartyTransport.prototype.sendAction = function (action) {
    if (this.role !== 'guest') return;
    this._send({ t: 'action', action: action });
  };
  WsPartyTransport.prototype.claimClub = function (clubId, name) {
    if (this.role === 'host') {
      // host reivindica localmente
      this._emit('action', { type: 'CLAIM_CLUB', clubId: clubId, name: name });
      return;
    }
    this._send({ t: 'claim', clubId: clubId, name: name });
  };
  WsPartyTransport.prototype.close = function () {
    this._closed = true;
    if (this._ws) try { this._ws.close(); } catch (e) {}
  };

  BF.net.WsPartyTransport = WsPartyTransport;
})();
