// ==========================================================================
// core/league.js  -  Calculo da tabela de classificacao (por divisao)
// --------------------------------------------------------------------------
// computeTable(S, div): retorna a classificacao apenas dos clubes da divisao
// informada (1 = Serie A, 2 = Serie B), considerando so os jogos daquela
// divisao. Se div for omitido, usa a Serie A.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

BF.core.computeTable = function (S, div) {
  const C = BF.core;
  div = div || 1;
  const t = {};
  S.clubs.filter(function (c) { return c.division === div; })
    .forEach(function (c) { t[c.id] = { id: c.id, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0 }; });
  S.fixtures.filter(function (f) { return f.played && f.div === div; }).forEach(function (f) {
    const h = t[f.homeId], a = t[f.awayId];
    if (!h || !a) return;
    h.J++; a.J++; h.GP += f.hg; h.GC += f.ag; a.GP += f.ag; a.GC += f.hg;
    if (f.hg > f.ag) { h.V++; h.P += 3; a.D++; }
    else if (f.hg < f.ag) { a.V++; a.P += 3; h.D++; }
    else { h.E++; a.E++; h.P++; a.P++; }
  });
  return Object.keys(t).map(function (k) { const r = t[k]; r.SG = r.GP - r.GC; return r; })
    .sort(function (x, y) {
      return y.P - x.P || y.SG - x.SG || y.GP - x.GP ||
        C.clubById(S, x.id).name.localeCompare(C.clubById(S, y.id).name);
    });
};
