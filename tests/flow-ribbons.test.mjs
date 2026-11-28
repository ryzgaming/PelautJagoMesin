import test from 'node:test';
import assert from 'node:assert/strict';

// Kedua berkas berupa skrip UMD; di paket "type":"module" keduanya memasang global.
await import('../dist/assets/three.min.js');
await import('../.agents/skills/animasi-aliran-mesin/scripts/flow-ribbons.js');
const {THREE, OrangMesinFlow: Flow} = globalThis;

const routes = {links: {
  jw: {geometry_basis: 'DOCUMENTED', spans: [
    {kind: 'exposed', carrier: 'a', passage: 'p1', points: [[0, 0, 0], [1, 0, 0]]},
    {kind: 'hidden', carrier: 'b', passage: 'p2', points: [[1, 0, 0], [2, 0, 0]]}]},
  sw: {geometry_basis: 'INFERRED', status: 'partial', spans: [{kind: 'exposed', carrier: 'c', passage: 'p3', points: [[0, 1, 0], [1, 1, 0]]}]},
}};
const scope = {links: {jw: {circuit: 'c1'}, sw: {circuit: 'c2'}}, circuits: {c1: {medium: 'jacket water'}, c2: {medium: 'sea water'}}};

test('nama media bebas dipetakan ke palet', () => {
  const k = Flow.mediumKey;
  assert.equal(k('heavy fuel oil'), 'fuel');
  assert.equal(k('lube oil'), 'lube_oil');
  assert.equal(k('oli pelumas'), 'lube_oil');
  assert.equal(k('cooling sea water'), 'sea_water');
  assert.equal(k('jacket water HT'), 'fresh_water');
  assert.equal(k('exhaust gas'), 'exhaust');
  assert.equal(k('starting air'), 'start_air');
  assert.equal(k('charge air'), 'charge_air');
  assert.equal(k('plasma'), 'unknown');
});

test('pita dibuat per span, estimasi ditandai, hidden hanya saat X-ray', () => {
  const f = Flow.create(THREE, {routes, scope});
  const links = f.links();
  assert.deepEqual(links.map(l => [l.id, l.medium, l.estimated]), [['jw', 'fresh_water', false], ['sw', 'sea_water', true]]);
  assert.ok(Math.abs(links[0].length_m - 2) < 1e-6);
  assert.equal(f.group.children.length, 3);
  // jarak kumulatif menyambung antar span
  const s2 = f.group.children[1].geometry.attributes.aS.array;
  assert.ok(Math.min(...s2) >= 1 - 1e-6 && Math.max(...s2) <= 2 + 1e-6);
  f.start({fillSeconds: 0});
  for (let i = 0; i < 10; i++) f.update(0.05);
  assert.equal(f.probe('jw').visible !== undefined, true);
  assert.equal(f.warnings.length, 0);
});

test('probe mengikuti satu gelombang: naik saat jalan, diam saat jeda, lanjut dari fase sama', () => {
  const f = Flow.create(THREE, {routes, scope, ratedRpm: 1000});
  f.start({fillSeconds: 0});
  const a = f.probe('jw').fraction; f.update(0.05); const b = f.probe('jw').fraction;
  assert.ok(b > a);
  f.pause(); f.update(0.05); assert.equal(f.probe('jw').fraction, b);
  f.resume(); f.update(0.05); assert.ok(f.probe('jw').fraction > b);
  f.setRpm(0); const c = f.probe('jw').fraction; f.update(0.05); assert.equal(f.probe('jw').fraction, c);
});

test('rute wajib dan opsi sembunyikan estimasi', () => {
  assert.throws(() => Flow.create(THREE, {}), /routes.links/);
  assert.deepEqual(Flow.create(THREE, {routes, scope, showEstimated: false}).links().map(l => l.id), ['jw']);
});
