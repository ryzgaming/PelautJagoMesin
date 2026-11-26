import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStructure,spliceStructure,structurePlan} from '../src/structure.ts';
import {applyHiring} from '../src/hrd.ts';
import {step,validate,execute,label} from '../src/flow.ts';
import {routerTargets} from '../src/prompt-router.ts';

const team = ['modeling-3d','assembly-kinematics','geometry-qa','visual-qa','oem-documentation'];
function graph(prompt, ids = team) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('hrd','hrd',500,0), step('router','router',750,200),
    ...ids.map((id,i) => step('agen-'+id, id, 1050, i*110))];
  nodes[1].message = prompt;
  return {id:'uji-struktur',name:'Uji struktur',revision:0,nodes,edges:[{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'hrd'},
    {from:'hrd',port:'out',to:'router'},...ids.map(id => ({from:'router',port:'out',to:id}))]};
}
const withStructure = (g) => spliceStructure(g, step('struktur','struktur',0,0));
const kids = (g, id) => g.edges.filter(e => e.from === id).map(e => e.to).sort();

test('Agent Struktur adalah langkah valid dan otomatis tersambung ke Pembagi tugas', () => {
  assert.equal(label('struktur'), 'Agent Struktur');
  const g = withStructure(graph('Buat model 3D blok silinder'));
  assert.deepEqual(kids(g, 'hrd'), ['struktur']);
  assert.deepEqual(kids(g, 'struktur'), ['router']);
  validate(g, true);
});

test('agent di bawah Pembagi tugas disusun bercabang per divisi: kepala divisi → staf', () => {
  const before = withStructure(graph('Buat model 3D blok silinder'));
  const plan = structurePlan(before, 'struktur');
  assert.ok(plan.changed);
  assert.deepEqual(plan.branches.map(b => [b.label, b.head.name, b.staff.map(s => s.id)]),
    [['Produk & Teknik', 'CTO', ['modeling-3d','assembly-kinematics']], ['QA & Keamanan', 'QA Lead', ['geometry-qa','visual-qa']]]);
  assert.deepEqual(plan.direct.map(d => d.id), ['oem-documentation']);
  const {graph:g, changed, branches} = applyStructure(before);
  assert.ok(changed); assert.deepEqual(branches, ['CTO','QA Lead']);
  validate(g, true);
  assert.deepEqual(kids(g, 'router'), ['oem-documentation','struktur-produk','struktur-qa']);
  assert.deepEqual(kids(g, 'struktur-produk'), ['assembly-kinematics','modeling-3d']);
  assert.deepEqual(kids(g, 'struktur-qa'), ['geometry-qa','visual-qa']);
  // Pembagi tugas tidak berpindah; kepala di kolom kanannya, staf di kolom berikutnya.
  const at = id => g.nodes.find(n => n.id === id);
  assert.deepEqual([at('router').x, at('router').y], [750, 200]);
  assert.ok(at('struktur-produk').x > at('router').x && at('modeling-3d').x > at('struktur-produk').x);
  // Tim Pembagi tugas tetap mencakup semua agent, termasuk staf di dalam cabang.
  assert.deepEqual(routerTargets(g, 'router').map(n => n.id).sort(), ['geometry-qa','modeling-3d','assembly-kinematics','oem-documentation','struktur-produk','struktur-qa','visual-qa'].sort());
  // Menyusun lagi tidak mengubah apa pun (posisi yang digeser pengguna tetap).
  const again = applyStructure(g);
  assert.equal(again.changed, false); assert.equal(again.graph, g);
  assert.equal(structurePlan(g, 'struktur').changed, false);
});

test('saat diuji, tugas mengalir turun lewat kepala cabang ke staf yang cocok; cabang tanpa tugas dilewati', () => {
  const g = applyStructure(withStructure(graph('Buat model 3D blok silinder dari dimensi acuan\nUkur ulang geometri model terhadap dimensi acuan dengan toleransi'))).graph;
  const r = execute(g, {nama:'', email:'', catatan:''});
  const ran = r.trace.map(t => t.id);
  assert.ok(ran.includes('struktur-produk') && ran.includes('modeling-3d'));
  assert.ok(ran.includes('struktur-qa') && ran.includes('geometry-qa'));
  assert.ok(ran.indexOf('struktur-produk') < ran.indexOf('modeling-3d'));
  assert.ok(!ran.includes('oem-documentation'), 'agent tanpa tugas tidak dijalankan');
  assert.match(r.trace.find(t => t.id === 'struktur-produk').detail, /Kepala cabang: meneruskan tugas ke 3D Modeling/);
  assert.match(r.trace.find(t => t.id === 'struktur').detail, /Struktur 2 cabang: CTO, QA Lead/);
  const owners = Object.fromEntries(r.assignments.map(a => [a.id, a.tasks]));
  assert.ok(owners['modeling-3d']?.some(t => t.startsWith('Buat model 3D')));
  assert.ok(owners['geometry-qa']?.some(t => t.startsWith('Ukur ulang geometri')));
});

test('agent yang direkrut Agent HRD ikut masuk cabang divisinya, dan keduanya stabil', () => {
  const start = withStructure(graph('Buat model 3D blok silinder\nHitung pajak penjualan bulan ini', ['assembly-kinematics']));
  const hired = applyHiring(start);
  assert.ok(hired.added.includes('3D Modeling'), hired.added.join());
  const {graph:g, changed} = applyStructure(hired.graph);
  assert.ok(changed);
  validate(g, true);
  const plan = structurePlan(g, 'struktur');
  const produk = plan.branches.find(b => b.label === 'Produk & Teknik');
  assert.ok(produk && produk.staff.length >= 2, JSON.stringify(plan.branches));
  // Rekrut dan susun lagi: tidak ada perubahan (tidak berputar terus di editor).
  assert.equal(applyHiring(g).added.length, 0);
  assert.equal(applyStructure(g).changed, false);
});

test('kepala buatan Agent Struktur dilepas bila stafnya tinggal satu; mode manual hanya lewat tombol', () => {
  let g = applyStructure(withStructure(graph('Buat model 3D'))).graph;
  g = {...g, nodes:g.nodes.filter(n => n.id !== 'assembly-kinematics'), edges:g.edges.filter(e => e.to !== 'assembly-kinematics')};
  const r = applyStructure(g);
  assert.ok(r.changed);
  assert.ok(!r.graph.nodes.some(n => n.id === 'struktur-produk'));
  assert.ok(kids(r.graph, 'router').includes('modeling-3d'));
  validate(r.graph, true);

  const manual = withStructure(graph('Buat model 3D'));
  manual.nodes.find(n => n.id === 'struktur').value = 'manual';
  assert.equal(applyStructure(manual).changed, false);
  assert.equal(structurePlan(manual, 'struktur').auto, false);
  assert.ok(applyStructure(manual, 'struktur').changed);
});

test('tanpa Agent Struktur, Pembagi tugas tetap membagi langsung seperti sebelumnya', () => {
  const g = graph('Buat model 3D blok silinder');
  assert.equal(applyStructure(g).changed, false);
  const r = execute(g, {nama:'', email:'', catatan:''});
  assert.ok(r.trace.some(t => t.id === 'modeling-3d'));
  assert.ok(!r.trace.some(t => t.id === 'oem-documentation'));
});
