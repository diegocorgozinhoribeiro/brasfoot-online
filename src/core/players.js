// ==========================================================================
// core/players.js  -  Geracao de elencos (deterministica via seed)
// --------------------------------------------------------------------------
// Se BF.data.REAL_PLAYERS_FULL tem dados para o clube (carregado de
// realPlayers.js), usa os jogadores reais respeitando a formacao base.
// Caso contrario, gera procedurally a partir do strength do clube.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const D = BF.data;

  // Distribui os jogadores reais (vindos do CSV) nas posicoes da nossa
  // formacao. Mantem ordem por OVR descendente dentro de cada posicao para
  // que os titulares sejam os melhores nomes.
  function realPoolFor(clubId) {
    const full = D.REAL_PLAYERS_FULL && D.REAL_PLAYERS_FULL[clubId];
    if (!full || !full.length) return null;
    const byPos = {};
    full.forEach(function (p) {
      if (!byPos[p.pos]) byPos[p.pos] = [];
      byPos[p.pos].push(p);
    });
    Object.keys(byPos).forEach(function (k) {
      byPos[k].sort(function (a, b) { return b.ovr - a.ovr; });
    });
    return byPos;
  }

  function genSquad(club, rng, idRef) {
    const list = [];
    const realPool = realPoolFor(club.id);
    const usedReal = {}; // pos -> idx usado
    const legacy = D.REAL_PLAYERS && D.REAL_PLAYERS[club.id] ? JSON.parse(JSON.stringify(D.REAL_PLAYERS[club.id])) : {};
    D.FORMATION.forEach(function (entry) {
      const pos = entry[0], n = entry[1];
      for (let i = 0; i < n; i++) {
        let real = null;
        if (realPool && realPool[pos]) {
          const idx = usedReal[pos] || 0;
          if (idx < realPool[pos].length) { real = realPool[pos][idx]; usedReal[pos] = idx + 1; }
        }
        let ovr, age, value, salary, name;
        if (real) {
          ovr = real.ovr;
          age = real.age;
          value = real.value;
          salary = real.salary;
          name = real.name;
        } else {
          const variance = BF.core.rint(rng, -7, 5);
          ovr = Math.max(58, Math.min(92, club.strength + variance));
          age = BF.core.rint(rng, 18, 35);
          value = Math.pow((ovr - 55) / 10, 2.4) * (age < 30 ? 1 : 0.62);
          value = Math.max(0.3, Math.round(value * 10) / 10);
          salary = Math.round((value * 0.018 + 0.04) * 1000) / 1000;
          name = (legacy[pos] && legacy[pos].length)
            ? legacy[pos].shift()
            : BF.core.rpick(rng, D.FIRST) + ' ' + BF.core.rpick(rng, D.LAST);
        }
        const contract = BF.core.rint(rng, 6, 48);
        list.push({ id: idRef.v++, clubId: club.id, name: name, pos: pos, ovr: ovr, age: age, value: value, salary: salary, contract: contract, listed: false, goals: 0, energy: 100 });
      }
    });
    // Se ainda sobrou jogador real do CSV em alguma posicao, adiciona como
    // reserva extra (ate 4 a mais por clube) para preservar nomes reais.
    if (realPool) {
      const extras = [];
      Object.keys(realPool).forEach(function (pos) {
        const start = usedReal[pos] || 0;
        for (let i = start; i < realPool[pos].length; i++) extras.push(realPool[pos][i]);
      });
      extras.sort(function (a, b) { return b.ovr - a.ovr; });
      extras.slice(0, 4).forEach(function (real) {
        const contract = BF.core.rint(rng, 6, 48);
        list.push({ id: idRef.v++, clubId: club.id, name: real.name, pos: real.pos, ovr: real.ovr, age: real.age, value: real.value, salary: real.salary, contract: contract, listed: false, goals: 0, energy: 100 });
      });
    }
    return list;
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
