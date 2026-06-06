// auth.js - telas de login/cadastro + lista de jogos do usuário (Meus jogos)
// Expoe window.BF.authUI = { show, hide, refreshGames, currentUser }
(function () {
  window.BF = window.BF || {};
  const api = BF.api;

  function $(id) { return document.getElementById(id); }
  function flash(msg, err) { if (BF.ui && BF.ui.flash) BF.ui.flash(msg, !!err); else alert(msg); }

  let modeRegister = false;

  function show() {
    $('auth').classList.remove('hidden');
    $('setup').classList.add('hidden');
    $('app').classList.add('hidden');
    // preenche servidor salvo
    const s = api.getBase();
    if (s && $('authServer')) $('authServer').value = s;
    setMode(false);
  }
  function hide() {
    $('auth').classList.add('hidden');
  }
  function setMode(register) {
    modeRegister = !!register;
    $('authTitle').textContent = modeRegister ? 'Criar conta' : 'Entrar';
    $('authNameWrap').style.display = modeRegister ? '' : 'none';
    $('authSubmit').textContent = modeRegister ? 'Cadastrar' : 'Entrar';
    $('authToggle').textContent = modeRegister
      ? 'J\u00e1 tem conta? Entrar'
      : 'Ainda n\u00e3o tem conta? Cadastrar';
  }

  async function submitAuth() {
    const email = ($('authEmail').value || '').trim();
    const pwd   = ($('authPass').value || '');
    const name  = ($('authName').value || '').trim();
    const srv   = ($('authServer').value || '').trim() || (window.BF && window.BF.DEFAULT_RELAY) || 'wss://brasfoot-online.onrender.com';
    api.setBase(srv);
    if (!email || !pwd) { flash('Preencha e-mail e senha', true); return; }
    if (modeRegister && !name) { flash('Informe seu nome', true); return; }
    const btn = $('authSubmit'); btn.disabled = true; btn.textContent = '...';
    try {
      if (modeRegister) await api.register({ email, password: pwd, name });
      else              await api.login({ email, password: pwd });
      flash('Bem-vindo, ' + (api.getUser().name) + '!');
      hide();
      await afterLogin();
    } catch (e) {
      flash(e.message || 'Erro ao autenticar', true);
    } finally {
      btn.disabled = false;
      setMode(modeRegister);
    }
  }

  async function afterLogin() {
    // mostra setup e popula "Meus jogos"
    $('setup').classList.remove('hidden');
    const u = api.getUser();
    if ($('userChip')) {
      $('userChip').textContent = u ? u.name : '';
      $('userChip').classList.remove('hidden');
    }
    await refreshGames();
    // pula direto pra Meus jogos se houver, sen\u00e3o solo
    const games = BF._gamesCache || [];
    BF.ui.setMode(games.length ? 'mine' : 'solo');
  }

  async function refreshGames() {
    const list = $('myGamesList');
    if (!list) return;
    list.innerHTML = '<div class="hint">Carregando...</div>';
    try {
      const games = await api.listGames();
      BF._gamesCache = games;
      renderGames(games);
    } catch (e) {
      list.innerHTML = '<div class="hint err">Erro: ' + (e.message || e) + '</div>';
    }
  }

  function fmtDate(s) {
    if (!s) return '';
    try {
      const d = new Date(s);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      const opts = sameDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
      return d.toLocaleString('pt-BR', opts);
    } catch (e) { return s; }
  }

  function renderGames(games) {
    const list = $('myGamesList');
    if (!games || !games.length) {
      list.innerHTML = '<div class="hint">Voc\u00ea ainda n\u00e3o tem jogos salvos. Comece um novo abaixo.</div>';
      return;
    }
    const html = games.map((g) => {
      const me  = api.getUser();
      const myName = me ? me.name : '';
      let myClubName = '';
      // ainda n\u00e3o temos clubes no listing; fallback gen\u00e9rico
      const modeLabel = g.mode === 'solo' ? 'Individual' : 'Party';
      const roleLabel = g.myRole === 'host' ? 'Anfitri\u00e3o' : 'Convidado';
      const onlineDot = g.isOnline ? '<span class="dot on" title="Anfitri\u00e3o online"></span>'
                                   : '<span class="dot off" title="Anfitri\u00e3o offline"></span>';
      const canEnter = g.myRole === 'host' || g.isOnline;
      const blockedHint = (!canEnter && g.mode === 'party') ? '<span class="tag warn">aguardando anfitri\u00e3o</span>' : '';
      const roundInfo = g.round ? ('Rodada ' + g.round + (g.year ? ' / ' + g.year : '')) : 'Sem partidas';
      const hostInfo = g.myRole === 'host' ? '' : ('Host: ' + (g.host && g.host.name ? g.host.name : '?'));
      return (
        '<div class="game-card">' +
          '<div class="gc-head">' +
            onlineDot +
            '<span class="gc-code">' + g.code + '</span>' +
            '<span class="tag">' + modeLabel + '</span>' +
            '<span class="tag alt">' + roleLabel + '</span>' +
            blockedHint +
          '</div>' +
          '<div class="gc-body">' +
            '<div class="gc-info">' + roundInfo + (hostInfo ? '  \u2022  ' + hostInfo : '') + '</div>' +
            '<div class="gc-date">\u00daltima jogada: ' + fmtDate(g.updatedAt) + '</div>' +
          '</div>' +
          '<div class="gc-actions">' +
            (canEnter
              ? '<button class="btn primary" data-act="open" data-code="' + g.code + '">Continuar</button>'
              : '<button class="btn" disabled>Anfitri\u00e3o offline</button>') +
            (g.myRole === 'host'
              ? '<button class="btn ghost danger" data-act="del" data-code="' + g.code + '">Excluir</button>'
              : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
    list.innerHTML = html;
    list.onclick = async function (ev) {
      const t = ev.target.closest('button[data-act]');
      if (!t) return;
      const code = t.getAttribute('data-code');
      const act = t.getAttribute('data-act');
      if (act === 'open') {
        const g = (BF._gamesCache || []).find((x) => x.code === code);
        if (!g) return;
        if (g.myRole === 'host') BF.bootstrap.resumeAsHost(g);
        else                     BF.bootstrap.resumeAsGuest(g);
      } else if (act === 'del') {
        if (!confirm('Excluir o jogo ' + code + '? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;
        try {
          await api.deleteGame(code);
          await refreshGames();
          flash('Jogo exclu\u00eddo');
        } catch (e) { flash(e.message || 'Erro ao excluir', true); }
      }
    };
  }

  function logout() {
    api.logout();
    BF._gamesCache = null;
    if ($('userChip')) $('userChip').classList.add('hidden');
    show();
  }

  function wire() {
    $('authSubmit').onclick = submitAuth;
    $('authToggle').onclick = function () { setMode(!modeRegister); };
    $('authEmail').onkeydown = function (e) { if (e.key === 'Enter') submitAuth(); };
    $('authPass').onkeydown  = function (e) { if (e.key === 'Enter') submitAuth(); };
    $('authName').onkeydown  = function (e) { if (e.key === 'Enter') submitAuth(); };
    if ($('logoutBtn')) $('logoutBtn').onclick = logout;
    if ($('refreshGamesBtn')) $('refreshGamesBtn').onclick = refreshGames;
  }

  async function bootstrap() {
    wire();
    if (!api.isAuthed() || !api.getBase()) { show(); return; }
    // valida token
    try {
      await api.me();
      hide();
      await afterLogin();
    } catch (e) {
      api.logout();
      show();
    }
  }

  BF.authUI = { show, hide, refreshGames, bootstrap, logout, afterLogin };
})();
