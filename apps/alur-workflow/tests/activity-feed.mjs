import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeActivity} from '../src/activity-merge.ts';

const a = id => ({id, at: '2026-11-26T10:00:00Z', worker: 'claude', kind: 'info', message: 'Langkah ' + id, url: null});
test('aktivitas baru digabung di atas tanpa duplikat dan dibatasi 50', () => {
  assert.deepEqual(mergeActivity([a(3), a(2)], [a(5), a(4), a(3)]).map(x => x.id), [5, 4, 3, 2]);
  const many = Array.from({length: 60}, (_, i) => a(i + 1));
  const merged = mergeActivity([], many);
  assert.equal(merged.length, 50);
  assert.equal(merged[0].id, 60);
});
