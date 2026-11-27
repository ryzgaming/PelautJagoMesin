import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {step,validate,execute,label} from '../src/flow.ts';
import {compileBlocks,blocksMarkdown,compilePrompt,fileStem} from '../src/compile.ts';
import {buildDocx,docxParts} from '../src/docx.ts';

const agentsIn = ['parts-inventory','modeling-3d','diesel-specialist'];
const prompt = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder\nPeriksa firing order dan timing katup\nJangan menebak part number';
/** Bagan: pemicu → prompt → Pembagi tugas → agent; langkah keluaran disambung dari agent atau dari Pembagi tugas. */
function graph({from = 'agents', kinds = ['penghimpun','word']} = {}) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('router','router',500,0),
    ...agentsIn.map((id,i) => step('agen-'+id, id, 800, i*120)), ...kinds.map((k,i) => step(k, k, 1100, i*120))];
  nodes[1].message = prompt;
  const edges = [{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'router'},
    ...agentsIn.map(id => ({from:'router',port:'out',to:id}))];
  if (from === 'agents') for (const k of kinds) for (const id of agentsIn) edges.push({from:id,port:'out',to:k});
  else for (const k of kinds) edges.push({from:'router',port:'out',to:k});
  return {id:'uji-keluaran',name:'Caterpillar 3512C',revision:0,nodes,edges};
}

/** Baca isi arsip ZIP (STORE atau DEFLATE) untuk memeriksa paket .docx. */
function unzip(buf) {
  const b = Buffer.from(buf), out = {};
  let end = b.length - 22; while (end >= 0 && b.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'akhir direktori pusat ditemukan');
  let at = b.readUInt32LE(end + 16);
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    assert.equal(b.readUInt32LE(at), 0x02014b50);
    const method = b.readUInt16LE(at + 10), size = b.readUInt32LE(at + 20), nl = b.readUInt16LE(at + 28), xl = b.readUInt16LE(at + 30), cl = b.readUInt16LE(at + 32), off = b.readUInt32LE(at + 42);
    const name = b.toString('utf8', at + 46, at + 46 + nl);
    const start = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28), data = b.subarray(start, start + size);
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    at += 46 + nl + xl + cl;
  }
  return out;
}

test('Agent Penghimpun dan Agent Word tersedia sebagai langkah dasar yang valid', () => {
  assert.equal(label('penghimpun'), 'Agent Penghimpun');
  assert.equal(label('word'), 'Agent Word');
  validate(graph(), true);
});

for (const from of ['agents','router']) test('hasil semua agent dihimpun bila disambung dari '+(from === 'agents' ? 'agent' : 'Pembagi tugas'), () => {
  const r = execute(graph({from}), {nama:'Caterpillar 3512C',email:'',catatan:''});
  const ran = r.trace.map(t => t.id);
  assert.ok(ran.includes('penghimpun') && ran.includes('word'), 'kedua langkah dijalankan: ' + ran.join(','));
  assert.match(r.trace.find(t => t.id === 'penghimpun').detail, /Menghimpun hasil 3 agent/);
  assert.match(r.trace.find(t => t.id === 'word').detail, /Dokumen Word disiapkan/);
  assert.equal(r.word, true);
  for (const s of ['# Prompt terhimpun — Caterpillar 3512C','## 3. Aturan umum','1. Jangan menebak part number','Parts Inventory','Buat model 3D blok silinder','Format hasil yang diminta'])
    assert.ok(r.compiled.includes(s), 'prompt terhimpun memuat: ' + s);
});

test('prompt terhimpun tertata: ringkasan, konteks, aturan, tugas per agent bernomor, celah, format hasil', () => {
  const md = compilePrompt({flow:'Uji', when:new Date('2026-11-27T08:00:00Z'), prompts:['Tujuan A\n\nTujuan B'],
    assignments:[{id:'a',name:'Agent A',tasks:['t1']},{id:'b',name:'Agent B',tasks:['t2','t3']}], rules:['r1'],
    warnings:['Tidak ada agent yang cocok untuk: t4','Tidak terbaca: 1 tugas'], recruit:[{title:'Spesialis X',summary:'cari x'}]});
  const heads = md.split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3));
  assert.deepEqual(heads, ['1. Ringkasan','2. Tujuan dan konteks','3. Aturan umum untuk semua agent','4. Tugas per agent','5. Celah yang perlu ditindaklanjuti','6. Format hasil yang diminta']);
  assert.ok(md.indexOf('### 4.1 Agent B (2 tugas)') < md.indexOf('### 4.2 Agent A (1 tugas)'), 'agent dengan tugas terbanyak lebih dulu');
  assert.match(md, /\| Tugas yang dibagikan \| 3 \|/);
  assert.match(md, /- t4/); assert.match(md, /- Spesialis X — cari x/); assert.match(md, /Tujuan A\n\nTujuan B/);
  assert.equal(fileStem('laporan', 'Caterpillar 3512C / Uji'), 'laporan-caterpillar-3512c-uji');
});

test('Agent Word menghasilkan paket .docx yang utuh dan bergaya profesional', () => {
  const blocks = compileBlocks({flow:'Caterpillar 3512C & <uji>', when:new Date('2026-11-27T08:00:00Z'), prompts:['Tujuan'],
    assignments:[{id:'a',name:'Agent A',tasks:['satu','dua']},{id:'b',name:'Agent B',tasks:['tiga']}], rules:['aturan'], warnings:[], recruit:[]});
  const bytes = buildDocx(blocks, {title:'Prompt terhimpun — Caterpillar 3512C & <uji>', header:'Alur · Caterpillar 3512C & <uji>', when:new Date('2026-11-27T08:00:00Z')});
  assert.equal(Buffer.from(bytes.subarray(0, 2)).toString(), 'PK');
  const files = unzip(bytes);
  for (const f of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/numbering.xml','word/header1.xml','word/footer1.xml','word/_rels/document.xml.rels','docProps/core.xml'])
    assert.ok(files[f], 'berkas ada: ' + f);
  const doc = files['word/document.xml'];
  for (const s of ['w:val="Title"','w:val="Heading1"','w:val="Heading2"','<w:tbl>','w:numId w:val="1"','w:w="11906"']) assert.ok(doc.includes(s), s);
  assert.ok(doc.includes('Caterpillar 3512C &amp; &lt;uji&gt;') && !doc.includes('<uji>'), 'teks di-escape');
  assert.match(files['word/footer1.xml'], /PAGE[\s\S]*NUMPAGES/);
  // Tiap daftar bernomor punya num sendiri yang mulai dari 1.
  const lists = blocks.filter(b => b.t === 'number' || b.t === 'bullet').length;
  assert.equal((files['word/numbering.xml'].match(/<w:num w:numId=/g) || []).length, lists);
  assert.equal(Object.keys(docxParts(blocks, {title:'x', header:'x', when:new Date()})).length, Object.keys(files).length);
});

test('brief produksi membawa instruksi Agent Penghimpun dan Agent Word, dan tetap lolos validasi', async () => {
  const {buildBrief,validBrief,outputRules} = await import('../src/production-brief.ts');
  const g = graph();
  const b = buildBrief(g, execute(g, {nama:'Caterpillar 3512C',email:'',catatan:''}));
  assert.ok(b.rules.includes(outputRules.penghimpun) && b.rules.includes(outputRules.word));
  assert.ok(b.rules.includes('Jangan menebak part number'));
  assert.ok(validBrief(b));
  const plain = graph({kinds:[]});
  assert.ok(!buildBrief(plain, execute(plain, {nama:'x',email:'',catatan:''})).rules.some(r => r.startsWith('Agent Word')));
});
