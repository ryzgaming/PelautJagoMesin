import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,execute,validate,step} from '../src/flow.ts';
test('email terisi menghasilkan konfirmasi',()=>assert.deepEqual(execute(initial(),{email:'a@example.com',nama:''}).trace.map(x=>x.id),['start','check','ok']));
test('email kosong masuk review',()=>assert.ok(execute(initial(),{email:' ',nama:''}).review));
test('siklus ditolak',()=>{const g=initial();g.edges.push({from:'ok',port:'out',to:'check'});assert.throws(()=>validate(g),/putaran/)});
test('alur terputus ditolak saat dijalankan',()=>{let g=initial();g.edges.pop();assert.throws(()=>execute(g,{nama:'',email:''}))});

test('bagan boleh berisi sampai 300 langkah dan 600 sambungan', async () => {
  const {maxSteps,maxEdges} = await import('../src/flow.ts');
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
