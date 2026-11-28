import test from 'node:test';
import assert from 'node:assert/strict';
import {claudeTeamGraph,claudeTeamId,claudeRoles,claudeTeamOrigin} from '../src/features/agents/claude-team.ts';
import {productionField} from '../src/features/machines/production-machine.ts';
import {divisionByKey} from '../src/features/agents/organization.ts';
import {validate,execute,singleField} from '../src/features/workflow/flow.ts';

test('Tim produksi Claude: Koordinator membawahi 10 subagen dan laporan ke pemilik', () => {
  const g = claudeTeamGraph();
  assert.equal(g.id, claudeTeamId);
  validate(g, true);
  const under = id => g.edges.filter(e => e.from === id).map(e => e.to);
  assert.deepEqual(under('koordinator'), [...claudeRoles.map(r => r.id), 'laporan']);
  assert.equal(claudeRoles.length, 10);
  assert.deepEqual(under('qa-independen'), ['agen-produksi']);
  const p = g.nodes.find(n => n.id === 'agen-produksi');
  assert.equal(p.kind, 'produksi'); assert.equal(p.value, 'claude-opus-5-5'); assert.equal(p.message, '40');
  const x = new Map(g.nodes.map(n => [n.id, n.x]));
  for (const e of g.edges) assert.ok(x.get(e.to) > x.get(e.from), 'bawahan selalu di kanan atasan');
});

test('setiap subagen punya kartu peran lengkap dan divisi yang valid', () => {
  const g = claudeTeamGraph();
  for (const n of g.nodes.filter(n => n.kind === 'custom-agent')) {
    assert.ok(n.message.startsWith(claudeTeamOrigin), n.id + ' menyebut asal template');
    for (const s of ['Misi: ', 'Tugas:', '\n- ', 'Keluaran: ', 'Aturan: ']) assert.ok(n.message.includes(s), n.id + ' memuat ' + s.trim());
    assert.ok(divisionByKey.has(n.value), n.id + ' divisi ' + n.value);
    assert.ok(n.name.length <= 80 && n.message.length <= 50000, n.id);
  }
  const qa = g.nodes.find(n => n.id === 'qa-independen');
  assert.match(qa.message, /maksimal dua putaran perbaikan/);
  assert.match(g.nodes.find(n => n.id === 'exterior-modeler').message, /enam sudut/);
});

test('formulir hanya meminta merk dan tipe; order berjalan dari bukti sampai QA lalu laporan', () => {
  const g = claudeTeamGraph();
  assert.equal(singleField(g), productionField);
  const r = execute(g, {nama: '', email: '', catatan: 'Caterpillar 3512C'});
  assert.equal(r.pending, null);
  const ids = r.trace.map(t => t.id);
  assert.deepEqual(ids.slice(0, 3), ['order-pemilik', 'cek-order', 'koordinator']);
  for (const [a, b] of [['evidence-dokumen', 'dimensi-datum'], ['dimensi-datum', 'exterior-modeler'], ['exterior-modeler', 'integrator'], ['integrator', 'qa-independen']])
    assert.ok(ids.indexOf(a) < ids.indexOf(b), a + ' sebelum ' + b);
  assert.equal(ids.at(-1), 'laporan');
  assert.ok(ids.indexOf('qa-independen') < ids.indexOf('agen-produksi'));
  assert.deepEqual(r.production.options, {ai_model: 'claude-opus-5-5', budget_usd: 40});
  assert.match(r.confirmation, /^Produksi Caterpillar 3512C dibuka oleh Tim produksi Claude/);
  assert.match(r.trace.find(t => t.id === 'integrator').detail, /^Diserahkan ke Integrator \(Tim produksi Claude\): /);
});

test('order kosong ditahan', () => {
  const r = execute(claudeTeamGraph(), {nama: '', email: '', catatan: ' '});
  assert.deepEqual(r.trace.map(t => t.id), ['order-pemilik', 'cek-order', 'tahan-order']);
});
