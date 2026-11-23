import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, step, execute, validate, branches, usesNotes} from '../src/flow.ts';
import {plugins, pluginById} from '../src/plugins.ts';

const form = {nama:'Siti Aminah',email:'siti@example.com',catatan:'2'};
function linear(...kinds) {
  const g=initial();
  g.nodes=[g.nodes[0],...kinds.map((kind,i)=>step(kind,'p'+i,0,0))];
  g.edges=g.nodes.slice(1).map((node,i)=>({from:g.nodes[i].id,port:'out',to:node.id}));
  return g;
}
test('setiap entri katalog bertahan setelah serialisasi dan berjalan di executor',()=>{
  assert.equal(pluginById.size,plugins.length);
  for(const plugin of plugins) {
    const g=linear(plugin.id);
    if(branches(plugin.id)){
      g.nodes.push(step('confirm','ok',0,0),step('review','review',0,0));
      g.edges.push({from:'p0',port:'yes',to:'ok'},{from:'p0',port:'no',to:'review'});
    }
    const result=execute(JSON.parse(JSON.stringify(g)),form);
    assert.equal(result.trace[1].name,plugin.name);
    assert.ok(result.trace[1].detail.length>0);
  }
});
test('satuan mesin dapat dirangkai dengan ambang, keluaran dan catatan formulir',()=>{
  const g=linear('robot-bar-kpa','robot-greater');
  g.nodes[2].field='hasil';
  g.nodes.push(step('confirm','ok',0,0),step('review','review',0,0));
  g.nodes[3].message='{nama}: {catatan} bar = {hasil} kPa';
  g.edges.push({from:'p1',port:'yes',to:'ok'},{from:'p1',port:'no',to:'review'});
  assert.equal(execute(g,form).confirmation,'Siti Aminah: 2 bar = 200 kPa');
  assert.ok(execute(g,{...form,catatan:'0,5'}).review);
  g.edges.pop();
  g.nodes.pop();
  assert.throws(()=>validate(g,true),/kedua cabang/);
});
test('perhitungan balik termasuk offset suhu dan masukan desimal',()=>{
  for(const plugin of plugins.filter(p=>p.group==='Satuan mesin'&&!p.id.endsWith('-balik'))) {
    const g=linear(plugin.id,plugin.id+'-balik');
    g.nodes[2].field='hasil';
    assert.ok(Math.abs(Number(execute(g,{...form,catatan:'12,5'}).hasil)-12.5)<1e-8,plugin.name);
  }
  assert.equal(execute(linear('robot-c-f'),{...form,catatan:'100'}).hasil,'212');
});
test('daftar dan laporan memakai hasil sebelumnya serta menjaga masukan asli',()=>{
  const g=linear('robot-unique','robot-count-lines','robot-inventory');
  g.nodes[2].field='hasil';
  const data={...form,catatan:'bearing\nseal\nbearing'};
  assert.equal(execute(g,data).hasil,'Rekap inventaris oleh Siti Aminah\nDaftar barang:\nbearing\nseal\nbearing\nHasil rekap: 2');
  assert.equal(data.catatan,'bearing\nseal\nbearing');
});
test('isian lama, input tak valid, batas ukuran, dan ID tidak dikenal',()=>{
  assert.equal(usesNotes(initial()),false);
  assert.equal(usesNotes(linear('robot-bar-kpa')),true);
  assert.equal(usesNotes(linear('robot-domain')),false);
  assert.equal(execute(linear('robot-domain'),form).hasil,'example.com');
  assert.throws(()=>execute(linear('robot-bar-kpa'),{...form,catatan:'dua'}),/bar ke kPa.*angka/);
  const g=linear('robot-divide');g.nodes[1].value='0';
  assert.throws(()=>execute(g,form),/Pembagi/);
  const report=linear('robot-watch');report.nodes[1].message='{catatan}'.repeat(4);
  assert.throws(()=>execute(report,{...form,catatan:'A'.repeat(4000)}),/8.000/);
  g.nodes[1].kind='robot-unknown';
  assert.throws(()=>validate(g),/konfigurasi/);
});
