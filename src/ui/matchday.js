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

  function commentary(ev) {
    const club = ev.side === 'home' ? home : away;
    const who = U.esc(ev.player || '');
    if (ev.type === 'goal')  return "<b style='color:var(--green)'>GOOOL do " + club.name + "!</b> " + who + " balanca a rede!";
    if (ev.type === 'chance') return club.name + " chega com perigo com " + who + "...";
    if (ev.type === 'save')   return "Que defesaca! O goleiro evita o gol de " + who + " (" + club.name + ").";
    if (ev.type === 'card')   return "Cartao amarelo para " + who + " (" + club.name + ").";
    return '';
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
      '<div class="md-bar"><i id="mdBar"></i></div>' +
      '<div class="md-feed" id="mdFeed"></div>' +
      '<div class="md-actions"><button class="btn" id="mdSkip">Pular para o fim</button>' +
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
    while (idx < events.length) { const ev = events[idx++]; if (ev.type === 'goal') { if (ev.side === 'home') hg++; else ag++; } }
    ov.querySelector('#mdH').textContent = match.hg;
    ov.querySelector('#mdA').textContent = match.ag;
    ov.querySelector('#mdClock').textContent = 'FIM';
    ov.querySelector('#mdBar').style.width = '100%';
    let verdict = match.hg > match.ag ? (home.name + ' venceu') : (match.hg < match.ag ? (away.name + ' venceu') : 'Empate');
    if (match.upset) verdict += ' \u2014 ZEBRA!';
    line('<b>Fim de jogo: ' + match.hg + ' x ' + match.ag + ' \u2014 ' + verdict + '</b>', 'md-end');
    ov.querySelector('#mdSkip').classList.add('hidden');
    ov.querySelector('#mdClose').classList.remove('hidden');
  }
  ov.querySelector('#mdSkip').onclick = finish;
  ov.querySelector('#mdClose').onclick = function () { document.body.removeChild(ov); if (onDone) onDone(); };

  line("<span class='md-min'>0'</span> Bola rolando no " + U.esc(home.stadium) + "!");
  timer = setInterval(function () {
    minute += 2;
    if (minute >= 90) { finish(); return; }
    ov.querySelector('#mdClock').textContent = minute + "'";
    ov.querySelector('#mdBar').style.width = (minute / 90 * 100) + '%';
    while (idx < events.length && events[idx].minute <= minute) {
      const ev = events[idx++];
      if (ev.type === 'goal') {
        if (ev.side === 'home') hg++; else ag++;
        ov.querySelector('#mdH').textContent = hg;
        ov.querySelector('#mdA').textContent = ag;
      }
      line("<span class='md-min'>" + ev.minute + "'</span> " + commentary(ev), ev.type === 'goal' ? 'md-goal' : '');
    }
  }, 230);
};
