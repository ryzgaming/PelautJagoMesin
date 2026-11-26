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

test('prompt besar (hingga 50.000 karakter) diterima, dibagikan, dan tetap cepat', async () => {
  const {promptMax} = await import('../src/prompt-router.ts');
  const lines = ['# Rencana produksi Caterpillar 3512C', 'Konteks:', 'Mesin induk kapal tunda, 16 silinder.',
    '1. Susun daftar komponen bertingkat dengan part number', '2. Buat model 3D blok silinder', '- Periksa firing order dan timing katup',
    '**Atur urutan bongkar pasang dan exploded view**', '```', 'Hitung pajak penjualan bulan ini'];
  let big = lines.join('\n');
  while (big.length < 30000) big += '\nCatatan tambahan nomor ' + big.length + ' untuk tim produksi agar membaca manual OEM dengan teliti.';
  assert.ok(big.length >= 30000 && big.length < promptMax);
  const g = graph(big);
  validate(g, true);
  const tasks = splitPrompt(big);
  assert.ok(!tasks.includes('Rencana produksi Caterpillar 3512C') && !tasks.includes('Konteks'), 'judul dan label tidak dihitung');
  assert.ok(tasks.includes('Atur urutan bongkar pasang dan exploded view'));
  const started = performance.now();
  const r = execute(g, {nama:'',email:'',catatan:''});
  promptWarnings(g);
  assert.ok(performance.now() - started < 3000, 'pembagian prompt besar harus cepat');
  for (const id of ['parts-inventory','modeling-3d','diesel-specialist','assembly-kinematics']) assert.ok(r.trace.some(t => t.id === id), id);
  const tooBig = graph('x'.repeat(promptMax + 1));
  assert.throws(() => validate(tooBig), /Periksa konfigurasi langkah/);
});

test('tugas di atas batas dilaporkan sebagai tidak terbaca, bukan hilang diam-diam', async () => {
  const {taskMax,droppedTasks,promptMax} = await import('../src/prompt-router.ts');
  const lines = Array.from({length: taskMax + 12}, (_, i) => 'Model 3D no ' + (i + 1));
  const text = lines.join('\n');
  assert.equal(splitPrompt(text).length, taskMax);
  assert.equal(droppedTasks(text).length, 12);
  assert.equal(droppedTasks(text)[0], 'Model 3D no ' + (taskMax + 1));
  assert.ok(text.length < promptMax, 'muat dalam satu Agent prompt');
  const g = graph(text);
  assert.equal(promptWarnings(g).prompt.dropped.length, 12);
  const r = execute(g, {nama:'',email:'',catatan:''});
  assert.ok(r.warnings.some(w => /^Tidak terbaca: 12 tugas/.test(w)));
});

test('prompt 50.000 karakter dengan ratusan tugas pendek terbaca seluruhnya', async () => {
  const {promptMax,droppedTasks} = await import('../src/prompt-router.ts');
  const kinds = ['Buat model 3D blok silinder varian ','Periksa firing order silinder ','Susun daftar komponen dengan part number '];
  let text = '', i = 0;
  while (text.length < promptMax - 200) text += kinds[i % 3] + (i++) + '\n';
  const tasks = splitPrompt(text);
  assert.ok(tasks.length > 1000, 'lebih dari 1.000 tugas');
  assert.equal(droppedTasks(text).length, 0);
  const started = performance.now();
  const g = graph(text);
  const w = promptWarnings(g);
  assert.equal(w.prompt.dropped.length, 0);
  assert.equal(w.router.unmatched.length, 0);
  assert.ok(performance.now() - started < 3000, 'tetap cepat');
});

test('daftar pendek digabung dengan labelnya; tanda chat, judul kapital, tautan, dan keterangan tidak dihitung', () => {
  const text = ['[26/11/2026 20:45] Rxyzッ: MASTER PROMPT — DRCE UNIVERSAL', 'Project: Orang Mesin — Pelaut Jago Mesin', 'https://github.com/ryzgaming/PelautJagoMesin.git',
    'PROJECT CONTEXT', 'Tujuan proyek adalah platform pembelajaran permesinan yang realistis.',
    'UNIVERSAL APPLICABILITY', 'Terapkan pada mesin berikut:', '- Boiler', '- Winch', '- Steering Gear',
    '[26/11/2026 20:45] Rxyzッ: Platform video:', '- YouTube', '- Vimeo', '- TikTok',
    'Level A — Complete machine search', '- Complete machine', '- Complete overhaul',
    'Buat model 3D blok silinder.', 'Simulator: rapikan tampilan'].join('\n');
  assert.deepEqual(splitPrompt(text), [
    'Terapkan pada mesin berikut: Boiler, Winch, Steering Gear',
    'Platform video: YouTube, Vimeo, TikTok',
    'Level A — Complete machine search: Complete machine, Complete overhaul',
    'Buat model 3D blok silinder',
    'Simulator: rapikan tampilan']);
});

test('kata yang hanya mirip awalannya tidak dianggap cocok ("complete" bukan "compliance")', () => {
  const nodes = ['tax-compliance','production-pipeline'].map(id => ({id, kind:'agen-'+id, name:id, message:''}));
  const r = routePrompt('Complete overhaul and complete disassembly', nodes);
  assert.ok(!r.tasks.some(t => t.targets.includes('tax-compliance')), JSON.stringify(r));
});

test('hasil uji memuat daftar lengkap tugas per agent untuk laporan', async () => {
  const {reportMarkdown} = await import('../src/report.ts');
  const prompt = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder\nBuat model 3D kepala silinder\nHitung pajak penjualan bulan ini';
  const r = execute(graph(prompt), {nama:'',email:'',catatan:''});
  const model = r.assignments.find(a => a.id === 'modeling-3d');
  assert.deepEqual(model.tasks, ['Buat model 3D blok silinder','Buat model 3D kepala silinder']);
  assert.ok(r.assignments.some(a => a.id === 'parts-inventory'));
  {
    const md = reportMarkdown('Uji', new Date(0), r.assignments, r.warnings, []);
    assert.match(md, /## 3D Modeling \(2 tugas\)\n\n1\. Buat model 3D blok silinder\n2\. Buat model 3D kepala silinder/);
    assert.match(md, /## Tidak cocok dengan agent mana pun\n\n- Hitung pajak penjualan bulan ini/);
  }
});

test('kalimat larangan menjadi aturan umum, bukan tugas atau lowongan', async () => {
  const {promptRules} = await import('../src/prompt-router.ts');
  const text = 'Buat model 3D blok silinder\nJangan menghapus atau menimpa aturan yang telah tersedia.\nHindari bentuk generik';
  assert.deepEqual(splitPrompt(text), ['Buat model 3D blok silinder']);
  assert.deepEqual(promptRules(text), ['Jangan menghapus atau menimpa aturan yang telah tersedia','Hindari bentuk generik']);
  const r = execute(graph(text), {nama:'',email:'',catatan:''});
  assert.deepEqual(r.rules, promptRules(text));
  assert.deepEqual(r.warnings, []);
});

test('brief produksi dari bagan memuat prompt, tugas berurutan, agent, aturan, dan lolos validasi', async () => {
  const {buildBrief,validBrief,hasPrompt} = await import('../src/production-brief.ts');
  const prompt = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder\nJangan menebak part number\nHitung pajak penjualan bulan ini';
  const g = graph(prompt);
  assert.ok(hasPrompt(g));
  const r = execute(g, {nama:'Caterpillar 3512C',email:'',catatan:''});
  const b = buildBrief(g, r);
  assert.equal(b.prompt, prompt);
  assert.deepEqual(b.tasks.map(t => t.task), ['Susun daftar komponen bertingkat dengan part number','Buat model 3D blok silinder']);
  assert.ok(b.tasks[1].agents.includes('3D Modeling'));
  assert.deepEqual(b.rules, ['Jangan menebak part number']);
  assert.deepEqual(b.unmatched, ['Hitung pajak penjualan bulan ini']);
  assert.ok(validBrief(b));
  assert.ok(!validBrief({...b, extra: 1}));
  assert.ok(!validBrief({...b, tasks: []}));
  assert.ok(!validBrief({...b, tasks: [{task: 'x', agents: ['a','b','c','d']}]}));
  assert.ok(!validBrief({...b, prompt: 'x'.repeat(50001)}));
});

test('brief memakai prompt yang sudah terisi ({nama}) sehingga urutan tugas tetap sesuai prompt', async () => {
  const {buildBrief,validBrief,briefBytes,briefLimits,briefInfo} = await import('../src/production-brief.ts');
  const g = graph('Buat model 3D blok silinder {nama}\nSusun daftar komponen bertingkat {nama} dengan part number\nSimulasikan pompa bahan bakar');
  const r = execute(g, {nama:'Caterpillar 3512C',email:'',catatan:''});
  const b = buildBrief(g, r);
  assert.equal(b.prompt.includes('{nama}'), false);
  assert.ok(b.prompt.includes('Caterpillar 3512C'));
  const order = b.tasks.map(t => t.task);
  assert.equal(order[0], 'Buat model 3D blok silinder Caterpillar 3512C');
  assert.equal(order[1], 'Susun daftar komponen bertingkat Caterpillar 3512C dengan part number');
  // Ukuran dihitung seperti di server; brief raksasa ditolak dengan jelas sebelum dikirim.
  const big = {...b, prompt: 'é'.repeat(50000), tasks: Array.from({length: 2000}, (_, i) => ({task: 'ü'.repeat(150) + i, agents: ['A']}))};
  assert.ok(briefBytes(big) > briefLimits.bytes);
  assert.equal(validBrief(big), false);
  // Ringkasan sesi yang aneh tidak merusak daftar mesin.
  assert.equal(briefInfo({flow_name: '\t', tasks: 1, rules: 0}).flow_name, 'Bagan');
  assert.equal(briefInfo({flow_name: 5, tasks: 1, rules: 0}), null);
  assert.equal(briefInfo('x'), null);
  assert.deepEqual(briefInfo({flow_name: 'DRCE', tasks: 2, rules: 1, sha256: 'a'.repeat(64), parts: 1}), {flow_name: 'DRCE', tasks: 2, rules: 1});
});
