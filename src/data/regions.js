// ==========================================================================
// data/regions.js  -  Modelo de REGIOES (paises) baseado em DADOS REAIS.
// --------------------------------------------------------------------------
// Nao ha mais dados fixos aqui. As regioes, clubes e jogadores vem do
// Postgres via src/data/provider.js (fetch /api/regions e /api/world).
// Este arquivo define apenas:
//   - os CONTAINERS de dados (D.REGIONS, D._regionClubs, ...);
//   - os HELPERS que o motor usa (regionById, clubsInRegion, ...);
//   - os METADADOS de copa por CONFEDERACAO (continental = confederacao).
// Regra de mapeamento de dominio:
//   regiao   = pais          (uma ou duas divisoes jogaveis, por nivel)
//   continental = confederacao  (adversarios de copa + alvos de mercado)
// ==========================================================================
window.BF = window.BF || {};
BF.data = BF.data || {};

(function () {
  var D = BF.data;

  // ---- Containers (preenchidos pelo provider em runtime) ----
  D.REGIONS = D.REGIONS || [];          // [{id,name,flag,confederation,leagues,continentals,nationalCup,clubCount}]
  D._regionClubs = D._regionClubs || []; // clubes jogaveis da regiao carregada
  D._continentalClubs = D._continentalClubs || []; // pool continental (confederacao)
  D.REAL_PLAYERS_FULL = D.REAL_PLAYERS_FULL || {}; // clubId -> [perfis reais]
  D._worldRegionId = D._worldRegionId || null;

  // ===== Metadados de copa por confederacao ================================
  // O MOTOR (cups.js) usa chaves fixas: 'libertadores' e 'sulamericana' para
  // as duas copas continentais e 'copaBrasil' para a copa nacional. Aqui so
  // trocamos os ROTULOS conforme a confederacao da regiao ativa.
  var CONFED_CUPS = {
    CONMEBOL: { c1: ['CONMEBOL Libertadores', 'LIB'], c2: ['CONMEBOL Sul-Americana', 'SUL'] },
    UEFA:     { c1: ['UEFA Champions League', 'UCL'], c2: ['UEFA Europa League', 'UEL'] },
    AFC:      { c1: ['AFC Champions League Elite', 'ACL'], c2: ['AFC Champions League Two', 'AC2'] },
    CONCACAF: { c1: ['CONCACAF Champions Cup', 'CCC'], c2: ['CONCACAF Central American Cup', 'CAC'] },
    CAF:      { c1: ['CAF Champions League', 'CCL'], c2: ['CAF Confederation Cup', 'CFC'] },
    OFC:      { c1: ['OFC Champions League', 'OCL'], c2: ['OFC Cup', 'OFC'] }
  };
  var DEFAULT_CUPS = { c1: ['Copa Continental I', 'CN1'], c2: ['Copa Continental II', 'CN2'] };

  // Nomes de copa nacional conhecidos (fallback: "Copa <pais>").
  var NATIONAL_CUP = {
    'Brasil': ['Copa do Brasil', 'CDB'],
    'Inglaterra': ['FA Cup', 'FAC'],
    'Espanha': ['Copa del Rey', 'CDR'],
    'It\u00e1lia': ['Coppa Italia', 'CIT'],
    'Alemanha': ['DFB-Pokal', 'DFB'],
    'Fran\u00e7a': ['Coupe de France', 'CDF'],
    'Portugal': ['Ta\u00e7a de Portugal', 'TDP'],
    'Argentina': ['Copa Argentina', 'CAR']
  };

  var FLAGS = {
    'Brasil': '\uD83C\uDDE7\uD83C\uDDF7', 'Argentina': '\uD83C\uDDE6\uD83C\uDDF7',
    'Espanha': '\uD83C\uDDEA\uD83C\uDDF8', 'Inglaterra': '\uD83C\uDDEC\uD83C\uDDE7',
    'It\u00e1lia': '\uD83C\uDDEE\uD83C\uDDF9', 'Alemanha': '\uD83C\uDDE9\uD83C\uDDEA',
    'Fran\u00e7a': '\uD83C\uDDEB\uD83C\uDDF7', 'Portugal': '\uD83C\uDDF5\uD83C\uDDF9',
    'Uruguai': '\uD83C\uDDFA\uD83C\uDDFE', 'Paraguai': '\uD83C\uDDF5\uD83C\uDDFE',
    'Chile': '\uD83C\uDDE8\uD83C\uDDF1', 'Col\u00f4mbia': '\uD83C\uDDE8\uD83C\uDDF4',
    'Equador': '\uD83C\uDDEA\uD83C\uDDE8', 'Peru': '\uD83C\uDDF5\uD83C\uDDEA',
    'B\u00e9lgica': '\uD83C\uDDE7\uD83C\uDDEA', 'Pa\u00edses Baixos': '\uD83C\uDDF3\uD83C\uDDF1'
  };

  D.nationalCupFor = function (country) {
    var nc = NATIONAL_CUP[country];
    return nc ? { key: 'copaBrasil', name: nc[0], short: nc[1] }
              : { key: 'copaBrasil', name: 'Copa ' + country, short: 'COP' };
  };

  // Decora uma regiao "crua" (vinda da API) com flag, copas e copa nacional.
  D.decorateRegion = function (meta) {
    return {
      id: meta.id,
      name: meta.name || meta.id,
      flag: FLAGS[meta.id] || '\uD83C\uDFC1',
      confederation: meta.confederation || '',
      leagues: (meta.leagues || []).slice(),
      clubCount: meta.clubCount || 0,
      continentals: ['libertadores', 'sulamericana'],
      nationalCup: D.nationalCupFor(meta.name || meta.id)
    };
  };

  // Aplica os rotulos de copa da confederacao no C.CUP_DEFS (mutacao global
  // valida porque o cliente joga UMA regiao por vez). Tambem ajusta o nome
  // da copa nacional. Chamado por buildWorld antes de montar as copas.
  D.applyConfederationCupLabels = function (confederation, region) {
    var C = (window.BF && BF.core) || null;
    if (!C || !C.CUP_DEFS) return;
    var cc = CONFED_CUPS[confederation] || DEFAULT_CUPS;
    if (C.CUP_DEFS.libertadores) { C.CUP_DEFS.libertadores.name = cc.c1[0]; C.CUP_DEFS.libertadores.short = cc.c1[1]; }
    if (C.CUP_DEFS.sulamericana) { C.CUP_DEFS.sulamericana.name = cc.c2[0]; C.CUP_DEFS.sulamericana.short = cc.c2[1]; }
    var nc = (region && region.nationalCup) || D.nationalCupFor((region && region.name) || '');
    if (C.CUP_DEFS.copaBrasil) { C.CUP_DEFS.copaBrasil.name = nc.name; C.CUP_DEFS.copaBrasil.short = nc.short; }
  };

  // ===== Helpers usados pelo motor ========================================
  D.regionById = function (id) {
    var list = D.REGIONS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  D.allBaseClubs = function () {
    return (D._regionClubs || []).concat(D._continentalClubs || []);
  };

  // Clubes JOGAVEIS da regiao carregada (viram a(s) liga(s) simulada(s)).
  D.clubsInRegion = function (regionId) {
    return (D._regionClubs || []).slice();
  };

  // Clubes da CONFEDERACAO (adversarios continentais + alvos de mercado).
  D.foreignClubsForRegion = function (regionId) {
    return (D._continentalClubs || []).slice();
  };

  D.regionClubCount = function (regionId) {
    var r = D.regionById(regionId);
    if (r && typeof r.clubCount === 'number') return r.clubCount;
    return D.clubsInRegion(regionId).length;
  };

  D.MIN_REGION_CLUBS = 8;
  D.regionPlayable = function (regionId) {
    return D.regionClubCount(regionId) >= D.MIN_REGION_CLUBS;
  };
})();
