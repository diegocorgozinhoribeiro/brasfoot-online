// ==========================================================================
// core/players.js  -  Montagem de elencos a partir dos JOGADORES REAIS.
// --------------------------------------------------------------------------
// SOMENTE dados reais. Os jogadores vem de BF.data.REAL_PLAYERS_FULL
// (carregado do Postgres pelo provider). Cada jogador recebe um id interno
// novo e um tempo de contrato aleatorio (deterministico via seed). NAO ha
// mais geracao de nomes/atributos ficticios: clube sem jogadores reais
// recebe elenco vazio.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const D = BF.data;

  // Quantidade maxima de jogadores por clube (mantem o estado/salvamento enxuto).
  const SQUAD_CAP = 28;
  // Minimo por posicao para garantir que sempre da pra escalar um XI valido.
  const MIN_BY_POS = { GOL: 2, ZAG: 3, LAT: 2, VOL: 2, MEI: 2, ATA: 2 };

  function pickSquad(full) {
    const sorted = full.slice().sort(function (a, b) { return b.ovr - a.ovr; });
    const chosen = sorted.slice(0, SQUAD_CAP);
    // Completa minimos por posicao puxando do restante do pool real.
    Object.keys(MIN_BY_POS).forEach(function (pos) {
      var have = chosen.filter(function (p) { return p.pos === pos; }).length;
      if (have < MIN_BY_POS[pos]) {
        var extra = sorted.filter(function (p) { return p.pos === pos && chosen.indexOf(p) < 0; })
                          .slice(0, MIN_BY_POS[pos] - have);
        Array.prototype.push.apply(chosen, extra);
      }
    });
    return chosen;
  }

  function genSquad(club, rng, idRef) {
    const full = D.REAL_PLAYERS_FULL && D.REAL_PLAYERS_FULL[club.id];
    if (!full || !full.length) return []; // sem dados reais => sem jogadores ficticios
    const squad = pickSquad(full);
    return squad.map(function (p) {
      const contract = BF.core.rint(rng, 6, 48);
      return {
        id: idRef.v++, clubId: club.id, name: p.name, pos: p.pos,
        ovr: p.ovr, age: p.age,
        value: (typeof p.value === 'number') ? p.value : 0.3,
        salary: (typeof p.salary === 'number') ? p.salary : 0.05,
        pot: p.pot || p.potential || p.ovr,
        contract: contract, listed: false, goals: 0, energy: 100
      };
    });
  }

  BF.core.genPlayersForClub = function (club, rng, idRef) {
    idRef = idRef || { v: 1 };
    return genSquad(club, rng, idRef);
  };

  BF.core.genAllPlayers = function (clubs, rng) {
    const idRef = { v: 1 };
    let players = [];
    clubs.forEach(function (c) { players = players.concat(BF.core.genPlayersForClub(c, rng, idRef)); });
    return players;
  };
})();
