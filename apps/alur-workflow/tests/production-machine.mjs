import test from 'node:test';
import assert from 'node:assert/strict';
import {productionGraph,productionId,productionField} from '../src/production-machine.ts';
import {agentByKind} from '../src/organization.ts';
import {validate,execute,singleField,usesNotes,step} from '../src/flow.ts';

const boss = (g, id) => g.edges.find(e => e.to === id)?.from;

test('produksi mesin 3D tersusun seperti bagan organisasi', () => {
  const g = productionGraph();
  assert.equal(g.id, productionId);
  validate(g, true);
  assert.equal(g.nodes.length, 29);
  const under = id => g.edges.filter(e => e.from === id).map(e => e.to);
  assert.deepEqual(under('direktur'), ['kepala-teknik', 'kepala-keuangan', 'kepala-produk', 'kepala-qa', 'arsip', 'laporan']);
  assert.equal(under('kepala-teknik').length, 7);
  assert.deepEqual(under('kepala-keuangan'), ['legal']);
  assert.equal(under('kepala-produk').length, 6);
  assert.equal(under('kepala-qa').length, 5);
  for (const n of g.nodes.filter(n => n.kind.startsWith('agen-'))) {
    assert.ok(agentByKind.has(n.kind), n.kind);
    assert.match(n.message, /\{catatan\}/, n.id + ' harus menyebut merk dan tipe');
    assert.ok(n.message.length <= 1000 && n.name.length <= 80, n.id);
    const lead = agentByKind.get(n.kind).lead;
    if (n.id !== 'direktur' && boss(g, boss(g, n.id)) === 'direktur') assert.ok(!lead, n.id + ' staf, bukan kepala');
  }
  const x = new Map(g.nodes.map(n => [n.id, n.x]));
  for (const e of g.edges) assert.ok(x.get(e.to) > x.get(e.from), 'bawahan selalu di kanan atasan');
});

test('formulir hanya meminta merk dan tipe mesin', () => {
  const g = productionGraph();
  assert.equal(singleField(g), productionField);
  assert.ok(usesNotes(g));
  assert.equal(singleField({...g, nodes: g.nodes.map(n => n.kind === 'trigger' ? {...n, value: ''} : n)}), '');
});

test('order berjalan dari direktur ke setiap divisi lalu laporan ke pemilik', () => {
  const r = execute(productionGraph(), {nama: '', email: '', catatan: 'Caterpillar 3512C'});
  assert.equal(r.pending, null);
  assert.equal(r.trace.length, 28);
  const ids = r.trace.map(t => t.id);
  assert.deepEqual(ids.slice(0, 4), ['order-pemilik', 'cek-order', 'direktur', 'kepala-teknik']);
  assert.ok(ids.indexOf('dimensi') < ids.indexOf('pemodel'), 'dimensi dikunci sebelum pemodelan');
  assert.ok(ids.indexOf('legal') < ids.indexOf('rilis'), 'legal sebelum rilis');
  assert.equal(ids.at(-1), 'laporan');
  assert.ok(!ids.includes('tahan-order'));
  assert.match(r.confirmation, /^Work order Caterpillar 3512C sudah dibuka/);
  assert.match(r.trace.find(t => t.id === 'dimensi').detail, /Caterpillar 3512C/);
});

test('order kosong ditahan', () => {
  const r = execute(productionGraph(), {nama: '', email: '', catatan: '  '});
  assert.deepEqual(r.trace.map(t => t.id), ['order-pemilik', 'cek-order', 'tahan-order']);
  assert.match(r.review, /Produksi ditahan/);
});

test('hanya agent yang boleh mendelegasikan ke banyak langkah', () => {
  const g = productionGraph();
  const extra = step('review', 'ekstra', 0, 0);
  assert.doesNotThrow(() => validate({...g, nodes: [...g.nodes, extra], edges: [...g.edges, {from: 'kepala-qa', port: 'out', to: 'ekstra'}]}));
  assert.throws(() => validate({...g, nodes: [...g.nodes, extra], edges: [...g.edges, {from: 'tahan-order', port: 'out', to: 'ekstra'}, {from: 'laporan', port: 'out', to: 'ekstra'}, {from: 'laporan', port: 'out', to: 'tahan-order'}]}), /Sambungan tidak valid/);
  assert.throws(() => validate({...g, edges: [...g.edges, {from: 'kepala-qa', port: 'out', to: 'auditor'}]}), /Sambungan tidak valid/);
});

test('langkah yang dicapai dua atasan hanya dijalankan sekali', () => {
  const g = productionGraph();
  const r = execute({...g, edges: [...g.edges, {from: 'kepala-produk', port: 'out', to: 'auditor'}]}, {nama: '', email: '', catatan: 'Tanabe H-74'});
  assert.equal(r.trace.filter(t => t.id === 'auditor').length, 1);
  assert.equal(r.trace.length, 28);
});
