// ==========================================================================
// data/clubs.js  -  Constantes de FORMACAO e listas auxiliares.
// --------------------------------------------------------------------------
// IMPORTANTE: nao ha mais clubes/jogadores ficticios aqui. Os clubes
// (BF.data._regionClubs / _continentalClubs) e os jogadores reais
// (BF.data.REAL_PLAYERS_FULL) sao carregados do Postgres em runtime, via
// src/data/provider.js (GET /api/regions e /api/world). Este arquivo guarda
// apenas o que e puramente estrutural do MOTOR (posicoes e formacoes).
// ==========================================================================
window.BF = window.BF || {};
BF.data = BF.data || {};

// Containers preenchidos pelo provider (mantidos aqui por compatibilidade).
BF.data.CLUBS = [];             // legado: nao usado para dados reais
BF.data.CONTINENTAL_CLUBS = []; // legado: nao usado para dados reais
BF.data.REAL_PLAYERS = {};      // legado: sem base ficticia de nomes

// Posicoes do jogo e ordem canonica.
BF.data.POS_ORDER = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"];
// Formacao base usada para montar o tamanho/composicao do elenco: [pos, qtd].
BF.data.FORMATION = [["GOL", 2], ["ZAG", 4], ["LAT", 3], ["VOL", 3], ["MEI", 4], ["ATA", 4]];
// XI titular ideal (11): usado para auto-escalacao e validacao.
BF.data.LINEUP_NEED = { GOL: 1, ZAG: 2, LAT: 2, VOL: 2, MEI: 2, ATA: 2 };

// Cada formacao e descrita por LINHAS (do gol ao ataque). O mapa do campo na
// aba Escalacao e desenhado a partir destas linhas.
BF.data.FORMATIONS = {
  "4-4-2":   { label:"4-4-2",   lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["MEI","VOL","VOL","MEI"],["ATA","ATA"]] },
  "4-3-3":   { label:"4-3-3",   lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["VOL","MEI","MEI"],["ATA","ATA","ATA"]] },
  "3-5-2":   { label:"3-5-2",   lines:[["GOL"],["ZAG","ZAG","ZAG"],["VOL","MEI","MEI","MEI","VOL"],["ATA","ATA"]] },
  "4-2-3-1": { label:"4-2-3-1", lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["VOL","VOL"],["MEI","MEI","MEI"],["ATA"]] },
  "5-3-2":   { label:"5-3-2",   lines:[["GOL"],["LAT","ZAG","ZAG","ZAG","LAT"],["VOL","MEI","VOL"],["ATA","ATA"]] }
};
// Deriva slots (lista achatada) e need (contagem por posicao) de cada formacao.
Object.keys(BF.data.FORMATIONS).forEach(function (k) {
  var f = BF.data.FORMATIONS[k];
  f.slots = [].concat.apply([], f.lines);
  f.need = {}; BF.data.POS_ORDER.forEach(function (p) { f.need[p] = 0; });
  f.slots.forEach(function (p) { f.need[p] = (f.need[p] || 0) + 1; });
});
