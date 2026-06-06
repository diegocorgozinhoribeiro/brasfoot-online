// ==========================================================================
// ui/app.js  -  Roteamento de abas e renderizacao de todas as telas
// ==========================================================================
window.BF = window.BF || {};
BF.ui = BF.ui || {};

(function () {
  const C = BF.core, U = BF.ui, D = BF.data;
  let tab = 'home';
  function S() { return BF.G.S; }
  function myId() { return BF.me.clubId; }
  function $(s) { return document.querySelector(s); }
  function myClub() { return C.clubById(S(), myId()); }
  function isFired() { return !!(S() && S().fired && S().fired[myId()]); }
  function hasClub() { return !!myClub() && !!S().controlled[myId()]; }
  function myDiv() { const c = myClub(); return c ? c.division : 1; }
  function divName(d) { return d === 1 ? 'Série A' : (d === 2 ? 'Série B' : 'Internacional'); }
  function currentFormation(clubId) { return (S().formations && S().formations[clubId]) || '4-4-2'; }
  function raceLabel(div, pos) {
    if (div === 1) {
      if (pos <= 6) return 'Libertadores';
      if (pos <= 12) return 'Sul-Americana';
      if (pos >= 17) return 'Rebaixamento';
      return 'Série A';
    }
    if (pos <= 4) return 'Acesso';
    if (pos >= 17) return 'Risco';
    return 'Série B';
  }
  function cupName(key) {
    return C.CUP_DEFS && C.CUP_DEFS[key] ? C.CUP_DEFS[key].name : key;
  }
  function cupShort(key) {
    return C.CUP_DEFS && C.CUP_DEFS[key] ? C.CUP_DEFS[key].short : key;
  }
  function enColor(p) { const e = C.energyOf(p); return e >= 70 ? 'var(--green)' : (e >= 40 ? 'var(--gold)' : 'var(--red)'); }
  // Metadados da competicao de um jogo (rotulo + classe de cor)
  function compMeta(g) {
    if (g.kind === 'league') return { label: 'Brasileirão • ' + (g.div === 2 ? 'Série B' : 'Série A'), cls: 'comp-green' };
    if (g.kind === 'copaBrasil') return { label: 'Copa do Brasil', cls: 'comp-blue' };
    if (g.kind === 'libertadores') return { label: 'Libertadores', cls: 'comp-red' };
    if (g.kind === 'sulamericana') return { label: 'Sul-Americana', cls: 'comp-red' };
    return { label: 'Jogo', cls: '' };
  }
  // Jogos de um clube numa rodada (liga + copas)
  function gamesForClubInRound(s, clubId, r) {
    const out = [];
    s.fixtures.filter(function (f) { return f.round === r && (f.homeId === clubId || f.awayId === clubId); }).forEach(function (f) { out.push({ kind: 'league', f: f, div: f.div }); });
    Object.keys(s.cups || {}).forEach(function (key) {
      (s.cups[key].fixtures || []).filter(function (f) { return f.round === r && (f.homeId === clubId || f.awayId === clubId); }).forEach(function (f) { out.push({ kind: key, f: f }); });
    });
    return out;
  }
  // Proximo jogo do clube (a partir da rodada atual)
  function nextGameOf(s, clubId) {
    for (let r = s.round; r <= s.totalRounds; r++) {
      const g = gamesForClubInRound(s, clubId, r).filter(function (x) { return !x.f.played; });
      if (g.length) return { round: r, games: g };
    }
    return null;
  }

  U.flash = function (msg, err) {
    const f = $('#flash'); if (!f) return;
    f.textContent = msg; f.className = 'flash show' + (err ? ' err' : '');
    setTimeout(function () { f.className = 'flash'; }, 1900);
  };
  U.setTab = function (t) {
    tab = t;
    const nav = $('#tabs'); if (nav) nav.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === t); });
    U.render();
  };
  U.initTabs = function () {
    const nav = $('#tabs');
    nav.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { U.setTab(b.dataset.tab); };
    });
  };

  // ---------- helpers ----------
  function stat(label, val, cls) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="val ' + (cls || '') + ' ' + (String(val).length > 6 ? 'sm' : '') + '">' + val + '</div></div>';
  }
  function matchRow(f) {
    const s = S();
    const h = C.clubById(s, f.homeId), a = C.clubById(s, f.awayId);
    const mine = f.homeId === myId() || f.awayId === myId();
    const pen = f.penalty ? '<span class="pen">p</span>' : '';
    const sc = f.played ? '<div class="score' + (f.upset ? ' up' : '') + '">' + f.hg + ' - ' + f.ag + pen + '</div>' : '<div class="score tbd">x</div>';
    return '<div class="match ' + (mine ? 'me' : '') + '"><div class="home">' + U.badge(h) + '<span class="nm">' + h.name + '</span></div>' + sc +
      '<div class="away"><span class="nm">' + a.name + '</span>' + U.badge(a) + '</div></div>';
  }
  function miniTable(rows) {
    const s = S();
    return '<div class="tbl-wrap"><table><thead><tr><th class="c">#</th><th>Clube</th><th class="c">P</th><th class="c">J</th><th class="c">SG</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        const c = C.clubById(s, r.id);
        return '<tr class="' + (r.id === myId() ? 'me' : '') + '"><td class="c">' + (i + 1) + '</td><td><div class="club-cell">' + U.badge(c) + c.name + '</div></td><td class="c">' + r.P + '</td><td class="c">' + r.J + '</td><td class="c">' + (r.SG > 0 ? '+' : '') + r.SG + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function firedBanner() {
    const info = S().fired[myId()];
    return '<div class="card fired"><h2>\ud83d\udea8 Você foi demitido</h2>' +
      '<p>A diretoria do <b>' + (info.clubName) + '</b> encerrou seu contrato por não cumprir a meta da temporada (' + info.pos + 'º lugar).</p>' +
      '<button class="btn gold" id="newClubBtn">Procurar um novo clube</button></div>';
  }

  function needsMyAction(n) {
    if (['accepted', 'rejected', 'withdrawn'].indexOf(n.status) >= 0) return false;
    if (n.status === 'pending' && n.toClubId === myId()) return true;
    if (n.status === 'counter' && n.fromClubId === myId()) return true;
    return false;
  }
  function myNegotiations() {
    return (S().negotiations || []).filter(function (n) { return n.fromClubId === myId() || n.toClubId === myId(); });
  }

  // ---------- HOME ----------
  function viewHome() {
    const s = S();
    if (isFired()) return firedBanner();
    const me = myClub();
    if (!me || !hasClub()) return '<div class="card"><div class="empty">Voce ainda nao controla um clube.<br>Va na aba <b>Party</b> e escolha um time.</div></div>';
    const tb = C.computeTable(s, me.division);
    const pos = tb.findIndex(function (r) { return r.id === me.id; }) + 1;
    const row = tb.find(function (r) { return r.id === me.id; }) || { P: 0 };
    const done = s.round > s.totalRounds;
    const thisRound = done ? [] : gamesForClubInRound(s, me.id, s.round).filter(function (g) { return !g.f.played; });
    const nextG = done ? null : nextGameOf(s, me.id);
    const feed = (s.feed || []).slice(0, 7);
    const b = s.boards[me.id];
    return '<div class="stat-row">' +
      stat('Divisão', divName(me.division)) +
      stat(done ? 'Status' : 'Rodada', done ? 'Fim' : s.round + '/' + s.totalRounds) +
      stat('Posição', pos + 'º') +
      stat('Destino', raceLabel(me.division, pos)) +
      stat('Pontos', row.P) +
      stat('Caixa', U.fmtM(me.budget), me.budget < 0 ? 'neg' : 'money') +
      '</div>' +
      '<div class="grid" style="gap:16px">' +
        nextMatchCard(s, me, nextG, done) +
        '<div class="card"><div class="row-between"><h2 style="margin:0">\u26a1 Controle de jogo</h2><span class="muted">' + me.name + ' \u2022 força do XI ' + Math.round(C.teamStrength(s, me.id)) + ' \u2022 ' + (C.TACTICS[s.tactics[me.id] || 'equilibrado'].label) + '</span></div>' +
          (done
            ? '<p class="muted" style="margin-bottom:12px">Temporada encerrada. Veja o histórico e comece a próxima.</p><button class="btn gold" id="nextSeasonBtn">\u25b6 Iniciar temporada ' + (s.year + 1) + '</button>'
            : (thisRound.length ? '' : '<div class="watch-note">\ud83d\udd2d Seu time não joga a ' + s.round + 'ª rodada. Avance para acompanhar os outros jogos.</div>') + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" id="playBtn">\u25b6 ' + playButtonLabel(s) + '</button></div>' + voteLine(s)) +
        '</div>' +
        (b ? boardMini(s, me, b, pos) : '') +
        (!done && thisRound.length ? '<div class="card"><h2>\ud83d\udcc5 Seus jogos na ' + s.round + 'ª rodada</h2><div class="matchlist">' + thisRound.map(function (g) { return matchRowComp(g); }).join('') + '</div></div>' : '') +
        (feed.length ? '<div class="card"><h2>\ud83d\udcf0 Notícias</h2>' + feed.map(function (f) { return '<div class="news">' + U.esc(f) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="card"><h2>\ud83c\udfc6 Top 5 \u2014 ' + divName(me.division) + '</h2>' + miniTable(tb.slice(0, 5)) + '</div>' +
      '</div>';
  }
  function boardMini(s, me, b, pos) {
    const score = Math.round(C.boardScore(s, me.id, pos) * 100);
    const cls = score >= 60 ? 'ok' : 'warn';
    return '<div class="card board-mini"><div class="row-between"><h2 style="margin:0">\ud83c\udfdb\ufe0f Metas da diretoria</h2><span class="obj-chip ' + cls + '">' + score + '% \u2022 meta 60%</span></div>' +
      '<div class="obj-list">' + (b.objectives || []).map(function (o) {
        const p = Math.round(C.evalObjective(s, me.id, o, pos) * 100);
        return '<div class="obj-item"><span class="obj-lbl">' + o.label + '</span><div class="obj-bar"><i style="width:' + Math.max(4, p) + '%;background:' + (p >= 60 ? 'var(--green)' : 'var(--gold)') + '"></i></div><b>' + p + '%</b></div>';
      }).join('') + '</div></div>';
  }
  function nextMatchCard(s, me, nextG, done) {
    if (done) return '';
    if (!nextG) return '<div class="card next-match"><h2>\ud83d\udcc5 Próximo jogo</h2><div class="empty">Sem jogos restantes nesta temporada.</div></div>';
    const cards = nextG.games.map(function (g) {
      const meta = compMeta(g);
      const oppId = g.f.homeId === me.id ? g.f.awayId : g.f.homeId;
      const opp = C.clubById(s, oppId);
      const homeAway = g.f.homeId === me.id ? '\ud83c\udfe0 Mando de campo' : '\u2708\ufe0f Fora de casa';
      const stage = g.f.stageName ? ' \u2022 ' + g.f.stageName : '';
      const roundLabel = g.round === s.round ? 'Rodada ' + s.round + ' \u2014 esta rodada' : 'Rodada ' + g.round;
      return '<div class="nm-card ' + meta.cls + '"><div class="nm-comp">' + meta.label + stage + '</div>' +
        '<div class="nm-round">\u26bd ' + roundLabel + '</div>' +
        '<div class="nm-teams">' + U.badge(me, 'lg') + '<span class="nm-vs">VS</span>' + U.badge(opp, 'lg') + '</div>' +
        '<div class="nm-opp">vs <b>' + (opp ? opp.name : '-') + '</b></div>' +
        '<div class="nm-info muted">' + homeAway + '</div></div>';
    }).join('');
    return '<div class="card next-match"><h2>\ud83d\udcc5 Próximo jogo</h2><div class="nm-grid">' + cards + '</div></div>';
  }
  function matchRowComp(g) {
    const meta = compMeta(g);
    return '<div class="comp-row ' + meta.cls + '"><span class="comp-pill">' + meta.label + (g.f.stageName ? ' \u2022 ' + g.f.stageName : '') + '</span>' + matchRow(g.f) + '</div>';
  }

  function voteLine(s) {
    const t = BF.G.transport;
    if (!t || t.role === 'solo') return '';
    const v = s.votes && s.votes.playRound && s.votes.playRound.round === s.round ? s.votes.playRound : null;
    const required = Math.max(1, Math.ceil(Math.max(1, (BF.G.members || []).length) * 2 / 3));
    return '<p class="muted" style="margin-top:10px">Votação para iniciar: ' + (v ? v.names.length : 0) + '/' + required + (v && v.names.length ? ' - ' + v.names.map(U.esc).join(', ') : '') + '</p>';
  }
  function playButtonLabel(s) {
    const t = BF.G.transport;
    if (!t || t.role === 'solo') return 'Pré-Iniciar a ' + s.round + 'ª rodada';
    return 'Pré-Iniciar a ' + s.round + 'ª rodada (votação)';
  }

  // ---------- PRE-INICIAR (modal de revisão antes da simulação) ----------
  function openPreRound() {
    const s = S(); const me = myClub();
    if (!me || s.round > s.totalRounds) return;
    const formKey = currentFormation(me.id);
    const form = D.FORMATIONS[formKey] || D.FORMATIONS['4-4-2'];
    const xi = C.lineupOf(s, me.id);
    const xiById = {}; xi.forEach(function (p) { xiById[p.id] = p; });
    const bench = C.benchOf(s, me.id);
    const myGames = gamesForClubInRound(s, me.id, s.round).filter(function (g) { return !g.f.played; });
    const curTac = s.tactics[me.id] || 'equilibrado';

    let si = 0;
    const pitch = '<div class="pitch lines small" style="max-width:520px;margin:8px auto">' + form.lines.map(function (line) {
      const cells = line.map(function (pos) {
        const p = xi[si++];
        return '<div class="slot"><span class="slot-pos">' + pos + '</span>' + (p ? '<button class="player-chip" tabindex="-1">' + U.esc(p.name.split(" ").pop()) + '<b>' + p.ovr + '</b><i class="chip-en" style="width:' + C.energyOf(p) + '%"></i></button>' : '<em>vazio</em>') + '</div>';
      }).join('');
      return '<div class="pitch-line">' + cells + '</div>';
    }).reverse().join('') + '</div>';

    const matchHtml = myGames.length ? myGames.map(function (g) {
      const meta = compMeta(g);
      const oppId = g.f.homeId === me.id ? g.f.awayId : g.f.homeId;
      const opp = C.clubById(s, oppId);
      return '<div class="pr-matchcard ' + meta.cls + '"><div class="opp"><div class="nm-comp" style="font-size:11px;color:var(--faint);margin-bottom:4px">' + meta.label + (g.f.stageName ? ' • ' + g.f.stageName : '') + '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' + U.badge(me, 'lg') + '<span class="vs">×</span>' + U.badge(opp, 'lg') + '<b>' + (opp ? opp.name : '-') + '</b></div>' +
        '<p class="muted" style="margin:6px 0 0">' + (g.f.homeId === me.id ? 'Mando de campo' : 'Fora de casa') + '</p></div></div>';
    }).join('') : '<div class="notion-callout">Seu time não joga esta rodada — você vai apenas acompanhar os jogos dos demais.</div>';

    const benchTxt = bench.slice(0, 7).map(function (p) { return p.name.split(' ').pop() + ' (' + p.pos + ')'; }).join(', ');

    const ov = document.createElement('div');
    ov.className = 'overlay';
    // Trava: o clube so pode entrar em campo se tiver 11 titulares escalados.
    // (Se o time nao joga essa rodada, nao precisa de escalacao completa.)
    const needsLineup = myGames.length > 0;
    const lineupOk = !needsLineup || xi.length >= form.slots.length;
    const startDisabled = lineupOk ? '' : ' disabled';
    const startLabel = lineupOk ? '▶ Iniciar rodada' : '▶ Escalação incompleta';
    const lineupWarn = !lineupOk
      ? '<div class="notion-callout warn" style="margin:8px 0;border-left:3px solid #ef4444;background:rgba(239,68,68,.08);padding:8px 12px;border-radius:8px">⚠ Escale <b>' + form.slots.length + '</b> jogadores de campo para iniciar a partida. Faltam <b>' + (form.slots.length - xi.length) + '</b>.</div>'
      : '';

    ov.innerHTML = '<div class="modal pre-round-modal">' +
      '<div class="pr-head">' + U.badge(me, 'lg') + '<h1>Pré-Iniciar — ' + s.round + 'ª rodada</h1></div>' +
      matchHtml +
      lineupWarn +
      '<div class="pr-info">' +
        '<div class="row"><span class="muted">Formação</span><b>' + form.label + '</b></div>' +
        '<div class="row"><span class="muted">Estilo de jogo</span><b>' + C.TACTICS[curTac].label + '</b></div>' +
        '<div class="row"><span class="muted">Titulares</span><b' + (lineupOk ? '' : ' style="color:#ef4444"') + '>' + xi.length + '/' + form.slots.length + ' • força ' + Math.round(C.teamStrength(s, me.id)) + '</b></div>' +
        '<div class="row"><span class="muted">Banco</span><b>' + (benchTxt || 'sem reservas') + '</b></div>' +
      '</div>' +
      pitch +
      '<div class="md-actions">' +
        '<button class="btn" id="prBack">← Voltar</button>' +
        '<button class="btn" id="prLineup">Ajustar escalação</button>' +
        '<button class="btn primary" id="prStart"' + startDisabled + '>' + startLabel + '</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) document.body.removeChild(ov); });
    ov.querySelector('#prBack').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#prLineup').onclick = function () { document.body.removeChild(ov); U.setTab('lineup'); };
    ov.querySelector('#prStart').onclick = function () {
      if (!lineupOk) {
        alert('Escale ' + form.slots.length + ' jogadores de campo antes de iniciar a partida.');
        return;
      }
      document.body.removeChild(ov);
      if (BF.showRoundWaiting) BF.showRoundWaiting(function () { BF.requestPlayRound(); });
      else BF.requestPlayRound();
    };
  }
  BF.openPreRound = openPreRound;

  // ---------- ELENCO (com rescisao) ----------
  function viewSquad() {
    const s = S(); const me = myClub();
    if (!me || isFired()) return isFired() ? firedBanner() : '<div class="card"><div class="empty">Escolha um clube na aba Party.</div></div>';
    const order = D.POS_ORDER;
    const sq = C.squad(s, me.id).slice().sort(function (a, b) { return order.indexOf(a.pos) - order.indexOf(b.pos) || b.ovr - a.ovr; });
    const xiIds = {}; C.lineupOf(s, me.id).forEach(function (p) { xiIds[p.id] = 1; });
    const folha = sq.reduce(function (t, p) { return t + p.salary; }, 0);
    return '<div class="stat-row">' +
      stat('Jogadores', sq.length) +
      stat('Força (XI)', Math.round(C.teamStrength(s, me.id))) +
      stat('Folha mensal', U.fmtM(folha), 'neg') +
      stat('Valor do elenco', U.fmtM(sq.reduce(function (t, p) { return t + p.value; }, 0)), 'money') +
      '</div>' +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udc65 Elenco do ' + me.name + '</h2><span class="muted">\u2b50 = titular \u2022 contratos curtos atraem a IA</span></div><div class="tbl-wrap"><table><thead><tr><th></th><th>Jogador</th><th class="c">Pos</th><th class="c">OVR</th><th class="c">Idade</th><th class="c">Gols</th><th class="c">Energia</th><th class="c">Contrato</th><th class="c">Salário</th><th class="c">Valor</th><th></th></tr></thead><tbody>' +
      sq.map(function (p) {
        return '<tr><td class="c">' + (xiIds[p.id] ? '\u2b50' : '') + '</td><td>' + U.esc(p.name) + (p.listed ? ' <span class="pill">neg</span>' : '') + '</td><td class="c">' + U.ptag(p.pos) + '</td><td class="c"><span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span></td><td class="c">' + p.age + '</td><td class="c">' + p.goals + '</td><td class="c"><span class="en-cell"><i style="width:' + C.energyOf(p) + '%;background:' + enColor(p) + '"></i></span> <small>' + C.energyOf(p) + '</small></td><td class="c ' + ((p.contract || 0) <= 12 ? 'neg' : '') + '">' + (p.contract || 0) + 'm</td><td class="c">' + U.fmtM(p.salary) + '</td><td class="c">' + U.fmtM(p.value) + '</td><td class="c squad-actions"><button class="btn sm renewBtn" data-id="' + p.id + '">Renovar</button><button class="btn sm listBtn" data-id="' + p.id + '">' + (p.listed ? 'Tirar lista' : 'Negociar') + '</button><button class="btn sm red rescBtn" data-id="' + p.id + '" ' + (sq.length <= 11 ? 'disabled' : '') + '>Rescindir</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  // ---------- ESCALACAO + TATICA ----------
  // Alinha um array de ids às posições dos slots da formação.
  // Sai com tamanho = slotsPos.length; 0 indica slot vazio (sem shift ao remover).
  function buildSlotAligned(slotsPos, sq, ids) {
    const slots = slotsPos.map(function () { return 0; });
    const used = {};
    (ids || []).forEach(function (id) {
      if (!id || used[id]) return;
      const p = sq.find(function (x) { return x.id === id; });
      if (!p) return;
      let i = -1;
      for (let k = 0; k < slotsPos.length; k++) { if (!slots[k] && slotsPos[k] === p.pos) { i = k; break; } }
      if (i >= 0) { slots[i] = id; used[id] = 1; }
    });
    (ids || []).forEach(function (id) {
      if (!id || used[id]) return;
      const i = slots.findIndex(function (s) { return !s; });
      if (i >= 0) { slots[i] = id; used[id] = 1; }
    });
    return slots;
  }
  BF._buildSlotAligned = buildSlotAligned;

  function viewLineup() {
    const s = S(); const me = myClub();
    if (!me || isFired()) return isFired() ? firedBanner() : '<div class="card"><div class="empty">Escolha um clube na aba Party.</div></div>';
    const sq = C.squad(s, me.id).slice().sort(function (a, b) { return D.POS_ORDER.indexOf(a.pos) - D.POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr; });
    const formKey = currentFormation(me.id);
    const form = D.FORMATIONS[formKey] || D.FORMATIONS["4-4-2"];
    const slotsPos = form.slots;
    if (!BF._lineupSel || BF._lineupSel.length !== slotsPos.length || BF._lineupSelForm !== formKey) {
      const baseIds = ((s.lineups && s.lineups[me.id] && s.lineups[me.id].length) ? s.lineups[me.id] : C.autoLineup(sq, form.need).map(function (p) { return p.id; }))
        .filter(function (id) { return sq.find(function (x) { return x.id === id; }); });
      BF._lineupSel = buildSlotAligned(slotsPos, sq, baseIds);
      BF._lineupSelForm = formKey;
    }
    const sel = BF._lineupSel;
    const counts = {}; D.POS_ORDER.forEach(function (p) { counts[p] = 0; });
    sel.forEach(function (id) { if (!id) return; const p = sq.find(function (x) { return x.id === id; }); if (p) counts[p.pos]++; });
    const selOvr = sel.filter(Boolean).map(function (id) { const p = sq.find(function (x) { return x.id === id; }); return p ? p.ovr : 0; });
    const filled = selOvr.length;
    const avg = filled ? Math.round(selOvr.reduce(function (a, b) { return a + b; }, 0) / filled) : 0;
    const curTac = s.tactics[me.id] || 'equilibrado';

    const tac = '<div class="card"><h2>\u2699\ufe0f Tática</h2><div class="tac-grid">' +
      C.TACTIC_KEYS.map(function (k) {
        const t = C.TACTICS[k];
        return '<button class="tac ' + (k === curTac ? 'sel' : '') + '" data-tac="' + k + '"><b>' + t.label + '</b><span>' + t.desc + '</span></button>';
      }).join('') + '</div></div>';

    // Agrupa o banco/elenco por linha (Goleiros / Defesa / Meio / Ataque)
    // para deixar a triagem mais clara.
    const POS_GROUPS = [
      { key: 'GOL', label: '\ud83e\uddef Goleiros', poses: ['GOL'] },
      { key: 'DEF', label: '\ud83d\udee1\ufe0f Defesa',  poses: ['ZAG', 'LAT'] },
      { key: 'MEI', label: '\u2699\ufe0f Meio-campo', poses: ['VOL', 'MEI'] },
      { key: 'ATA', label: '\ud83d\udd25 Ataque',  poses: ['ATA'] }
    ];
    function rowHtml(p) {
      const on = sel.indexOf(p.id) >= 0;
      return '<label class="pick-row ' + (on ? 'on' : '') + '" draggable="true" data-id="' + p.id + '"><input type="checkbox" class="lpick" data-id="' + p.id + '" ' + (on ? 'checked' : '') + '>' +
        '<span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span>' + U.ptag(p.pos) +
        '<span class="pn">' + U.esc(p.name) + '</span><span class="en-mini" title="Energia ' + C.energyOf(p) + '"><i style="width:' + C.energyOf(p) + '%;background:' + enColor(p) + '"></i></span><span class="pa muted">' + p.age + ' anos</span></label>';
    }
    const rows = POS_GROUPS.map(function (g) {
      const sub = sq.filter(function (p) { return g.poses.indexOf(p.pos) >= 0; });
      if (!sub.length) return '';
      const onCount = sub.filter(function (p) { return sel.indexOf(p.id) >= 0; }).length;
      return '<div class="pick-group" data-group="' + g.key + '"><div class="pick-group-h"><span>' + g.label + '</span><span class="muted">' + onCount + ' / ' + sub.length + '</span></div>' +
        sub.map(rowHtml).join('') + '</div>';
    }).join('');

    const balance = D.POS_ORDER.map(function (pos) {
      const c = counts[pos];
      return '<span class="bal ' + (c >= (pos === 'GOL' ? 1 : 0) ? '' : 'low') + '">' + U.ptag(pos) + ' ' + c + '</span>';
    }).join('');

    let __si = 0;
    const pitch = '<div class="pitch lines" id="pitch">' + form.lines.map(function (line) {
      const cells = line.map(function (pos) {
        const i = __si++;
        const p = sel[i] ? sq.find(function (x) { return x.id === sel[i]; }) : null;
        return '<div class="slot" data-slot="' + i + '" data-pos="' + pos + '"><span class="slot-pos">' + pos + '</span>' + (p ? '<button draggable="true" class="player-chip" data-id="' + p.id + '">' + U.esc(p.name) + '<b>' + p.ovr + '</b><i class="chip-en" style="width:' + C.energyOf(p) + '%"></i></button>' : '<em>vazio</em>') + '</div>';
      }).join('');
      return '<div class="pitch-line">' + cells + '</div>';
    }).reverse().join('') + '</div>';
    const formBtns = '<div class="formation-switch">' + Object.keys(D.FORMATIONS).map(function (k) {
      return '<button class="formBtn ' + (k === formKey ? 'active' : '') + '" data-form="' + k + '">' + D.FORMATIONS[k].label + '</button>';
    }).join('') + '</div>';

    return tac +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udccb Escalação (' + filled + '/' + slotsPos.length + ')</h2><span class="muted">Força do XI: <b>' + avg + '</b> \u2022 arraste do banco direto para o campo</span></div>' +
      formBtns +
      pitch +
      '<div class="balance">' + balance + '</div>' +
      '<div class="lineup-actions"><button class="btn sm" id="autoLineup">Preencher automático</button><button class="btn sm" id="clearLineup">Limpar</button>' +
      '<button class="btn primary" id="saveLineup" ' + (filled === slotsPos.length ? '' : 'disabled') + '>Salvar escalação</button></div>' +
      (counts.GOL < 1 ? '<p class="warn-txt">\u26a0\ufe0f Escale ao menos 1 goleiro.</p>' : '') +
      '<div class="pick-list">' + rows + '</div></div>';
  }

  // ---------- TABELA (com divisao) ----------
  function viewTable() {
    const s = S(); const div = BF._tableDiv || myDiv(); BF._tableDiv = div;
    const tb = C.computeTable(s, div);
    const isA = div === 1;
    return '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83c\udfc6 Classificação</h2>' + divSwitch('tableDiv', div) + '</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th class="c">#</th><th>Clube</th><th class="c">Pts</th><th class="c">J</th><th class="c">V</th><th class="c">E</th><th class="c">D</th><th class="c">GP</th><th class="c">GC</th><th class="c">SG</th></tr></thead><tbody>' +
      tb.map(function (r, i) {
        const c = C.clubById(s, r.id);
        let z = '';
        if (isA) z = i < 6 ? 'zone-lib' : (i < 12 ? 'zone-sul' : (i >= 16 ? 'zone-reb' : ''));
        else z = i < 4 ? 'zone-promo' : '';
        return '<tr class="' + (r.id === myId() ? 'me ' : '') + z + '"><td class="c">' + (i + 1) + '</td><td><div class="club-cell">' + U.badge(c) + c.name + '</div></td><td class="c"><b>' + r.P + '</b></td><td class="c">' + r.J + '</td><td class="c">' + r.V + '</td><td class="c">' + r.E + '</td><td class="c">' + r.D + '</td><td class="c">' + r.GP + '</td><td class="c">' + r.GC + '</td><td class="c">' + (r.SG > 0 ? '+' : '') + r.SG + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (isA
        ? '<div class="legend"><span><i class="dot" style="background:var(--blue)"></i>Libertadores</span><span><i class="dot" style="background:var(--green)"></i>Sul-Americana</span><span><i class="dot" style="background:var(--red)"></i>Rebaixamento</span></div>'
        : '<div class="legend"><span><i class="dot" style="background:var(--gold)"></i>Zona de acesso à Série A</span></div>') +
      '</div>';
  }
  function divSwitch(key, cur) {
    return '<div class="div-switch sm" data-key="' + key + '"><button class="' + (cur === 1 ? 'active' : '') + '" data-div="1">Série A</button><button class="' + (cur === 2 ? 'active' : '') + '" data-div="2">Série B</button></div>';
  }

  // ---------- COMPETICOES (classificação + copas em uma aba só) ----------
  function viewComp() {
    const s = S();
    if (C.ensureSeasonCups) C.ensureSeasonCups(s);
    const order = C.CUP_ORDER || [];
    let sub = BF._compSub || 'table';
    if (sub !== 'table' && order.indexOf(sub) < 0) sub = 'table';
    BF._compSub = sub;
    const nav = '<div class="comp-subnav"><button class="comp-subtab ' + (sub === 'table' ? 'active' : '') + '" data-sub="table">Classificação</button>' +
      order.map(function (k) { return '<button class="comp-subtab ' + (sub === k ? 'active' : '') + '" data-sub="' + k + '">' + cupShort(k) + '</button>'; }).join('') + '</div>';
    let body;
    if (sub === 'table') body = viewTable();
    else { BF._cupKey = sub; body = viewCups(); }
    return '<div class="card comp-head"><h2 style="margin:0">\ud83c\udfc6 Competições</h2><p class="muted">Classificação do Brasileirão e o chaveamento das copas, tudo em um só lugar.</p>' + nav + '</div>' + body;
  }

  // ---------- JOGOS ----------
  function viewFixtures() {
    const s = S(); const div = BF._fixDiv || myDiv(); BF._fixDiv = div;
    let opts = '';
    const cur = Math.min(s.round, s.totalRounds);
    for (let r = 1; r <= s.totalRounds; r++) opts += '<option value="' + r + '" ' + (r === cur ? 'selected' : '') + '>' + r + 'ª rodada' + (r < s.round ? ' (jogada)' : '') + '</option>';
    return '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udcc5 Calendário de jogos</h2><div style="display:flex;gap:8px;align-items:center">' + divSwitch('fixDiv', div) + '<select id="roundSel">' + opts + '</select></div></div><div id="roundGames" class="matchlist"></div></div>';
  }
  function renderRound(r) {
    const s = S();
    const div = BF._fixDiv || myDiv();
    const leagueGames = s.fixtures.filter(function (f) { return f.round == r && f.div === div; });
    const sections = [];
    if (leagueGames.length) {
      sections.push('<div class="tournament-section t-league"><h3 class="round-title">🏆 ' + divName(div) + '</h3>' + leagueGames.map(matchRow).join('') + '</div>');
    }
    (C.CUP_ORDER || []).forEach(function (key) {
      const cup = (s.cups || {})[key];
      if (!cup) return;
      const games = (cup.fixtures || []).filter(function (f) { return f.round == r; });
      if (!games.length) return;
      const stageName = (games[0] && games[0].stageName) ? games[0].stageName.replace(/ — Grupo .*$/, '') : '';
      sections.push('<div class="tournament-section t-' + key + '"><h3 class="round-title">' + cup.name + (stageName ? ' — ' + stageName : '') + '</h3>' + games.map(matchRow).join('') + '</div>');
    });
    $('#roundGames').innerHTML = sections.length ? sections.join('') : '<div class="empty">Nenhum jogo nesta rodada.</div>';
  }

  // ---------- COMPETICOES ----------
  function clubTags(ids, limit) {
    const s = S();
    ids = ids || [];
    limit = limit || 12;
    if (!ids.length) return '<span class="muted">Nenhum clube definido</span>';
    const shown = ids.slice(0, limit).map(function (id) {
      const c = C.clubById(s, id);
      return c ? '<span class="club-tag">' + U.badge(c) + '<span>' + c.short + '</span></span>' : '';
    }).join('');
    return '<div class="club-tags">' + shown + (ids.length > limit ? '<span class="muted">+' + (ids.length - limit) + '</span>' : '') + '</div>';
  }
  function cupSwitch(cur) {
    return '<div class="cup-switch">' + (C.CUP_ORDER || []).map(function (key) {
      return '<button class="cup-tab ' + (key === cur ? 'active' : '') + '" data-cup="' + key + '">' + cupShort(key) + '</button>';
    }).join('') + '</div>';
  }
  function cupStatusForClub(cup, clubId) {
    if (!clubId || !cup) return '';
    const inCup = cup.participants.indexOf(clubId) >= 0;
    if (!inCup) return '<div class="cup-status muted">Seu clube não disputa esta competição.</div>';
    if (cup.championId === clubId) return '<div class="cup-status ok">Campeão da competição.</div>';
    const lost = cup.fixtures.find(function (f) {
      return f.played && (f.homeId === clubId || f.awayId === clubId) && f.winnerId !== clubId;
    });
    if (lost) {
      const oppId = lost.homeId === clubId ? lost.awayId : lost.homeId;
      const opp = C.clubById(S(), oppId);
      return '<div class="cup-status bad">Eliminado por ' + (opp ? opp.name : '-') + ' na ' + lost.stageName + '.</div>';
    }
    const next = cup.fixtures.filter(function (f) {
      return !f.played && (f.homeId === clubId || f.awayId === clubId);
    }).sort(function (a, b) { return a.round - b.round; })[0];
    if (next) {
      const oppId = next.homeId === clubId ? next.awayId : next.homeId;
      const opp = C.clubById(S(), oppId);
      return '<div class="cup-status ok">Próximo jogo: ' + (opp ? opp.name : '-') + ' • rodada ' + next.round + ' • ' + next.stageName + '.</div>';
    }
    return '<div class="cup-status ok">Ainda vivo na competição, aguardando o próximo sorteio.</div>';
  }
  function renderGroupStage(s, cup) {
    if (!cup.groups || !cup.groups.length) return '';
    const def = C.CUP_DEFS[cup.key];
    const adv = (def.groups && def.groups.advance) || 2;
    const grid = cup.groups.map(function (_g, gi) {
      const tbl = C.computeGroupTable(s, cup, gi);
      return '<div class="group-card"><h4>Grupo ' + String.fromCharCode(65 + gi) + '</h4>' +
        '<table><thead><tr><th class="c">#</th><th>Clube</th><th class="c">P</th><th class="c">V</th><th class="c">E</th><th class="c">D</th><th class="c">SG</th></tr></thead><tbody>' +
        tbl.map(function (r, i) {
          const c = C.clubById(s, r.id);
          const cls = (i < adv ? 'q-adv' : '') + (r.id === myId() ? ' me' : '');
          return '<tr class="' + cls + '"><td class="c">' + (i + 1) + '</td><td class="nm">' + (c ? c.short : '-') + '</td><td class="c"><b>' + r.P + '</b></td><td class="c">' + r.V + '</td><td class="c">' + r.E + '</td><td class="c">' + r.D + '</td><td class="c">' + (r.SG > 0 ? '+' : '') + r.SG + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
    return '<div class="cup-stage"><div class="stage-head"><h3>Fase de grupos</h3><span>' + cup.groups.length + ' grupos \u00d7 ' + (def.groups ? def.groups.size : 4) + ' \u2014 classificam ' + adv + ' de cada</span></div><div class="group-stage">' + grid + '</div></div>';
  }

  function viewCups() {
    const s = S();
    if (C.ensureSeasonCups) C.ensureSeasonCups(s);
    const order = C.CUP_ORDER || [];
    let key = BF._cupKey || order[0];
    if (order.indexOf(key) < 0) key = order[0];
    BF._cupKey = key;
    const cup = s.cups && s.cups[key];
    if (!cup) return '<div class="card"><div class="empty">As competições ainda não foram criadas.</div></div>';
    const champ = cup.championId ? C.clubById(s, cup.championId) : null;
    const next = cup.fixtures.filter(function (f) { return !f.played; }).sort(function (a, b) { return a.round - b.round; })[0];
    const groupsHtml = cup.groups ? renderGroupStage(s, cup) : '';
    const stageHtml = cup.stages.map(function (stage, i) {
      if (stage.kind === 'group') return ''; // mostrado em renderGroupStage
      const fx = cup.fixtures.filter(function (f) { return f.stageIndex === i; });
      if (!fx.length) return '';
      const done = fx.every(function (f) { return f.played; });
      return '<div class="cup-stage"><div class="stage-head"><h3>' + stage.name + '</h3><span>' + (done ? 'Concluída' : 'Rodada ' + stage.round) + '</span></div><div class="matchlist">' + fx.map(matchRow).join('') + '</div></div>';
    }).join('');
    const slots = s.cupSlots || {};
    return '<div class="card cup-head"><div class="row-between"><div><h2 style="margin:0">' + cup.name + '</h2><p class="muted">' + cup.participants.length + ' clubes • mata-mata em jogo único</p></div></div>' +
      '<div class="stat-row">' +
        stat('Status', champ ? 'Campeão' : (next ? 'Rodada ' + next.round : 'Em andamento')) +
        stat('Campeão', champ ? champ.short : '-') +
        stat('Fase atual', cup.stages[cup.currentStage] ? cup.stages[cup.currentStage].name : '-') +
      '</div>' +
      cupStatusForClub(cup, myId()) +
      '</div>' +
      '<div class="card"><h2>Chaveamento</h2>' + groupsHtml + stageHtml + '</div>' +
      '<div class="card"><h2>Vagas brasileiras desta temporada</h2>' +
        '<div class="slot-grid"><div><h3>Libertadores</h3>' + clubTags(slots.libertadores, 8) + '</div>' +
        '<div><h3>Sul-Americana</h3>' + clubTags(slots.sulamericana, 8) + '</div>' +
        '<div><h3>Copa do Brasil</h3>' + clubTags(slots.copaBrasil, 16) + '</div></div>' +
      '</div>';
  }

  // ---------- DIRETORIA ----------
  function viewBoard() {
    const s = S(); const me = myClub();
    if (isFired()) return firedBanner();
    if (!me || !hasClub()) return '<div class="card"><div class="empty">Escolha um clube na aba Party.</div></div>';
    const b = s.boards[me.id];
    const tb = C.computeTable(s, me.division);
    const pos = tb.findIndex(function (r) { return r.id === me.id; }) + 1;
    const score = b ? Math.round(C.boardScore(s, me.id, pos) * 100) : 0;
    const okAll = score >= 60;
    const objHtml = (b && b.objectives ? b.objectives : []).map(function (o) {
      const p = Math.round(C.evalObjective(s, me.id, o, pos) * 100);
      return '<div class="board-obj"><div class="row-between"><span class="obj-lbl">' + o.label + '</span><b class="' + (p >= 60 ? 'money' : 'neg') + '">' + p + '%</b></div>' +
        '<div class="obj-meta muted">' + C.objProgressText(s, me.id, o, pos) + ' \u2022 peso ' + o.weight + '</div>' +
        '<div class="obj-bar"><i style="width:' + Math.max(4, p) + '%;background:' + (p >= 60 ? 'var(--green)' : (p >= 40 ? 'var(--gold)' : 'var(--red)')) + '"></i></div></div>';
    }).join('');
    return (b ? '<div class="card board-card"><div class="board-head"><span class="crest">\ud83c\udfdb\ufe0f</span><div><h2 style="margin:0">Diretoria do ' + me.name + '</h2><p class="muted">Temporada ' + s.year + ' \u2022 ' + divName(me.division) + '</p></div>' +
      '<div class="board-score ' + (okAll ? 'ok' : 'warn') + '"><span>' + score + '%</span><small>meta 60%</small></div></div>' +
      '<div class="obj-msg ' + (okAll ? 'ok' : 'warn') + '">' + (okAll ? '\u2705 Acima de 60%. Mantendo assim, você segue no comando ao fim da temporada.' : '\u26a0\ufe0f Abaixo de 60%. Se a temporada terminar assim, a diretoria vai demiti-lo.') + '</div>' +
      '<div class="board-objs">' + objHtml + '</div></div>'
      : '') +
      '<div class="card"><h2>\ud83d\udcc4 Como funciona</h2><ul class="bullets"><li>A diretoria define <b>várias metas</b> (posição, copa, contratações e finanças), cada uma com um peso.</li><li>A nota da diretoria é a <b>média ponderada</b> do cumprimento das metas. É preciso ficar <b>acima de 60%</b> ao fim da temporada.</li><li>Se a nota final ficar abaixo de 60%, você é <b>demitido</b> e precisa procurar outro clube.</li><li>Cumprindo, você segue no comando e recebe novas metas na próxima temporada.</li></ul></div>';
  }

  // ---------- FINANCAS ----------
  function viewFinance() {
    const s = S(); const me = myClub();
    const div = BF._finDiv || myDiv(); BF._finDiv = div;
    const rows = C.divClubs(s, div).slice().sort(function (a, b) { return b.budget - a.budget; });
    const maxB = Math.max.apply(null, rows.map(function (c) { return Math.abs(c.budget); }).concat([1]));
    const head = (me && hasClub() && !isFired()) ? '<div class="stat-row">' +
      stat('Caixa', U.fmtM(me.budget), me.budget < 0 ? 'neg' : 'money') +
      stat('Folha mensal', U.fmtM(C.squad(s, me.id).reduce(function (t, p) { return t + p.salary; }, 0)), 'neg') +
      stat('Patrimonio (elenco)', U.fmtM(C.squad(s, me.id).reduce(function (t, p) { return t + p.value; }, 0)), 'money') +
      '</div>' : '';
    return head + '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udcb0 Saúde financeira</h2>' + divSwitch('finDiv', div) + '</div>' +
      rows.map(function (c) {
        return '<div class="fin-row"><div class="club-cell" style="justify-content:space-between"><span class="club-cell">' + U.badge(c) + c.name + '</span><b class="' + (c.budget < 0 ? 'neg' : 'money') + '">' + U.fmtM(c.budget) + '</b></div><div class="fin-bar"><i style="width:' + Math.max(3, Math.abs(c.budget) / maxB * 100) + '%;background:' + (c.budget < 0 ? 'var(--red)' : 'var(--green)') + '"></i></div></div>';
      }).join('') + '<p class="muted" style="margin-top:12px">As finanças são apertadas: a cada rodada o caixa paga a folha salarial e recebe pouca bilheteria. Vender jogadores é essencial para equilibrar as contas.</p></div>';
  }

  // ---------- HISTORICO ----------
  function viewHistory() {
    const s = S();
    if (!s.history.length) return '<div class="card"><div class="empty">Nenhuma temporada concluída ainda.<br>Jogue todas as rodadas para registrar os campeões!</div></div>';
    return '<div class="card"><h2>\ud83d\udcdc Galeria de campeões</h2>' + s.history.map(function (h) {
      const a = C.clubById(s, h.championId); const bb = h.championBId ? C.clubById(s, h.championBId) : null; const art = h.artil;
      const cups = h.cupWinners || {};
      const cupLine = ['copaBrasil', 'libertadores', 'sulamericana'].map(function (key) {
        const c = C.clubById(s, cups[key]);
        return c ? cupShort(key) + ': ' + c.short : null;
      }).filter(Boolean).join(' • ');
      const promoted = (h.promoted || []).map(function (id) { const c = C.clubById(s, id); return c ? c.short : ''; }).filter(Boolean).join(', ');
      const relegated = (h.relegated || []).map(function (id) { const c = C.clubById(s, id); return c ? c.short : ''; }).filter(Boolean).join(', ');
      return '<div class="hist-item"><span class="yr">' + h.year + '</span>' + U.badge(a, 'lg') + '<div style="flex:1"><div style="font-weight:800">\ud83c\udfc6 ' + a.name + ' <span class="muted">(Série A)</span></div>' +
        (bb ? '<div class="muted">Série B: ' + bb.name + '</div>' : '') +
        (cupLine ? '<div class="muted">Copas: ' + cupLine + '</div>' : '') +
        ((promoted || relegated) ? '<div class="muted">Acesso: ' + (promoted || '-') + ' • Rebaixados: ' + (relegated || '-') + '</div>' : '') +
        '<div class="muted">Artilheiro: ' + (art ? U.esc(art.name) + ' (' + art.goals + ' gols)' : '-') + '</div></div></div>';
    }).join('') + '</div>';
  }

  // -------- MERCADO --------
  function negCard(n) {
    const s = S();
    const buyer = C.clubById(s, n.fromClubId), seller = C.clubById(s, n.toClubId);
    const statusTxt = { pending: 'Aguardando vendedor', counter: 'Contraproposta recebida', accepted: 'Fechado', rejected: 'Recusado', withdrawn: 'Cancelado' }[n.status];
    const last = n.history[n.history.length - 1];
    let actions = '';
    if (needsMyAction(n)) {
      const side = n.toClubId === myId() ? 'to' : 'from';
      actions = '<div class="neg-actions">' +
        '<button class="btn sm primary negAct" data-neg="' + n.id + '" data-side="' + side + '" data-dec="accept">Aceitar (' + n.amount.toFixed(1) + ' mi)</button>' +
        '<button class="btn sm negAct" data-neg="' + n.id + '" data-side="' + side + '" data-dec="counter">Contrapropor</button>' +
        '<button class="btn sm red negAct" data-neg="' + n.id + '" data-side="' + side + '" data-dec="' + (side === 'from' ? 'withdraw' : 'reject') + '">' + (side === 'from' ? 'Desistir' : 'Recusar') + '</button>' +
        '</div>';
    }
    const dir = n.toClubId === myId() ? '\ud83d\udce5 ' + buyer.name + ' quer seu jogador' : buyer.name + ' \u2192 ' + seller.name;
    return '<div class="neg ' + n.status + '"><div class="neg-head"><b>' + U.esc(n.playerName) + '</b>' +
      '<span class="neg-status s-' + n.status + '">' + statusTxt + '</span></div>' +
      '<div class="muted">' + dir + ' \u2022 valor atual: <b>' + n.amount.toFixed(1) + ' mi</b></div>' +
      '<div class="neg-last">' + U.esc(last.by) + ': ' + U.esc(last.action) + (last.amount ? ' (' + last.amount.toFixed(1) + ' mi)' : '') + '</div>' +
      actions + '</div>';
  }
  function viewMarket() {
    const s = S(); const me = myClub();
    if (!me || !hasClub() || isFired()) return isFired() ? firedBanner() : '<div class="card"><div class="empty">Escolha um clube na aba Party para negociar.</div></div>';
    const inbox = myNegotiations().filter(needsMyAction);
    const active = myNegotiations().filter(function (n) { return ['pending', 'counter'].indexOf(n.status) >= 0 && !needsMyAction(n); });
    const closed = myNegotiations().filter(function (n) { return ['accepted', 'rejected', 'withdrawn'].indexOf(n.status) >= 0; }).slice(0, 6);

    let clubOpts = '<option value="0">Todos os clubes</option>';
    s.clubs.filter(function (c) { return c.id !== me.id; }).forEach(function (c) { clubOpts += '<option value="' + c.id + '">' + c.name + ' (' + divName(c.division) + ')</option>'; });

    // ----- Filtros do mercado -----
    BF._marketFilter = BF._marketFilter || { pos: '', search: '', ovrMin: 0, ageMin: 16, ageMax: 40 };
    const f = BF._marketFilter;
    const filterClub = BF._marketClub || 0;
    const posList = ['', 'GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];
    const posOpts = posList.map(function (p) {
      return '<option value="' + p + '"' + (f.pos === p ? ' selected' : '') + '>' + (p || 'Todas posições') + '</option>';
    }).join('');
    const searchVal = (f.search || '').toLowerCase();
    let targets = s.players.filter(function (p) { return p.clubId !== me.id; });
    if (filterClub) targets = targets.filter(function (p) { return p.clubId === filterClub; });
    if (f.pos) targets = targets.filter(function (p) { return p.pos === f.pos; });
    if (f.ovrMin > 0) targets = targets.filter(function (p) { return p.ovr >= f.ovrMin; });
    if (f.ageMin > 16) targets = targets.filter(function (p) { return p.age >= f.ageMin; });
    if (f.ageMax < 40) targets = targets.filter(function (p) { return p.age <= f.ageMax; });
    if (searchVal) targets = targets.filter(function (p) { return p.name.toLowerCase().indexOf(searchVal) >= 0; });
    const totalMatches = targets.length;
    targets = targets.sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 80);

    const filterBarHtml = (
      '<div class="market-filters" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:10px 0">' +
        '<div><label class="tiny muted">Buscar nome</label><input id="mfSearch" type="text" placeholder="ex: Neymar" value="' + U.esc(f.search) + '" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border, #2a2a2a);background:var(--bg-soft, #181818);color:inherit"></div>' +
        '<div><label class="tiny muted">Posição</label><select id="mfPos" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border, #2a2a2a);background:var(--bg-soft, #181818);color:inherit">' + posOpts + '</select></div>' +
        '<div><label class="tiny muted">Clube</label><select id="mfClub" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border, #2a2a2a);background:var(--bg-soft, #181818);color:inherit">' + clubOpts + '</select></div>' +
        '<div><label class="tiny muted">OVR mínimo: <b id="mfOvrLbl">' + (f.ovrMin || 0) + '</b></label><input id="mfOvr" type="range" min="0" max="99" value="' + (f.ovrMin || 0) + '" style="width:100%"></div>' +
        '<div><label class="tiny muted">Idade min: <b id="mfAgeMinLbl">' + (f.ageMin || 16) + '</b></label><input id="mfAgeMin" type="range" min="16" max="40" value="' + (f.ageMin || 16) + '" style="width:100%"></div>' +
        '<div><label class="tiny muted">Idade max: <b id="mfAgeMaxLbl">' + (f.ageMax || 40) + '</b></label><input id="mfAgeMax" type="range" min="16" max="40" value="' + (f.ageMax || 40) + '" style="width:100%"></div>' +
        '<div style="display:flex;align-items:flex-end"><button class="btn sm" id="mfClear">Limpar filtros</button></div>' +
      '</div>' +
      '<p class="tiny muted" style="margin:-4px 0 8px">Mostrando ' + targets.length + ' de ' + totalMatches + ' jogadores que batem com os filtros.</p>'
    );

    // Lista de transferência: jogadores marcados como negociáveis em qualquer outro clube
    const listedAll = s.players.filter(function (p) { return p.listed && p.clubId !== me.id; })
      .sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 30);
    const listedHtml = listedAll.length ? (
      '<div class="card listed-box"><div class="row-between"><h2 style="margin:0">\ud83d\udccb Lista de transferência</h2><span class="muted">Jogadores marcados como "Negociar" \u2014 os clubes tendem a aceitar propostas mais facilmente.</span></div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Jogador</th><th class="c">Pos</th><th class="c">OVR</th><th class="c">Idade</th><th>Clube</th><th class="c">Valor</th><th></th></tr></thead><tbody>' +
      listedAll.map(function (p) {
        const c = C.clubById(s, p.clubId);
        return '<tr><td>' + U.esc(p.name) + '<span class="listed-pill">NEG</span></td><td class="c">' + U.ptag(p.pos) + '</td><td class="c"><span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span></td><td class="c">' + p.age + '</td><td><div class="club-cell">' + U.badge(c) + '<span style="font-size:12px">' + c.short + '</span></div></td><td class="c">' + U.fmtM(p.value) + '</td><td class="c"><button class="btn sm primary offerBtn" data-id="' + p.id + '">Proposta</button></td></tr>';
      }).join('') + '</tbody></table></div></div>'
    ) : '';

    return '<div class="stat-row">' +
      stat('Caixa disponível', U.fmtM(me.budget), me.budget < 0 ? 'neg' : 'money') +
      stat('Elenco', C.squad(s, me.id).length) +
      stat('Propostas p/ decidir', inbox.length, inbox.length ? 'neg' : '') +
      stat('Listados (mercado)', listedAll.length, listedAll.length ? 'money' : '') +
      '</div>' +
      (inbox.length ? '<div class="card"><h2>\ud83d\udce5 Aguardando sua decisão</h2><div class="neg-grid">' + inbox.map(negCard).join('') + '</div></div>' : '') +
      (active.length ? '<div class="card"><h2>\u23f3 Negociações em andamento</h2><div class="neg-grid">' + active.map(negCard).join('') + '</div></div>' : '') +
      listedHtml +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udd01 Mercado \u2014 contratar jogadores</h2></div>' +
        '<p class="muted" style="margin-bottom:6px">Escolha um jogador (de qualquer divisão) e envie uma proposta. Use os filtros para encontrar reforços por posição, clube, OVR e idade.</p>' +
        filterBarHtml +
        '<div class="tbl-wrap"><table><thead><tr><th>Jogador</th><th class="c">Pos</th><th class="c">OVR</th><th class="c">Idade</th><th>Clube</th><th class="c">Valor</th><th></th></tr></thead><tbody>' +
        targets.map(function (p) {
          const c = C.clubById(s, p.clubId);
          return '<tr><td>' + U.esc(p.name) + '</td><td class="c">' + U.ptag(p.pos) + '</td><td class="c"><span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span></td><td class="c">' + p.age + '</td><td><div class="club-cell">' + U.badge(c) + '<span style="font-size:12px">' + c.short + '</span></div></td><td class="c">' + U.fmtM(p.value) + '</td><td class="c"><button class="btn sm primary offerBtn" data-id="' + p.id + '">Proposta</button></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
      (closed.length ? '<div class="card"><h2>\ud83d\udcc4 Histórico de negociações</h2><div class="neg-grid">' + closed.map(negCard).join('') + '</div></div>' : '');
  }

  // -------- PARTY --------
  function viewParty() {
    const s = S(); const t = BF.G.transport;
    const mode = t ? t.role : 'solo';
    const members = BF.G.members || (mode === 'solo' ? [{ name: BF.me.name || 'Você', host: true }] : []);
    const controlled = s.controlled || {};
    let info;
    if (mode === 'solo') {
      info = '<div class="notion-callout"><b>Modo individual.</b> Aqui você pode trocar de clube a qualquer momento (útil após uma demissão).</div>';
    } else {
      info = '<div class="party-code">Código da party: <b>' + (BF.G.partyCode || '-') + '</b> <button class="btn sm" id="copyCode">copiar</button></div>' +
        '<p class="muted">Você é <b>' + (mode === 'host' ? 'o anfitrião' : 'convidado') + '</b>. Compartilhe o código; cada jogador assume um clube abaixo.</p>';
    }
    const memHtml = members.map(function (m) { return '<span class="member">' + (m.host ? '\ud83d\udc51 ' : '') + U.esc(m.name) + '</span>'; }).join('');
    const div = BF._partyDiv || 1; BF._partyDiv = div;
    const grid = C.divClubs(s, div).map(function (c) {
      const owner = controlled[c.id];
      const mineFlag = c.id === myId();
      return '<div class="club-opt ' + (mineFlag ? 'sel' : '') + '">' + U.badge(c, 'lg') +
        '<div style="flex:1"><div class="nm">' + c.name + '</div><div class="st">' + (owner ? 'Controlado por ' + U.esc(owner) : 'IA (livre)') + ' \u2022 força ' + c.strength + '</div></div>' +
        (mineFlag ? '<button class="btn sm red releaseBtn" data-id="' + c.id + '">Largar</button>' : (owner ? '<span class="muted">ocupado</span>' : '<button class="btn sm primary claimBtn" data-id="' + c.id + '">Assumir</button>')) +
        '</div>';
    }).join('');
    return '<div class="card"><h2>\ud83d\udc65 Party</h2>' + info + '<div class="members">' + memHtml + '</div></div>' +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\u26bd Escolha seu clube</h2>' + divSwitch('partyDiv', div) + '</div><div class="club-pick">' + grid + '</div></div>';
  }

  // ---------- RENDER ----------
  U.render = function () {
    if (!S()) return;
    const me = myClub();
    $('#clubChip').innerHTML = (me && hasClub() && !isFired()) ? (U.badge(me) + '<span>' + me.name + '</span><span style="color:var(--faint)">\u2022 ' + divName(me.division) + ' \u2022 ' + S().year + '</span>') : '<span>Sem clube</span>';
    const views = { home: viewHome, squad: viewSquad, lineup: viewLineup, comp: viewComp, fixtures: viewFixtures, market: viewMarket, board: viewBoard, finance: viewFinance, history: viewHistory, party: viewParty };
    $('#view').innerHTML = (views[tab] || viewHome)();
    const inbox = (S().controlled[myId()] && !isFired()) ? myNegotiations().filter(needsMyAction).length : 0;
    const mb = document.querySelector('[data-tab="market"]');
    if (mb) mb.innerHTML = 'Mercado' + (inbox ? ' <span class="pill">' + inbox + '</span>' : '');
    bind();
  };

  // ---------- BIND ----------
  function bind() {
    const pb = $('#playBtn'); if (pb) pb.onclick = function () { openPreRound(); };
    const ns = $('#nextSeasonBtn'); if (ns) ns.onclick = function () { BF.dispatch({ type: 'NEXT_SEASON' }); };
    const rs = $('#roundSel'); if (rs) { renderRound(rs.value); rs.onchange = function () { renderRound(rs.value); }; }
    const mc = $('#marketClub'); if (mc) { mc.value = String(BF._marketClub || 0); mc.onchange = function () { BF._marketClub = +mc.value; U.render(); }; }
    // --- filtros do mercado ---
    BF._marketFilter = BF._marketFilter || { pos: '', search: '', ovrMin: 0, ageMin: 16, ageMax: 40 };
    const mfClub = $('#mfClub'); if (mfClub) { mfClub.value = String(BF._marketClub || 0); mfClub.onchange = function () { BF._marketClub = +mfClub.value; U.render(); }; }
    const mfPos = $('#mfPos'); if (mfPos) mfPos.onchange = function () { BF._marketFilter.pos = mfPos.value; U.render(); };
    const mfSearch = $('#mfSearch');
    if (mfSearch) {
      // debounce leve para nao re-renderizar a cada tecla
      let searchTimer = null;
      mfSearch.oninput = function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { BF._marketFilter.search = mfSearch.value; U.render(); setTimeout(function () { const x = document.getElementById('mfSearch'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 0); }, 200);
      };
    }
    const mfOvr = $('#mfOvr'); if (mfOvr) { mfOvr.oninput = function () { document.getElementById('mfOvrLbl').textContent = mfOvr.value; }; mfOvr.onchange = function () { BF._marketFilter.ovrMin = +mfOvr.value; U.render(); }; }
    const mfAgeMin = $('#mfAgeMin'); if (mfAgeMin) { mfAgeMin.oninput = function () { document.getElementById('mfAgeMinLbl').textContent = mfAgeMin.value; }; mfAgeMin.onchange = function () { BF._marketFilter.ageMin = +mfAgeMin.value; U.render(); }; }
    const mfAgeMax = $('#mfAgeMax'); if (mfAgeMax) { mfAgeMax.oninput = function () { document.getElementById('mfAgeMaxLbl').textContent = mfAgeMax.value; }; mfAgeMax.onchange = function () { BF._marketFilter.ageMax = +mfAgeMax.value; U.render(); }; }
    const mfClear = $('#mfClear'); if (mfClear) mfClear.onclick = function () { BF._marketFilter = { pos: '', search: '', ovrMin: 0, ageMin: 16, ageMax: 40 }; BF._marketClub = 0; U.render(); };
    const nb = $('#newClubBtn'); if (nb) nb.onclick = function () { U.setTab('party'); };
    document.querySelectorAll('.cup-tab').forEach(function (b) { b.onclick = function () { BF._cupKey = b.dataset.cup; U.render(); }; });
    document.querySelectorAll('.comp-subtab').forEach(function (b) { b.onclick = function () { BF._compSub = b.dataset.sub; U.render(); }; });

    // alternadores de divisao
    document.querySelectorAll('.div-switch[data-key]').forEach(function (sw) {
      sw.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { BF['_' + sw.dataset.key] = +b.dataset.div; U.render(); };
      });
    });

    document.querySelectorAll('.offerBtn').forEach(function (b) { b.onclick = function () { openOffer(+b.dataset.id); }; });
    document.querySelectorAll('.negAct').forEach(function (b) { b.onclick = function () { respond(+b.dataset.neg, b.dataset.side, b.dataset.dec); }; });
    document.querySelectorAll('.claimBtn').forEach(function (b) { b.onclick = function () { BF.claimClub(+b.dataset.id); U.setTab('home'); }; });
    document.querySelectorAll('.releaseBtn').forEach(function (b) { b.onclick = function () { BF.dispatch({ type: 'RELEASE_CLUB', clubId: +b.dataset.id }); BF.me.clubId = null; U.render(); }; });
    document.querySelectorAll('.rescBtn').forEach(function (b) { b.onclick = function () { if (confirm('Rescindir o contrato deste jogador? Você paga a multa e ele deixa o clube.')) BF.dispatch({ type: 'RESCIND', clubId: myId(), playerId: +b.dataset.id }); }; });

    document.querySelectorAll('.listBtn').forEach(function (b) { b.onclick = function () { BF.dispatch({ type: 'TOGGLE_LISTED', clubId: myId(), playerId: +b.dataset.id }); U.render(); }; });
    document.querySelectorAll('.renewBtn').forEach(function (b) { b.onclick = function () { openRenew(+b.dataset.id); }; });

    // escalacao (slot-aligned: marcar = colocar em slot vazio, desmarcar = zerar slot sem shift)
    document.querySelectorAll('.lpick').forEach(function (cb) {
      cb.onchange = function () {
        const id = +cb.dataset.id; const sel = BF._lineupSel || [];
        const cur = sel.indexOf(id);
        if (cb.checked) {
          if (cur >= 0) return;
          const filled = sel.filter(Boolean).length;
          if (filled >= sel.length) { cb.checked = false; U.flash('Você já tem ' + sel.length + ' titulares', true); return; }
          const sq = C.squad(S(), myId());
          const p = sq.find(function (x) { return x.id === id; });
          const fk = currentFormation(myId());
          const slotsPos = (D.FORMATIONS[fk] || D.FORMATIONS['4-4-2']).slots;
          let i = -1;
          for (let k = 0; k < slotsPos.length; k++) { if (!sel[k] && p && slotsPos[k] === p.pos) { i = k; break; } }
          if (i < 0) i = sel.findIndex(function (s) { return !s; });
          if (i >= 0) sel[i] = id;
        } else if (cur >= 0) {
          sel[cur] = 0; // zera o slot sem deslocar os demais
        }
        U.render();
      };
    });
    const al = $('#autoLineup'); if (al) al.onclick = function () {
      const sq = C.squad(S(), myId());
      const fk = currentFormation(myId());
      const form = D.FORMATIONS[fk] || D.FORMATIONS['4-4-2'];
      const ids = C.autoLineup(sq, form.need).map(function (p) { return p.id; });
      BF._lineupSel = BF._buildSlotAligned(form.slots, sq, ids);
      BF._lineupSelForm = fk;
      U.render();
    };
    const cl = $('#clearLineup'); if (cl) cl.onclick = function () { BF._lineupSel = (BF._lineupSel || []).map(function () { return 0; }); U.render(); };
    const sl = $('#saveLineup'); if (sl) sl.onclick = function () { BF.dispatch({ type: 'SET_LINEUP', clubId: myId(), lineup: (BF._lineupSel || []).filter(Boolean) }); U.flash('Escalação salva!'); };
    document.querySelectorAll('.tac').forEach(function (b) { b.onclick = function () {
      // Atualiza visual imediatamente (evita qualquer race com render)
      document.querySelectorAll('.tac').forEach(function (x) { x.classList.toggle('sel', x === b); });
      BF.dispatch({ type: 'SET_TACTIC', clubId: myId(), tactic: b.dataset.tac });
      U.flash('Tática: ' + C.TACTICS[b.dataset.tac].label);
    }; });
    bindPitchDrag();

    const cc = $('#copyCode'); if (cc) cc.onclick = function () { try { navigator.clipboard.writeText(BF.G.partyCode); U.flash('Código copiado!'); } catch (e) {} };
  }

  function bindPitchDrag() {
    document.querySelectorAll('.formBtn').forEach(function (b) {
      b.onclick = function () {
        const newForm = b.dataset.form;
        BF.dispatch({ type: 'SET_FORMATION', clubId: myId(), formation: newForm });
        const sq = C.squad(S(), myId());
        const f = D.FORMATIONS[newForm] || D.FORMATIONS['4-4-2'];
        // preserva quem já estava escalado quando muda a formação
        const currentIds = (BF._lineupSel || []).filter(Boolean);
        const baseIds = currentIds.length ? currentIds : C.autoLineup(sq, f.need).map(function (p) { return p.id; });
        BF._lineupSel = BF._buildSlotAligned(f.slots, sq, baseIds);
        BF._lineupSelForm = newForm;
        U.render();
      };
    });
    let dragId = null, dragSrc = null;
    document.querySelectorAll('.player-chip').forEach(function (b) {
      b.ondragstart = function (e) { dragId = +b.dataset.id; dragSrc = 'pitch'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (er) {} };
      b.ondragend = function () { /* mantém limpeza pelo drop */ };
    });
    document.querySelectorAll('.pick-row[draggable="true"]').forEach(function (r) {
      r.ondragstart = function (e) { dragId = +r.dataset.id; dragSrc = 'bench'; r.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; } catch (er) {} };
      r.ondragend = function () { r.classList.remove('dragging'); };
    });
    document.querySelectorAll('.slot').forEach(function (slot) {
      slot.ondragover = function (e) { e.preventDefault(); slot.classList.add('hover'); };
      slot.ondragleave = function () { slot.classList.remove('hover'); };
      slot.ondrop = function (e) {
        e.preventDefault(); slot.classList.remove('hover');
        if (!dragId) { try { dragId = +e.dataTransfer.getData('text/plain'); } catch (er) {} }
        if (!dragId) return;
        const sel = BF._lineupSel || [];
        const target = +slot.dataset.slot;
        if (target < 0 || target >= sel.length) { dragId = null; dragSrc = null; return; }
        if (dragSrc === 'pitch') {
          const from = sel.indexOf(dragId);
          if (from < 0) { dragId = null; dragSrc = null; return; }
          const old = sel[target];
          sel[target] = dragId;
          sel[from] = old;
        } else {
          // banco -> campo: jogador alvo (se houver) volta ao banco
          const filled = sel.filter(Boolean).length;
          const wasOnPitch = sel.indexOf(dragId);
          if (wasOnPitch >= 0 && wasOnPitch !== target) sel[wasOnPitch] = 0;
          if (!sel[target] && filled >= sel.length && wasOnPitch < 0) { dragId = null; dragSrc = null; U.flash('Você já tem ' + sel.length + ' titulares', true); return; }
          sel[target] = dragId;
        }
        dragId = null; dragSrc = null;
        U.render();
      };
    });
  }

  function respond(negId, side, dec) {
    if (dec === 'counter') openCounter(negId, side);
    else BF.dispatch({ type: 'OFFER_RESPOND', negId: negId, side: side, decision: dec });
  }

  // ---------- modais ----------
  function modal(html) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="modal small">' + html + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) document.body.removeChild(ov); });
    return ov;
  }
  function openRenew(playerId) {
    const p = S().players.find(function (x) { return x.id === playerId && x.clubId === myId(); });
    if (!p) return;
    const suggested = Math.round((p.salary * 1.18) * 1000) / 1000;
    const ov = modal('<h1>Renovar contrato</h1>' +
      '<p class="sub">' + U.esc(p.name) + ' \u2022 contrato atual ' + (p.contract || 0) + ' meses \u2022 salário ' + U.fmtM(p.salary) + '</p>' +
      '<label class="fld">Novo salário mensal (milhões R$)<input type="number" id="renSalary" step="0.001" min="0.01" value="' + suggested.toFixed(3) + '"></label>' +
      '<label class="fld">Duração<select id="renMonths"><option value="12">12 meses</option><option value="24" selected>24 meses</option><option value="36">36 meses</option><option value="48">48 meses</option></select></label>' +
      '<div class="md-actions"><button class="btn" id="renCancel">Cancelar</button><button class="btn primary" id="renSend">Enviar</button></div>');
    ov.querySelector('#renCancel').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#renSend').onclick = function () {
      const salary = parseFloat(ov.querySelector('#renSalary').value);
      const months = +ov.querySelector('#renMonths').value;
      if (!(salary > 0)) { U.flash('Salário inválido', true); return; }
      document.body.removeChild(ov);
      BF.dispatch({ type: 'EXTEND_CONTRACT', clubId: myId(), playerId: playerId, salary: salary, months: months });
      const last = S().lastContract;
      U.flash(last && last.msg ? last.msg : 'Proposta enviada', last && !last.ok);
    };
  }
  function openOffer(playerId) {
    const s = S(); const p = s.players.find(function (x) { return x.id === playerId; });
    if (!p) return; const c = C.clubById(s, p.clubId);
    const ov = modal('<h1>Proposta por ' + U.esc(p.name) + '</h1>' +
      '<p class="sub">' + U.ptag(p.pos) + ' OVR ' + p.ovr + ' \u2022 ' + c.name + ' \u2022 valor de mercado <b>' + U.fmtM(p.value) + '</b></p>' +
      '<label class="fld">Sua oferta (em milhões R$)<input type="number" id="offerVal" step="0.5" min="0" value="' + p.value.toFixed(1) + '"></label>' +
      '<div class="md-actions"><button class="btn" id="offerCancel">Cancelar</button><button class="btn primary" id="offerSend">Enviar proposta</button></div>');
    ov.querySelector('#offerCancel').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#offerSend').onclick = function () {
      const amt = parseFloat(ov.querySelector('#offerVal').value);
      if (!(amt > 0)) { U.flash('Valor inválido', true); return; }
      document.body.removeChild(ov);
      BF.dispatch({ type: 'OFFER_CREATE', fromClubId: myId(), playerId: playerId, amount: amt });
      U.flash('Proposta enviada!');
    };
  }
  function openCounter(negId, side) {
    const n = S().negotiations.find(function (x) { return x.id === negId; }); if (!n) return;
    const ov = modal('<h1>Contraproposta</h1><p class="sub">' + U.esc(n.playerName) + ' \u2022 valor atual <b>' + n.amount.toFixed(1) + ' mi</b></p>' +
      '<label class="fld">Seu novo valor (milhões R$)<input type="number" id="cVal" step="0.5" min="0" value="' + n.amount.toFixed(1) + '"></label>' +
      '<div class="md-actions"><button class="btn" id="cCancel">Cancelar</button><button class="btn primary" id="cSend">Enviar</button></div>');
    ov.querySelector('#cCancel').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#cSend').onclick = function () {
      const amt = parseFloat(ov.querySelector('#cVal').value);
      if (!(amt > 0)) { U.flash('Valor inválido', true); return; }
      document.body.removeChild(ov);
      BF.dispatch({ type: 'OFFER_RESPOND', negId: negId, side: side, decision: 'counter', amount: amt });
    };
  }
})();
