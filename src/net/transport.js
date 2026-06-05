// ==========================================================================
// net/transport.js  -  Camada de rede abstrata (fabrica de transportes)
// --------------------------------------------------------------------------
// O jogo nao fala diretamente com BroadcastChannel/WebSocket. Ele conversa
// com um "transport" que implementa esta interface. Isso permite trocar o
// meio de comunicacao (mesmo dispositivo, rede local, servidor online) sem
// alterar o restante do codigo.
//
// Interface esperada:
//   .role               'solo' | 'host' | 'guest'
//   .on(event, cb)      eventos: 'ready','state','presence','action','requestSync','error'
//   .start()            inicia a conexao
//   .broadcastState(S)  (host) envia o estado para todos
//   .sendAction(action) (guest) envia uma acao para o host
//   .claimClub(id,name) reivindica um clube
//   .close()
// ==========================================================================
window.BF = window.BF || {};
BF.net = BF.net || {};

BF.net.makeTransport = function (mode, opts) {
  opts = opts || {};
  // 'ws'  -> multiplayer real entre dispositivos, via servidor relay WebSocket
  // 'party' -> party local entre abas do mesmo navegador (BroadcastChannel)
  // outros -> modo solo
  if (mode === 'ws') return new BF.net.WsPartyTransport(opts);
  if (mode === 'party') {
    // Se o usuario informou um serverUrl, prefere WebSocket automaticamente.
    if (opts.serverUrl) return new BF.net.WsPartyTransport(opts);
    return new BF.net.PartyTransport(opts);
  }
  return new BF.net.LocalTransport(opts);
};
