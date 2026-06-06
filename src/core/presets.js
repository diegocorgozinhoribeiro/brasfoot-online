// ==========================================================================
// core/presets.js  -  Esquemas de escalacao salvos por usuario+clube.
// Armazenamento em localStorage (rapido, offline, sem peso para o servidor).
// Persiste entre sessoes no MESMO navegador (nao sincroniza entre dispositivos).
// ==========================================================================
window.BF = window.BF || {};

(function () {
  function userId() {
    try { return (BF.api && BF.api.getUser() && BF.api.getUser().id) || 'anon'; }
    catch (_) { return 'anon'; }
  }
  function key(clubId) { return 'bf_lineup_presets_' + userId() + '_' + (clubId || 0); }
  function readAll(clubId) {
    try {
      const raw = localStorage.getItem(key(clubId));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function writeAll(clubId, arr) {
    try { localStorage.setItem(key(clubId), JSON.stringify(arr || [])); } catch (_) {}
  }

  BF.presets = {
    // Lista todos os esquemas salvos para o clube atual.
    list: function (clubId) { return readAll(clubId); },
    // Busca um esquema por nome.
    get: function (clubId, name) {
      const arr = readAll(clubId);
      return arr.find(function (p) { return p.name === name; }) || null;
    },
    // Salva ou sobrescreve um esquema. lineup = array de player ids alinhados aos slots.
    save: function (clubId, name, formation, lineup) {
      if (!clubId || !name) return;
      const arr = readAll(clubId);
      const idx = arr.findIndex(function (p) { return p.name === name; });
      const entry = {
        name: name,
        formation: formation || '4-4-2',
        lineup: (lineup || []).slice(),
        savedAt: Date.now()
      };
      if (idx >= 0) arr[idx] = entry;
      else arr.push(entry);
      // limite de 20 esquemas por clube
      if (arr.length > 20) arr.splice(0, arr.length - 20);
      writeAll(clubId, arr);
    },
    // Remove um esquema por nome.
    remove: function (clubId, name) {
      const arr = readAll(clubId).filter(function (p) { return p.name !== name; });
      writeAll(clubId, arr);
    },
    // Limpa todos os esquemas do clube.
    clear: function (clubId) { writeAll(clubId, []); }
  };
})();
