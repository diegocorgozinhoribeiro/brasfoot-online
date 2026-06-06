// ==========================================================================
// data/realPlayers.js  -  Container dos elencos REAIS.
// --------------------------------------------------------------------------
// Sem dados embutidos. O provider (src/data/provider.js) preenche
// BF.data.REAL_PLAYERS_FULL com os jogadores reais vindos do Postgres
// (GET /api/world). Chave = id do clube; valor = lista de perfis ja no
// formato do motor ({name,pos,ovr,pot,age,value,salary,...}).
// ==========================================================================
window.BF = window.BF || {}; BF.data = BF.data || {};
BF.data.REAL_PLAYERS_FULL = BF.data.REAL_PLAYERS_FULL || {};
