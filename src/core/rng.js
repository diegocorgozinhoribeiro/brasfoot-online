// ==========================================================================
// core/rng.js  -  Gerador pseudo-aleatorio COM SEMENTE (seed)
// --------------------------------------------------------------------------
// Em modo online, todos os jogadores precisam gerar EXATAMENTE o mesmo mundo
// (mesmos elencos, mesma tabela, mesmos resultados). Usando a mesma seed,
// todos os clientes chegam ao mesmo estado -> sem dessincronizacao.
// ==========================================================================
window.BF = window.BF || {};
BF.core = BF.core || {};

// mulberry32: rapido e deterministico
BF.core.makeRng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Converte string (ex.: codigo da party) em seed numerica (FNV-1a)
BF.core.hashSeed = function (str) {
  str = String(str);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

BF.core.rint  = function (rng, a, b) { return Math.floor(rng() * (b - a + 1)) + a; };
BF.core.rpick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };

// Gera um codigo de party legivel (ex.: BR-7Q2KP)
BF.core.partyCode = function () {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return "BR-" + s;
};
