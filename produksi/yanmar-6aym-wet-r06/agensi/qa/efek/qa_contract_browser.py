import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/workspace/efek-review/qa-browser-contract');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 page=b.new_page(viewport={'width':1280,'height':800});err=[]
 page.on('pageerror',lambda e:err.append(str(e)));page.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
 page.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:orig.call(this,t,...args)}")
 base='http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/'
 page.goto(base+'demo.html?auto=1.5&xray',wait_until='networkidle');page.wait_for_function('window.__ready');page.wait_for_timeout(1800)
 demo=page.evaluate("""(()=>{__flow.pause();return {links:__flow.links(),estimated:__flow.group.children.filter(o=>o.material.uniforms.uEstimated.value>.5).map(o=>({name:o.name,opacity:o.material.uniforms.uOpacity.value,fragment:o.material.fragmentShader.includes('fract(vS * 6.0)')}))}})()""")
 page.screenshot(path=str(out/'estimasi-demo.png'))
 page.goto(base+'lab.html?auto=1.5&xray',wait_until='networkidle');page.wait_for_function('window.__ready');page.wait_for_timeout(700)
 fire=page.evaluate("""(()=>{__fire.pause();__flow.pause();let maxradius=0;const rows=[];for(let degree=0;degree<=720;degree+=2){__fire.setCrank(degree);__fire.group.updateMatrixWorld(true);const probes=['c1','c3','c4','c2'].map(id=>__fire.probe(id));for(const o of __fire.group.children.filter(o=>o.name.startsWith('api:'))){const v=o.geometry.attributes.position;for(let i=0;i<v.count;i++)maxradius=Math.max(maxradius,Math.hypot(v.getX(i)*o.scale.x,v.getZ(i)*o.scale.z));}if(degree%180===8)rows.push(probes);}return{samples:361,max_model_flame_radius:maxradius,bore_radius:.09,phases:__fire.phases(),shapes:__fire.group.children.filter(o=>o.type==='Mesh').map(o=>({name:o.name,type:o.geometry.type})),testPhaseSnapshots:rows}})()""")
 # Check the normal controls, rather than just invoking pause functions.
 page.click('#pause');page.wait_for_timeout(120);page.click('#pause');a=page.evaluate('[__fire.crankDeg,__flow.probe("jacket").fraction]');page.wait_for_timeout(300);z=page.evaluate('[__fire.crankDeg,__flow.probe("jacket").fraction]');page.click('#pause');page.wait_for_timeout(160);n=page.evaluate('[__fire.crankDeg,__flow.probe("jacket").fraction]')
 fire['button_pause_stable']=a==z;fire['button_resume_moves']=n!=z
 fire['mobile_pointlights']=page.evaluate("""(()=>{const f=OrangMesinFire.create(THREE,{mobile:true,cylinders:[{id:'a',position:[0,0,0],bore_m:.18}],firingOrder:['a']});const lights=f.group.children.filter(o=>o.type==='PointLight').length;f.dispose();return lights})()""")
 b.close()
result={'estimated_demo':demo,'fire':fire,'errors':err};(out/'report.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
assert not err
assert all(x['opacity']==.6 and x['fragment'] for x in demo['estimated']) and demo['estimated']
assert fire['max_model_flame_radius']<=fire['bore_radius']+1e-7
assert fire['button_pause_stable'] and fire['button_resume_moves'] and fire['mobile_pointlights']==0
