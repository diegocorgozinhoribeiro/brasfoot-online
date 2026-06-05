// ==========================================================================
// ui/components.js  -  Helpers de renderizacao reutilizaveis
// ==========================================================================
window.BF = window.BF || {};
BF.ui = BF.ui || {};

BF.ui.fmtM = function (v) {
  v = v || 0;
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toFixed(2).replace('.', ',') + ' bi';
  if (Math.abs(v) >= 1) return 'R$ ' + v.toFixed(1).replace('.', ',') + ' mi';
  return 'R$ ' + Math.round(v * 1000) + ' mil';
};
BF.ui.ovrClass = function (o) { return o >= 82 ? 'ovr-hi' : (o >= 76 ? 'ovr-mid' : 'ovr-lo'); };
BF.ui.badge = function (c, cls) { return '<span class="badge ' + (cls || '') + '" style="background:' + c.color + '">' + c.short + '</span>'; };
BF.ui.ptag = function (p) { return '<span class="ptag p-' + p + '">' + p + '</span>'; };
BF.ui.esc = function (s) {
  return String(s).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
};
