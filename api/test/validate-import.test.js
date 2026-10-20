/* The import validator: what a transcription is allowed to look like.
 *
 * Unlike a created plan there are no library ids here — the whole point is that the model only
 * reads names and the client decides what they are. So the tests check the opposite of
 * validate.test.js: unknown names are *kept*, invented ids are dropped, and the written
 * prescription survives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { validateImport } = await import('../coach/core/validate.js');

const day = (...ex) => ({ name: 'Push', ex });

test('keeps an exercise name the catalogue does not know', () => {
  const r = validateImport({ name: 'PPL', routines: [day({ name: '招财猫', query: 'cable rear delt fly', bp: 'shoulders', sets: 3, reps: 15 })] });
  assert.equal(r.ok, true);
  assert.equal(r.import.routines[0].ex[0].name, '招财猫');
  assert.equal(r.import.routines[0].ex[0].query, 'cable rear delt fly');
});

test('drops an id the model invented instead of trusting it', () => {
  const r = validateImport({ routines: [day({ id: '0001', name: '招财猫', sets: 3, reps: 12 })] });
  assert.equal(r.ok, true);
  assert.equal(r.import.routines[0].ex[0].id, undefined);
});

test('preserves sets, a rep range, weight, side and alternatives', () => {
  const r = validateImport({
    routines: [day({ name: '保加利亚蹲', bp: 'upper legs', sets: 3, repsMin: 8, repsMax: 12, weight: 20, side: true, note: '每侧', alternatives: [{ name: '箭步蹲', sets: 3, reps: 10, weight: 12 }] })]
  });
  assert.equal(r.ok, true);
  const e = r.import.routines[0].ex[0];
  assert.equal(e.sets, 3);
  assert.equal(e.repsMin, 8);
  assert.equal(e.repsMax, 12);
  assert.equal(e.weight, 20);
  assert.equal(e.side, true);
  assert.deepEqual(e.alternatives, [{ name: '箭步蹲', sets: 3, reps: 10, weight: 12 }]);
});

test('a day with no exercises is a repair, not an empty routine', () => {
  const r = validateImport({ routines: [{ name: 'Push', ex: [] }] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('at least one exercise')));
});

test('refuses an empty transcription', () => {
  assert.equal(validateImport({ routines: [] }).ok, false);
  assert.equal(validateImport(null).ok, false);
});

test('a rep range with its ceiling below its floor is rejected', () => {
  const r = validateImport({ routines: [day({ name: '卧推', repsMin: 12, repsMax: 8 })] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('repsMax')));
});

test('caps the number of days', () => {
  const routines = Array.from({ length: 8 }, (_, i) => ({ name: `Day ${i}`, ex: [{ name: '深蹲', sets: 3, reps: 5 }] }));
  const r = validateImport({ routines });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('at most 7')));
});
