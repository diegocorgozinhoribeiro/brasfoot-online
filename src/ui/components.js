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

BF.ui.playerNo = function (p) { return p.no || ((p.id % 39) + 1); };
BF.ui.playerFoot = function (p) { return p.foot || (p.id % 4 === 0 ? 'E' : 'D'); };
BF.ui.playerEnergy = function (p) { return Math.max(45, Math.min(100, p.energy == null ? 100 : p.energy)); };
BF.ui.playerRating = function (p) {
  if (p.rating) return p.rating.toFixed(2).replace('.', ',');
  return ((p.ovr || 70) / 13).toFixed(2).replace('.', ',');
};
BF.ui.shirt = function (club, cls) {
  const color = club && club.color ? club.color : '#16a34a';
  return '<span class="shirt ' + (cls || '') + '" style="--kit:' + color + '"><i></i></span>';
};

BF.ui.tacticalPitch = function (S, clubId, opts) {
  const C = BF.core, D = BF.data, U = BF.ui;
  opts = opts || {};
  const club = C.clubById(S, clubId);
  const formKey = (S.formations && S.formations[clubId]) || opts.formation || '4-4-2';
  const form = D.FORMATIONS[formKey] || D.FORMATIONS["4-4-2"];
  const lineup = opts.lineup || C.lineupOf(S, clubId);
  const slots = form.slots || [];
  const posMap = {
    0:[50,91], 1:[24,75], 2:[76,75], 3:[38,75], 4:[62,75],
    5:[23,51], 6:[42,51], 7:[58,51], 8:[77,51], 9:[38,22], 10:[62,22]
  };
  const nodes = slots.map(function (pos, i) {
    const p = lineup[i];
    const xy = posMap[i] || [50, 50];
    const attrs = opts.editable && p ? ' draggable="true" data-id="' + p.id + '"' : '';
    const cls = 'pitch-player' + (opts.editable ? ' draggable' : '') + (opts.compact ? ' compact' : '');
    const body = p
      ? U.shirt(club) + '<b>' + U.esc(p.name) + '</b><small>' + pos + ' - F' + U.playerNo(p) + ' E' + U.playerEnergy(p) + '</small>'
      : U.shirt(club, 'empty') + '<b>Vazio</b><small>' + pos + '</small>';
    return '<div class="t-slot" data-slot="' + i + '" data-pos="' + pos + '" style="left:' + xy[0] + '%;top:' + xy[1] + '%">' +
      '<button class="' + cls + '"' + attrs + '>' + body + '</button></div>';
  }).join('');
  const controls = opts.controls ? '<div class="pitch-controls">' + opts.controls + '</div>' : '';
  return '<div class="tactical-wrap ' + (opts.compact ? 'compact' : '') + '">' +
    '<div class="tactical-pitch">' +
      '<div class="pitch-line box top"></div><div class="pitch-line box bottom"></div><div class="pitch-line mid"></div><div class="pitch-line circle"></div>' +
      '<div class="pitch-watermark">' + (club ? U.esc(club.short) : '') + '</div>' + nodes +
    '</div>' + controls + '</div>';
};
