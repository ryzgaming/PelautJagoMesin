import test from 'node:test';
import assert from 'node:assert/strict';
import {splitMachine,productionBadges,roleNodes} from '../src/production-status.ts';
import {productionGraph} from '../src/production-machine.ts';

test('merk dan tipe dipisah dari satu kolom', () => {
  assert.deepEqual(splitMachine('Caterpillar 3512C'), {brand: 'Caterpillar', model: '3512C'});
  assert.deepEqual(splitMachine('  Alfa   Laval MAB 206S-24 '), {brand: 'Alfa Laval', model: 'MAB 206S-24'});
  assert.deepEqual(splitMachine('MAN B&W 6S50ME-C'), {brand: 'MAN B&W', model: '6S50ME-C'});
  assert.deepEqual(splitMachine('Tanabe H-74'), {brand: 'Tanabe', model: 'H-74'});
  assert.deepEqual(splitMachine('Yanmar'), {brand: 'Yanmar', model: ''});
});

test('setiap peran pipeline menunjuk kotak yang ada di bagan produksi', () => {
  const ids = new Set(productionGraph().nodes.map(n => n.id));
  assert.deepEqual(Object.keys(roleNodes).sort(), ['evidence', 'exterior', 'freshwater', 'fuel', 'intake-exhaust', 'integrator', 'internals', 'lubrication', 'qa', 'seawater']);
  for (const nodes of Object.values(roleNodes)) for (const id of nodes) assert.ok(ids.has(id), id);
});

test('status kotak mengikuti memori peran', () => {
  const b = productionBadges({status: 'running'}, [
    {role: 'evidence', status: 'DOCUMENTED'},
    {role: 'fuel', status: 'DOCUMENTED'},
    {role: 'freshwater', status: 'PARTIAL'},
    {role: 'seawater', status: 'DOCUMENTED'},
    {role: 'lubrication', status: 'NOT_APPLICABLE'},
  ]);
  assert.deepEqual(b.direktur, {tone: 'active', label: 'Sedang bekerja'});
  assert.equal(b.dimensi.tone, 'done');
  assert.equal(b['spesialis-diesel'].tone, 'pending', 'intake-exhaust belum selesai');
  assert.equal(b['spesialis-pendingin'].tone, 'warn', 'status terlemah dipakai');
  assert.equal(b['spesialis-pompa'].tone, 'na');
  assert.equal(b.pemodel.label, 'Menunggu');
});

test('sesi review dan sesi gagal', () => {
  const all = Object.keys(roleNodes).map(role => ({role, status: role === 'seawater' ? 'NOT_APPLICABLE' : 'DOCUMENTED'}));
  const done = productionBadges({status: 'review'}, all);
  assert.equal(done.direktur.label, 'Siap direview');
  assert.equal(done['spesialis-pendingin'].tone, 'done');
  assert.ok(Object.entries(done).every(([, v]) => v.tone === 'done'));
  const failed = productionBadges({status: 'failed'}, []);
  assert.equal(failed.pemodel.tone, 'failed');
  assert.equal(failed.direktur.label, 'Terhenti');
});
