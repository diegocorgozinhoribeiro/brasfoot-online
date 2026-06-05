// ==========================================================================
// core/cups.js  -  Copas nacionais e continentais
// --------------------------------------------------------------------------
// Cada copa e um mata-mata de jogo unico, encaixado em rodadas da temporada.
// As vagas continentais da temporada seguinte saem da classificacao da Serie A
// e dos campeoes brasileiros das copas.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const C = BF.core, D = BF.data;

  C.CUP_ORDER = ['libertadores', 'copaBrasil', 'sulamericana'];
  C.CUP_DEFS = {
    libertadores: {
      key: 'libertadores',
      name: 'CONMEBOL Libertadores',
      short: 'LIB',
      slots: 16,
      prizes: [2.5, 4, 7, 14],
      stages: [
        { key: 'oitavas', name: 'Oitavas de final', round: 6 },
        { key: 'quartas', name: 'Quartas de final', round: 11 },
        { key: 'semi', name: 'Semifinal', round: 16 },
        { key: 'final', name: 'Final', round: 21 }
      ]
    },
    copaBrasil: {
      key: 'copaBrasil',
      name: 'Copa do Brasil',
      short: 'CDB',
      slots: 32,
      prizes: [1.2, 2, 3.5, 6, 12],
      stages: [
        { key: 'fase32', name: 'Primeira fase', round: 4 },
        { key: 'oitavas', name: 'Oitavas de final', round: 9 },
        { key: 'quartas', name: 'Quartas de final', round: 14 },
        { key: 'semi', name: 'Semifinal', round: 19 },
        { key: 'final', name: 'Final', round: 24 }
      ]
    },
    sulamericana: {
      key: 'sulamericana',
      name: 'CONMEBOL Sul-Americana',
      short: 'SUL',
      slots: 16,
      prizes: [1.5, 2.5, 4.5, 9],
      stages: [
        { key: 'oitavas', name: 'Oitavas de final', round: 8 },
        { key: 'quartas', name: 'Quartas de final', round: 13 },
        { key: 'semi', name: 'Semifinal', round: 18 },
        { key: 'final', name: 'Final', round: 23 }
      ]
    }
  };

  function cloneClub(c) { return Object.assign({}, c); }
  function isBrazilianClub(S, id) {
    const c = C.clubById(S, id);
    return !!(c && !c.continental && c.division > 0);
  }
  C.isBrazilianClub = isBrazilianClub;

  function unique(ids) {
    const seen = {};
    return (ids || []).filter(function (id) {
      id = +id;
      if (!id || seen[id]) return false;
      seen[id] = 1;
      return true;
    });
  }

  function uniqueExisting(S, ids) {
    return unique(ids).filter(function (id) { return !!C.clubById(S, id); });
  }

  function brazilianClubs(S) {
    return S.clubs.filter(function (c) { return !c.continental && c.division > 0; });
  }

  function byStrengthDesc(a, b) {
    return b.strength - a.strength || a.name.localeCompare(b.name);
  }

  function tableIds(rows, max) {
    return rows.slice(0, max).map(function (r) { return r.id; });
  }

  function shuffled(ids, rng) {
    const arr = ids.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function fillWithBrazilian(S, ids, max) {
    const cur = uniqueExisting(S, ids);
    const used = {};
    cur.forEach(function (id) { used[id] = 1; });
    brazilianClubs(S).slice().sort(byStrengthDesc).forEach(function (c) {
      if (cur.length < max && !used[c.id]) {
        cur.push(c.id);
        used[c.id] = 1;
      }
    });
    return cur.slice(0, max);
  }

  function foreignIds(S, count, key, used) {
    used = used || {};
    const rng = C.makeRng(C.hashSeed(S.seed + '-foreign-' + key + '-s' + S.season));
    const pool = shuffled(S.clubs.filter(function (c) { return c.continental; }).map(function (c) { return c.id; }), rng);
    const picked = [];
    pool.forEach(function (id) {
      if (picked.length < count && !used[id]) {
        picked.push(id);
        used[id] = 1;
      }
    });
    if (picked.length < count) {
      pool.forEach(function (id) {
        if (picked.length < count && picked.indexOf(id) < 0) picked.push(id);
      });
    }
    return picked.slice(0, count);
  }

  C.ensureCompetitionClubs = function (S) {
    if (!S || !D.CONTINENTAL_CLUBS) return;
    S.clubs = S.clubs || [];
    S.players = S.players || [];
    const added = [];
    D.CONTINENTAL_CLUBS.forEach(function (c) {
      if (!C.clubById(S, c.id)) {
        const nc = cloneClub(c);
        S.clubs.push(nc);
        added.push(nc);
      }
    });
    if (!added.length) return;
    const maxId = S.players.reduce(function (m, p) { return Math.max(m, p.id || 0); }, 0);
    const idRef = { v: maxId + 1 };
    const rng = C.makeRng(C.hashSeed(S.seed + '-continental-players'));
    added.forEach(function (club) {
      S.players = S.players.concat(C.genPlayersForClub(club, rng, idRef));
    });
  };

  C.initialCupSlots = function (S) {
    const a = C.divClubs(S, 1).slice().sort(byStrengthDesc).map(function (c) { return c.id; });
    const b = C.divClubs(S, 2).slice().sort(byStrengthDesc).map(function (c) { return c.id; });
    return {
      libertadores: a.slice(0, 6),
      sulamericana: a.slice(6, 12),
      copaBrasil: a.concat(b.slice(0, 12)).slice(0, 32)
    };
  };

  C.cupWinners = function (S) {
    const out = {};
    if (!S || !S.cups) return out;
    C.CUP_ORDER.forEach(function (key) {
      out[key] = S.cups[key] ? S.cups[key].championId : null;
    });
    return out;
  };

  C.computeNextCupSlots = function (S, tableA, tableB) {
    const winners = C.cupWinners(S);
    let lib = tableIds(tableA, 6);

    ['copaBrasil', 'sulamericana', 'libertadores'].forEach(function (key) {
      const id = winners[key];
      if (isBrazilianClub(S, id) && lib.indexOf(id) < 0) lib.unshift(id);
    });
    lib = unique(lib).slice(0, 6);

    const sul = tableA.map(function (r) { return r.id; })
      .filter(function (id) { return lib.indexOf(id) < 0; })
      .slice(0, 6);

    return {
      libertadores: lib,
      sulamericana: sul,
      copaBrasil: unique(tableIds(tableA, 20).concat(tableIds(tableB, 12))).slice(0, 32)
    };
  };

  function participantsFor(S, key, usedForeign) {
    const slots = S.cupSlots || C.initialCupSlots(S);
    const def = C.CUP_DEFS[key];
    if (key === 'copaBrasil') return fillWithBrazilian(S, slots.copaBrasil, def.slots);

    const brazil = fillWithBrazilian(S, slots[key], Math.min(6, def.slots));
    const foreign = foreignIds(S, def.slots - brazil.length, key, usedForeign);
    return brazil.concat(foreign).slice(0, def.slots);
  }

  function addStageFixtures(S, cup, stageIndex, ids) {
    const stage = cup.stages[stageIndex];
    const rng = C.makeRng(C.hashSeed(S.seed + '-cup-draw-' + cup.key + '-' + stageIndex + '-s' + S.season));
    const draw = shuffled(ids, rng);
    cup.currentStage = stageIndex;
    for (let i = 0; i < draw.length; i += 2) {
      const a = draw[i], b = draw[i + 1];
      if (!a || !b) continue;
      const homeFirst = rng() >= 0.5;
      cup.fixtures.push({
        cupKey: cup.key,
        stage: stage.key,
        stageName: stage.name,
        stageIndex: stageIndex,
        round: stage.round,
        homeId: homeFirst ? a : b,
        awayId: homeFirst ? b : a,
        hg: null,
        ag: null,
        played: false,
        upset: false,
        penalty: false,
        winnerId: null
      });
    }
  }

  C.prepareSeasonCups = function (S) {
    if (!S) return;
    C.ensureCompetitionClubs(S);
    S.cupSlots = S.cupSlots || C.initialCupSlots(S);
    S.cups = {};
    const usedForeign = {};
    C.CUP_ORDER.forEach(function (key) {
      const def = C.CUP_DEFS[key];
      const cup = {
        key: key,
        name: def.name,
        short: def.short,
        status: 'active',
        participants: participantsFor(S, key, usedForeign),
        stages: def.stages.map(function (s) { return Object.assign({}, s); }),
        currentStage: 0,
        fixtures: [],
        championId: null,
        runnerUpId: null
      };
      addStageFixtures(S, cup, 0, cup.participants);
      S.cups[key] = cup;
    });
  };

  C.ensureSeasonCups = function (S) {
    if (!S) return;
    C.ensureCompetitionClubs(S);
    if (!S.cupSlots) S.cupSlots = C.initialCupSlots(S);
    if (!S.cups) C.prepareSeasonCups(S);
    const missing = C.CUP_ORDER.some(function (key) { return !S.cups[key]; });
    if (missing) C.prepareSeasonCups(S);
  };

  function knockoutWinner(S, f, rng) {
    if (f.hg > f.ag) return f.homeId;
    if (f.ag > f.hg) return f.awayId;
    f.penalty = true;
    const homeStrength = C.teamStrength(S, f.homeId);
    const awayStrength = C.teamStrength(S, f.awayId);
    const chance = Math.max(0.35, Math.min(0.65, 0.5 + (homeStrength - awayStrength) / 90));
    return rng() < chance ? f.homeId : f.awayId;
  }

  function awardCupMoney(S, f, winnerId) {
    const def = C.CUP_DEFS[f.cupKey];
    const home = C.clubById(S, f.homeId);
    const winner = C.clubById(S, winnerId);
    if (home) home.budget = Math.round((home.budget + 0.7) * 10) / 10;
    if (winner) {
      const prize = (def.prizes && def.prizes[f.stageIndex]) || 1;
      winner.budget = Math.round((winner.budget + prize) * 10) / 10;
    }
  }

  function advanceCupIfReady(S, cup) {
    if (!cup || cup.status === 'finished') return;
    const stageIndex = cup.currentStage || 0;
    const fixtures = cup.fixtures.filter(function (f) { return f.stageIndex === stageIndex; });
    if (!fixtures.length || !fixtures.every(function (f) { return f.played; })) return;
    const winners = fixtures.map(function (f) { return f.winnerId; }).filter(Boolean);
    if (stageIndex >= cup.stages.length - 1) {
      const final = fixtures[0];
      cup.status = 'finished';
      cup.championId = winners[0] || null;
      cup.runnerUpId = final ? (final.homeId === cup.championId ? final.awayId : final.homeId) : null;
      const champ = C.clubById(S, cup.championId);
      if (champ) S.feed.unshift('TÍTULO: ' + champ.name + ' conquistou a ' + cup.name + '.');
      return;
    }
    if (!cup.fixtures.some(function (f) { return f.stageIndex === stageIndex + 1; })) {
      addStageFixtures(S, cup, stageIndex + 1, winners);
    }
  }

  C.playCupRound = function (S, round) {
    C.ensureSeasonCups(S);
    const matches = [];
    C.CUP_ORDER.forEach(function (key) {
      const cup = S.cups[key];
      if (!cup || cup.status === 'finished') return;
      cup.fixtures.filter(function (f) { return f.round === round && !f.played; }).forEach(function (f, idx) {
        const rng = C.makeRng(C.hashSeed(S.seed + '-cup-match-' + key + '-' + round + '-' + idx + '-s' + S.season));
        const home = C.teamObj(S, f.homeId), away = C.teamObj(S, f.awayId);
        const res = C.simulateMatch(home, away, rng);
        f.hg = res.hg; f.ag = res.ag; f.played = true; f.upset = res.upset;
        res.scorers.home.concat(res.scorers.away).forEach(function (pid) {
          const p = S.players.find(function (x) { return x.id === pid; });
          if (p) p.goals++;
        });
        f.winnerId = knockoutWinner(S, f, rng);
        awardCupMoney(S, f, f.winnerId);
        const winner = C.clubById(S, f.winnerId);
        if (winner) {
          S.feed.unshift(cup.short + ': ' + winner.name + ' avançou na ' + f.stageName + (f.penalty ? ' nos pênaltis' : '') + '.');
        }
        matches.push({
          homeId: f.homeId,
          awayId: f.awayId,
          hg: res.hg,
          ag: res.ag,
          upset: res.upset,
          cupKey: key,
          cupName: cup.name,
          stageName: f.stageName,
          winnerId: f.winnerId,
          penalty: f.penalty,
          events: res.events,
          stats: res.stats
        });
      });
      advanceCupIfReady(S, cup);
    });
    return matches;
  };
})();
