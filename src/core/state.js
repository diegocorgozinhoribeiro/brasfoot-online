// ==========================================================================
// core/state.js  -  Estado do jogo, helpers e REDUCER central (applyAction)
// --------------------------------------------------------------------------
// Toda mudanca no jogo passa por applyAction(S, action). Isso torna o estado
// previsivel e facil de sincronizar no modo online: o host aplica a acao e
// retransmite o novo estado para todos os clientes.
// Recursos: 2 divisoes (acesso/rebaixamento), escalacao 11 titulares + tatica,
// diretoria com metas (demissao), rescisao de contrato e mercado da IA.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const C = BF.core, D = BF.data;

  C.clubById = function (S, id) { return S.clubs.find(function (c) { return c.id === id; }); };
  C.squad = function (S, id) { return S.players.filter(function (p) { return p.clubId === id; }); };
  C.divClubs = function (S, div) { return S.clubs.filter(function (c) { return c.division === div; }); };

  // ---- Escalacao (XI titular) ----
  C.autoLineup = function (sq) {
    const byPos = {};
    sq.forEach(function (p) { (byPos[p.pos] = byPos[p.pos] || []).push(p); });
    Object.keys(byPos).forEach(function (k) { byPos[k].sort(function (a, b) { return b.ovr - a.ovr; }); });
    const need = D.LINEUP_NEED; const xi = []; const ids = {};
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
    return C.autoLineup(sq);
  };
  C.teamStrength = function (S, id) {
    const xi = C.lineupOf(S, id);
    if (!xi.length) return 60;
    return xi.reduce(function (s, p) { return s + p.ovr; }, 0) / xi.length;
  };
  C.teamObj = function (S, id) {
    const xi = C.lineupOf(S, id);
    const strength = xi.length ? xi.reduce(function (s, p) { return s + p.ovr; }, 0) / xi.length : 60;
    return {
      id: id, strength: strength,
      tactic: (S.tactics && S.tactics[id]) || 'equilibrado',
      squad: xi.map(function (p) { return { id: p.id, name: p.name, pos: p.pos }; })
    };
  };

  // ---- Diretoria / metas ----
  C.BOARD_TEXT = {
    title:      'Ser campeao da Serie A',
    top4:       'Terminar entre os 4 primeiros (vaga na Libertadores)',
    top10:      'Terminar na primeira metade da tabela',
    safe:       'Escapar do rebaixamento (fora dos 4 ultimos)',
    promoTitle: 'Conquistar o acesso a Serie A (entre os 2 primeiros)',
    promo:      'Conquistar o acesso a Serie A (entre os 4 primeiros)',
    safeB:      'Manter o clube na Serie B (fora dos 4 ultimos)'
  };
  C.boardTarget = function (type) {
    return { title: 1, top4: 4, top10: 10, safe: 16, promoTitle: 2, promo: 4, safeB: 16 }[type] || 10;
  };
  C.evalBoard = function (type, pos) { return pos > 0 && pos <= C.boardTarget(type); };
  C.assignBoard = function (S, id) {
    const c = C.clubById(S, id); if (!c) return;
    const peers = C.divClubs(S, c.division).slice().sort(function (a, b) { return b.strength - a.strength; });
    const rank = peers.findIndex(function (x) { return x.id === id; });
    let type;
    if (c.division === 1) {
      if (rank < 3) type = 'title';
      else if (rank < 7) type = 'top4';
      else if (rank < 13) type = 'top10';
      else type = 'safe';
    } else {
      if (rank < 4) type = 'promoTitle';
      else if (rank < 9) type = 'promo';
      else type = 'safeB';
    }
    S.boards[id] = { type: type, status: 'ongoing' };
  };

  // ---- Construcao do mundo ----
  function buildAllFixtures(S) {
    const d1 = C.divClubs(S, 1).map(function (c) { return c.id; });
    const d2 = C.divClubs(S, 2).map(function (c) { return c.id; });
    const fx1 = C.buildFixtures(d1).map(function (f) { f.div = 1; return f; });
    const fx2 = C.buildFixtures(d2).map(function (f) { f.div = 2; return f; });
    S.fixtures = fx1.concat(fx2);
    S.totalRounds = Math.max.apply(null, S.fixtures.map(function (f) { return f.round; }));
  }

  C.buildWorld = function (seed) {
    const rng = C.makeRng(C.hashSeed(seed));
    const clubs = D.CLUBS.map(function (c) { return Object.assign({}, c); });
    const players = C.genAllPlayers(clubs, rng);
    const S = {
      seed: seed, season: 1, year: 2026, round: 1, totalRounds: 1,
      clubs: clubs, players: players, fixtures: [],
      history: [], controlled: {}, negotiations: [], lastRound: null, feed: [], negId: 1,
      lineups: {}, tactics: {}, boards: {}, fired: {}
    };
    buildAllFixtures(S);
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

  C.playRound = function (S) {
    if (S.round > S.totalRounds) return;
    const r = S.round;
    const rng = C.makeRng(C.hashSeed(S.seed + '-r' + r + '-s' + S.season));
    const matches = [];
    S.fixtures.filter(function (f) { return f.round === r && !f.played; }).forEach(function (f) {
      const home = C.teamObj(S, f.homeId), away = C.teamObj(S, f.awayId);
      const res = C.simulateMatch(home, away, rng);
      f.hg = res.hg; f.ag = res.ag; f.played = true; f.upset = res.upset;
      res.scorers.home.concat(res.scorers.away).forEach(function (pid) {
        const p = S.players.find(function (x) { return x.id === pid; }); if (p) p.goals++;
      });
      matches.push({ homeId: f.homeId, awayId: f.awayId, hg: res.hg, ag: res.ag, upset: res.upset, div: f.div, events: res.events });
      if (res.upset) S.feed.unshift('ZEBRA! ' + C.clubById(S, f.homeId).name + ' ' + res.hg + ' x ' + res.ag + ' ' + C.clubById(S, f.awayId).name + ' (rod. ' + r + ')');
    });
    roundFinance(S, r);
    // O mundo segue para os times de IA tambem: janela de transferencias automatica
    const trng = C.makeRng(C.hashSeed(S.seed + '-tr' + r + '-s' + S.season));
    C.aiTransferWindow(S, trng);
    S.lastRound = { round: r, matches: matches };
    S.round++;
    if (S.round > S.totalRounds) endSeason(S);
  };

  function endSeason(S) {
    const t1 = C.computeTable(S, 1), t2 = C.computeTable(S, 2);
    const champ = C.clubById(S, t1[0].id); champ.titles++;
    const art = S.players.slice().sort(function (a, b) { return b.goals - a.goals; })[0];

    // Avaliacao das metas da diretoria (antes do rebaixamento alterar divisoes)
    Object.keys(S.controlled).forEach(function (idStr) {
      const id = +idStr; const c = C.clubById(S, id); if (!c) return;
      const tbl = c.division === 1 ? t1 : t2;
      const pos = tbl.findIndex(function (rr) { return rr.id === id; }) + 1;
      const b = S.boards[id]; if (!b) return;
      const met = C.evalBoard(b.type, pos);
      b.status = met ? 'met' : 'failed'; b.finalPos = pos;
      if (met) {
        S.feed.unshift('DIRETORIA: ' + c.name + ' cumpriu a meta da temporada (' + pos + 'o lugar).');
      } else {
        S.fired[id] = { clubName: c.name, year: S.year, board: b.type, pos: pos };
        delete S.controlled[id]; // o clube volta a ser controlado pela IA
        S.feed.unshift('DEMISSAO: a diretoria do ' + c.name + ' demitiu o tecnico (meta nao cumprida, ' + pos + 'o lugar).');
      }
    });

    // Acesso e rebaixamento
    const releg = t1.slice(-4).map(function (r) { return r.id; });
    const promo = t2.slice(0, 4).map(function (r) { return r.id; });
    releg.forEach(function (id) { C.clubById(S, id).division = 2; });
    promo.forEach(function (id) { C.clubById(S, id).division = 1; });

    S.history.unshift({
      year: S.year, championId: t1[0].id, championBId: t2[0].id,
      promoted: promo, relegated: releg,
      artil: art ? { name: art.name, goals: art.goals, clubId: art.clubId } : null
    });
    S.feed.unshift('FIM DA TEMPORADA ' + S.year + ': ' + champ.name + ' campeao da Serie A; ' + C.clubById(S, t2[0].id).name + ' campeao da Serie B.');
  }

  C.nextSeason = function (S) {
    S.season++; S.year++; S.round = 1;
    S.players.forEach(function (p) { p.goals = 0; p.age++; });
    buildAllFixtures(S);
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
    S.feed.unshift('RESCISAO: ' + p.name + ' deixou o ' + c.name + ' (multa ' + fee.toFixed(1) + ' mi)');
  };

  // ----------------- REDUCER CENTRAL -----------------
  C.applyAction = function (S, a) {
    S = JSON.parse(JSON.stringify(S)); // estado imutavel: trabalhamos sobre uma copia
    switch (a.type) {
      case 'PLAY_ROUND': C.playRound(S); break;
      case 'PLAY_ALL': while (S.round <= S.totalRounds) C.playRound(S); break;
      case 'NEXT_SEASON': C.nextSeason(S); break;
      case 'CLAIM_CLUB': S.controlled[a.clubId] = a.name; delete S.fired[a.clubId]; C.assignBoard(S, a.clubId); break;
      case 'RELEASE_CLUB': delete S.controlled[a.clubId]; delete S.boards[a.clubId]; delete S.fired[a.clubId]; break;
      case 'SET_LINEUP': S.lineups[a.clubId] = (a.lineup || []).slice(0, 11); break;
      case 'SET_TACTIC': S.tactics[a.clubId] = a.tactic; break;
      case 'RESCIND': C.rescind(S, a); break;
      case 'OFFER_CREATE': C.createOffer(S, a); break;
      case 'OFFER_RESPOND': C.respondOffer(S, a); break;
      default: break;
    }
    return S;
  };
})();
