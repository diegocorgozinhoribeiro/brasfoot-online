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
  function divName(d) { return d === 1 ? 'Serie A' : 'Serie B'; }

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
    const sc = f.played ? '<div class="score' + (f.upset ? ' up' : '') + '">' + f.hg + ' - ' + f.ag + '</div>' : '<div class="score tbd">x</div>';
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
    return '<div class="card fired"><h2>\ud83d\udea8 Voce foi demitido</h2>' +
      '<p>A diretoria do <b>' + (info.clubName) + '</b> encerrou seu contrato por nao cumprir a meta da temporada (' + info.pos + 'o lugar).</p>' +
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
    const next = s.fixtures.filter(function (f) { return f.round === s.round && f.div === me.division; });
    const feed = (s.feed || []).slice(0, 7);
    const b = s.boards[me.id];
    return '<div class="stat-row">' +
      stat('Divisao', divName(me.division)) +
      stat(done ? 'Status' : 'Rodada', done ? 'Fim' : s.round + '/' + s.totalRounds) +
      stat('Posicao', pos + 'o') +
      stat('Pontos', row.P) +
      stat('Caixa', U.fmtM(me.budget), me.budget < 0 ? 'neg' : 'money') +
      '</div>' +
      '<div class="grid" style="gap:16px">' +
        '<div class="card"><div class="row-between"><h2 style="margin:0">\u26a1 Controle de jogo</h2><span class="muted">' + me.name + ' \u2022 forca do XI ' + Math.round(C.teamStrength(s, me.id)) + ' \u2022 ' + (C.TACTICS[s.tactics[me.id] || 'equilibrado'].label) + '</span></div>' +
          (done
            ? '<p class="muted" style="margin-bottom:12px">Temporada encerrada. Veja o historico e comece a proxima.</p><button class="btn gold" id="nextSeasonBtn">\u25b6 Iniciar temporada ' + (s.year + 1) + '</button>'
            : '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="playBtn">\u25b6 Jogar a ' + s.round + 'a rodada</button><button class="btn" id="playAllBtn">\u23ed Simular ate o fim</button></div>') +
        '</div>' +
        (b ? '<div class="card board-mini"><h2>\ud83c\udfdb\ufe0f Meta da diretoria</h2><div class="obj-line"><span>' + C.BOARD_TEXT[b.type] + '</span>' + boardChip(b, pos) + '</div></div>' : '') +
        (!done ? '<div class="card"><h2>\ud83d\udcc5 ' + s.round + 'a rodada \u2014 ' + divName(me.division) + '</h2><div class="matchlist">' + next.map(matchRow).join('') + '</div></div>' : '') +
        (feed.length ? '<div class="card"><h2>\ud83d\udcf0 Noticias</h2>' + feed.map(function (f) { return '<div class="news">' + U.esc(f) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="card"><h2>\ud83c\udfc6 Top 5 \u2014 ' + divName(me.division) + '</h2>' + miniTable(tb.slice(0, 5)) + '</div>' +
      '</div>';
  }
  function boardChip(b, pos) {
    if (b.status === 'met') return '<span class="obj-chip ok">Cumprida</span>';
    if (b.status === 'failed') return '<span class="obj-chip bad">Nao cumprida</span>';
    const target = C.boardTarget(b.type);
    const ok = pos > 0 && pos <= target;
    return '<span class="obj-chip ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'No caminho (' + pos + 'o)' : 'Atencao (' + pos + 'o)') + '</span>';
  }

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
      stat('Forca (XI)', Math.round(C.teamStrength(s, me.id))) +
      stat('Folha mensal', U.fmtM(folha), 'neg') +
      stat('Valor do elenco', U.fmtM(sq.reduce(function (t, p) { return t + p.value; }, 0)), 'money') +
      '</div>' +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udc65 Elenco do ' + me.name + '</h2><span class="muted">\u2b50 = titular \u2022 rescisao custa ~30% do valor</span></div><div class="tbl-wrap"><table><thead><tr><th></th><th>Jogador</th><th class="c">Pos</th><th class="c">OVR</th><th class="c">Idade</th><th class="c">Gols</th><th class="c">Salario</th><th class="c">Valor</th><th></th></tr></thead><tbody>' +
      sq.map(function (p) {
        return '<tr><td class="c">' + (xiIds[p.id] ? '\u2b50' : '') + '</td><td>' + U.esc(p.name) + '</td><td class="c">' + U.ptag(p.pos) + '</td><td class="c"><span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span></td><td class="c">' + p.age + '</td><td class="c">' + p.goals + '</td><td class="c">' + U.fmtM(p.salary) + '</td><td class="c">' + U.fmtM(p.value) + '</td><td class="c"><button class="btn sm red rescBtn" data-id="' + p.id + '" ' + (sq.length <= 11 ? 'disabled' : '') + '>Rescindir</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  // ---------- ESCALACAO + TATICA ----------
  function viewLineup() {
    const s = S(); const me = myClub();
    if (!me || isFired()) return isFired() ? firedBanner() : '<div class="card"><div class="empty">Escolha um clube na aba Party.</div></div>';
    if (!BF._lineupSel) BF._lineupSel = C.lineupOf(s, me.id).map(function (p) { return p.id; });
    const sel = BF._lineupSel;
    const sq = C.squad(s, me.id).slice().sort(function (a, b) { return D.POS_ORDER.indexOf(a.pos) - D.POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr; });
    const counts = {}; D.POS_ORDER.forEach(function (p) { counts[p] = 0; });
    sel.forEach(function (id) { const p = sq.find(function (x) { return x.id === id; }); if (p) counts[p.pos]++; });
    const selOvr = sel.map(function (id) { const p = sq.find(function (x) { return x.id === id; }); return p ? p.ovr : 0; });
    const avg = sel.length ? Math.round(selOvr.reduce(function (a, b) { return a + b; }, 0) / sel.length) : 0;
    const curTac = s.tactics[me.id] || 'equilibrado';

    const tac = '<div class="card"><h2>\u2699\ufe0f Tatica</h2><div class="tac-grid">' +
      C.TACTIC_KEYS.map(function (k) {
        const t = C.TACTICS[k];
        return '<button class="tac ' + (k === curTac ? 'sel' : '') + '" data-tac="' + k + '"><b>' + t.label + '</b><span>' + t.desc + '</span></button>';
      }).join('') + '</div></div>';

    const rows = sq.map(function (p) {
      const on = sel.indexOf(p.id) >= 0;
      return '<label class="pick-row ' + (on ? 'on' : '') + '"><input type="checkbox" class="lpick" data-id="' + p.id + '" ' + (on ? 'checked' : '') + '>' +
        '<span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span>' + U.ptag(p.pos) +
        '<span class="pn">' + U.esc(p.name) + '</span><span class="pa muted">' + p.age + ' anos</span></label>';
    }).join('');

    const need = D.LINEUP_NEED;
    const balance = D.POS_ORDER.map(function (pos) {
      const c = counts[pos], rec = need[pos] || 0;
      return '<span class="bal ' + (c >= (pos === 'GOL' ? 1 : 0) ? '' : 'low') + '">' + U.ptag(pos) + ' ' + c + '</span>';
    }).join('');

    return tac +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udccb Escalacao (' + sel.length + '/11)</h2><span class="muted">Forca do XI: <b>' + avg + '</b></span></div>' +
      '<div class="balance">' + balance + '</div>' +
      '<div class="lineup-actions"><button class="btn sm" id="autoLineup">Preencher automatico</button><button class="btn sm" id="clearLineup">Limpar</button>' +
      '<button class="btn primary" id="saveLineup" ' + (sel.length === 11 ? '' : 'disabled') + '>Salvar escalacao</button></div>' +
      (counts.GOL < 1 ? '<p class="warn-txt">\u26a0\ufe0f Escale ao menos 1 goleiro.</p>' : '') +
      '<div class="pick-list">' + rows + '</div></div>';
  }

  // ---------- TABELA (com divisao) ----------
  function viewTable() {
    const s = S(); const div = BF._tableDiv || myDiv(); BF._tableDiv = div;
    const tb = C.computeTable(s, div);
    const isA = div === 1;
    return '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83c\udfc6 Classificacao</h2>' + divSwitch('tableDiv', div) + '</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th class="c">#</th><th>Clube</th><th class="c">Pts</th><th class="c">J</th><th class="c">V</th><th class="c">E</th><th class="c">D</th><th class="c">GP</th><th class="c">GC</th><th class="c">SG</th></tr></thead><tbody>' +
      tb.map(function (r, i) {
        const c = C.clubById(s, r.id);
        let z = '';
        if (isA) z = i < 4 ? 'zone-lib' : (i < 6 ? 'zone-sul' : (i >= 16 ? 'zone-reb' : ''));
        else z = i < 4 ? 'zone-promo' : '';
        return '<tr class="' + (r.id === myId() ? 'me ' : '') + z + '"><td class="c">' + (i + 1) + '</td><td><div class="club-cell">' + U.badge(c) + c.name + '</div></td><td class="c"><b>' + r.P + '</b></td><td class="c">' + r.J + '</td><td class="c">' + r.V + '</td><td class="c">' + r.E + '</td><td class="c">' + r.D + '</td><td class="c">' + r.GP + '</td><td class="c">' + r.GC + '</td><td class="c">' + (r.SG > 0 ? '+' : '') + r.SG + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (isA
        ? '<div class="legend"><span><i class="dot" style="background:var(--blue)"></i>Libertadores</span><span><i class="dot" style="background:var(--green)"></i>Pre-Libertadores</span><span><i class="dot" style="background:var(--red)"></i>Rebaixamento</span></div>'
        : '<div class="legend"><span><i class="dot" style="background:var(--gold)"></i>Zona de acesso a Serie A</span></div>') +
      '</div>';
  }
  function divSwitch(key, cur) {
    return '<div class="div-switch sm" data-key="' + key + '"><button class="' + (cur === 1 ? 'active' : '') + '" data-div="1">Serie A</button><button class="' + (cur === 2 ? 'active' : '') + '" data-div="2">Serie B</button></div>';
  }

  // ---------- JOGOS ----------
  function viewFixtures() {
    const s = S(); const div = BF._fixDiv || myDiv(); BF._fixDiv = div;
    let opts = '';
    const cur = Math.min(s.round, s.totalRounds);
    for (let r = 1; r <= s.totalRounds; r++) opts += '<option value="' + r + '" ' + (r === cur ? 'selected' : '') + '>' + r + 'a rodada' + (r < s.round ? ' (jogada)' : '') + '</option>';
    return '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udcc5 Tabela de jogos</h2><div style="display:flex;gap:8px;align-items:center">' + divSwitch('fixDiv', div) + '<select id="roundSel">' + opts + '</select></div></div><div id="roundGames" class="matchlist"></div></div>';
  }
  function renderRound(r) {
    const div = BF._fixDiv || myDiv();
    const games = S().fixtures.filter(function (f) { return f.round == r && f.div === div; });
    $('#roundGames').innerHTML = games.map(matchRow).join('');
  }

  // ---------- DIRETORIA ----------
  function viewBoard() {
    const s = S(); const me = myClub();
    if (isFired()) return firedBanner();
    if (!me || !hasClub()) return '<div class="card"><div class="empty">Escolha um clube na aba Party.</div></div>';
    const b = s.boards[me.id];
    const tb = C.computeTable(s, me.division);
    const pos = tb.findIndex(function (r) { return r.id === me.id; }) + 1;
    const target = b ? C.boardTarget(b.type) : 0;
    const past = (s.history || []).filter(function (h) { return false; }); // historico de metas fica no board.status
    return (b ? '<div class="card board-card"><div class="board-head"><span class="crest">\ud83c\udfdb\ufe0f</span><div><h2 style="margin:0">Diretoria do ' + me.name + '</h2><p class="muted">Temporada ' + s.year + ' \u2022 ' + divName(me.division) + '</p></div></div>' +
      '<div class="obj-box"><div class="obj-title">Meta da temporada</div><div class="obj-goal">' + C.BOARD_TEXT[b.type] + '</div>' +
      '<div class="obj-prog"><div class="prog-row"><span>Posicao atual</span><b class="' + (pos <= target ? 'money' : 'neg') + '">' + pos + 'o</b></div>' +
      '<div class="prog-row"><span>Meta</span><b>ate ' + target + 'o</b></div>' +
      '<div class="prog-bar"><i style="width:' + Math.max(4, Math.min(100, (1 - (pos - 1) / Math.max(1, C.divClubs(s, me.division).length - 1)) * 100)) + '%;background:' + (pos <= target ? 'var(--green)' : 'var(--red)') + '"></i></div></div>' +
      '<div class="obj-msg ' + (pos <= target ? 'ok' : 'warn') + '">' + (pos <= target ? '\u2705 No caminho certo. Mantenha o desempenho ate o fim da temporada.' : '\u26a0\ufe0f Abaixo da meta. Se a temporada acabar assim, voce sera demitido!') + '</div></div>'
      : '') +
      '<div class="card"><h2>\ud83d\udcc4 Como funciona</h2><ul class="bullets"><li>A diretoria define um objetivo conforme o porte do clube e a divisao.</li><li>Ao fim da temporada, se a meta <b>nao</b> for cumprida, voce e <b>demitido</b> e precisa procurar outro clube.</li><li>Cumprindo a meta, voce segue no comando e recebe um novo objetivo.</li></ul></div>';
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
    return head + '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udcb0 Saude financeira</h2>' + divSwitch('finDiv', div) + '</div>' +
      rows.map(function (c) {
        return '<div class="fin-row"><div class="club-cell" style="justify-content:space-between"><span class="club-cell">' + U.badge(c) + c.name + '</span><b class="' + (c.budget < 0 ? 'neg' : 'money') + '">' + U.fmtM(c.budget) + '</b></div><div class="fin-bar"><i style="width:' + Math.max(3, Math.abs(c.budget) / maxB * 100) + '%;background:' + (c.budget < 0 ? 'var(--red)' : 'var(--green)') + '"></i></div></div>';
      }).join('') + '<p class="muted" style="margin-top:12px">As financas sao apertadas: a cada rodada o caixa paga a folha salarial e recebe pouca bilheteria. Vender jogadores e essencial para equilibrar as contas.</p></div>';
  }

  // ---------- HISTORICO ----------
  function viewHistory() {
    const s = S();
    if (!s.history.length) return '<div class="card"><div class="empty">Nenhuma temporada concluida ainda.<br>Jogue todas as rodadas para registrar os campeoes!</div></div>';
    return '<div class="card"><h2>\ud83d\udcdc Galeria de campeoes</h2>' + s.history.map(function (h) {
      const a = C.clubById(s, h.championId); const bb = h.championBId ? C.clubById(s, h.championBId) : null; const art = h.artil;
      return '<div class="hist-item"><span class="yr">' + h.year + '</span>' + U.badge(a, 'lg') + '<div style="flex:1"><div style="font-weight:800">\ud83c\udfc6 ' + a.name + ' <span class="muted">(Serie A)</span></div>' +
        (bb ? '<div class="muted">Serie B: ' + bb.name + '</div>' : '') +
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
    const filterClub = BF._marketClub || 0;
    let targets = s.players.filter(function (p) { return p.clubId !== me.id; });
    if (filterClub) targets = targets.filter(function (p) { return p.clubId === filterClub; });
    targets = targets.sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 60);

    return '<div class="stat-row">' +
      stat('Caixa disponivel', U.fmtM(me.budget), me.budget < 0 ? 'neg' : 'money') +
      stat('Elenco', C.squad(s, me.id).length) +
      stat('Propostas p/ decidir', inbox.length, inbox.length ? 'neg' : '') +
      '</div>' +
      (inbox.length ? '<div class="card"><h2>\ud83d\udce5 Aguardando sua decisao</h2><div class="neg-grid">' + inbox.map(negCard).join('') + '</div></div>' : '') +
      (active.length ? '<div class="card"><h2>\u23f3 Negociacoes em andamento</h2><div class="neg-grid">' + active.map(negCard).join('') + '</div></div>' : '') +
      '<div class="card"><div class="row-between"><h2 style="margin:0">\ud83d\udd01 Mercado \u2014 contratar jogadores</h2><select id="marketClub">' + clubOpts + '</select></div>' +
        '<p class="muted" style="margin-bottom:10px">Escolha um jogador (de qualquer divisao) e envie uma proposta no seu valor. O outro clube pode aceitar, recusar ou contrapropor.</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Jogador</th><th class="c">Pos</th><th class="c">OVR</th><th class="c">Idade</th><th>Clube</th><th class="c">Valor</th><th></th></tr></thead><tbody>' +
        targets.map(function (p) {
          const c = C.clubById(s, p.clubId);
          return '<tr><td>' + U.esc(p.name) + '</td><td class="c">' + U.ptag(p.pos) + '</td><td class="c"><span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span></td><td class="c">' + p.age + '</td><td><div class="club-cell">' + U.badge(c) + '<span style="font-size:12px">' + c.short + '</span></div></td><td class="c">' + U.fmtM(p.value) + '</td><td class="c"><button class="btn sm primary offerBtn" data-id="' + p.id + '">Proposta</button></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
      (closed.length ? '<div class="card"><h2>\ud83d\udcc4 Historico de negociacoes</h2><div class="neg-grid">' + closed.map(negCard).join('') + '</div></div>' : '');
  }

  // -------- PARTY --------
  function viewParty() {
    const s = S(); const t = BF.G.transport;
    const mode = t ? t.role : 'solo';
    const members = BF.G.members || (mode === 'solo' ? [{ name: BF.me.name || 'Voce', host: true }] : []);
    const controlled = s.controlled || {};
    let info;
    if (mode === 'solo') {
      info = '<div class="notion-callout"><b>Modo individual.</b> Aqui voce pode trocar de clube a qualquer momento (util apos uma demissao).</div>';
    } else {
      info = '<div class="party-code">Codigo da party: <b>' + (BF.G.partyCode || '-') + '</b> <button class="btn sm" id="copyCode">copiar</button></div>' +
        '<p class="muted">Voce e <b>' + (mode === 'host' ? 'o anfitriao' : 'convidado') + '</b>. Compartilhe o codigo; cada jogador assume um clube abaixo.</p>';
    }
    const memHtml = members.map(function (m) { return '<span class="member">' + (m.host ? '\ud83d\udc51 ' : '') + U.esc(m.name) + '</span>'; }).join('');
    const div = BF._partyDiv || 1; BF._partyDiv = div;
    const grid = C.divClubs(s, div).map(function (c) {
      const owner = controlled[c.id];
      const mineFlag = c.id === myId();
      return '<div class="club-opt ' + (mineFlag ? 'sel' : '') + '">' + U.badge(c, 'lg') +
        '<div style="flex:1"><div class="nm">' + c.name + '</div><div class="st">' + (owner ? 'Controlado por ' + U.esc(owner) : 'IA (livre)') + ' \u2022 forca ' + c.strength + '</div></div>' +
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
    const views = { home: viewHome, squad: viewSquad, lineup: viewLineup, table: viewTable, fixtures: viewFixtures, market: viewMarket, board: viewBoard, finance: viewFinance, history: viewHistory, party: viewParty };
    $('#view').innerHTML = (views[tab] || viewHome)();
    const inbox = (S().controlled[myId()] && !isFired()) ? myNegotiations().filter(needsMyAction).length : 0;
    const mb = document.querySelector('[data-tab="market"]');
    if (mb) mb.innerHTML = '\ud83d\udd01 Transferencias' + (inbox ? ' <span class="pill">' + inbox + '</span>' : '');
    bind();
  };

  // ---------- BIND ----------
  function bind() {
    const pb = $('#playBtn'); if (pb) pb.onclick = function () { BF.dispatch({ type: 'PLAY_ROUND' }); };
    const pa = $('#playAllBtn'); if (pa) pa.onclick = function () { if (confirm('Simular todas as rodadas restantes (sem assistir)?')) BF.dispatch({ type: 'PLAY_ALL' }); };
    const ns = $('#nextSeasonBtn'); if (ns) ns.onclick = function () { BF.dispatch({ type: 'NEXT_SEASON' }); };
    const rs = $('#roundSel'); if (rs) { renderRound(rs.value); rs.onchange = function () { renderRound(rs.value); }; }
    const mc = $('#marketClub'); if (mc) { mc.value = String(BF._marketClub || 0); mc.onchange = function () { BF._marketClub = +mc.value; U.render(); }; }
    const nb = $('#newClubBtn'); if (nb) nb.onclick = function () { U.setTab('party'); };

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
    document.querySelectorAll('.rescBtn').forEach(function (b) { b.onclick = function () { if (confirm('Rescindir o contrato deste jogador? Voce paga a multa e ele deixa o clube.')) BF.dispatch({ type: 'RESCIND', clubId: myId(), playerId: +b.dataset.id }); }; });

    // escalacao
    document.querySelectorAll('.lpick').forEach(function (cb) {
      cb.onchange = function () {
        const id = +cb.dataset.id; const sel = BF._lineupSel;
        const i = sel.indexOf(id);
        if (cb.checked) { if (sel.length >= 11) { cb.checked = false; U.flash('Voce ja tem 11 titulares', true); return; } if (i < 0) sel.push(id); }
        else if (i >= 0) sel.splice(i, 1);
        U.render();
      };
    });
    const al = $('#autoLineup'); if (al) al.onclick = function () { BF._lineupSel = C.autoLineup(C.squad(S(), myId())).map(function (p) { return p.id; }); U.render(); };
    const cl = $('#clearLineup'); if (cl) cl.onclick = function () { BF._lineupSel = []; U.render(); };
    const sl = $('#saveLineup'); if (sl) sl.onclick = function () { BF.dispatch({ type: 'SET_LINEUP', clubId: myId(), lineup: BF._lineupSel.slice() }); U.flash('Escalacao salva!'); };
    document.querySelectorAll('.tac').forEach(function (b) { b.onclick = function () { BF.dispatch({ type: 'SET_TACTIC', clubId: myId(), tactic: b.dataset.tac }); U.flash('Tatica: ' + C.TACTICS[b.dataset.tac].label); U.render(); }; });

    const cc = $('#copyCode'); if (cc) cc.onclick = function () { try { navigator.clipboard.writeText(BF.G.partyCode); U.flash('Codigo copiado!'); } catch (e) {} };
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
  function openOffer(playerId) {
    const s = S(); const p = s.players.find(function (x) { return x.id === playerId; });
    if (!p) return; const c = C.clubById(s, p.clubId);
    const ov = modal('<h1>Proposta por ' + U.esc(p.name) + '</h1>' +
      '<p class="sub">' + U.ptag(p.pos) + ' OVR ' + p.ovr + ' \u2022 ' + c.name + ' \u2022 valor de mercado <b>' + U.fmtM(p.value) + '</b></p>' +
      '<label class="fld">Sua oferta (em milhoes R$)<input type="number" id="offerVal" step="0.5" min="0" value="' + p.value.toFixed(1) + '"></label>' +
      '<div class="md-actions"><button class="btn" id="offerCancel">Cancelar</button><button class="btn primary" id="offerSend">Enviar proposta</button></div>');
    ov.querySelector('#offerCancel').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#offerSend').onclick = function () {
      const amt = parseFloat(ov.querySelector('#offerVal').value);
      if (!(amt > 0)) { U.flash('Valor invalido', true); return; }
      document.body.removeChild(ov);
      BF.dispatch({ type: 'OFFER_CREATE', fromClubId: myId(), playerId: playerId, amount: amt });
      U.flash('Proposta enviada!');
    };
  }
  function openCounter(negId, side) {
    const n = S().negotiations.find(function (x) { return x.id === negId; }); if (!n) return;
    const ov = modal('<h1>Contraproposta</h1><p class="sub">' + U.esc(n.playerName) + ' \u2022 valor atual <b>' + n.amount.toFixed(1) + ' mi</b></p>' +
      '<label class="fld">Seu novo valor (milhoes R$)<input type="number" id="cVal" step="0.5" min="0" value="' + n.amount.toFixed(1) + '"></label>' +
      '<div class="md-actions"><button class="btn" id="cCancel">Cancelar</button><button class="btn primary" id="cSend">Enviar</button></div>');
    ov.querySelector('#cCancel').onclick = function () { document.body.removeChild(ov); };
    ov.querySelector('#cSend').onclick = function () {
      const amt = parseFloat(ov.querySelector('#cVal').value);
      if (!(amt > 0)) { U.flash('Valor invalido', true); return; }
      document.body.removeChild(ov);
      BF.dispatch({ type: 'OFFER_RESPOND', negId: negId, side: side, decision: 'counter', amount: amt });
    };
  }
})();
