// ==========================================================================
// net/partyTransport.js  -  Multiplayer por party (host-autoritativo)
// --------------------------------------------------------------------------
// Implementacao via BroadcastChannel: funciona entre varias abas/janelas do
// mesmo navegador e, quando servido por http (ver README), entre dispositivos
// na mesma origem. O HOST mantem o estado oficial; os GUESTS enviam acoes e
// recebem o estado completo de volta. Trocar para um servidor WebSocket real
// e so criar outro transport com a mesma interface (ver README).
//
// Protocolo de mensagens:
//   guest -> host : {t:'join', name}
//                   {t:'action', action}
//                   {t:'claim', clubId, name}
//   host  -> todos: {t:'state', S, members}
// ==========================================================================
window.BF = window.BF || {};
BF.net = BF.net || {};

BF.net.PartyTransport = function (opts) {
  this.code = opts.code;
  this.name = opts.name;
  this.role = opts.host ? 'host' : 'guest';
  this.handlers = {};
  this.members = opts.host ? [{ name: opts.name, host: true }] : [];
  this.ch = null;
};

BF.net.PartyTransport.prototype.on = function (ev, cb) { this.handlers[ev] = cb; return this; };
BF.net.PartyTransport.prototype._emit = function (ev, data) { if (this.handlers[ev]) this.handlers[ev](data); };
BF.net.PartyTransport.prototype._post = function (m) { if (this.ch) this.ch.postMessage(m); };

BF.net.PartyTransport.prototype.start = function () {
  const self = this;
  if (typeof BroadcastChannel === 'undefined') {
    this._emit('error', 'Este navegador nao suporta party. Rode via servidor local (veja README).');
    return;
  }
  this.ch = new BroadcastChannel('bf_' + this.code);
  this.ch.onmessage = function (e) { self._onMsg(e.data); };
  if (this.role === 'guest') this._post({ t: 'join', name: this.name });
  this._emit('ready');
  this._emit('presence', this.members);
};

BF.net.PartyTransport.prototype._onMsg = function (m) {
  if (this.role === 'host') {
    if (m.t === 'join') {
      if (!this.members.find(function (x) { return x.name === m.name; })) this.members.push({ name: m.name, host: false });
      this._emit('presence', this.members);
      this._emit('requestSync'); // host reenvia o estado para o novo membro
    } else if (m.t === 'action') {
      this._emit('action', m.action);
    } else if (m.t === 'claim') {
      this._emit('action', { type: 'CLAIM_CLUB', clubId: m.clubId, name: m.name });
    }
  } else { // guest
    if (m.t === 'state') {
      this.members = m.members || this.members;
      this._emit('presence', this.members);
      this._emit('state', m.S);
    }
  }
};

BF.net.PartyTransport.prototype.broadcastState = function (S) { this._post({ t: 'state', S: S, members: this.members }); };
BF.net.PartyTransport.prototype.sendAction = function (action) { this._post({ t: 'action', action: action }); };
BF.net.PartyTransport.prototype.claimClub = function (clubId, name) {
  if (this.role === 'host') this._emit('action', { type: 'CLAIM_CLUB', clubId: clubId, name: name });
  else this._post({ t: 'claim', clubId: clubId, name: name });
};
BF.net.PartyTransport.prototype.close = function () { if (this.ch) this.ch.close(); };
