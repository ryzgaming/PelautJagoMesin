import test from 'node:test';
import assert from 'node:assert/strict';
import {production3512cGraph,production3512cId,production3512cStages,reference3512c} from '../src/production-3512c.ts';
import {agentByKind} from '../src/organization.ts';
import {validate,execute} from '../src/flow.ts';

const variant = 'Caterpillar 3512C propulsi standar IMO II';

test('alur produksi CAT 3512C valid dan memuat 5 tahap', () => {
  const g = production3512cGraph();
  assert.equal(g.id, production3512cId);
  validate(g, true);
  assert.equal(g.nodes.length, 37);
  assert.deepEqual(production3512cStages.map(s => s.count), [8, 8, 6, 5, 7]);
  assert.equal(new Set(g.nodes.map(n => n.id)).size, g.nodes.length);
  for (const n of g.nodes) {
    assert.ok(n.name.length <= 80 && n.message.length <= 1000, n.id);
    if (n.kind.startsWith('agen-')) {
      assert.ok(agentByKind.has(n.kind), n.kind);
      assert.match(n.message, /\{catatan\}/, n.id + ' harus menyebut varian dari catatan');
    }
  }
});

test('produksi berjalan melewati 4 gerbang QA bila varian ditulis', () => {
  const result = execute(production3512cGraph(), {nama: 'Pemilik', email: '', catatan: variant});
  assert.equal(result.pending, null);
  assert.equal(result.trace.length, 36);
  assert.deepEqual(result.trace.filter(t => t.id.startsWith('g')).map(t => t.id), ['g1-bukti', 'g2-sistem', 'g3-model', 'g4-integrasi']);
  assert.match(result.confirmation, /Caterpillar 3512C propulsi standar IMO II selesai/);
  const order = result.trace.map(t => t.id);
  assert.ok(order.indexOf('b-dimensi') < order.indexOf('m-exterior'), 'dimensi dikunci sebelum pemodelan');
  assert.ok(order.indexOf('m-geometri') < order.indexOf('i-pipeline'), 'QA geometri sebelum integrasi');
  assert.ok(order.indexOf('r-chief') < order.indexOf('r-rilis'), 'tanda tangan teknis sebelum rilis');
});

test('produksi ditahan bila varian kosong', () => {
  const result = execute(production3512cGraph(), {nama: 'Pemilik', email: '', catatan: ''});
  assert.deepEqual(result.trace.map(t => t.id), ['order-3512c', 'cek-varian', 'tahan-varian']);
  assert.match(result.review, /Produksi ditahan/);
  assert.equal(result.confirmation, '');
});

test('angka acuan dan konflik data ikut diteruskan ke agent', () => {
  const g = production3512cGraph();
  const text = id => g.nodes.find(n => n.id === id).message;
  assert.match(text('b-dimensi'), /bore 170 mm, stroke 190 mm/);
  assert.match(text('b-dimensi'), /7411 kg vs 8104 kg/);
  assert.match(text('b-orchestrator'), /HD \(stroke 215 mm, 58,6 L\)/);
  assert.match(text('i-ui'), /Studio Gelap/);
  assert.match(text('r-rilis'), /premium-source\//);
  assert.equal(reference3512c.conflicts.length, 3);
  assert.match(reference3512c.source, /^https:\/\/www\.cat\.com\//);
});
