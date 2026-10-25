// raffle-picker-bd — node unit tests. Run: node tests/test_logic.js
'use strict';
const assert = require('assert');
const L = require('../logic.js');
const STR = require('../i18n.js');

let n = 0;
function eq(actual, expected, name) { assert.deepStrictEqual(actual, expected, name); n++; console.log('ok - ' + name); }

// parse + dedupe
eq(L.parseNames(' Rahim \n\nKarim\r\nRahim '), ['Rahim', 'Karim', 'Rahim'], 'parse trims + drops blanks');
eq(L.dedupeNames(['a', 'b', 'a']), ['a', 'b'], 'dedupe keeps order');
// addNames
let r = L.addNames([], 'Rahim\nKarim\nRahim');
eq(r.names, ['Rahim', 'Karim'], 'addNames dedupes paste');
eq([r.added, r.skipped], [2, 0], 'addNames counts (dup removed pre-count)');
r = L.addNames(['Rahim'], 'Rahim\n' + 'x'.repeat(61));
eq(r.added, 0, 'addNames skips dup + too-long');
eq(r.skipped, 2, 'addNames skipped count 2');
// addSingleName errors
eq(L.addSingleName([], '  ').error, 'empty', 'single empty rejected');
eq(L.addSingleName(['Rahim'], 'Rahim').error, 'duplicate', 'single duplicate rejected');
eq(L.addSingleName([], 'x'.repeat(61)).error, 'too-long', 'single too-long rejected');
eq(L.addSingleName([], 'Nusrat').ok, true, 'single valid accepted');
// fair draw with stubbed randomness: rand 0 -> first, 0.999 -> last
eq(L.secureRandomIndex(4, () => 0), 0, 'stub rand 0 -> index 0');
eq(L.secureRandomIndex(4, () => 0.999), 3, 'stub rand .999 -> last index');
let d = L.drawWinners(['a', 'b', 'c'], 2, true, () => 0);
eq(d.winners, ['a', 'b'], 'no-repeat draw removes winners in order');
eq(d.remaining, ['c'], 'no-repeat remaining correct');
d = L.drawWinners(['a', 'b'], 5, true, () => 0);
eq(d.winners.length, 2, 'no-repeat draw caps at pool size');
d = L.drawWinners(['a'], 3, false, () => 0);
eq(d.winners, ['a', 'a', 'a'], 'repeat mode can redraw same name');
// wheel geometry: winner segment centre must land on pointer at target rotation
for (const count of [2, 3, 8]) {
  const idx = 1;
  const target = L.targetRotation(0.7, idx, count, 5);
  assert.ok(target >= 0.7 + 5 * Math.PI * 2, 'target has >=5 turns (count ' + count + ')');
  const centre = L.segmentAngle(idx, count, target) % (Math.PI * 2);
  const pointer = (Math.PI * 1.5) % (Math.PI * 2);
  assert.ok(Math.abs(centre - pointer) < 1e-9, 'winner centre lands on pointer (count ' + count + ')');
  n++;
  console.log('ok - wheel lands on winner, count ' + count);
}
// Bengali digits + i18n completeness
eq(L.toBnDigits('2026'), '২০২৬', 'Bengali digits 2026');
eq(L.toBnDigits('3 winners'), '৩ winners', 'Bengali digits mixed');
for (const key of Object.keys(STR.en)) {
  assert.ok(STR.bn[key] && STR.bn[key].length > 0, 'bn string present: ' + key);
}
n++;
console.log('ok - all EN keys have BN strings');
// validateImport
const good = { app: 'raffle-picker-bd', version: 1, names: ['a'], winners: [{ name: 'a', at: '2026-10-25T05:00:00.000Z' }], noRepeat: true };
eq(L.validateImport(good).ok, true, 'valid import accepted');
eq(L.validateImport({ ...good, version: 2 }).ok, false, 'wrong version rejected');
eq(L.validateImport({ ...good, names: ['a', 'a'] }).ok, false, 'dup names rejected');
eq(L.validateImport({ ...good, winners: [{ name: 'a', at: 'nope' }] }).ok, false, 'bad winner date rejected');
eq(L.validateImport({ ...good, winners: 'x' }).ok, false, 'non-array winners rejected');
eq(L.validateImport(null).ok, false, 'null import rejected');
eq(L.validateImport('str').ok, false, 'string import rejected');

console.log(n + ' passed, 0 failed');
