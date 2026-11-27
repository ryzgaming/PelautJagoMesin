import test from 'node:test';
import assert from 'node:assert/strict';
import {step,validate,execute,label} from '../src/flow.ts';
import {machinePrompt,spliceMachine} from '../src/machine.ts';
import {agentByKind} from '../src/organization.ts';
const kinds = [...agentByKind.keys()];

const data = {nama:'',email:'',catatan:''};
/** Formulir → Agent Mesin → Agent prompt → Pembagi tugas → semua agent Orang Mesin. */
function graph(value = 'Caterpillar 3512C', message = '') {
  const m = step('mesin','mesin',150,0); m.value = value;
  const p = step('prompt','prompt',300,0); p.message = message;
  const nodes = [step('trigger','start',0,0), m, p, step('router','router',500,0), ...kinds.map((k,i) => step(k, k, 800, i*100))];
  const edges = [{from:'start',port:'out',to:'mesin'},{from:'mesin',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'router'},
    ...kinds.map(k => ({from:'router',port:'out',to:k}))];
  return {id:'uji-mesin',name:'Uji mesin',revision:0,nodes,edges};
}

test('Agent Mesin tersedia dan hanya satu per bagan', () => {
  assert.equal(label('mesin'), 'Agent Mesin');
  validate(graph(), true);
  const g = graph();
  assert.throws(() => validate({...g, nodes:[...g.nodes, step('mesin','mesin2',0,300)]}), /satu Agent Mesin/);
  assert.throws(() => validate(graph('x'.repeat(121))), /maksimal 120/);
});

test('prompt kosong memakai tugas produksi standar untuk mesin yang ditulis', () => {
  const r = execute(graph(), data);
  assert.equal(r.machine, 'Caterpillar 3512C');
  assert.deepEqual(r.prompts, [machinePrompt('Caterpillar 3512C')]);
  assert.match(r.trace.find(t => t.id === 'mesin').detail, /Target mesin: Caterpillar 3512C · diberitahukan ke prompt dan \d+ agent/);
  assert.match(r.trace.find(t => t.id === 'prompt').detail, /^Prompt untuk membuat Caterpillar 3512C: /);
  assert.ok(r.assignments.length >= 4, 'tugas standar dibagikan ke beberapa agent');
  for (const t of r.trace.filter(t => /^Diserahkan ke/.test(t.detail))) assert.match(t.detail, / untuk Caterpillar 3512C: /);
});

test('prompt yang ditulis tetap dipakai, {mesin} diganti nama mesin', () => {
  const r = execute(graph('Yanmar 6EY18ALW', 'Buat model 3D blok silinder {mesin}'), data);
  assert.deepEqual(r.prompts, ['Buat model 3D blok silinder Yanmar 6EY18ALW']);
});

test('Agent Mesin kosong ditolak saat dijalankan', () => {
  assert.throws(() => execute(graph('  '), data), /tulis merek dan tipe mesin/);
});

test('Agent Mesin baru dipasang di antara Formulir masuk dan Agent prompt', () => {
  const p = step('prompt','prompt',400,100);
  const g = {id:'x',name:'x',revision:0,nodes:[step('trigger','start',0,100), p],edges:[{from:'start',port:'out',to:'prompt'}]};
  const out = spliceMachine(g, step('mesin','m',0,0));
  assert.deepEqual(out.edges, [{from:'start',port:'out',to:'m'},{from:'m',port:'out',to:'prompt'}]);
  validate(out, true);
  const lone = spliceMachine({...g, edges:[]}, step('mesin','m',0,0));
  assert.equal(lone.edges.length, 0);
});
