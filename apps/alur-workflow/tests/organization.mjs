import test from 'node:test';
import assert from 'node:assert/strict';
import {agents,divisions,accuracyStandards,definitionOfDone,agentByKind,agentKind} from '../src/features/agents/organization.ts';
import {organizationGraph,divisionOrder,organizationId} from '../src/features/agents/organization-graph.ts';
import {validate,execute,label,step} from '../src/features/workflow/flow.ts';

test('struktur organisasi berisi 57 agent unik di 8 divisi', () => {
  assert.equal(agents.length, 57);
  assert.equal(new Set(agents.map(a => a.id)).size, 57);
  assert.equal(divisions.length, 8);
  const counts = Object.fromEntries(divisions.map(d => [d.key, agents.filter(a => a.division === d.key).length]));
  assert.deepEqual(counts, {eksekutif: 4, kurikulum: 10, produk: 9, qa: 7, growth: 9, sales: 6, cs: 6, finance: 6});
  for (const d of divisions) assert.equal(agents.filter(a => a.division === d.key && a.lead).length, 1, d.key + ' butuh satu Lead');
  assert.deepEqual(divisionOrder.slice().sort(), divisions.map(d => d.key).sort());
});

test('fase aktivasi mengikuti rencana: 11, 11, 21, 14 agent', () => {
  const phase = n => agents.filter(a => a.phase === n).length;
  assert.deepEqual([phase(1), phase(2), phase(3), phase(4)], [11, 11, 21, 14]);
  assert.equal(agents.filter(a => a.production).length, 17);
  assert.ok(agents.filter(a => a.production).every(a => a.phase <= 2), 'lini produksi aktif di fase 1–2');
});

test('setiap agent punya kartu peran lengkap dan kewajiban ketelitian', () => {
  assert.equal(accuracyStandards.length, 10);
  assert.equal(definitionOfDone.length, 13);
  for (const a of agents) {
    assert.ok(a.name.trim() && a.short.trim() && a.mission.trim(), a.id);
    assert.ok(a.short.length <= 30, a.id + ' nama kotak terlalu panjang');
    for (const key of ['tasks', 'outputs', 'kpi', 'accuracy']) {
      assert.ok(Array.isArray(a[key]) && a[key].length > 0 && a[key].every(x => typeof x === 'string' && x.trim()), a.id + ' ' + key);
    }
    assert.equal(agentByKind.get(agentKind(a)), a);
    assert.equal(label(agentKind(a)), a.short);
  }
});

test('template kanvas memuat semua agent, valid, dan bisa diuji jalan', () => {
  const g = organizationGraph();
  assert.equal(g.id, organizationId);
  assert.equal(g.nodes.length, 58);
  assert.equal(g.edges.length, 57);
  validate(g, true);
  const result = execute(g, {nama: 'Pemilik', email: 'pemilik@example.com', catatan: 'Shinko GJ 80-25'});
  assert.equal(result.pending, null);
  assert.equal(result.trace.length, 58);
  assert.match(result.trace[1].detail, /Orchestrator/);
  const children = id => g.edges.filter(e => e.from === id).map(e => e.to);
  assert.deepEqual(children('arahan-pemilik'), ['agen-orchestrator']);
  const leads = agents.filter(a => a.lead && a.division !== 'eksekutif').map(a => 'agen-' + a.id);
  for (const id of leads) assert.ok(children('agen-orchestrator').includes(id), id + ' melapor ke Orchestrator');
  for (const a of agents.filter(a => !a.lead && a.division !== 'eksekutif')) {
    const boss = g.edges.find(e => e.to === 'agen-' + a.id).from;
    assert.equal(agentByKind.get(g.nodes.find(n => n.id === boss).kind).division, a.division, a.id + ' melapor ke kepala divisinya');
  }
  const x = new Map(g.nodes.map(n => [n.id, n.x]));
  for (const e of g.edges) assert.ok(x.get(e.to) > x.get(e.from), 'bawahan selalu di kanan atasan');
});

test('tugas agent diteruskan sebagai hasil ke langkah berikutnya', () => {
  const g = organizationGraph();
  const oem = g.nodes.find(n => n.kind === 'agen-oem-documentation');
  oem.message = 'Kumpulkan parts catalog {catatan}';
  const confirm = step('confirm', 'akhir', 0, 0);
  confirm.message = '{hasil}';
  const g2 = {...g, nodes: [...g.nodes, confirm], edges: [...g.edges.filter(e => e.from !== oem.id), {from: oem.id, port: 'out', to: 'akhir'}]};
  const run = execute(g2, {nama: 'A', email: '', catatan: 'Tanabe H-74'});
  assert.equal(run.confirmation, 'Kumpulkan parts catalog Tanabe H-74');
  assert.equal(run.trace.length, 59);
});

test('jenis agent tidak dikenal ditolak', () => {
  const g = organizationGraph();
  g.nodes[1].kind = 'agen-tidak-ada';
  assert.throws(() => validate(g), /Periksa konfigurasi langkah/);
});
