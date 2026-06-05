// ==========================================================================
// main.js  -  Bootstrap: telas de inicio, transporte, dispatch e persistencia
// ==========================================================================
window.BF = window.BF || {};

(function () {
  const C = BF.core, U = BF.ui;
  const KEY = 'brasfoot_mgr_v7';
  BF.G = { S: null, transport: null, members: [], partyCode: null, watchedRound: 0 };
  BF.me = { clubId: null, name: 'Você' };
  BF._marketClub = 0;

  function isAuthority() { const t = BF.G.transport; return !t || t.role === 'solo' || t.role === 'host'; }
  function persist() {
    if (BF.G.transport && BF.G.transport.role === 'guest') return; // guest nao guarda estado oficial
    try { localStorage.setItem(KEY, JSON.stringify({ S: BF.G.S, me: BF.me, mode: BF.G.transport ? BF.G.transport.role : 'solo' })); } catch (e) {}
  }
  function loadSave() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

  // -------- DISPATCH central --------
  BF.dispatch = function (action) {
    if (isAuthority()) {
      BF.G.S = C.applyAction(BF.G.S, action);
      persist();
      if (BF.G.transport && BF.G.transport.role === 'host') BF.G.transport.broadcastState(BF.G.S);
      U.render();
      if (action.type === 'PLAY_ROUND') maybeWatch();
    } else {
      BF.G.transport.sendAction(action); // guest -> host
    }
  };
  BF.requestPlayRound = function () {
    const t = BF.G.transport;
    const members = BF.G.members || [];
    if (!t || t.role === 'solo') {
      BF.dispatch({ type: 'PLAY_ROUND' });
      return;
    }
    const required = Math.max(1, Math.ceil(Math.max(1, members.length) * 2 / 3));
    BF.dispatch({ type: 'REQUEST_PLAY_ROUND', name: BF.me.name || 'Jogador', required: required });
  };

  // Overlay "aguardando jogadores" — mostrado entre o clique em Iniciar rodada
  // e a narração ao vivo / simulação. Em modo solo dura ~700ms; em party,
  // mostra a contagem de votos até atingir o mínimo.
  BF.showRoundWaiting = function (onReady) {
    const t = BF.G.transport;
    const members = (BF.G.members || []).length || 1;
    const isSolo = !t || t.role === 'solo';
    const required = isSolo ? 1 : Math.max(1, Math.ceil(members * 2 / 3));
    // limpa qualquer overlay residual de rodadas anteriores antes de criar
    // um novo (a partir da 2a rodada o anterior poderia ainda estar no DOM
    // dependendo do timing do re-render).
    document.querySelectorAll('.wait-overlay').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    const ov = document.createElement('div');
    ov.className = 'wait-overlay';
    ov.innerHTML = '<div class="wait-card">' +
      '<h2>⚽ Iniciando rodada</h2>' +
      '<div class="wait-sub">Aguardando confirmação dos jogadores…</div>' +
      '<div class="wait-count"><em id="wcNow">1</em> / <span id="wcTot">' + required + '</span></div>' +
      '<div class="wait-bar"><i id="wcBar" style="width:' + Math.round(100 / required) + '%"></i></div>' +
      '<div class="wait-tip">' + (isSolo ? 'Modo solo — único jogador confirmado.' : 'Quando ' + required + ' jogadores confirmarem, a rodada começa.') + '</div>' +
      '</div>';
    // Estilo inline garante visibilidade mesmo se houver outro overlay no DOM
    // (ex.: modal de narracao da partida anterior ainda nao fechado).
    ov.style.zIndex = '99999';
    ov.style.display = 'flex';
    ov.style.visibility = 'visible';
    ov.style.opacity = '1';
    document.body.appendChild(ov);
    // Forca o navegador a fazer layout/paint do overlay antes de prosseguir.
    // Sem isso, em rodadas subsequentes o re-render sincrono apos onReady()
    // pode encobrir o overlay antes dele aparecer na tela.
    void ov.offsetHeight;
    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
    if (isSolo) {
      // 1) Pinta o overlay sincronamente (acima).
      // 2) Em duas frames de animacao + 850ms, fecha e dispara o onReady.
      // O uso de requestAnimationFrame garante que o overlay seja pintado
      // antes de iniciar a contagem, evitando o bug em que rodadas seguintes
      // pulavam direto para a partida sem mostrar a tela de espera.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          const bar = ov.querySelector('#wcBar'); if (bar) bar.style.width = '100%';
          setTimeout(function () {
            close();
            if (typeof onReady === 'function') onReady();
          }, 850);
        });
      });
      return;
    }
    // Party: dispara o pedido e fica observando vote count via S.votes
    if (typeof onReady === 'function') onReady();
    const interval = setInterval(function () {
      const S = BF.G.S;
      const votes = (S && S.votes && S.votes.playRound) || [];
      const now = Math.min(required, votes.length || 1);
      const wnow = ov.querySelector('#wcNow'); if (wnow) wnow.textContent = now;
      const bar = ov.querySelector('#wcBar'); if (bar) bar.style.width = Math.round(now * 100 / required) + '%';
      if (now >= required || (S && S.lastRound)) { clearInterval(interval); setTimeout(close, 400); }
    }, 250);
    // Failsafe: fecha em até 6s
    setTimeout(function () { clearInterval(interval); close(); }, 6000);
  };

  BF.claimClub = function (clubId) {
    BF.me.clubId = clubId;
    if (BF.G.transport && BF.G.transport.role !== 'solo') BF.G.transport.claimClub(clubId, BF.me.name);
    else BF.dispatch({ type: 'CLAIM_CLUB', clubId: clubId, name: BF.me.name });
    persist(); U.render();
  };

  function maybeWatch() {
    const S = BF.G.S; if (!S || !S.lastRound) return;
    if (S.lastRound.round <= BF.G.watchedRound) return;
    BF.G.watchedRound = S.lastRound.round;
    const mine = S.lastRound.matches.find(function (m) { return m.homeId === BF.me.clubId || m.awayId === BF.me.clubId; });
    if (mine) U.playMatch(mine, S, function () { U.render(); });
  }

  // -------- transporte --------
  function wire(t) {
    BF.G.transport = t;
    t.on('ready', function () {});
    t.on('state', function (S) { BF.G.S = S; U.render(); maybeWatch(); });
    t.on('presence', function (members) { BF.G.members = members; U.render(); });
    t.on('requestSync', function () { if (BF.G.transport.role === 'host') BF.G.transport.broadcastState(BF.G.S); });
    t.on('action', function (action) { // host recebe acao de um guest
      BF.G.S = C.applyAction(BF.G.S, action); persist(); BF.G.transport.broadcastState(BF.G.S); U.render(); maybeWatch();
    });
    t.on('error', function (msg) { U.flash(msg, true); });
  }

  function enterApp() {
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    U.initTabs();
    U.render();
  }

  // -------- telas de inicio --------
  function showSetup() {
    const sv = loadSave();
    document.getElementById('continueWrap').style.display = sv && sv.S ? 'block' : 'none';

    // seletor de clube (modo solo) - com divisao
    const pick = document.getElementById('soloClubs');
    let chosen = null;
    let soloDiv = 1;
    function renderSoloClubs() {
      pick.innerHTML = BF.data.CLUBS.filter(function (c) { return c.division === soloDiv; }).map(function (c) {
        return '<button class="club-opt" data-id="' + c.id + '">' + BF.ui.badge(c, 'lg') + '<div><div class="nm">' + c.name + '</div><div class="st">' + c.city + ' \u2022 força ' + c.strength + '</div></div></button>';
      }).join('');
      pick.querySelectorAll('.club-opt').forEach(function (b) {
        if (+b.dataset.id === chosen) b.classList.add('sel');
        b.onclick = function () {
          pick.querySelectorAll('.club-opt').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel'); chosen = +b.dataset.id;
          document.getElementById('soloStart').disabled = false;
        };
      });
    }
    const dsw = document.getElementById('soloDivSwitch');
    if (dsw) dsw.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        dsw.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        soloDiv = +b.dataset.div; renderSoloClubs();
      };
    });
    renderSoloClubs();

    // alternar paineis
    document.querySelectorAll('.mode-tab').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.mode-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        document.querySelectorAll('.mode-panel').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== b.dataset.mode); });
      };
    });

    // SOLO
    document.getElementById('soloStart').onclick = function () {
      if (!chosen) return;
      BF.me = { clubId: chosen, name: 'Você' };
      BF.G.S = C.buildWorld('solo-' + Date.now());
      BF.G.S = C.applyAction(BF.G.S, { type: 'CLAIM_CLUB', clubId: chosen, name: 'Você' });
      wire(BF.net.makeTransport('local', {}));
      BF.G.transport.start();
      persist(); enterApp();
    };

    // CONTINUAR
    document.getElementById('continueBtn').onclick = function () {
      const sv = loadSave(); if (!sv || !sv.S) { U.flash('Nenhum jogo salvo', true); return; }
      BF.G.S = sv.S; BF.me = sv.me || BF.me;
      wire(BF.net.makeTransport('local', {}));
      BF.G.transport.start();
      enterApp();
    };

    // CRIAR PARTY
    document.getElementById('hostStart').onclick = function () {
      const name = (document.getElementById('hostName').value || '').trim() || 'Anfitrião';
      const serverEl = document.getElementById('hostServer');
      const serverUrl = serverEl ? (serverEl.value || '').trim() : '';
      const code = C.partyCode();
      BF.me = { clubId: null, name: name };
      BF.G.partyCode = code;
      BF.G.S = C.buildWorld(code); // mundo deterministico a partir do codigo
      // Lembra a URL do servidor para a proxima sessao
      try { if (serverUrl) localStorage.setItem('bf_relay_url', serverUrl); } catch (e) {}
      wire(BF.net.makeTransport(serverUrl ? 'ws' : 'party', { code: code, name: name, host: true, serverUrl: serverUrl }));
      BF.G.transport.start();
      persist(); enterApp(); U.setTab('party');
      if (serverUrl) U.flash('Sala online criada. Compartilhe o c\u00f3digo: ' + code);
    };

    // ENTRAR PARTY
    document.getElementById('joinStart').onclick = function () {
      const name = (document.getElementById('joinName').value || '').trim();
      const code = (document.getElementById('joinCode').value || '').trim().toUpperCase();
      const serverEl = document.getElementById('joinServer');
      const serverUrl = serverEl ? (serverEl.value || '').trim() : '';
      if (!name || !code) { U.flash('Preencha nome e c\u00f3digo', true); return; }
      BF.me = { clubId: null, name: name };
      BF.G.partyCode = code;
      BF.G.S = C.buildWorld(code); // estado provisorio ate o host sincronizar
      try { if (serverUrl) localStorage.setItem('bf_relay_url', serverUrl); } catch (e) {}
      wire(BF.net.makeTransport(serverUrl ? 'ws' : 'party', { code: code, name: name, host: false, serverUrl: serverUrl }));
      BF.G.transport.start();
      enterApp(); U.setTab('party');
    };

    // pre-preenche URL do relay se ja foi usada antes
    try {
      const lastRelay = localStorage.getItem('bf_relay_url');
      if (lastRelay) {
        const hs = document.getElementById('hostServer'); if (hs && !hs.value) hs.value = lastRelay;
        const js = document.getElementById('joinServer'); if (js && !js.value) js.value = lastRelay;
      }
    } catch (e) {}

    document.getElementById('resetBtn').onclick = function () {
      if (confirm('Reiniciar e apagar o jogo salvo?')) { localStorage.removeItem(KEY); location.reload(); }
    };
    document.getElementById('saveBtn').onclick = function () { persist(); U.flash('Jogo salvo!'); };
  }

  document.addEventListener('DOMContentLoaded', showSetup);
})();
