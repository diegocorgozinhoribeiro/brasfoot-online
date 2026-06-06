// ==========================================================================
// data/provider.js  -  Ponte entre o front e a API de DADOS REAIS do relay.
// --------------------------------------------------------------------------
//   GET /api/regions          -> lista de paises jogaveis
//   GET /api/world?region=XX  -> clubes da regiao + pool continental +
//                                jogadores reais (ja no shape do motor)
// Popula os containers definidos em regions.js. Sem dados ficticios.
// As funcoes sao assincronas e DEVEM ser aguardadas antes de C.buildWorld.
// ==========================================================================
window.BF = window.BF || {};
BF.data = BF.data || {};

(function () {
  var D = BF.data;

  function httpBase() {
    var api = window.BF && BF.api;
    if (api && api.toHttp && api.getBase) return api.toHttp(api.getBase());
    return '';
  }

  async function getJson(path) {
    var base = httpBase();
    if (!base) throw new Error('Servidor relay nao configurado.');
    var headers = {};
    try { var t = BF.api && BF.api.getToken && BF.api.getToken(); if (t) headers['Authorization'] = 'Bearer ' + t; } catch (e) {}
    var resp;
    try { resp = await fetch(base + path, { headers: headers }); }
    catch (e) { throw new Error('Nao consegui conectar ao servidor (' + base + ').'); }
    var json = null; try { json = await resp.json(); } catch (e) {}
    if (!resp.ok) throw new Error((json && json.error) || ('HTTP ' + resp.status));
    return json;
  }

  // ---- Regioes (carregadas uma vez, cacheadas) ----
  var regionsPromise = null;
  D.ensureRegionsLoaded = function (force) {
    if (!force && D.REGIONS && D.REGIONS.length) return Promise.resolve(D.REGIONS);
    if (!force && regionsPromise) return regionsPromise;
    regionsPromise = getJson('/api/regions').then(function (r) {
      var metas = (r && r.regions) || [];
      D.REGIONS = metas.map(function (m) { return D.decorateRegion(m); });
      return D.REGIONS;
    }).catch(function (e) { regionsPromise = null; throw e; });
    return regionsPromise;
  };

  // ---- Mundo de uma regiao (clubes + jogadores reais) ----
  var worldPromise = {};
  D.ensureWorldLoaded = function (regionId) {
    if (!regionId) return Promise.resolve(null);
    if (D._worldRegionId === regionId && D._regionClubs && D._regionClubs.length) return Promise.resolve(true);
    if (worldPromise[regionId]) return worldPromise[regionId];
    worldPromise[regionId] = getJson('/api/world?region=' + encodeURIComponent(regionId)).then(function (w) {
      D._regionClubs = (w && w.clubs) || [];
      D._continentalClubs = (w && w.continental) || [];
      D.REAL_PLAYERS_FULL = (w && w.players) || {};
      D._worldRegionId = regionId;
      // garante metadados da regiao (caso /api/regions ainda nao tenha rodado)
      if (!D.regionById(regionId) && w && w.region) {
        D.REGIONS = (D.REGIONS || []).concat([D.decorateRegion(w.region)]);
      }
      var reg = D.regionById(regionId);
      if (reg) D.applyConfederationCupLabels(reg.confederation, reg);
      return true;
    }).catch(function (e) { delete worldPromise[regionId]; throw e; });
    return worldPromise[regionId];
  };

  // ---- Mercado: catalogo COMPLETO da base (todos clubes + jogadores reais) ----
  // Carregado uma vez e cacheado. Usado pela aba Mercado para listar todos os
  // clubes (qualquer pais) e procurar jogadores de qualquer liga (ex.: Japao).
  var marketPromise = null;
  D.ensureMarketLoaded = function () {
    if (D.MARKET) return Promise.resolve(D.MARKET);
    if (marketPromise) return marketPromise;
    marketPromise = getJson('/api/market').then(function (m) {
      var clubs = (m && m.clubs) || [];
      var players = (m && m.players) || [];
      var clubById = {};
      clubs.forEach(function (c) { clubById[c.id] = c; });
      D.MARKET = { clubs: clubs, players: players, clubById: clubById };
      return D.MARKET;
    }).catch(function (e) { marketPromise = null; throw e; });
    return marketPromise;
  };

  // Limpa o cache do mundo (usado ao trocar de regiao no menu).
  D.resetWorld = function () {
    D._regionClubs = []; D._continentalClubs = []; D.REAL_PLAYERS_FULL = {}; D._worldRegionId = null; worldPromise = {};
  };
})();
