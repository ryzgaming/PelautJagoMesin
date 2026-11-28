import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,execute,validate,step} from '../src/features/workflow/flow.ts';
test('email terisi menghasilkan konfirmasi',()=>assert.deepEqual(execute(initial(),{email:'a@example.com',nama:''}).trace.map(x=>x.id),['start','check','ok']));
test('email kosong masuk review',()=>assert.ok(execute(initial(),{email:' ',nama:''}).review));
test('siklus ditolak',()=>{const g=initial();g.edges.push({from:'ok',port:'out',to:'check'});assert.throws(()=>validate(g),/putaran/)});
test('alur terputus ditolak saat dijalankan',()=>{let g=initial();g.edges.pop();assert.throws(()=>execute(g,{nama:'',email:''}))});

test('bagan boleh berisi sampai 300 langkah dan 600 sambungan', async () => {
  const {maxSteps,maxEdges} = await import('../src/features/workflow/flow.ts');
  assert.equal(maxSteps, 300); assert.equal(maxEdges, 600);
  const big = n => {
    const nodes = [step('trigger','start',0,0), ...Array.from({length:n-1}, (_,i) => step('review','r'+i,300,i*100))];
    return {id:'besar',name:'Bagan besar',revision:0,nodes,edges:nodes.slice(1).map(x => ({from:'start',port:'out',to:x.id}))};
  };
  const ok = big(300);
  ok.edges = ok.edges.slice(0, 1).concat(ok.nodes.slice(2).map((x, i) => ({from:ok.nodes[i+1].id,port:'out',to:x.id})));
  validate(ok, true);
  const tooMany = big(301);
  tooMany.edges = [];
  assert.throws(() => validate(tooMany), /tidak valid/);
});

test('langkah biasa dapat bercabang ke beberapa langkah; tiap cabang menerima hasil yang sama', async () => {
  const {execute} = await import('../src/features/workflow/flow.ts');
  const t = step('trigger','start',0,0), a = step('robot-watch','a',1,0), b = step('confirm','b',2,0), c = step('review','c',2,1), d = step('review','d',3,0);
  a.message = 'Halo {nama}'; b.message = 'B: {hasil}'; c.message = 'C: {hasil}'; d.message = 'D: {hasil}';
  b.name = 'Cabang B'; c.name = 'Cabang C';
  const g = {id:'cabang',name:'Cabang',revision:0,nodes:[t,a,b,c,d],edges:[{from:'start',port:'out',to:'a'},{from:'a',port:'out',to:'b'},{from:'a',port:'out',to:'c'},{from:'b',port:'out',to:'d'},{from:'c',port:'out',to:'d'}]};
  validate(g, true);
  const r = execute(g, {email:'a@b.co', nama:'Rina'});
  // d punya dua sambungan masuk: menunggu b dan c, lalu menerima hasil keduanya.
  assert.deepEqual(r.trace.map(x => x.id), ['start','a','b','c','d']);
  assert.equal(r.confirmation, 'B: Halo Rina');
  assert.equal(r.review, 'D: ## Cabang B\nHalo Rina\n\n## Cabang C\nHalo Rina');
});
