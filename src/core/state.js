// ==========================================================================
// core/state.js  -  Estado do jogo, helpers e REDUCER central (applyAction)
// --------------------------------------------------------------------------
// Toda mudanca no jogo passa por applyAction(S, action). Isso torna o estado
// previsivel e facil de sincronizar no modo online: o host aplica a acao e
// retransmite o novo estado para todos os clientes.
// Recursos: 2 divisoes (acesso/rebaixamento), escalacao 11 titulares por
// FORMACAO + tatica, diretoria com VARIAS metas (>=60% para manter o emprego),
// ENERGIA dos jogadores, rescisao de contrato e mercado da IA.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const C = BF.core, D = BF.data;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- Indice O(1) por estado (performance p/ milhares de jogadores) ----
  // Mapas clubById/byClub/byId construidos uma vez por instancia de S e
  // reaproveitados. Invalida quando: o array de clubs/players e' reatribuido
  // (mudanca de identidade ou tamanho) OU quando S.__sv muda (transferencia
  // altera clubId in-place). Guardado como propriedade NAO enumeravel para
  // nao inchar saves/broadcasts nem sobreviver ao clone do applyAction.
  function buildIndex(S) {
    var cb = {}, bc = {}, bi = {};
    var clubs = S.clubs || [], players = S.players || [];
    for (var i = 0; i < clubs.length; i++) cb[clubs[i].id] = clubs[i];
    for (var j = 0; j < players.length; j++) {
      var p = players[j];
      bi[p.id] = p;
      (bc[p.clubId] || (bc[p.clubId] = [])).push(p);
    }
    var cache = {
      clubById: cb, byClub: bc, byId: bi,
      clubsRef: clubs, clubsLen: clubs.length,
      playersRef: players, playersLen: players.length,
      sv: S.__sv || 0
    };
    try { Object.defineProperty(S, '__idx', { value: cache, enumerable: false, writable: true, configurable: true }); }
    catch (e) { S.__idx = cache; }
    return cache;
  }
  function idx(S) {
    var c = S.__idx;
    if (c && c.clubsRef === S.clubs && c.clubsLen === S.clubs.length &&
        c.playersRef === S.players && c.playersLen === S.players.length &&
        c.sv === (S.__sv || 0)) return c;
    return buildIndex(S);
  }
  C._index = idx;
  C.clubById = function (S, id) { return idx(S).clubById[id]; };
  // squad retorna uma COPIA (callers podem ordenar/mutar o array retornado).
  C.squad = function (S, id) { var a = idx(S).byClub[id]; return a ? a.slice() : []; };
  C.playerById = function (S, id) { return idx(S).byId[id]; };
  C.divClubs = function (S, div) { return S.clubs.filter(function (c) { return c.division === div; }); };

  // ---- Formacao do clube ----
  C.formationOf = function (S, id) {
    const key = (S.formations && S.formations[id]) || '4-4-2';
    return D.FORMATIONS[key] || D.FORMATIONS['4-4-2'];
  };
  C.formNeed = function (S, id) { return C.formationOf(S, id).need || D.LINEUP_NEED; };

  // ---- Energia ----
  C.energyOf = function (p) { return (p.energy == null) ? 100 : p.energy; };
  // overall efetivo considerando o cansaco (100 = cheio; 0 = -20%)
  C.effOvr = function (p) { return p.ovr * (0.80 + 0.20 * C.energyOf(p) / 100); };

  // ---- Escalacao (XI titular) ----
  C.autoLineup = function (sq, need) {
    need = need || D.LINEUP_NEED;
    const byPos = {};
    sq.forEach(function (p) { (byPos[p.pos] = byPos[p.pos] || []).push(p); });
    Object.keys(byPos).forEach(function (k) { byPos[k].sort(function (a, b) { return b.ovr - a.ovr; }); });
    const xi = []; const ids = {};
    Object.keys(need).forEach(function (pos) {
      (byPos[pos] || []).slice(0, need[pos]).forEach(function (p) { xi.push(p); ids[p.id] = 1; });
    });
    if (xi.length < 11) {
      sq.slice().sort(function (a, b) { return b.ovr - a.ovr; }).forEach(function (p) {
        if (xi.length < 11 && !ids[p.id]) { xi.push(p); ids[p.id] = 1; }
      });
    }
    return xi.slice(0, 11);
  };
  // Retorna os 11 jogadores escalados (usa a escalacao salva se valida, senao auto)
  C.lineupOf = function (S, id) {
    const sq = C.squad(S, id);
    const saved = (S.lineups && S.lineups[id]) || [];
    const valid = saved.map(function (pid) { return sq.find(function (p) { return p.id === pid; }); }).filter(Boolean);
    if (valid.length === 11) return valid;
    return C.autoLineup(sq, C.formNeed(S, id));
  };
  C.benchOf = function (S, id) {
    const ids = {}; C.lineupOf(S, id).forEach(function (p) { ids[p.id] = 1; });
    return C.squad(S, id).filter(function (p) { return !ids[p.id]; }).sort(function (a, b) { return b.ovr - a.ovr; });
  };
  C.teamStrength = function (S, id) {
    const xi = C.lineupOf(S, id);
    if (!xi.length) return 60;
    return xi.reduce(function (s, p) { return s + C.effOvr(p); }, 0) / xi.length;
  };
  C.teamObj = function (S, id) {
    const xi = C.lineupOf(S, id);
    const strength = xi.length ? xi.reduce(function (s, p) { return s + C.effOvr(p); }, 0) / xi.length : 60;
    return {
      id: id, strength: strength,
      tactic: (S.tactics && S.tactics[id]) || 'equilibrado',
      squad: xi.map(function (p) { return { id: p.id, name: p.name, pos: p.pos }; })
    };
  };

  // ====================== DIRETORIA / METAS (multi-objetivo) ================
  // Cada clube recebe um conjunto de metas com peso. A pontuacao da diretoria
  // e a media ponderada do cumprimento (0..1). Precisa de >= 60% para manter
  // o emprego ao fim da temporada.
  C.PASS_MARK = 0.6;

  C.buildObjectives = function (S, id) {
    const c = C.clubById(S, id); if (!c) return [];
    const peers = C.divClubs(S, c.division).slice().sort(function (a, b) { return b.strength - a.strength; });
    const rank = peers.findIndex(function (x) { return x.id === id; });
    let posTarget, signTarget, cupStage, cupLabel;
    if (c.division === 1) {
      if (rank < 3) posTarget = 4;
      else if (rank < 7) posTarget = 8;
      else if (rank < 13) posTarget = 12;
      else posTarget = 16;
      signTarget = rank < 7 ? 3 : 2;
      cupStage = 2; cupLabel = 'Avançar até as quartas da Copa do Brasil';
    } else {
      if (rank < 4) posTarget = 4;
      else if (rank < 10) posTarget = 8;
      else posTarget = 16;
      signTarget = 2;
      cupStage = 1; cupLabel = 'Vencer ao menos uma fase na Copa do Brasil';
    }
    return [
      { key: 'position', type: 'position', target: posTarget, weight: 3, label: 'Terminar até o ' + posTarget + 'º lugar na ' + (c.division === 1 ? 'Série A' : 'Série B') },
      { key: 'cup', type: 'cup', cup: 'copaBrasil', stage: cupStage, weight: 2, label: cupLabel },
      { key: 'signings', type: 'signings', target: signTarget, weight: 1, label: 'Contratar ao menos ' + signTarget + ' reforço(s) na temporada' },
      { key: 'finance', type: 'finance', target: 0, weight: 1, label: 'Encerrar a temporada sem dívidas (caixa ≥ 0)' }
    ];
  };

  C.clubCupWins = function (S, id, cupKey) {
    const cup = S.cups && S.cups[cupKey];
    if (!cup) return 0;
    return cup.fixtures.filter(function (f) { return f.played && f.winnerId === id; }).length;
  };

  // Cumprimento de uma meta (0..1). pos = posicao atual/final do clube.
  C.evalObjective = function (S, id, obj, pos) {
    const c = C.clubById(S, id); if (!c) return 0;
    if (obj.type === 'position') {
      if (!pos || pos < 1) return 0;
      if (pos <= obj.target) return 1;
      return Math.max(0, 1 - (pos - obj.target) * 0.12);
    }
    if (obj.type === 'signings') {
      const done = (S.signings && S.signings[id]) || 0;
      return clamp(done / Math.max(1, obj.target), 0, 1);
    }
    if (obj.type === 'finance') {
      if (c.budget >= obj.target) return 1;
      if (c.budget >= obj.target - 20) return 0.5;
      return 0;
    }
    if (obj.type === 'cup') {
      const cup = S.cups && S.cups[obj.cup];
      if (cup && cup.championId === id) return 1;
      const wins = C.clubCupWins(S, id, obj.cup);
      return clamp(wins / Math.max(1, obj.stage), 0, 1);
    }
    return 0;
  };
  // Detalhe textual do progresso de uma meta
  C.objProgressText = function (S, id, obj, pos) {
    if (obj.type === 'position') return 'Atual: ' + (pos || '-') + 'º';
    if (obj.type === 'signings') return 'Contratações: ' + ((S.signings && S.signings[id]) || 0) + '/' + obj.target;
    if (obj.type === 'finance') { const c = C.clubById(S, id); return 'Caixa: ' + (c ? c.budget.toFixed(1) : '-') + ' mi'; }
    if (obj.type === 'cup') {
      const cup = S.cups && S.cups[obj.cup];
      if (cup && cup.championId === id) return 'Campeão!';
      return 'Fases vencidas: ' + C.clubCupWins(S, id, obj.cup) + '/' + obj.stage;
    }
    return '';
  };
  C.boardScore = function (S, id, pos) {
    const b = S.boards[id]; if (!b || !b.objectives) return 0;
    let w = 0, s = 0;
    b.objectives.forEach(function (o) { w += o.weight; s += o.weight * C.evalObjective(S, id, o, pos); });
    return w ? s / w : 0;
  };
  C.assignBoard = function (S, id) {
    S.boards[id] = { objectives: C.buildObjectives(S, id), status: 'ongoing' };
  };

  // ---- Construcao do mundo ----
  // Calendario de copas ADAPTATIVO: 7 rodadas continentais + 5 da copa nacional,
  // na mesma ordem cronologica do calendario classico, mas espalhadas conforme
  // o tamanho da liga (L rodadas). Assim regioes menores tambem completam as
  // copas sem travar.
  function cupSchedule(L) {
    const order = ['continental','copaBrasil','continental','continental','copaBrasil','continental','copaBrasil','continental','copaBrasil','continental','copaBrasil','continental'];
    const total = order.length; // 12 eventos de copa
    const totalRounds = L + total;
    const gap = totalRounds / (total + 1);
    const cont = [], copa = [];
    const used = {};
    let last = 0;
    for (let i = 0; i < total; i++) {
      let r = Math.round((i + 1) * gap);
      if (r <= last) r = last + 1;
      while (used[r]) r++;
      if (r > totalRounds) r = totalRounds;
      used[r] = 1; last = r;
      if (order[i] === 'continental') cont.push(r); else copa.push(r);
    }
    return { continentalRounds: cont, copaBrasilRounds: copa };
  }

  // Calendario unico: cada rodada possui apenas UM torneio (liga, copa
  // continental ou copa nacional).
  function buildAllFixtures(S) {
    const d1 = C.divClubs(S, 1).map(function (c) { return c.id; });
    const d2 = C.divClubs(S, 2).map(function (c) { return c.id; });
    const fx1 = C.buildFixtures(d1).map(function (f) { f.div = 1; f.lr = f.round; return f; });
    const fx2 = C.buildFixtures(d2).map(function (f) { f.div = 2; f.lr = f.round; return f; });
    const allLr = fx1.concat(fx2).map(function (f) { return f.lr; });
    const leagueRoundsCount = allLr.length ? Math.max.apply(null, allLr) : 1;
    // Rodadas globais reservadas para copas (mesmo indice para as continentais).
    const sched = cupSchedule(leagueRoundsCount);
    const continentalRounds = sched.continentalRounds;
    const copaBrasilRounds = sched.copaBrasilRounds;
    const cupRoundsSet = {};
    continentalRounds.forEach(function (r) { cupRoundsSet[r] = 'continental'; });
    copaBrasilRounds.forEach(function (r) { cupRoundsSet[r] = 'copaBrasil'; });
    const totalRounds = leagueRoundsCount + continentalRounds.length + copaBrasilRounds.length;
    const lrMap = {};
    let lr = 1;
    for (let g = 1; g <= totalRounds && lr <= leagueRoundsCount; g++) {
      if (cupRoundsSet[g]) continue;
      lrMap[lr] = g;
      lr++;
    }
    fx1.forEach(function (f) { f.round = lrMap[f.lr]; });
    fx2.forEach(function (f) { f.round = lrMap[f.lr]; });
    S.fixtures = fx1.concat(fx2);
    S.totalRounds = totalRounds;
    S.calendar = {
      continentalRounds: continentalRounds.slice(),
      copaBrasilRounds: copaBrasilRounds.slice(),
      leagueRoundsCount: leagueRoundsCount
    };
  }

  C.buildWorld = function (seed, regionId) {
    const region = (D.regionById && D.regionById(regionId)) || (D.REGIONS && D.REGIONS[0]) || null;
    regionId = region ? region.id : 'BR';
    const rng = C.makeRng(C.hashSeed(seed));
    // Apenas a regiao ativa vira liga(s) simulada(s). Os clubes das outras
    // regioes entram SOB DEMANDA (copas continentais + mercado) via
    // ensureCompetitionClubs -> lazy-load, melhor performance ao escalar.
    // Aplica os rotulos de copa da confederacao da regiao ANTES de montar as
    // copas, para que toda a UI mostre os nomes corretos (Libertadores/UCL...).
    if (region && D.applyConfederationCupLabels) D.applyConfederationCupLabels(region.confederation, region);
    let baseClubs;
    if (region && D.clubsInRegion) {
      baseClubs = D.clubsInRegion(regionId).map(function (c) {
        const lg = (region.leagues || []).filter(function (l) { return String(l.id) === String(c.leagueId); })[0] || (region.leagues || [])[0];
        const division = (lg && lg.division) || c.division || 1;
        return Object.assign({}, c, { division: division, continental: false });
      });
    } else {
      baseClubs = (D._regionClubs || []).map(function (c) { return Object.assign({}, c); });
    }
    const players = C.genAllPlayers(baseClubs, rng);
    const S = {
      seed: seed, regionId: regionId, season: 1, year: 2026, round: 1, totalRounds: 1,
      clubs: baseClubs, players: players, fixtures: [],
      history: [], controlled: {}, userClubs: {}, negotiations: [], lastRound: null, feed: [], negId: 1,
      lineups: {}, tactics: {}, formations: {}, boards: {}, fired: {}, votes: {},
      signings: {}, cups: {}, cupSlots: null, nextCupSlots: null
    };
    // Convidados de partidas online podem montar o mundo antes do estado
    // chegar do anfitriao; sem clubes carregados, pula calendario/copas.
    if (baseClubs.length) {
      buildAllFixtures(S);
      if (C.prepareSeasonCups) C.prepareSeasonCups(S);
    }
    return S;
  };

  // ---- Financas por rodada (reduzidas) ----
  function roundFinance(S, r) {
    S.clubs.forEach(function (c) {
      const folha = C.squad(S, c.id).reduce(function (s, p) { return s + p.salary; }, 0);
      c.budget -= folha;
    });
    const rng = C.makeRng(C.hashSeed(S.seed + '-fin' + r + '-' + S.season));
    S.fixtures.filter(function (f) { return f.round === r; }).forEach(function (f) {
      const home = C.clubById(S, f.homeId); if (!home) return;
      // Serie B rende menos do que a Serie A
      const base = home.division === 1 ? 0.055 : 0.03;
      const extra = home.division === 1 ? C.rint(rng, 1, 5) : C.rint(rng, 1, 3);
      const renda = Math.round((C.teamStrength(S, f.homeId) * base + extra) * 10) / 10;
      home.budget += renda;
    });
    S.clubs.forEach(function (c) { c.budget = Math.round(c.budget * 10) / 10; });
  }

  // ---- Energia: quem jogou cansa; quem ficou de fora recupera ----
  function updateEnergy(S, r) {
    const rng = C.makeRng(C.hashSeed(S.seed + '-energy' + r + '-' + S.season));
    const played = {};
    S.fixtures.filter(function (f) { return f.round === r && f.played; }).forEach(function (f) { played[f.homeId] = 1; played[f.awayId] = 1; });
    Object.keys(S.cups || {}).forEach(function (k) {
      (S.cups[k].fixtures || []).filter(function (f) { return f.round === r && f.played; }).forEach(function (f) { played[f.homeId] = 1; played[f.awayId] = 1; });
    });
    S.clubs.forEach(function (c) {
      const xi = {}; C.lineupOf(S, c.id).forEach(function (p) { xi[p.id] = 1; });
      const didPlay = played[c.id];
      C.squad(S, c.id).forEach(function (p) {
        if (p.energy == null) p.energy = 100;
        if (didPlay && xi[p.id]) p.energy = clamp(p.energy - C.rint(rng, 3, 6), 0, 100);    // titular jogou: cansa pouco
        else p.energy = clamp(p.energy + C.rint(rng, 6, 12), 0, 100);                       // reserva/folga: recupera
      });
    });
  }

  C.playRound = function (S) {
    if (S.round > S.totalRounds) return;
    if (C.ensureSeasonCups) C.ensureSeasonCups(S);
    const r = S.round;
    const rng = C.makeRng(C.hashSeed(S.seed + '-r' + r + '-s' + S.season));
    const matches = [];
    S.fixtures.filter(function (f) { return f.round === r && !f.played; }).forEach(function (f) {
      const home = C.teamObj(S, f.homeId), away = C.teamObj(S, f.awayId);
      const res = C.simulateMatch(home, away, rng);
      f.hg = res.hg; f.ag = res.ag; f.played = true; f.upset = res.upset;
      res.scorers.home.concat(res.scorers.away).forEach(function (pid) {
        const p = C.playerById(S, pid); if (p) p.goals++;
      });
      matches.push({ homeId: f.homeId, awayId: f.awayId, hg: res.hg, ag: res.ag, upset: res.upset, div: f.div, comp: 'league', events: res.events, stats: res.stats });
      if (res.upset) S.feed.unshift('ZEBRA! ' + C.clubById(S, f.homeId).name + ' ' + res.hg + ' x ' + res.ag + ' ' + C.clubById(S, f.awayId).name + ' (rod. ' + r + ')');
    });
    if (C.playCupRound) {
      const cupMatches = C.playCupRound(S, r);
      cupMatches.forEach(function (m) { matches.push(m); });
    }
    roundFinance(S, r);
    updateEnergy(S, r);
    S.players.forEach(function (p) { p.contract = Math.max(0, (p.contract || 24) - 1); });
    // O mundo segue para os times de IA tambem: janela de transferencias automatica
    const trng = C.makeRng(C.hashSeed(S.seed + '-tr' + r + '-s' + S.season));
    C.aiTransferWindow(S, trng);
    S.lastRound = { round: r, matches: matches };
    S.round++;
    if (S.round > S.totalRounds) endSeason(S);
  };

  function endSeason(S) {
    if (C.ensureSeasonCups) C.ensureSeasonCups(S);
    const t1 = C.computeTable(S, 1), t2 = C.computeTable(S, 2);
    const champ = t1[0] ? C.clubById(S, t1[0].id) : null; if (champ) champ.titles++;
    const art = S.players.slice().sort(function (a, b) { return b.goals - a.goals; })[0];
    const cupWinners = C.cupWinners ? C.cupWinners(S) : {};
    const nextCupSlots = C.computeNextCupSlots ? C.computeNextCupSlots(S, t1, t2) : null;

    // Avaliacao das metas da diretoria (antes do rebaixamento alterar divisoes)
    Object.keys(S.controlled).forEach(function (idStr) {
      const id = +idStr; const c = C.clubById(S, id); if (!c) return;
      const tbl = c.division === 1 ? t1 : t2;
      const pos = tbl.findIndex(function (rr) { return rr.id === id; }) + 1;
      const b = S.boards[id]; if (!b) return;
      const score = C.boardScore(S, id, pos);
      const met = score >= C.PASS_MARK;
      b.status = met ? 'met' : 'failed'; b.finalPos = pos; b.score = Math.round(score * 100);
      if (met) {
        S.feed.unshift('DIRETORIA: ' + c.name + ' cumpriu as metas da temporada (' + b.score + '% \u2022 ' + pos + 'º lugar).');
      } else {
        S.fired[id] = { clubName: c.name, year: S.year, pos: pos, score: b.score };
        delete S.controlled[id]; // o clube volta a ser controlado pela IA
        S.feed.unshift('DEMISSÃO: a diretoria do ' + c.name + ' demitiu o técnico (metas em ' + b.score + '%, abaixo de 60%).');
      }
    });

    // Acesso e rebaixamento (apenas quando a regiao tem 2a divisao)
    const hasDiv2 = C.divClubs(S, 2).length > 0;
    const releg = hasDiv2 ? t1.slice(-4).map(function (r) { return r.id; }) : [];
    const promo = hasDiv2 ? t2.slice(0, 4).map(function (r) { return r.id; }) : [];
    releg.forEach(function (id) { const c = C.clubById(S, id); if (c) c.division = 2; });
    promo.forEach(function (id) { const c = C.clubById(S, id); if (c) c.division = 1; });

    S.history.unshift({
      year: S.year, championId: t1[0] ? t1[0].id : null, championBId: t2[0] ? t2[0].id : null,
      promoted: promo, relegated: releg, cupWinners: cupWinners, cupSlots: nextCupSlots,
      artil: art ? { name: art.name, goals: art.goals, clubId: art.clubId } : null
    });
    S.nextCupSlots = nextCupSlots;
    if (nextCupSlots) {
      const libNames = nextCupSlots.libertadores.map(function (id) { const c = C.clubById(S, id); return c ? c.short : ''; }).filter(Boolean).join(', ');
      const sulNames = nextCupSlots.sulamericana.map(function (id) { const c = C.clubById(S, id); return c ? c.short : ''; }).filter(Boolean).join(', ');
      S.feed.unshift('VAGAS ' + (S.year + 1) + ': Libertadores (' + libNames + '); Sul-Americana (' + sulNames + ').');
    }
    const champBClub = t2[0] ? C.clubById(S, t2[0].id) : null;
    const champBName = champBClub ? champBClub.name : null;
    S.feed.unshift('FIM DA TEMPORADA ' + S.year + ': ' + (champ ? champ.name : '-') + ' campeão' + (champBName ? ('; ' + champBName + ' campeão da 2ª divisão.') : '.'));
  }

  C.nextSeason = function (S) {
    S.season++; S.year++; S.round = 1;
    S.signings = {};
    S.players.forEach(function (p) { p.goals = 0; p.age++; p.contract = Math.max(6, (p.contract || 12)); p.energy = 100; });
    S.cupSlots = S.nextCupSlots || (C.initialCupSlots ? C.initialCupSlots(S) : S.cupSlots);
    S.nextCupSlots = null;
    buildAllFixtures(S);
    if (C.prepareSeasonCups) C.prepareSeasonCups(S);
    S.lastRound = null;
    // Novas metas para quem segue no comando
    Object.keys(S.controlled).forEach(function (idStr) { C.assignBoard(S, +idStr); });
  };

  // ---- Rescisao de contrato ----
  C.rescind = function (S, a) {
    const sq = C.squad(S, a.clubId);
    if (sq.length <= 11) return; // nao pode ficar com menos de 11
    const p = S.players.find(function (x) { return x.id === a.playerId && x.clubId === a.clubId; });
    if (!p) return;
    const c = C.clubById(S, a.clubId); if (!c) return;
    const fee = Math.round(p.value * 0.3 * 10) / 10; // multa rescisoria ~30% do valor
    c.budget = Math.round((c.budget - fee) * 10) / 10;
    S.players = S.players.filter(function (x) { return x.id !== p.id; });
    if (S.lineups[a.clubId]) S.lineups[a.clubId] = S.lineups[a.clubId].filter(function (id) { return id !== p.id; });
    S.feed.unshift('RESCISÃO: ' + p.name + ' deixou o ' + c.name + ' (multa ' + fee.toFixed(1) + ' mi)');
  };

  // ----------------- REDUCER CENTRAL -----------------
  C.applyAction = function (S, a) {
    S = JSON.parse(JSON.stringify(S)); // estado imutavel: trabalhamos sobre uma copia
    switch (a.type) {
      case 'PLAY_ROUND': C.playRound(S); break;
      case 'REQUEST_PLAY_ROUND':
        S.votes = S.votes || {};
        S.votes.playRound = S.votes.playRound || { round: S.round, names: [] };
        if (S.votes.playRound.round !== S.round) S.votes.playRound = { round: S.round, names: [] };
        if (a.name && S.votes.playRound.names.indexOf(a.name) < 0) S.votes.playRound.names.push(a.name);
        if ((a.required || 1) <= S.votes.playRound.names.length) { C.playRound(S); S.votes.playRound = null; }
        break;
      case 'PLAY_ALL': while (S.round <= S.totalRounds) C.playRound(S); break;
      case 'NEXT_SEASON': C.nextSeason(S); break;
      case 'CLAIM_CLUB': {
        S.controlled[a.clubId] = a.name;
        S.userClubs = S.userClubs || {};
        if (a.userId) {
          // remove qualquer vinculo anterior deste usuario
          Object.keys(S.userClubs).forEach(function (uid) {
            if (uid === String(a.userId)) delete S.userClubs[uid];
          });
          // e remove qualquer outro usuario vinculado a este clube
          Object.keys(S.userClubs).forEach(function (uid) {
            if (+S.userClubs[uid] === +a.clubId) delete S.userClubs[uid];
          });
          S.userClubs[String(a.userId)] = a.clubId;
        }
        delete S.fired[a.clubId];
        C.assignBoard(S, a.clubId);
        break;
      }
      case 'RELEASE_CLUB': {
        delete S.controlled[a.clubId];
        delete S.boards[a.clubId];
        delete S.fired[a.clubId];
        if (S.userClubs) {
          Object.keys(S.userClubs).forEach(function (uid) {
            if (+S.userClubs[uid] === +a.clubId) delete S.userClubs[uid];
          });
        }
        break;
      }
      case 'SET_LINEUP': S.lineups[a.clubId] = (a.lineup || []).slice(0, 11); break;
      case 'SET_TACTIC': S.tactics[a.clubId] = a.tactic; break;
      case 'SET_FORMATION': S.formations[a.clubId] = a.formation; break;
      case 'RESCIND': C.rescind(S, a); break;
      case 'TOGGLE_LISTED': C.toggleTransferList(S, a); break;
      case 'EXTEND_CONTRACT': C.extendContract(S, a); break;
      case 'OFFER_CREATE': C.createOffer(S, a); break;
      case 'OFFER_RESPOND': C.respondOffer(S, a); break;
      default: break;
    }
    return S;
  };
})();
