import test from 'node:test';
import assert from 'node:assert/strict';
import {step,validate,execute,label} from '../src/features/workflow/flow.ts';
import {routerTargets} from '../src/features/agents/prompt-router.ts';
import {checklist,gathers} from '../src/features/workflow/gather.ts';

const agentsIn = ['parts-inventory','modeling-3d','diesel-specialist','component-writer'];
const prompt = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder\nPeriksa firing order dan timing katup';
/** Prompt → Pembagi tugas → agent → Penghimpun → Agen Produksi. */
function graph(collector = step('himpun','himpun',1100,0)) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('router','router',500,0),
    ...agentsIn.map((id,i) => step('agen-'+id, id, 800, i*120)), collector, step('produksi','produksi',1400,0)];
  nodes[1].message = prompt;
  const edges = [{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'router'},
    ...agentsIn.map(id => ({from:'router',port:'out',to:id})),
    ...agentsIn.map(id => ({from:id,port:'out',to:collector.id})),
    {from:collector.id,port:'out',to:'produksi'}];
  return {id:'uji-himpun',name:'Uji himpun',revision:0,nodes,edges};
}

test('Penghimpun dan Agen Produksi tersedia sebagai langkah', () => {
  assert.equal(label('himpun'), 'Penghimpun');
  assert.equal(label('produksi'), 'Agen Produksi');
  validate(graph(), true);
});

test('Penghimpun menunggu semua agent yang bekerja lalu mengumpulkan hasil semuanya', () => {
  const r = execute(graph(), {nama:'',email:'',catatan:''});
  const ids = r.trace.map(t => t.id);
  const worked = ['parts-inventory','modeling-3d','diesel-specialist'];
  for (const id of worked) assert.ok(ids.indexOf(id) < ids.indexOf('himpun'), id+' selesai sebelum Penghimpun');
  assert.ok(!ids.includes('component-writer'), 'agent tanpa tugas dilewati');
  const himpun = r.trace.find(t => t.id === 'himpun');
  assert.match(himpun.detail, /Menghimpun hasil dari 3 langkah/);
  assert.match(himpun.detail, /1 tidak mengirim hasil .*Component Writer/);
  assert.equal(ids.at(-1), 'produksi', 'Agen Produksi paling akhir');
  assert.equal(ids.filter(id => id === 'himpun').length, 1, 'Penghimpun berjalan sekali');
});

test('Penghimpun tidak menerima tugas dan tidak dianggap staf agent', () => {
  const g = graph();
  assert.ok(!routerTargets(g, 'router').some(n => n.id === 'himpun' || n.id === 'produksi'));
  const r = execute(g, {nama:'',email:'',catatan:''});
  assert.ok(!r.assignments.some(a => a.id === 'himpun'));
  for (const t of r.trace.filter(t => agentsIn.includes(t.id))) assert.doesNotMatch(t.detail, /Kepala cabang/);
});

test('Agent baru bernama Penghimpun juga mengumpulkan hasil (bagan lama)', () => {
  const old = step('custom-agent','penghimpun',1100,0);
  old.name = 'Agent Penghimpun'; old.message = 'Misi: menghimpun hasil\nTugas:\n- Kumpulkan hasil kerja semua agent';
  assert.ok(gathers(old));
  const r = execute(graph(old), {nama:'',email:'',catatan:''});
  assert.match(r.trace.find(t => t.id === 'penghimpun').detail, /Menghimpun hasil dari 3 langkah/);
  assert.ok(!r.assignments.some(a => a.id === 'penghimpun'));
});

test('Agen Produksi memeriksa setiap agent dengan daftar periksanya dan mengirim ke review', () => {
  const r = execute(graph(), {nama:'',email:'',catatan:''});
  assert.equal(r.production.reviews.length, 3);
  for (const rv of r.production.reviews) assert.ok(rv.checks.length > 0 && rv.hasil.trim(), rv.name);
  const modeling = r.production.reviews.find(rv => rv.id === 'modeling-3d');
  assert.deepEqual(modeling.checks, checklist({kind:'agen-modeling-3d',name:'',message:''}));
  assert.match(r.review, /3 agent diperiksa.*dashboard untuk ditinjau/);
  assert.match(r.hasil, /## Parts Inventory/);
});

test('Agen Produksi harus langkah terakhir dan hanya satu', () => {
  const g = graph();
  assert.throws(() => validate({...g, nodes:[...g.nodes, step('review','akhir',1700,0)], edges:[...g.edges,{from:'produksi',port:'out',to:'akhir'}]}), /langkah terakhir/);
  assert.throws(() => validate({...g, nodes:[...g.nodes, step('produksi','produksi2',1700,0)]}), /satu Agen Produksi/);
});

test('daftar periksa Agent baru memakai tugas, kemampuan, dan aturan di kartunya', () => {
  const list = checklist({kind:'custom-agent', name:'Spesialis Turbo', message:'Misi: turbo\nTugas:\n- Ukur turbocharger\nKemampuan: membaca manual turbo\nMelapor ke: Diesel\nAturan: tanpa tebakan'});
  assert.deepEqual(list, ['Menyelesaikan: Ukur turbocharger','Memakai kemampuan: membaca manual turbo','Mematuhi aturan: tanpa tebakan']);
});

test('brief produksi membawa tugas Agen Produksi untuk peran QA pekerja', async () => {
  const {buildBrief, validBrief} = await import('../src/features/machines/production-brief.ts');
  const {producerRule} = await import('../src/features/workflow/gather.ts');
  const g = graph();
  const b = buildBrief(g, execute(g, {nama:'',email:'',catatan:''}));
  assert.equal(b.rules[0], producerRule);
  assert.ok(validBrief(b));
  const without = {...g, nodes: g.nodes.filter(n => n.kind !== 'produksi'), edges: g.edges.filter(e => e.to !== 'produksi')};
  assert.ok(!buildBrief(without, execute(without, {nama:'',email:'',catatan:''})).rules.includes(producerRule));
});
