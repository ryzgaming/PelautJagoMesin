import test from 'node:test';
import assert from 'node:assert/strict';
import {step,validate,execute} from '../src/flow.ts';
import {aiModels,productionOptions,stepOptions,optionsLabel,defaultAiModel,budgetLimits} from '../src/ai-models.ts';

const agentsIn = ['parts-inventory','modeling-3d'];
function graph(producer = step('produksi','produksi',1400,0)) {
  const nodes = [step('trigger','start',0,0), step('prompt','prompt',250,0), step('router','router',500,0),
    ...agentsIn.map((id,i) => step('agen-'+id, id, 800, i*120)), producer];
  nodes[1].message = 'Susun daftar komponen bertingkat dengan part number\nBuat model 3D blok silinder';
  const edges = [{from:'start',port:'out',to:'prompt'},{from:'prompt',port:'out',to:'router'},
    ...agentsIn.map(id => ({from:'router',port:'out',to:id})), ...agentsIn.map(id => ({from:id,port:'out',to:'produksi'}))];
  return {id:'uji-opsi',name:'Uji opsi',revision:0,nodes,edges};
}

test('Agen Produksi baru memakai Claude Opus 5.5 dan batas $40 secara bawaan', () => {
  const p = step('produksi','produksi',0,0);
  assert.equal(p.value, defaultAiModel); assert.equal(p.message, String(budgetLimits.initial));
  const r = execute(graph(), {nama:'', email:'', catatan:'Caterpillar 3512C'});
  assert.deepEqual(r.production.options, {ai_model:'claude-opus-5-5', budget_usd:40});
  assert.match(r.trace.at(-1).detail, /produksi dengan Claude Opus 5\.5 · batas \$40$/);
});

test('bagan lama dengan Agen Produksi kosong tetap sah dan mengikuti bawaan pekerja', () => {
  const old = step('produksi','produksi',1400,0); old.value = ''; old.message = '';
  const r = execute(graph(old), {nama:'', email:'', catatan:'x'});
  assert.equal(r.production.options, null);
  assert.match(r.trace.at(-1).detail, /bawaan pekerja/);
});

test('pilihan model dan batas biaya divalidasi', () => {
  for (const [value, message] of [['gpt-5','40'],['claude-opus-5-5','0'],['claude-opus-5-5','501'],['claude-opus-5-5','4.5'],['claude-opus-5-5',''],['','40']]) {
    const p = step('produksi','produksi',1400,0); p.value = value; p.message = message;
    assert.throws(() => validate(graph(p), true), /Agen Produksi/, value + ' ' + message);
  }
  const ok = step('produksi','produksi',1400,0); ok.value = 'claude-haiku-5-5'; ok.message = '5';
  validate(graph(ok), true);
  assert.deepEqual(execute(graph(ok), {nama:'',email:'',catatan:'x'}).production.options, {ai_model:'claude-haiku-5-5', budget_usd:5});
});

test('daftar model dan bentuk opsi sama dengan yang diterima database', () => {
  assert.deepEqual(aiModels.map(m => m.id), ['claude-opus-5-5','claude-fable-5-2','claude-sonnet-5-5','claude-haiku-5-5']);
  assert.deepEqual(productionOptions({ai_model:'claude-sonnet-5-5', budget_usd:25}), {ai_model:'claude-sonnet-5-5', budget_usd:25});
  for (const bad of [null, {}, {ai_model:'claude-sonnet-5-5'}, {ai_model:'x', budget_usd:5}, {ai_model:'claude-sonnet-5-5', budget_usd:'5'}, {ai_model:'claude-sonnet-5-5', budget_usd:5, x:1}])
    assert.equal(productionOptions(bad), null);
  assert.deepEqual(stepOptions('aneh','999'), {ai_model:defaultAiModel, budget_usd:budgetLimits.initial});
  assert.equal(optionsLabel({ai_model:'claude-fable-5-2', budget_usd:100}), 'Claude Fable 5.2 · batas $100');
});
