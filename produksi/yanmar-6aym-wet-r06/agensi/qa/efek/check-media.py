import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('/workspace/efek-review')
legacy=json.loads((root/'baseline/.agents/skills/animasi-aliran-mesin/references/gaya-efek.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 page=b.new_page();errors=[]
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:original.call(this,t,...args)}")
 page.goto('http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html',wait_until='networkidle')
 page.wait_for_function('window.__ready')
 result=page.evaluate("""legacy=>{
 const media=['fresh_water','sea_water','lube_oil','fuel','charge_air','start_air','exhaust'];
 const links={},mapping={};
 media.forEach((key,i)=>{links[key]={geometry_basis:'DOCUMENTED',spans:[{kind:'exposed',carrier:key,passage:key,points:[[-.5,i*.09,0],[.5,i*.09,0]]}]};mapping[key]=key;});
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl'),renderer=new THREE.WebGLRenderer({canvas,context:gl});
 renderer.setSize(800,600);const camera=new THREE.PerspectiveCamera(50,4/3,.01,10);camera.position.set(0,.3,1.7);camera.lookAt(0,.3,0);
 const results=[];
 for(const style of [null,legacy]){
  const scene=new THREE.Scene();
  const flow=OrangMesinFlow.create(THREE,{routes:{links},medium:mapping,style});
  scene.add(flow.group);flow.start({fillSeconds:0});flow.update(.1);
  const fire=OrangMesinFire.create(THREE,{style,cylinders:[{id:'test',position:[0,0,0],injector:[0,.12,0],bore_m:.18}],firingOrder:['test']});
  scene.add(fire.group);fire.start();fire.setCrank(8);
  renderer.render(scene,camera);
  const mats=[...new Set(flow.group.children.map(o=>o.material))];
  results.push({preset:style?'legacy':'default',media:flow.links().map(x=>x.medium),materials:mats.length,finite:mats.every(m=>Object.values(m.uniforms).every(u=>typeof u.value!=='number'||Number.isFinite(u.value))),gl_error:gl.getError(),programs:renderer.info.programs.map(p=>({runnable:p.diagnostics?.runnable!==false}))});
  fire.dispose();flow.dispose();
 }renderer.dispose();return results;
}""",legacy)
 b.close()
assert not errors,errors
for x in result:
 assert len(x['media'])==7 and len(set(x['media']))==7 and x['finite'] and x['gl_error']==0 and all(p['runnable'] for p in x['programs']),x
(root/'all-media.json').write_text(json.dumps({'results':result,'errors':errors},indent=2))
print('All seven media and fire compiled on WebGL1 with default and legacy presets.')
