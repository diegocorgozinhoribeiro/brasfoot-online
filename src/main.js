// ==========================================================================
// main.js  -  Bootstrap: telas de inicio, transporte, dispatch e persistencia
// ==========================================================================
window.BF = window.BF || {};

(function () {
  const C = BF.core, U = BF.ui;
  const KEY = 'brasfoot_mgr_v2';
  BF.G = { S: null, transport: null, members: [], partyCode: null, watchedRound: 0 };
  BF.me = { clubId: null, name: 'Voce' };
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
        return '<button class="club-opt" data-id="' + c.id + '">' + BF.ui.badge(c, 'lg') + '<div><div class="nm">' + c.name + '</div><div class="st">' + c.city + ' \u2022 forca ' + c.strength + '</div></div></button>';
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
      BF.me = { clubId: chosen, name: 'Voce' };
      BF.G.S = C.buildWorld('solo-' + Date.now());
      BF.G.S = C.applyAction(BF.G.S, { type: 'CLAIM_CLUB', clubId: chosen, name: 'Voce' });
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
      const name = (document.getElementById('hostName').value || '').trim() || 'Anfitriao';
      const code = C.partyCode();
      BF.me = { clubId: null, name: name };
      BF.G.partyCode = code;
      BF.G.S = C.buildWorld(code); // mundo deterministico a partir do codigo
      wire(BF.net.makeTransport('party', { code: code, name: name, host: true }));
      BF.G.transport.start();
      persist(); enterApp(); U.setTab('party');
    };

    // ENTRAR PARTY
    document.getElementById('joinStart').onclick = function () {
      const name = (document.getElementById('joinName').value || '').trim();
      const code = (document.getElementById('joinCode').value || '').trim().toUpperCase();
      if (!name || !code) { U.flash('Preencha nome e codigo', true); return; }
      BF.me = { clubId: null, name: name };
      BF.G.partyCode = code;
      BF.G.S = C.buildWorld(code); // estado provisorio ate o host sincronizar
      wire(BF.net.makeTransport('party', { code: code, name: name, host: false }));
      BF.G.transport.start();
      enterApp(); U.setTab('party');
    };

    document.getElementById('resetBtn').onclick = function () {
      if (confirm('Reiniciar e apagar o jogo salvo?')) { localStorage.removeItem(KEY); location.reload(); }
    };
    document.getElementById('saveBtn').onclick = function () { persist(); U.flash('Jogo salvo!'); };
  }

  document.addEventListener('DOMContentLoaded', showSetup);
})();
