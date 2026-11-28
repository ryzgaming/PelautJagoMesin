import argparse,json,time,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--port',type=int,required=True);p.add_argument('--out',required=True);p.add_argument('--lab-override');a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 for viewport,(w,h,dpr) in {'desktop':(1280,800,1),'hp':(390,844,2)}.items():
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.add_init_script("""const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return original.call(this,type,...args)}""")
  if a.lab_override: page.route('**/lab.html?*',lambda route:route.fulfill(path=a.lab_override,content_type='text/html'))
  page.goto(f'http://localhost:{a.port}/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray',wait_until='networkidle');page.wait_for_function('window.__ready===true');page.wait_for_timeout(2200)
  fps=[]
  for _ in range(4):page.wait_for_timeout(1100);fps.append(page.evaluate('window.__fps'))
  info=page.evaluate("""(()=>{const gl=document.querySelector('canvas').getContext('webgl'); const ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),width:innerWidth,height:innerHeight,dpr:devicePixelRatio,links:__flow.links(),firePhases:__fire.phases(),materials:[...new Set(__flow.group.children.map(x=>x.material))].length}})()""")
  page.evaluate('__flow.pause();__fire.pause()')
  before=page.evaluate('[__flow.probe("jacket"),__fire.probe("c1")]');page.wait_for_timeout(350);after=page.evaluate('[__flow.probe("jacket"),__fire.probe("c1")]');pause=before==after
  shots=[];phase_info=[]
  for deg in [-8,8,32,85]:
   data=page.evaluate("""deg=>{__fire.setCrank(deg); for(const ob of __fire.group.children){const u=ob.material?.uniforms;if(u?.uTime)u.uTime.value=1.25;} for(const ob of __flow.group.children){ob.material.uniforms.uPhase.value=.23;ob.material.uniforms.uFill.value=1000;} return {degree:deg,probe:__fire.probe('c1'),parts:__fire.group.children.filter(o=>o.type==='Mesh').map(o=>({name:o.name,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray()}))}}""",deg)
   page.wait_for_timeout(90);path=out/f'{viewport}-{deg}.png';page.screenshot(path=str(path));shots.append(path);phase_info.append(data)
  imgs=[Image.open(s).convert('RGB') for s in shots];tw=480 if viewport=='desktop' else 240;th=round(imgs[0].height*tw/imgs[0].width);sheet=Image.new('RGB',(tw*4,th),'#12171c')
  for i,im in enumerate(imgs):sheet.paste(im.resize((tw,th)),(i*tw,0))
  sheet.save(out/f'{viewport}-phases.png')
  resume_base=page.evaluate('[__flow.probe("jacket"),__fire.probe("c1")]');page.evaluate('__flow.resume();__fire.resume()');page.wait_for_timeout(180);resume=page.evaluate('[__flow.probe("jacket"),__fire.probe("c1")]')
  result={'browser':'Chromium / SwiftShader software WebGL1','viewport':info,'fps_samples':fps,'fps_mean':sum(fps)/len(fps),'pause_stable':pause,'resume_moves':resume[0]['fraction']!=resume_base[0]['fraction'] and resume[1]['crank_deg']!=resume_base[1]['crank_deg'],'phase_snapshots':phase_info,'errors':errors}
  (out/f'{viewport}.json').write_text(json.dumps(result,indent=2));print(viewport,result['fps_samples'],'errors',errors,'pause',pause,flush=True);page.close()
 browser.close()
