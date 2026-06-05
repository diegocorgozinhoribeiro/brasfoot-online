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
    const uid = (BF.api && BF.api.getUser() && BF.api.getUser().id) || null;
    if (BF.G.transport && BF.G.transport.role === 'guest') {
      // guest envia claim via servidor (servidor preenche userId/name autenticados)
      BF.G.transport.claimClub(clubId, BF.me.name);
    } else {
      BF.dispatch({ type: 'CLAIM_CLUB', clubId: clubId, name: BF.me.name, userId: uid });
    }
    persist(); U.render();
  };

  // Re-vincula BF.me.clubId ao clube salvo do usuário quando um estado chega do servidor.
  // Usa S.userClubs[userId] (preferencial) com fallback em S.controlled por nome.
  function rebindMyClub(S) {
    if (!S) return;
    const u = BF.api && BF.api.getUser(); if (!u) return;
    if (BF.me.clubId && S.controlled && S.controlled[BF.me.clubId]) return; // j\u00e1 vinculado e v\u00e1lido
    let cid = null;
    if (S.userClubs && u.id != null && S.userClubs[String(u.id)] != null) {
      cid = +S.userClubs[String(u.id)];
    }
    if (cid == null && S.controlled && u.name) {
      // fallback: procura pelo nome (jogos antigos sem userClubs)
      Object.keys(S.controlled).forEach(function (k) {
        if (cid == null && S.controlled[k] === u.name) cid = +k;
      });
    }
    if (cid != null && S.controlled && S.controlled[cid]) {
      BF.me.clubId = cid;
    }
  }

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
    t.on('welcome', function (m) {
      BF.G.partyCode = m.code;
      if (m.members) BF.G.members = m.members;
      if (m.state) { BF.G.S = m.state; rebindMyClub(m.state); }
      U.render();
    });
    t.on('state', function (S) { BF.G.S = S; rebindMyClub(S); persist(); U.render(); maybeWatch(); });
    t.on('presence', function (members) { BF.G.members = members; U.render(); });
    t.on('members',  function (members) { BF.G.members = members; U.render(); });
    t.on('peer-join',  function (p) { if (BF.G.transport && BF.G.transport.role === 'host') BF.G.transport.broadcastState(BF.G.S); U.flash((p && p.name ? p.name : 'Jogador') + ' entrou na party'); });
    t.on('peer-leave', function (p) { U.flash((p && p.name ? p.name : 'Jogador') + ' saiu', true); });
    t.on('requestSync', function () { if (BF.G.transport.role === 'host') BF.G.transport.broadcastState(BF.G.S); });
    t.on('action', function (action) { // host recebe acao de um guest
      BF.G.S = C.applyAction(BF.G.S, action); persist(); BF.G.transport.broadcastState(BF.G.S); U.render(); maybeWatch();
    });
    t.on('status', function (st) { /* connected | disconnected */ });
    t.on('error', function (e) {
      const msg = (e && e.msg) ? e.msg : String(e || 'Erro de conex\u00e3o');
      U.flash(msg, true);
      if (e && e.fatal) {
        try { if (BF.G.transport) BF.G.transport.close(); } catch (_) {}
        BF.G.transport = null;
        BF.G.S = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('setup').classList.remove('hidden');
        if (/sess\u00e3o inv|sess\u00e3o\sexpir|n\u00e3o autenticado/i.test(msg)) {
          BF.api && BF.api.logout && BF.api.logout();
          BF.authUI && BF.authUI.show && BF.authUI.show();
        } else if (BF.authUI && BF.authUI.refreshGames) {
          BF.authUI.refreshGames();
        }
      }
    });
    t.on('fatal', function () { /* j\u00e1 tratado em error/fatal */ });
  }

  // ws transport helper (sempre online)
  function makeWs(opts) {
    return new BF.net.WsPartyTransport({
      code: opts.code,
      name: BF.me.name,
      host: !!opts.host,
      mode: opts.mode || 'party',
      serverUrl: (BF.api && BF.api.getBase()) || '',
      token: BF.api && BF.api.getToken(),
      initialState: opts.initialState || null,
    });
  }

  function enterApp() {
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    U.initTabs();
    U.render();
  }

  // -------- telas de inicio --------
  function showSetup() {
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

    // SOLO -- agora cria jogo online (host com mode='solo') para salvar na nuvem
    document.getElementById('soloStart').onclick = function () {
      if (!chosen) return;
      const u = BF.api && BF.api.getUser(); if (!u) { BF.authUI.show(); return; }
      BF.me = { clubId: chosen, name: u.name };
      const code = 'SOLO-' + (u.id || 'X') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      let S0 = C.buildWorld(code);
      S0 = C.applyAction(S0, { type: 'CLAIM_CLUB', clubId: chosen, name: u.name });
      BF.G.S = S0;
      BF.G.partyCode = code;
      wire(makeWs({ code: code, host: true, mode: 'solo', initialState: S0 }));
      BF.G.transport.start();
      enterApp();
    };

    // CRIAR PARTY -- agora persiste na nuvem
    document.getElementById('hostStart').onclick = function () {
      const u = BF.api && BF.api.getUser(); if (!u) { BF.authUI.show(); return; }
      const code = C.partyCode();
      BF.me = { clubId: null, name: u.name };
      const S0 = C.buildWorld(code);
      BF.G.S = S0;
      BF.G.partyCode = code;
      wire(makeWs({ code: code, host: true, mode: 'party', initialState: S0 }));
      BF.G.transport.start();
      enterApp(); U.setTab('party');
      U.flash('Party criada. Compartilhe o c\u00f3digo: ' + code);
    };

    // ENTRAR PARTY -- conecta como guest; servidor exige host online
    document.getElementById('joinStart').onclick = function () {
      const u = BF.api && BF.api.getUser(); if (!u) { BF.authUI.show(); return; }
      const code = (document.getElementById('joinCode').value || '').trim().toUpperCase();
      if (!code) { U.flash('Informe o c\u00f3digo da party', true); return; }
      BF.me = { clubId: null, name: u.name };
      BF.G.S = C.buildWorld(code); // estado provis\u00f3rio at\u00e9 o host sincronizar
      BF.G.partyCode = code;
      wire(makeWs({ code: code, host: false, mode: 'party' }));
      BF.G.transport.start();
      enterApp(); U.setTab('party');
    };

    const rb = document.getElementById('resetBtn');
    if (rb) rb.onclick = function () {
      if (confirm('Sair deste jogo e voltar ao menu?')) {
        try { if (BF.G.transport) BF.G.transport.close(); } catch (_) {}
        BF.G.transport = null; BF.G.S = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('setup').classList.remove('hidden');
        BF.authUI && BF.authUI.refreshGames && BF.authUI.refreshGames();
      }
    };
    const sb = document.getElementById('saveBtn');
    if (sb) sb.onclick = function () {
      // For\u00e7a um broadcast/save imediato se for host
      if (BF.G.transport && BF.G.transport.role === 'host') {
        BF.G.transport.broadcastState(BF.G.S);
        U.flash('Jogo salvo na nuvem!');
      } else {
        U.flash('Apenas o anfitri\u00e3o salva o jogo.', true);
      }
    };
  }

  // Helper exposto para a UI de "Meus jogos" abrir uma partida existente
  BF.bootstrap = {
    resumeAsHost: function (g) {
      const u = BF.api && BF.api.getUser(); if (!u) { BF.authUI.show(); return; }
      BF.me = { clubId: null, name: u.name };
      BF.G.partyCode = g.code;
      BF.G.S = null; // ser\u00e1 substitu\u00eddo pelo welcome.state vindo do DB
      wire(makeWs({ code: g.code, host: true, mode: g.mode || 'party' }));
      BF.G.transport.start();
      enterApp();
      if (g.mode === 'party') U.setTab && U.setTab('party');
    },
    resumeAsGuest: function (g) {
      const u = BF.api && BF.api.getUser(); if (!u) { BF.authUI.show(); return; }
      BF.me = { clubId: null, name: u.name };
      BF.G.partyCode = g.code;
      BF.G.S = C.buildWorld(g.code);
      wire(makeWs({ code: g.code, host: false, mode: 'party' }));
      BF.G.transport.start();
      enterApp(); U.setTab && U.setTab('party');
    },
  };

  // expoe troca de aba do setup para a UI de auth
  BF.ui = BF.ui || {};
  BF.ui.setMode = function (mode) {
    document.querySelectorAll('.mode-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
    document.querySelectorAll('.mode-panel').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== mode); });
  };

  document.addEventListener('DOMContentLoaded', function () {
    // Auth primeiro — a tela de login é a primeira a aparecer e deve funcionar
    // mesmo que algo no showSetup quebre.
    try { BF.authUI && BF.authUI.bootstrap && BF.authUI.bootstrap(); }
    catch (e) { console.error('[bf] auth bootstrap error:', e); }
    try { showSetup(); }
    catch (e) { console.error('[bf] showSetup error:', e); }
  });
})();
