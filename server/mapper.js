// ==========================================================================
// server/mapper.js  -  Conversao dos dados REAIS (FIFA/Postgres) para o
// formato do MOTOR do jogo. PURO (sem dependencias, sem I/O) para poder ser
// usado tanto pelo servidor (relay) quanto pelo harness de teste offline.
//
// Decisao de design (economia): os atributos de IDENTIDADE sao reais
// (nome, posicao, overall, idade, nacionalidade, potencial). Ja o VALOR de
// mercado e o SALARIO sao DERIVADOS do overall/idade pela MESMA formula do
// jogo -- nao usamos os euros reais (ex.: 180M) porque quebrariam a escala
// economica (orcamentos de 8-220 "mi", valores de 0,3-25 "mi"). Assim os
// jogadores sao 100% reais e a economia continua jogavel.
// ==========================================================================
'use strict';

// ---- Mapa posicao FIFA -> posicao do jogo (GOL/ZAG/LAT/VOL/MEI/ATA) ------
var POS_MAP = {
  GK: 'GOL',
  CB: 'ZAG', RCB: 'ZAG', LCB: 'ZAG',
  LB: 'LAT', RB: 'LAT', LWB: 'LAT', RWB: 'LAT',
  CDM: 'VOL', RDM: 'VOL', LDM: 'VOL', CM: 'VOL', RCM: 'VOL', LCM: 'VOL',
  CAM: 'MEI', LAM: 'MEI', RAM: 'MEI', LM: 'MEI', RM: 'MEI', LW: 'MEI', RW: 'MEI',
  ST: 'ATA', CF: 'ATA', LF: 'ATA', RF: 'ATA', LS: 'ATA', RS: 'ATA'
};

function mapPosition(fifaPositions) {
  var first = String(fifaPositions || '').split(',')[0].trim().toUpperCase();
  return POS_MAP[first] || 'MEI';
}

function num(v, d) {
  var n = parseFloat(v);
  return isFinite(n) ? n : (d == null ? 0 : d);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round1(v) { return Math.round(v * 10) / 10; }

// Valor de mercado (em "mi") derivado do overall e idade -- MESMA formula do
// motor (core/players.js antigo) para manter a economia equilibrada.
function playerValue(ovr, age) {
  ovr = num(ovr, 60); age = num(age, 25);
  var base = Math.pow(Math.max(0, (ovr - 55)) / 10, 2.4) * (age < 30 ? 1 : 0.62);
  return Math.max(0.3, round1(base));
}
function playerSalary(value) {
  return Math.round((value * 0.018 + 0.04) * 1000) / 1000;
}

// Converte uma linha do banco (player) para o "perfil real" usado por
// D.REAL_PLAYERS_FULL[clubId]. (O id de runtime e atribuido depois pelo
// motor em genSquad.)
function mapPlayer(row) {
  var ovr = Math.round(num(row.overall, 60));
  var age = Math.round(num(row.age, 25));
  var value = playerValue(ovr, age);
  return {
    name: String(row.short_name || row.long_name || 'Jogador').trim(),
    pos: mapPosition(row.positions || row.player_positions || row.main_position),
    ovr: ovr,
    age: age,
    value: value,
    salary: playerSalary(value),
    potential: Math.round(num(row.potential, ovr)),
    nationality: String(row.nationality || row.nationality_name || '').trim(),
    clubId: row.club_id != null ? +row.club_id : (row.club_team_id != null ? +row.club_team_id : null)
  };
}

// ---- Clube: forca e orcamento derivados do elenco real ------------------
function topAvg(ovrs, n) {
  var arr = ovrs.slice().sort(function (a, b) { return b - a; }).slice(0, n);
  if (!arr.length) return 60;
  var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}
function clubStrength(players) {
  var ovrs = players.map(function (p) { return p.ovr; });
  return Math.round(topAvg(ovrs, 11));
}
function clubBudget(players) {
  var ovrs = players.map(function (p) { return p.ovr; });
  var avg16 = topAvg(ovrs, 16);
  return Math.round(clamp((avg16 - 60) * 9, 8, 220));
}

// ---- short + color deterministicos a partir do nome/id ------------------
var STOP = { de:1, do:1, da:1, dos:1, das:1, fc:1, cf:1, ec:1, sc:1, ac:1, club:1, clube:1, the:1, real:0 };
function shortName(name) {
  var clean = String(name || '').replace(/[^A-Za-z\u00C0-\u017F0-9 ]/g, ' ').trim();
  var words = clean.split(/\s+/).filter(function (w) { return w && !STOP[w.toLowerCase()]; });
  if (!words.length) words = clean.split(/\s+/).filter(Boolean);
  var s;
  if (words.length >= 3) s = (words[0][0] + words[1][0] + words[2][0]);
  else if (words.length === 2) s = (words[0].slice(0, 2) + words[1][0]);
  else s = (words[0] || 'CLB').slice(0, 3);
  return s.toUpperCase();
}
var PALETTE = ['#c1121f','#1d3557','#2a9d8f','#e76f51','#264653','#6a4c93','#007200','#bc6c25','#3a0ca3','#d62828','#118ab2','#073b4c','#ef476f','#06d6a0','#8338ec','#fb5607'];
function clubColor(id) {
  var h = 0, s = String(id);
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Converte um clube + seus jogadores reais para o shape do motor.
// division: 1 ou 2 (nivel da liga). continental: false para clubes da regiao.
function mapClub(clubRow, players, opts) {
  opts = opts || {};
  var profile = players.map(mapPlayer);
  return {
    club: {
      id: +clubRow.id,
      name: String(clubRow.name || 'Clube').trim(),
      short: shortName(clubRow.name),
      color: clubColor(clubRow.id),
      city: opts.country || '',
      leagueId: String(clubRow.league_id != null ? clubRow.league_id : (opts.leagueId || '')),
      region: opts.region || '',
      division: opts.division || 1,
      continental: !!opts.continental,
      strength: clubStrength(profile),
      budget: clubBudget(profile)
    },
    players: profile
  };
}

module.exports = {
  POS_MAP: POS_MAP,
  mapPosition: mapPosition,
  playerValue: playerValue,
  playerSalary: playerSalary,
  mapPlayer: mapPlayer,
  clubStrength: clubStrength,
  clubBudget: clubBudget,
  shortName: shortName,
  clubColor: clubColor,
  mapClub: mapClub
};
