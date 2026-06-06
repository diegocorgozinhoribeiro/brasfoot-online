// ==========================================================================
// core/transfers.js  -  Negociacoes: propostas, contrapropostas e mercado IA
// --------------------------------------------------------------------------
// Fluxo: o comprador cria uma proposta (OFFER_CREATE) por um jogador de outro
// clube. Se o vendedor for IA, a decisao e automatica (aceita/recusa/contra).
// Se for outro humano (online), fica pendente ate ele responder (OFFER_RESPOND).
// A cada rodada, aiTransferWindow() faz os clubes de IA proporem entre si e
// tambem para clubes humanos -> o mercado anda para todos.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

(function () {
  const C = BF.core;

  function isHuman(S, clubId) { return !!S.controlled[clubId]; }
  function clubName(S, id) { const c = C.clubById(S, id); return c ? c.name : 'Clube'; }

  function finalize(S, neg, price) {
    const p = S.players.find(function (x) { return x.id === neg.playerId; });
    if (!p) { neg.status = 'rejected'; return; }
    const buyer = C.clubById(S, neg.fromClubId), seller = C.clubById(S, neg.toClubId);
    if (buyer.budget < price) { neg.status = 'rejected'; neg.history.push({ by: 'Sistema', action: 'Comprador sem caixa suficiente' }); return; }
    if (C.squad(S, seller.id).length <= 11) { neg.status = 'rejected'; neg.history.push({ by: 'Sistema', action: 'Vendedor nao pode ficar com menos de 11' }); return; }
    buyer.budget = Math.round((buyer.budget - price) * 10) / 10;
    seller.budget = Math.round((seller.budget + price) * 10) / 10;
    // Reseta o estado do jogador ao mudar de clube: sai como recem-contratado,
    // fora da lista de negociacao, sem gols na temporada e energia cheia.
    p.clubId = buyer.id;
    S.__sv = (S.__sv || 0) + 1; // invalida o indice por-clube (jogador mudou de clube)
    p.goals = 0;
    p.listed = false;
    p.energy = 100;
    // conta a contratacao na temporada (usado nas metas da diretoria)
    S.signings = S.signings || {};
    S.signings[buyer.id] = (S.signings[buyer.id] || 0) + 1;
    // remove o jogador vendido da escalacao antiga
    if (S.lineups[seller.id]) S.lineups[seller.id] = S.lineups[seller.id].filter(function (id) { return id !== p.id; });
    neg.status = 'accepted'; neg.price = price;
    neg.history.push({ by: 'Sistema', action: 'Negócio fechado por ' + price.toFixed(1) + ' mi' });
    S.feed.unshift('TRANSFERÊNCIA: ' + p.name + ' -> ' + buyer.name + ' (' + price.toFixed(1) + ' mi)');
    // Outras propostas pendentes pelo mesmo jogador sao automaticamente
    // recusadas — evita venda duplicada e bug do dinheiro multiplicando.
    S.negotiations.forEach(function (other) {
      if (other.id === neg.id) return;
      if (other.playerId !== p.id) return;
      if (['pending', 'counter'].indexOf(other.status) < 0) return;
      other.status = 'rejected';
      other.history.push({ by: 'Sistema', action: 'Jogador foi vendido a outro clube' });
    });
  }

  // Decisao automatica da IA sobre uma proposta pendente (IA e a vendedora)
  function aiDecide(S, neg) {
    const p = S.players.find(function (x) { return x.id === neg.playerId; });
    if (!p) { neg.status = 'rejected'; return; }
    const fair = p.value, offer = neg.amount;
    const samePos = C.squad(S, neg.toClubId).filter(function (x) { return x.pos === p.pos; }).length;
    const eager = samePos > 3 ? 0.9 : 1.05; // sobra na posicao -> vende mais facil
    if (offer >= fair * 1.15 * eager) {
      finalize(S, neg, offer);
    } else if (offer >= fair * 0.6) {
      const counter = Math.round(Math.max(offer + 0.5, fair * 1.12 * eager) * 10) / 10;
      neg.amount = counter; neg.status = 'counter'; neg.turn = 'from';
      neg.history.push({ by: C.clubById(S, neg.toClubId).name, action: 'Contraproposta', amount: counter });
    } else {
      neg.status = 'rejected';
      neg.history.push({ by: C.clubById(S, neg.toClubId).name, action: 'Recusou a proposta' });
    }
  }

  C.createOffer = function (S, a) {
    const p = S.players.find(function (x) { return x.id === a.playerId; });
    if (!p || p.clubId === a.fromClubId) return;
    const amount = Math.round(a.amount * 10) / 10;
    const neg = {
      id: S.negId++, fromClubId: a.fromClubId, toClubId: p.clubId, playerId: p.id,
      playerName: p.name, amount: amount, status: 'pending', turn: 'to', byAI: !!a.byAI,
      history: [{ by: C.clubById(S, a.fromClubId).name, action: 'Proposta inicial', amount: amount }]
    };
    S.negotiations.unshift(neg);
    if (!isHuman(S, neg.toClubId)) aiDecide(S, neg); // vendedor IA decide na hora
    return neg;
  };

  C.respondOffer = function (S, a) {
    const neg = S.negotiations.find(function (n) { return n.id === a.negId; });
    if (!neg) return;
    if (['accepted', 'rejected', 'withdrawn'].indexOf(neg.status) >= 0) return;
    const actorClub = a.side === 'from' ? neg.fromClubId : neg.toClubId;
    const name = C.clubById(S, actorClub).name;
    if (a.decision === 'accept') {
      finalize(S, neg, neg.amount);
    } else if (a.decision === 'reject') {
      neg.status = 'rejected'; neg.history.push({ by: name, action: 'Recusou' });
    } else if (a.decision === 'withdraw') {
      neg.status = 'withdrawn'; neg.history.push({ by: name, action: 'Desistiu da negociação' });
    } else if (a.decision === 'counter') {
      neg.amount = Math.round(a.amount * 10) / 10;
      neg.history.push({ by: name, action: 'Contraproposta', amount: neg.amount });
      if (a.side === 'from') { // comprador contrapropos -> vendedor decide
        neg.turn = 'to'; neg.status = 'pending';
        if (!isHuman(S, neg.toClubId)) aiDecide(S, neg);
      } else { // vendedor contrapropos -> comprador decide
        neg.turn = 'from'; neg.status = 'counter';
        if (!isHuman(S, neg.fromClubId)) {
          const p = S.players.find(function (x) { return x.id === neg.playerId; });
          if (p && neg.amount <= p.value * 1.1) finalize(S, neg, neg.amount);
          else { neg.status = 'rejected'; neg.history.push({ by: C.clubById(S, neg.fromClubId).name, action: 'Recusou a contraproposta' }); }
        }
      }
    }
  };

  C.toggleTransferList = function (S, a) {
    const p = S.players.find(function (x) { return x.id === a.playerId && x.clubId === a.clubId; });
    if (!p) return;
    p.listed = !p.listed;
    S.feed.unshift((p.listed ? 'MERCADO: ' : 'MERCADO: ') + p.name + (p.listed ? ' foi colocado na lista de negociaveis.' : ' saiu da lista de negociaveis.'));
  };

  C.extendContract = function (S, a) {
    const p = S.players.find(function (x) { return x.id === a.playerId && x.clubId === a.clubId; });
    const c = C.clubById(S, a.clubId);
    if (!p || !c) return;
    const months = Math.max(6, Math.min(60, Math.round(a.months || 24)));
    const salary = Math.round(Math.max(0.01, a.salary || p.salary) * 1000) / 1000;
    const expected = Math.round((p.value * 0.018 + 0.045 + Math.max(0, p.ovr - 78) * 0.006) * 1000) / 1000;
    const rng = C.makeRng(C.hashSeed(S.seed + '-renew-' + p.id + '-' + S.round + '-' + S.season + '-' + salary));
    let chance = 0.25 + (salary / Math.max(0.01, expected) - 0.85) * 0.75;
    if (p.contract <= 12) chance += 0.12;
    if (months >= 36 && p.age <= 30) chance += 0.08;
    if (salary < p.salary) chance -= 0.35;
    chance = Math.max(0.05, Math.min(0.95, chance));
    if (rng() <= chance) {
      p.contract = months;
      p.salary = salary;
      p.listed = false;
      S.feed.unshift('CONTRATO: ' + p.name + ' renovou com o ' + c.name + ' por ' + months + ' meses.');
      S.lastContract = { ok: true, playerId: p.id, msg: p.name + ' aceitou a renovacao.' };
    } else {
      S.feed.unshift('CONTRATO: ' + p.name + ' recusou a proposta do ' + c.name + '.');
      S.lastContract = { ok: false, playerId: p.id, msg: p.name + ' recusou. Ele quer algo perto de ' + expected.toFixed(3) + ' mi/mes.' };
    }
  };

  // -------- MERCADO DA IA (roda a cada rodada) --------
  // Clubes de IA buscam reforcos para a posicao mais fraca do XI e fazem
  // propostas a OUTROS clubes (IA ou humanos). Negocios IA<->IA fecham na hora;
  // propostas a clubes humanos ficam pendentes para o jogador decidir.
  C.aiTransferWindow = function (S, rng) {
    const buyers = C.divClubs(S, 1).concat(C.divClubs(S, 2))
      .filter(function (c) { return !isHuman(S, c.id) && c.budget > 10; });
    // ordem deterministica embaralhada pelo rng da rodada
    buyers.sort(function () { return rng() - 0.5; });
    const picks = buyers.slice(0, 5);

    picks.forEach(function (buyer) {
      const xi = C.lineupOf(S, buyer.id);
      if (xi.length < 11) return;
      const weak = xi.slice().sort(function (a, b) { return a.ovr - b.ovr; })[0];
      let targets = S.players.filter(function (p) {
        return p.clubId !== buyer.id && p.pos === weak.pos && p.ovr > weak.ovr + 1 &&
          p.value <= buyer.budget * 0.8 && C.squad(S, p.clubId).length > 11;
      });
      if (!targets.length) return;
      // FORTE priorização para jogadores na lista ("Negociar")
      targets.sort(function (a, b) {
        return (b.listed ? 50 : 0) - (a.listed ? 50 : 0) ||
          (a.contract <= 12 ? -6 : 0) - (b.contract <= 12 ? -6 : 0) ||
          b.ovr - a.ovr;
      });
      // Maior chance de cair em um listado quando ele está no top da lista
      const tgt = targets[Math.floor(rng() * Math.min(targets[0] && targets[0].listed ? 3 : 5, targets.length))];
      const discount = tgt.listed ? 0.85 : (tgt.contract <= 12 ? 0.95 : 1);
      const amount = Math.round(tgt.value * discount * (1.02 + rng() * 0.2) * 10) / 10;
      const neg = C.createOffer(S, { fromClubId: buyer.id, playerId: tgt.id, amount: amount, byAI: true });
      // Se o vendedor IA fez contraproposta, o comprador IA avalia automaticamente
      if (neg && neg.status === 'counter' && !isHuman(S, neg.fromClubId)) {
        if (neg.amount <= tgt.value * 1.15 && buyer.budget >= neg.amount) C.respondOffer(S, { negId: neg.id, side: 'from', decision: 'accept' });
        else C.respondOffer(S, { negId: neg.id, side: 'from', decision: 'reject' });
      }
    });

    // Passe extra: para cada jogador LISTADO de um clube humano, gera até 1 proposta IA
    // (clubes da IA "vêem" os listados e tendem a abordar).
    const listedHumanPlayers = S.players.filter(function (p) {
      return p.listed && isHuman(S, p.clubId);
    });
    listedHumanPlayers.forEach(function (p) {
      if (rng() > 0.55) return; // ~45% por listado por rodada
      const candidateBuyers = C.divClubs(S, 1).concat(C.divClubs(S, 2)).filter(function (c) {
        return !isHuman(S, c.id) && c.id !== p.clubId && c.budget > p.value * 0.9;
      });
      if (!candidateBuyers.length) return;
      const buyer = candidateBuyers[Math.floor(rng() * candidateBuyers.length)];
      const amount = Math.round(p.value * (0.85 + rng() * 0.18) * 10) / 10;
      C.createOffer(S, { fromClubId: buyer.id, playerId: p.id, amount: amount, byAI: true });
    });

    // mantem o historico de negociacoes enxuto
    if (S.negotiations.length > 80) S.negotiations = S.negotiations.slice(0, 80);
  };
})();
