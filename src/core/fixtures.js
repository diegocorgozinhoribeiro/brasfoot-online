// ==========================================================================
// core/fixtures.js  -  Tabela de jogos (turno e returno) - metodo do circulo
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

BF.core.buildFixtures = function (ids) {
  let teams = ids.slice();
  if (teams.length % 2) teams.push(0); // 0 = "bye" (folga)
  const n = teams.length, rounds = n - 1, half = n / 2;
  const arr = teams.slice();
  const turno = [];
  for (let r = 0; r < rounds; r++) {
    const games = [];
    for (let i = 0; i < half; i++) {
      const h = arr[i], a = arr[n - 1 - i];
      if (h !== 0 && a !== 0) {
        if (r % 2 === 0) games.push([h, a]); else games.push([a, h]); // alterna mando
      }
    }
    turno.push(games);
    arr.splice(1, 0, arr.pop()); // rotaciona mantendo o primeiro fixo
  }
  const fixtures = [];
  turno.forEach(function (games, r) {
    games.forEach(function (g) { fixtures.push({ round: r + 1, homeId: g[0], awayId: g[1], hg: null, ag: null, played: false, upset: false }); });
  });
  turno.forEach(function (games, r) { // returno: mando invertido
    games.forEach(function (g) { fixtures.push({ round: rounds + r + 1, homeId: g[1], awayId: g[0], hg: null, ag: null, played: false, upset: false }); });
  });
  return fixtures;
};
