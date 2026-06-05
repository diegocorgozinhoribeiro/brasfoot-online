// ==========================================================================
// net/localTransport.js  -  Modo individual (sem rede). Tudo roda local.
// ==========================================================================
window.BF = window.BF || {};
BF.net = BF.net || {};

BF.net.LocalTransport = function () { this.role = 'solo'; this.handlers = {}; };
BF.net.LocalTransport.prototype.on = function (ev, cb) { this.handlers[ev] = cb; return this; };
BF.net.LocalTransport.prototype.start = function () { if (this.handlers.ready) this.handlers.ready(); };
BF.net.LocalTransport.prototype.broadcastState = function () {};
BF.net.LocalTransport.prototype.sendAction = function () {};
BF.net.LocalTransport.prototype.claimClub = function () {};
BF.net.LocalTransport.prototype.close = function () {};
