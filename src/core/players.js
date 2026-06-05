// ==========================================================================
// core/players.js  -  Geracao de elencos (deterministica via seed)
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const D = BF.data;

  function genSquad(club, rng, idRef) {
    const list = [];
    D.FORMATION.forEach(function (entry) {
      const pos = entry[0], n = entry[1];
      for (let i = 0; i < n; i++) {
        const variance = BF.core.rint(rng, -7, 5);
        const ovr = Math.max(58, Math.min(92, club.strength + variance));
        const age = BF.core.rint(rng, 18, 35);
        let value = Math.pow((ovr - 55) / 10, 2.4) * (age < 30 ? 1 : 0.62); // milhoes
        value = Math.max(0.3, Math.round(value * 10) / 10);
        const salary = Math.round((value * 0.018 + 0.04) * 1000) / 1000;     // milhoes/mes
        const name = BF.core.rpick(rng, D.FIRST) + " " + BF.core.rpick(rng, D.LAST);
        list.push({ id: idRef.v++, clubId: club.id, name: name, pos: pos, ovr: ovr, age: age, value: value, salary: salary, goals: 0 });
      }
    });
    return list;
  }

  BF.core.genAllPlayers = function (clubs, rng) {
    const idRef = { v: 1 };
    let players = [];
    clubs.forEach(function (c) { players = players.concat(genSquad(c, rng, idRef)); });
    return players;
  };
})();
