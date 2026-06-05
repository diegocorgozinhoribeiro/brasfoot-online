// auth.js - hash de senha (scrypt) + JWT minimo (HMAC-SHA256). Zero deps.
'use strict';

const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('[FATAL] JWT_SECRET obrigat\u00f3rio (m\u00ednimo 16 caracteres). Veja server/README.md.');
  process.exit(1);
}
const JWT_TTL_SEC = parseInt(process.env.JWT_TTL_SEC || String(60 * 60 * 24 * 30), 10); // 30 dias

// ----- senha (scrypt nativo) -----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  try {
    const calc = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
    const stored = Buffer.from(hash, 'hex');
    if (stored.length !== calc.length) return false;
    return crypto.timingSafeEqual(stored, calc);
  } catch (e) { return false; }
}

// ----- JWT HS256 caseiro -----
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function sign(payload, ttlSec) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + (ttlSec || JWT_TTL_SEC) }));
  const data = header + '.' + body;
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return data + '.' + sig;
}
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expectedSig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + b).digest());
  // timing safe compare
  if (s.length !== expectedSig.length) return null;
  let diff = 0;
  for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(b64urlDecode(b).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

module.exports = { hashPassword, verifyPassword, sign, verify };
