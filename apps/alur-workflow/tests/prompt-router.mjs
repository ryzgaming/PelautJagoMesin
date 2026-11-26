import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPrompt,routePrompt,promptWarnings} from '../src/prompt-router.ts';
import {step,validate,execute,label,usesNotes} from '../src/flow.ts';

const agentsIn = ['parts-inventory','modeling-3d','assembly-kinematics','simulator','diesel-specialist','component-writer','memory-knowledge'];
function graph(prompt) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('router','router',500,0),
    ...agentsIn.map((id,i) => step('agen-'+id, id, 800, i*120))];
  nodes[1].message = prompt;
  const edges = [{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'router'},
    ...agentsIn.map(id => ({from:'router',port:'out',to:id}))];
  return {id:'uji-prompt',name:'Uji prompt',revision:0,nodes,edges};
}

test('prompt dipecah per baris, titik koma, dan kalimat tanpa nomor butir', () => {
  assert.deepEqual(splitPrompt('1. Cari manual OEM. 2) Buat model 3D; - Simulasikan pompa\n\nTolong rapikan.'),
    ['Cari manual OEM','Buat model 3D','Simulasikan pompa','Tolong rapikan']);
  assert.deepEqual(splitPrompt('  \n dan \n'), []);
});

test('Agent prompt dan Pembagi tugas tersedia sebagai langkah valid', () => {
  assert.equal(label('prompt'), 'Agent prompt');
  assert.equal(label('router'), 'Pembagi tugas');
  validate(graph('Buat model 3D blok silinder'), true);
  const g = graph('');
  assert.ok(usesNotes(g), 'prompt kosong memakai kolom Catatan formulir');
});

test('setiap tugas diserahkan ke agent yang cocok; agent tanpa tugas dilewati', () => {
  const prompt = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder\nPeriksa firing order dan timing katup\nAtur urutan bongkar pasang dan exploded view';
  const r = execute(graph(prompt), {nama:'',email:'',catatan:''});
  const ran = r.trace.map(t => t.id);
  for (const id of ['prompt','router','parts-inventory','modeling-3d','diesel-specialist','assembly-kinematics']) assert.ok(ran.includes(id), id);
  for (const id of ['component-writer','memory-knowledge']) assert.ok(!ran.includes(id), id+' tidak mendapat tugas');
  assert.match(r.trace.find(t => t.id === 'modeling-3d').detail, /model 3D blok silinder/);
  assert.deepEqual(r.warnings, []);
});

test('tugas yang tidak cocok dengan agent mana pun menjadi peringatan', () => {
  const prompt = 'Buat model 3D blok silinder\nHitung pajak penjualan bulan ini\nPasang iklan Facebook untuk promosi';
  const r = execute(graph(prompt), {nama:'',email:'',catatan:''});
  assert.deepEqual(r.warnings, ['Tidak ada agent yang cocok untuk: Hitung pajak penjualan bulan ini','Tidak ada agent yang cocok untuk: Pasang iklan Facebook untuk promosi']);
  const w = promptWarnings(graph(prompt));
  assert.deepEqual(w.prompt.unmatched, ['Hitung pajak penjualan bulan ini','Pasang iklan Facebook untuk promosi']);
  assert.deepEqual(w.router.unmatched, w.prompt.unmatched);
});

test('prompt kosong memakai catatan formulir; menyebut nama agent menunjuk langsung', () => {
  const r = execute(graph(''), {nama:'',email:'',catatan:'Simulator: rapikan tampilan'});
  assert.ok(r.trace.some(t => t.id === 'simulator'));
  const only = routePrompt('Minta Memory & Knowledge mencatat ini', [{id:'m',kind:'agen-memory-knowledge',name:'Memory & Knowledge',message:''},{id:'s',kind:'agen-simulator',name:'Simulator',message:''}]);
  assert.deepEqual(only.tasks.map(t => t.targets), [['m']]);
});

test('Pembagi tugas tanpa agent tersambung diberi peringatan dan menolak dijalankan', () => {
  const g = graph('Buat model 3D');
  g.nodes = g.nodes.filter(n => !n.kind.startsWith('agen-'));
  g.edges = g.edges.filter(e => e.from !== 'router');
  assert.match(promptWarnings(g).router.note, /Belum ada agent/);
  assert.throws(() => execute(g, {nama:'',email:'',catatan:''}), /hubungkan ke setidaknya satu agent/);
});
