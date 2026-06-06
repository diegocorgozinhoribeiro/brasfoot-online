// apiClient.js - chamadas HTTP ao relay (auth + games CRUD)
// expoe window.BF.api = { setBase, getBase, getToken, setToken, login, register, me, listGames, deleteGame, isAuthed }
(function () {
  window.BF = window.BF || {};
  const TKEY = 'bf_token';
  const UKEY = 'bf_user';
  const SKEY = 'bf_relay_url';
  const DEFAULT_RELAY = 'wss://brasfoot-online.onrender.com';

  function getBase() {
    try {
      const v = localStorage.getItem(SKEY);
      if (v && v.trim()) return v.trim();
    } catch (e) {}
    return DEFAULT_RELAY;
  }
  BF.DEFAULT_RELAY = DEFAULT_RELAY;
  function setBase(url) {
    try { if (url) localStorage.setItem(SKEY, url); else localStorage.removeItem(SKEY); } catch (e) {}
  }
  function getToken() {
    try { return localStorage.getItem(TKEY) || null; } catch (e) { return null; }
  }
  function setToken(t) {
    try { if (t) localStorage.setItem(TKEY, t); else localStorage.removeItem(TKEY); } catch (e) {}
  }
  function getUser() {
    try { const r = localStorage.getItem(UKEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function setUser(u) {
    try { if (u) localStorage.setItem(UKEY, JSON.stringify(u)); else localStorage.removeItem(UKEY); } catch (e) {}
  }

  // converte ws(s):// para http(s):// para chamadas HTTP
  function toHttp(url) {
    let u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('wss://')) u = 'https://' + u.slice(6);
    else if (u.startsWith('ws://')) u = 'http://' + u.slice(5);
    else if (!/^https?:\/\//.test(u)) {
      // s\u00f3 hostname: infere pelo protocolo da p\u00e1gina
      const proto = (location.protocol === 'https:') ? 'https://' : 'http://';
      u = proto + u;
    }
    return u.replace(/\/+$/, '');
  }

  async function fetchJson(path, opts) {
    const base = toHttp(getBase());
    if (!base) throw new Error('Servidor relay n\u00e3o configurado');
    const headers = { 'Content-Type': 'application/json' };
    const tok = getToken();
    if (tok && (!opts || opts.auth !== false)) headers['Authorization'] = 'Bearer ' + tok;
    let resp;
    try {
      resp = await fetch(base + path, {
        method: (opts && opts.method) || 'GET',
        headers,
        body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      throw new Error('N\u00e3o consegui conectar ao servidor (' + base + '). Verifique a URL.');
    }
    let json = null;
    try { json = await resp.json(); } catch (_) {}
    if (!resp.ok) {
      const msg = (json && json.error) || ('HTTP ' + resp.status);
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return json;
  }

  async function register({ email, password, name }) {
    const r = await fetchJson('/auth/register', { method: 'POST', body: { email, password, name }, auth: false });
    setToken(r.token); setUser(r.user);
    return r.user;
  }
  async function login({ email, password }) {
    const r = await fetchJson('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setToken(r.token); setUser(r.user);
    return r.user;
  }
  async function me() {
    const r = await fetchJson('/auth/me');
    setUser(r.user);
    return r.user;
  }
  function logout() {
    setToken(null); setUser(null);
  }
  async function listGames() {
    const r = await fetchJson('/games/mine');
    return r.games || [];
  }
  async function deleteGame(code) {
    return fetchJson('/games/' + encodeURIComponent(code), { method: 'DELETE' });
  }
  function isAuthed() { return !!getToken(); }
  async function ping() {
    return fetchJson('/health', { auth: false });
  }

  BF.api = { getBase, setBase, getToken, setToken, getUser, setUser, register, login, me, logout, listGames, deleteGame, isAuthed, ping, toHttp };
})();
