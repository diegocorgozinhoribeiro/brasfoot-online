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

  // helpers para o modo solo (lobby de 1 jogador, com persistencia online)
  function isSoloGame() {
    const t = BF.G.transport;
    if (!t) return true;
    if (t.role === 'solo') return true;
    if (t.mode === 'solo') return true;
    return false;
  }
  function requiredVotes() {
    const members = (BF.G.members || []);
    return Math.max(1, members.length || 1);
  }

  // -------- DISPATCH central --------
  BF.dispatch = function (action) {
    if (isAuthority()) {
      const prevRound = (BF.G.S && BF.G.S.lastRound) ? BF.G.S.lastRound.round : 0;
      BF.G.S = C.applyAction(BF.G.S, action);
      persist();
      if (BF.G.transport && BF.G.transport.role === 'host') BF.G.transport.broadcastState(BF.G.S);
      U.render();
      const newRound = (BF.G.S && BF.G.S.lastRound) ? BF.G.S.lastRound.round : 0;
      // dispara narracao sempre que uma nova rodada eh jogada,
      // independente do tipo da action (PLAY_ROUND direto OU REQUEST_PLAY_ROUND que bateu quorum)
      if (newRound > prevRound) maybeWatch();
    } else {
      BF.G.transport.sendAction(action); // guest -> host
    }
  };
  // v10.5: simplificado — sem sistema de quorum/votacao.
  // O HOST decide quando iniciar a rodada. Clica e dispara imediatamente.
  // Guests recebem o novo state via broadcast e a narracao abre automaticamente.
  // (O modelo de votacao causava travamento se um peer perdia conexao.)
  BF.requestPlayRound = function () {
    if (isAuthority()) {
      BF.dispatch({ type: 'PLAY_ROUND' });
    } else {
      // Guest nao deveria ter chamado, mas por seguranca pede ao host.
      U.flash('Apenas o host pode iniciar a rodada.', true);
    }
  };

  // v10.5: stub. Mantido para retrocompatibilidade do app.js antigo.
  // Antes mostrava overlay de quorum; agora só chama onReady direto.
  BF.showRoundWaiting = function (onReady) {
    if (typeof onReady === 'function') onReady();
  };

  // Indica se o usuario atual eh o host (pode iniciar rodadas).
  BF.canStartRound = function () { return isAuthority(); };

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
    // Restaura a aba onde o usuário estava ao dar F5/sair, por jogo
    BF._tabKey = 'bf_tab_' + (BF.G.partyCode || 'default');
    try {
      const last = localStorage.getItem(BF._tabKey);
      if (last && U.setTab) U.setTab(last);
    } catch (e) {}
    // Faz toda troca de aba ser persistida automaticamente
    if (U.setTab && !U._setTabWrapped) {
      const orig = U.setTab;
      U.setTab = function (t) {
        try { localStorage.setItem(BF._tabKey, t); } catch (e) {}
        return orig(t);
      };
      U._setTabWrapped = true;
    }
  }

  // -------- listener de save confirmation (relay -> client) --------
  // O 'saved' eh enviado pelo relay quando processa um {t:'save'} (flush forcado)
  // ou um broadcast de state apos o debounce. Mostramos um toast pro usuario.
  BF._wireSaveAck = function (t) {
    t.on && t.on('saved', function (m) {
      if (m && m.ok) U.flash('Jogo salvo na nuvem ✓');
      else U.flash('Falha ao salvar: ' + (m && m.msg || ''), true);
    });
  };

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
      // 1) Atualiza o estado mais recente no servidor (broadcast).
      // 2) Pede flush IMEDIATO no Postgres (sem o debounce de 3s).
      // 3) Mostra confirmação 'Jogo salvo' quando o relay responde 'saved'.
      if (BF.G.transport && BF.G.transport.role === 'host') {
        BF.G.transport.broadcastState(BF.G.S);
        if (BF.G.transport.requestSave) BF.G.transport.requestSave();
        U.flash('Salvando…');
      } else {
        U.flash('Apenas o anfitri\u00e3o salva o jogo.', true);
      }
    };
    // Salva antes de fechar a aba (best-effort), evitando perda de mudancas
    // entre o ultimo broadcast e o debounce de 3s do relay.
    window.addEventListener('beforeunload', function () {
      try {
        if (BF.G.transport && BF.G.transport.role === 'host') {
          BF.G.transport.broadcastState(BF.G.S);
          if (BF.G.transport.requestSave) BF.G.transport.requestSave();
        }
      } catch (_) {}
    });
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
