import test from 'node:test';
import assert from 'node:assert/strict';
import {directory,validServer} from '../src/directory.ts';
import {initial,step,execute,validate} from '../src/flow.ts';

const graph=(...kinds)=>{
  const g=initial();
  g.nodes=[g.nodes[0],...kinds.map((k,i)=>step(k,'s'+i,0,0))];
  g.edges=g.nodes.slice(1).map((n,i)=>({from:g.nodes[i].id,port:'out',to:n.id}));
  return g;
};
const data={nama:'Uji',email:'',catatan:'dokumen jaga'};
test('semua pilihan Claude menunggu hasil nyata sebelum melanjutkan',()=>{
  assert.equal(directory.filter(p=>p.group==='Konektor populer').length,12);
  assert.equal(directory.filter(p=>p.group==='Plugin Claude Code').length,6);
  assert.equal(new Set(directory.map(p=>p.slug)).size,directory.length);
  for(const entry of directory){
    const g=graph('claude-'+entry.slug,'confirm');g.nodes[2].message='{hasil}';
    const paused=execute(g,data);
    assert.equal(paused.pending.name,entry.name);assert.equal(paused.confirmation,'');
    assert.equal(paused.trace.length,1);
    assert.equal(execute(g,data,{s0:'contoh hasil'}).confirmation,'contoh hasil');
  }
});
test('hasil diteruskan ke langkah berikutnya dan ke cabang yang dicapai',()=>{
  const g=graph('claude-google-drive','claude-notion','confirm');
  g.nodes[2].message='Ringkas {hasil} untuk {nama}';
  assert.equal(execute(g,data,{s0:'berkas 1'}).pending.task,'Ringkas berkas 1 untuk Uji');
  assert.throws(()=>execute(g,data,{s0:' '}),/Hasil konektor/);
  const split=initial();split.nodes[2]=step('claude-gmail','ok',0,0);
  assert.equal(execute(split,data).pending,null);
});
test('endpoint kustom disimpan dalam graf dan divalidasi sebelum dipakai',()=>{
  const g=graph('claude-custom');
  for(const input of ['http://contoh.id','https://user:pass@contoh.id/mcp','https://contoh.id/?token=x','javascript:void(0)']){
    g.nodes[1].value=input;assert.equal(validServer(input),false);assert.throws(()=>validate(g));
  }
  g.nodes[1].value='https://contoh.id/mcp';
  assert.equal(execute(JSON.parse(JSON.stringify(g)),data).pending.server,g.nodes[1].value);
});
