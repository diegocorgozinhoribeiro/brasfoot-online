// ==========================================================================
// core/engine.js  -  Motor de simulacao (eventos + AZARAO + TATICAS)
// --------------------------------------------------------------------------
// simulateMatch(home, away, rng):
//   home/away = { id, strength, tactic, squad:[{id,name,pos}] }  (squad = XI)
//   retorna { hg, ag, scorers:{home:[ids],away:[ids]}, events:[...], upset }
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const C = BF.core;

  // Taticas: atk = bonus no proprio ataque; opp = quanto o adversario marca a mais
  // (positivo = sua defesa fica mais exposta). Equilibrado e neutro.
  C.TACTICS = {
    ofensivo:    { label: 'Ofensivo',      atk:  0.55, opp:  0.40, desc: 'Mais volume ofensivo, mas se expoe atras.' },
    equilibrado: { label: 'Equilibrado',   atk:  0.00, opp:  0.00, desc: 'Postura neutra, sem grandes riscos.' },
    contra:      { label: 'Contra-ataque', atk:  0.15, opp: -0.25, desc: 'Cede a bola e busca o erro do rival.' },
    defensivo:   { label: 'Defensivo',     atk: -0.35, opp: -0.45, desc: 'Prioriza nao sofrer gols.' },
    retranca:    { label: 'Retranca',      atk: -0.70, opp: -0.70, desc: 'Fecha o jogo, placar baixo.' }
  };
  C.TACTIC_KEYS = ['ofensivo', 'equilibrado', 'contra', 'defensivo', 'retranca'];

  C._poisson = function (rng, l) {
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  C.simulateMatch = function (home, away, rng) {
    const adv = 4; // vantagem de mando de campo
    const sh = home.strength + adv, sa = away.strength;
    const gap = Math.abs(home.strength - away.strength);
    const weaker = home.strength <= away.strength ? 'home' : 'away';

    let lh = 1.25 + (sh - sa) / 9;
    let la = 1.05 + (sa - sh) / 9;

    // -------- TATICAS --------
    const T = C.TACTICS;
    const ht = T[home.tactic] || T.equilibrado;
    const at = T[away.tactic] || T.equilibrado;
    lh += ht.atk + at.opp;
    la += at.atk + ht.opp;

    // -------- PROBABILIDADE DE AZARAO --------
    let motivated = false;
    const upsetChance = 0.16 + Math.min(0.24, gap / 90);
    if (rng() < upsetChance) {
      motivated = true;
      if (weaker === 'home') { lh += 0.95; la -= 0.35; }
      else { la += 0.95; lh -= 0.35; }
    }
    lh = clamp(lh, 0.15, 5); la = clamp(la, 0.12, 4.6);

    let hg = Math.min(7, C._poisson(rng, lh));
    let ag = Math.min(7, C._poisson(rng, la));

    const weights = { ATA: 6, MEI: 3, VOL: 1, LAT: 1, ZAG: 1, GOL: 0 };
    function scorer(team) {
      const pool = [];
      team.squad.forEach(function (p) { const w = weights[p.pos] || 1; for (let i = 0; i < w; i++) pool.push(p); });
      return pool.length ? pool[Math.floor(rng() * pool.length)] : team.squad[0];
    }

    const events = []; const used = {};
    function goals(team, count, side) {
      const ids = [];
      for (let i = 0; i < count; i++) {
        let m, guard = 0;
        do { m = C.rint(rng, 1, 90); guard++; } while (used[m] && guard < 30);
        used[m] = 1;
        const s = scorer(team); ids.push(s ? s.id : 0);
        events.push({ minute: m, type: 'goal', side: side, player: s ? s.name : '' });
      }
      return ids;
    }
    const hs = goals(home, hg, 'home');
    const as = goals(away, ag, 'away');

    const flavor = C.rint(rng, 3, 5);
    for (let i = 0; i < flavor; i++) {
      const m = C.rint(rng, 1, 90);
      const side = rng() < 0.5 ? 'home' : 'away';
      const t = rng();
      const type = t < 0.5 ? 'chance' : (t < 0.82 ? 'save' : 'card');
      const tm = side === 'home' ? home : away;
      events.push({ minute: m, type: type, side: side, player: scorer(tm).name });
    }
    events.sort(function (a, b) { return a.minute - b.minute; });

    const upset = motivated && gap >= 4 &&
      ((weaker === 'home' && hg >= ag) || (weaker === 'away' && ag >= hg));

    return { hg: hg, ag: ag, scorers: { home: hs, away: as }, events: events, upset: upset };
  };
})();
