import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

await import('../dist/assets/three.min.js');
await import('../.agents/skills/animasi-aliran-mesin/scripts/combustion-glow.js');
await import('../.agents/skills/animasi-aliran-mesin/scripts/flow-ribbons.js');
const {THREE, OrangMesinFire: Fire, OrangMesinFlow: Flow} = globalThis;
const style = JSON.parse(readFileSync(new URL('../.agents/skills/animasi-aliran-mesin/references/gaya-efek.json', import.meta.url)));

const cyl = (id, x) => ({id, position: [x, 0.5, 0], axis: [0, 1, 0], bore_m: 0.2, injector: [x, 0.65, 0]});
const cylinders = [cyl('c1', 0), cyl('c2', 0.2), cyl('c3', 0.4), cyl('c4', 0.6)];

test('fase nyala dari firing order: interval merata 720/4', () => {
  const f = Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4', 'c2'], style});
  assert.deepEqual(f.phases(), {c1: 0, c2: 540, c3: 180, c4: 360});
});

test('api menyala tepat setelah TMA silinder sesuai urutan, semburan sebelum TMA', () => {
  const f = Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4', 'c2'], style});
  f.setCrank(180 + 8);                       // c3 di puncak nyala
  assert.ok(f.probe('c3').flame > 0.99);
  assert.equal(f.probe('c4').flame, 0);
  f.setCrank(360 - 5);                       // c4 menjelang TMA: semburan, belum api
  assert.ok(f.probe('c4').spray > 0.3);
  assert.equal(f.probe('c4').flame, 0);
  f.setCrank(540 + 100);                     // c2 sudah meredup jauh di langkah usaha
  assert.ok(f.probe('c2').flame < 0.2);
});

test('jalan, jeda dan rpm menggerakkan sudut engkol dengan benar', () => {
  const f = Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4', 'c2'], style, rpm: 60});
  f.start(); f.update(0.05);
  assert.ok(Math.abs(f.crankDeg - 60 * 6 * 0.05) < 1e-9);  // 60 rpm = 360°/s
  f.pause(); const c = f.crankDeg; f.update(0.05); assert.equal(f.crankDeg, c);
});

test('timing dari manual mengalahkan gaya; urutan wajib lengkap', () => {
  const f = Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4', 'c2'], style, timing: {semburan_mulai_deg: -20}});
  assert.equal(f.style.semburan_mulai_deg, -20);
  assert.throws(() => Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4']}), /tepat sekali/);
  assert.throws(() => Fire.create(THREE, {cylinders}), /firingOrder/);
  const odd = Fire.create(THREE, {cylinders: cylinders.map((c, i) => ({...c, phase_deg: [0, 90, 450, 540][i]}))});
  assert.equal(odd.phases().c2, 90);
});

test('api tidak lebih lebar dari bore dan mengikuti piston turun', () => {
  const f = Fire.create(THREE, {cylinders, firingOrder: ['c1', 'c3', 'c4', 'c2'], style, kinematics: {stroke_m: 0.24, rod_length_m: 0.36}});
  f.setCrank(60);
  const flame = f.group.children.find(o => o.name === 'api:c1');
  assert.equal(flame.scale.x, 1);
  assert.ok(flame.position.y < 0.5);
});

test('gaya-efek.json dipakai pustaka aliran', () => {
  const routes = {links: {a: {geometry_basis: 'DOCUMENTED', spans: [{kind: 'exposed', points: [[0, 0, 0], [1, 0, 0]]}]}}};
  const changed = JSON.parse(JSON.stringify(style)); changed.media.lube_oil.color = '#123456';
  const f = Flow.create(THREE, {routes, medium: {a: 'lube_oil'}, style: changed});
  assert.equal(f.media.lube_oil.color, '#123456');
  assert.equal(f.media.fresh_water.color, style.media.fresh_water.color);
});
