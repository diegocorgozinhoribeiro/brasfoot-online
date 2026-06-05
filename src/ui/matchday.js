// ==========================================================================
// ui/matchday.js  -  Partida AO VIVO: narracao minuto a minuto
// ==========================================================================
window.BF = window.BF || {};
BF.ui = BF.ui || {};

BF.ui.playMatch = function (match, S, onDone) {
  const C = BF.core, U = BF.ui;
  const home = C.clubById(S, match.homeId), away = C.clubById(S, match.awayId);
  const events = match.events.slice();
  let hg = 0, ag = 0, minute = 0, idx = 0, timer = null;
  let paused = false, halfPaused = false;

  function commentary(ev) {
    const club = ev.side === 'home' ? home : away;
    const who = U.esc(ev.player || '');
    if (ev.type === 'goal')  return "<b style='color:var(--green)'>GOOOL do " + club.name + "!</b> " + who + " balanca a rede!";
    if (ev.type === 'penalty_goal') return "<b style='color:var(--green)'>GOOOL de penalti do " + club.name + "!</b> " + who + " bateu firme.";
    if (ev.type === 'chance') return club.name + " chega com perigo com " + who + "...";
    if (ev.type === 'save')   return "Que defesaca! O goleiro evita o gol de " + who + " (" + club.name + ").";
    if (ev.type === 'card')   return "Cartao amarelo para " + who + " (" + club.name + ").";
    if (ev.type === 'injury') return "Atendimento no gramado para " + who + " (" + club.name + ").";
    return '';
  }
  function matchStats() {
    const st = match.stats || {};
    return '<div class="md-stats">' +
      '<div><b>' + (st.homePoss || 50) + '%</b><span>posse</span><b>' + (st.awayPoss || 50) + '%</b></div>' +
      '<div><b>' + (st.homeShots || '-') + '</b><span>chutes</span><b>' + (st.awayShots || '-') + '</b></div>' +
      '<div><b>' + (st.xgHome || '-') + '</b><span>xG</span><b>' + (st.xgAway || '-') + '</b></div>' +
    '</div>';
  }

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML =
    '<div class="modal matchday">' +
      '<div class="md-score">' + U.badge(home, 'lg') +
        '<div class="md-sc"><span id="mdH">0</span> - <span id="mdA">0</span></div>' +
        U.badge(away, 'lg') + '</div>' +
      '<div class="md-names"><span>' + home.name + '</span>' +
        '<span class="md-clock" id="mdClock">0\'</span>' +
        '<span>' + away.name + '</span></div>' +
      matchStats() +
      '<div class="md-bar"><i id="mdBar"></i></div>' +
      '<div class="md-feed" id="mdFeed"></div>' +
      '<div class="md-actions"><button class="btn" id="mdPause">Pausar/Substituir</button><button class="btn" id="mdSkip">Pular para o fim</button>' +
        '<button class="btn primary hidden" id="mdClose">Continuar</button></div>' +
    '</div>';
  document.body.appendChild(ov);
  const feed = ov.querySelector('#mdFeed');

  function line(html, cls) {
    const d = document.createElement('div');
    d.className = 'md-line ' + (cls || '');
    d.innerHTML = html;
    feed.appendChild(d); feed.scrollTop = feed.scrollHeight;
  }
  function finish() {
    clearInterval(timer);
    while (idx < events.length) { const ev = events[idx++]; if (ev.type === 'goal' || ev.type === 'penalty_goal') { if (ev.side === 'home') hg++; else ag++; } }
    ov.querySelector('#mdH').textContent = match.hg;
    ov.querySelector('#mdA').textContent = match.ag;
    ov.querySelector('#mdClock').textContent = 'FIM';
    ov.querySelector('#mdBar').style.width = '100%';
    let verdict = match.hg > match.ag ? (home.name + ' venceu') : (match.hg < match.ag ? (away.name + ' venceu') : 'Empate');
    if (match.upset) verdict += ' \u2014 ZEBRA!';
    line('<b>Fim de jogo: ' + match.hg + ' x ' + match.ag + ' \u2014 ' + verdict + '</b>', 'md-end');
    ov.querySelector('#mdSkip').classList.add('hidden');
    ov.querySelector('#mdPause').classList.add('hidden');
    ov.querySelector('#mdClose').classList.remove('hidden');
  }
  function openSubPanel(title) {
    paused = true;
    clearInterval(timer);
    const clubId = BF.me.clubId;
    const sq = C.squad(S, clubId);
    if (!clubId || !sq.length || (clubId !== match.homeId && clubId !== match.awayId)) {
      line('<b>' + title + '</b> Sem clube controlado nesta partida.');
      paused = false; startTimer();
      return;
    }
    const ids = C.lineupOf(S, clubId).map(function (p) { return p.id; });
    const starters = ids.map(function (id) { return sq.find(function (p) { return p.id === id; }); }).filter(Boolean);
    const bench = sq.filter(function (p) { return ids.indexOf(p.id) < 0; }).sort(function (a, b) { return b.ovr - a.ovr; });
    const box = modal('<h1>' + title + '</h1><p class="sub">Escolha uma troca para salvar a escalação usada nas próximas partidas.</p>' +
      '<label class="fld">Sai<select id="subOut">' + starters.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.name) + ' (' + p.pos + ' ' + p.ovr + ')</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Entra<select id="subIn">' + bench.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.name) + ' (' + p.pos + ' ' + p.ovr + ')</option>'; }).join('') + '</select></label>' +
      '<div class="md-actions"><button class="btn" id="subCancel">Voltar</button><button class="btn primary" id="subSave">Confirmar</button></div>');
    box.querySelector('#subCancel').onclick = function () { document.body.removeChild(box); paused = false; startTimer(); };
    box.querySelector('#subSave').onclick = function () {
      const outId = +box.querySelector('#subOut').value, inId = +box.querySelector('#subIn').value;
      const next = ids.map(function (id) { return id === outId ? inId : id; });
      BF.dispatch({ type: 'SET_LINEUP', clubId: clubId, lineup: next });
      document.body.removeChild(box);
      line('<b>Substituição preparada.</b> A nova escalação foi salva para os próximos jogos.', 'md-sub');
      paused = false; startTimer();
    };
  }
  function openPenalty(ev) {
    const clubId = ev.side === 'home' ? match.homeId : match.awayId;
    if (clubId !== BF.me.clubId) return false;
    paused = true;
    clearInterval(timer);
    const takers = C.lineupOf(S, clubId).filter(function (p) { return p.pos !== 'GOL'; }).sort(function (a, b) { return b.ovr - a.ovr; });
    const box = modal('<h1>Penalti para o seu time</h1><p class="sub">Escolha o batedor.</p>' +
      '<label class="fld">Batedor<select id="penTaker">' + takers.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.name) + ' (' + p.pos + ' ' + p.ovr + ')</option>'; }).join('') + '</select></label>' +
      '<div class="md-actions"><button class="btn primary" id="penSave">Bater</button></div>');
    box.querySelector('#penSave').onclick = function () {
      const id = +box.querySelector('#penTaker').value;
      const p = takers.find(function (x) { return x.id === id; });
      if (p) { ev.player = p.name; ev.playerId = p.id; }
      document.body.removeChild(box);
      paused = false;
      processEvent(ev);
      startTimer();
    };
    return true;
  }
  function processEvent(ev) {
    if (ev.type === 'goal' || ev.type === 'penalty_goal') {
      if (ev.side === 'home') hg++; else ag++;
      ov.querySelector('#mdH').textContent = hg;
      ov.querySelector('#mdA').textContent = ag;
    }
    line("<span class='md-min'>" + ev.minute + "'</span> " + commentary(ev), (ev.type === 'goal' || ev.type === 'penalty_goal') ? 'md-goal' : '');
  }
  function modal(html) {
    const m = document.createElement('div');
    m.className = 'overlay';
    m.innerHTML = '<div class="modal small">' + html + '</div>';
    document.body.appendChild(m);
    return m;
  }
  function startTimer() {
    clearInterval(timer);
    timer = setInterval(tick, 230);
  }
  function tick() {
    if (paused) return;
    minute += 2;
    if (minute >= 45 && !halfPaused) {
      minute = 45; halfPaused = true;
      ov.querySelector('#mdClock').textContent = "45'";
      ov.querySelector('#mdBar').style.width = '50%';
      line("<span class='md-min'>45'</span> Intervalo. Hora de ajustar o time.", 'md-sub');
      openSubPanel('Intervalo');
      return;
    }
    if (minute >= 90) { finish(); return; }
    ov.querySelector('#mdClock').textContent = minute + "'";
    ov.querySelector('#mdBar').style.width = (minute / 90 * 100) + '%';
    while (idx < events.length && events[idx].minute <= minute) {
      const ev = events[idx++];
      if (ev.type === 'penalty_goal' && openPenalty(ev)) return;
      processEvent(ev);
    }
  }
  ov.querySelector('#mdSkip').onclick = finish;
  ov.querySelector('#mdPause').onclick = function () { openSubPanel('Pausa tecnica'); };
  ov.querySelector('#mdClose').onclick = function () { document.body.removeChild(ov); if (onDone) onDone(); };

  line("<span class='md-min'>0'</span> Bola rolando no " + U.esc(home.stadium) + "!");
  startTimer();
};
