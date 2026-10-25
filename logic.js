// raffle-picker-bd — pure logic (no DOM). Shared by the app and node tests.
'use strict';
const MAX_NAMES = 200;
const MAX_NAME_LEN = 60;
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
const PALETTE = ['#0f766e','#0369a1','#b45309','#be123c','#6d28d9','#15803d','#c026d3','#ea580c'];

function toBnDigits(value) {
  return String(value).replace(/[0-9]/g, d => BN_DIGITS[Number(d)]);
}

function parseNames(text) {
  if (typeof text !== 'string') return [];
  return text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
}

function dedupeNames(names) {
  const seen = new Set();
  const out = [];
  for (const n of names) {
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// Returns { ok, names, added, skipped, error } — error is a code string.
function addNames(existing, incoming) {
  const clean = dedupeNames(parseNames(incoming));
  const result = { ok: true, names: existing.slice(), added: 0, skipped: 0, error: '' };
  for (const name of clean) {
    if (name.length > MAX_NAME_LEN) { result.skipped++; continue; }
    if (result.names.includes(name)) { result.skipped++; continue; }
    if (result.names.length >= MAX_NAMES) { result.ok = false; result.error = 'too-many'; break; }
    result.names.push(name);
    result.added++;
  }
  return result;
}

function addSingleName(existing, raw) {
  const name = (raw || '').trim();
  if (!name) return { ok: false, names: existing.slice(), error: 'empty' };
  if (name.length > MAX_NAME_LEN) return { ok: false, names: existing.slice(), error: 'too-long' };
  if (existing.includes(name)) return { ok: false, names: existing.slice(), error: 'duplicate' };
  if (existing.length >= MAX_NAMES) return { ok: false, names: existing.slice(), error: 'too-many' };
  return { ok: true, names: existing.concat([name]), error: '' };
}

// Fair draw: the winner index is chosen FIRST (crypto by default), and the
// wheel animation is then aimed at that segment — the wheel never decides.
function secureRandomIndex(count, randFn) {
  if (!count || count < 1) return -1;
  if (typeof randFn === 'function') return Math.floor(randFn() * count);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % count;
  }
  return Math.floor(Math.random() * count);
}

function drawWinners(pool, count, noRepeat, randFn) {
  const n = Math.max(1, Math.min(10, Math.floor(count) || 1));
  const remaining = pool.slice();
  const winners = [];
  const take = noRepeat ? Math.min(n, remaining.length) : n;
  for (let i = 0; i < take; i++) {
    if (remaining.length === 0) break;
    const idx = secureRandomIndex(remaining.length, randFn);
    const name = remaining[idx];
    winners.push(name);
    if (noRepeat) remaining.splice(idx, 1);
  }
  return { winners, remaining };
}

// Wheel geometry: segment i centre angle (radians) at rotation `rot`.
function segmentAngle(i, count, rot) {
  const seg = (Math.PI * 2) / count;
  return rot + (i + 0.5) * seg;
}

// Target rotation so segment `winnerIdx` ends under the top pointer (-PI/2),
// after at least `minTurns` full turns from `currentRot`.
function targetRotation(currentRot, winnerIdx, count, minTurns) {
  const seg = (Math.PI * 2) / count;
  const centre = (winnerIdx + 0.5) * seg;
  const twoPi = Math.PI * 2;
  let target = -Math.PI / 2 - centre;
  while (target < currentRot + minTurns * twoPi) target += twoPi;
  return target;
}

function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'not-object' };
  if (data.app !== 'raffle-picker-bd' || data.version !== 1) return { ok: false, error: 'bad-header' };
  if (!Array.isArray(data.names) || data.names.length > MAX_NAMES) return { ok: false, error: 'bad-names' };
  for (const n of data.names) {
    if (typeof n !== 'string' || !n.trim() || n.length > MAX_NAME_LEN) return { ok: false, error: 'bad-names' };
  }
  if (dedupeNames(data.names).length !== data.names.length) return { ok: false, error: 'bad-names' };
  if (!Array.isArray(data.winners)) return { ok: false, error: 'bad-winners' };
  for (const w of data.winners) {
    if (!w || typeof w.name !== 'string' || !w.name.trim() || typeof w.at !== 'string' || isNaN(Date.parse(w.at))) {
      return { ok: false, error: 'bad-winners' };
    }
  }
  if (typeof data.noRepeat !== 'boolean') return { ok: false, error: 'bad-flag' };
  return { ok: true, data: { names: data.names.slice(), winners: data.winners.map(w => ({ name: w.name, at: w.at })), noRepeat: data.noRepeat } };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MAX_NAMES, MAX_NAME_LEN, PALETTE, toBnDigits, parseNames, dedupeNames,
    addNames, addSingleName, secureRandomIndex, drawWinners, segmentAngle,
    targetRotation, validateImport };
}
