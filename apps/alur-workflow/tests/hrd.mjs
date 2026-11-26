import test from 'node:test';
import assert from 'node:assert/strict';
import {hrdPlan,applyHiring,vacancy} from '../src/hrd.ts';
import {step,validate,execute,label} from '../src/flow.ts';

function graph(prompt, ids = ['parts-inventory','modeling-3d','diesel-specialist']) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('hrd','hrd',500,0), step('router','router',750,0),
    ...ids.map((id,i) => step('agen-'+id, id, 1050, i*110))];
  nodes[1].message = prompt;
  return {id:'uji-hrd',name:'Uji HRD',revision:0,nodes,edges:[{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'hrd'},
    {from:'hrd',port:'out',to:'router'},...ids.map(id => ({from:'router',port:'out',to:id}))]};
}
const prompt = 'Buat model 3D blok silinder\nHitung pajak penjualan bulan ini\nPasang iklan Facebook untuk promosi\nMasak makan siang untuk kru';

test('Agent HRD adalah langkah valid di antara Agent prompt dan Pembagi tugas', () => {
  assert.equal(label('hrd'), 'Agent HRD');
  validate(graph(prompt), true);
});

test('HRD memilih agent organisasi yang dibutuhkan dan membuka lowongan untuk sisanya', () => {
  const plan = hrdPlan(graph(prompt), 'hrd');
  assert.deepEqual(plan.hires.map(h => h.agent.id), ['tax-compliance','performance-ads']);
  assert.deepEqual(plan.vacancies.map(v => v.task), ['Masak makan siang untuk kru']);
  const v = plan.vacancies[0];
  assert.match(v.summary, /^Dibutuhkan agent Spesialis/);
  assert.ok(v.reportsTo && v.duties.length && v.rules.length && v.skills.length);
});

test('rekrut otomatis memasang agent di bawah Pembagi tugas lalu tugasnya dibagikan', () => {
  const {graph:g, added} = applyHiring(graph(prompt));
  assert.deepEqual(added, ['Tax & Compliance','Performance Ads']);
  validate(g, true);
  assert.equal(hrdPlan(g,'hrd').hires.length, 0, 'tidak merekrut dua kali');
  const r = execute(g, {nama:'',email:'',catatan:''});
  assert.ok(r.trace.some(t => t.id === 'hrd-tax-compliance' && /pajak/.test(t.detail)));
  assert.deepEqual(r.recruit, [], 'lowongan sudah menjadi Agent baru');
  assert.match(r.trace.find(t => t.id === 'hrd').detail, /Semua tugas sudah punya agent/);
  // Tanpa rekrut otomatis, waktu dijalankan HRD tetap melaporkan agent yang dicari.
  const raw = execute(graph(prompt), {nama:'',email:'',catatan:''});
  assert.deepEqual(raw.recruit.map(v => v.task), ['Masak makan siang untuk kru']);
  assert.match(raw.trace.find(t => t.id === 'hrd').detail, /Mencari 1 agent baru/);
});

test('mode manual tidak menambah agent kecuali diminta', () => {
  const g = graph(prompt); g.nodes.find(n => n.id === 'hrd').value = 'manual';
  assert.equal(applyHiring(g).added.length, 0);
  assert.equal(applyHiring(g, 'hrd').added.length, 2);
});

test('agent yang sudah ada di bagan disambungkan, bukan digandakan', () => {
  const g = graph('Hitung pajak penjualan bulan ini');
  g.nodes.push(step('agen-tax-compliance','pajak',1050,400));
  const {graph:next} = applyHiring(g);
  assert.equal(next.nodes.filter(n => n.kind === 'agen-tax-compliance').length, 1);
  assert.ok(next.edges.some(e => e.from === 'router' && e.to === 'pajak'));
});

test('profil lowongan menebak divisi dari kata petunjuk', () => {
  assert.equal(vacancy('Buat kampanye TikTok untuk alumni').division, 'Growth & Marketing');
  assert.equal(vacancy('Masak nasi goreng').division, 'Belum ditentukan');
});

test('lowongan otomatis menjadi Agent baru yang menerima tugasnya', () => {
  const {graph:g, added, created} = applyHiring(graph(prompt));
  assert.deepEqual(added, ['Tax & Compliance','Performance Ads']);
  assert.equal(created.length, 1);
  const made = g.nodes.find(n => n.kind === 'custom-agent');
  assert.equal(made.name, created[0]);
  assert.match(made.message, /^Misi: /);
  assert.match(made.message, /^- Masak makan siang untuk kru$/m);
  assert.ok(g.edges.some(e => e.from === 'router' && e.to === made.id));
  validate(g, true);
  const plan = hrdPlan(g, 'hrd');
  assert.equal(plan.vacancies.length, 0, 'tidak ada lowongan tersisa');
  assert.equal(applyHiring(g).created.length, 0, 'tidak membuat dua kali');
  const r = execute(g, {nama:'',email:'',catatan:''});
  assert.deepEqual(r.warnings, []);
  assert.match(r.trace.find(t => t.id === made.id).detail, /agent baru.*Masak makan siang/);
});

test('Agent baru tidak merebut tugas lain lewat baris aturan dan atasan', () => {
  const {graph:g} = applyHiring(graph(prompt + '\nCatat setiap halaman dokumen sumber'));
  const made = g.nodes.filter(n => n.kind === 'custom-agent');
  const r = execute(g, {nama:'',email:'',catatan:''});
  for (const m of made) assert.ok(!/halaman dokumen/.test(r.trace.find(t => t.id === m.id)?.detail ?? '') || /^Spesialis Halaman/.test(m.name), m.name);
});

test('divisi Agent baru harus dikenal', () => {
  const {graph:g} = applyHiring(graph(prompt));
  g.nodes.find(n => n.kind === 'custom-agent').value = 'bukan-divisi';
  assert.throws(() => validate(g), /divisi Agent baru/);
});
