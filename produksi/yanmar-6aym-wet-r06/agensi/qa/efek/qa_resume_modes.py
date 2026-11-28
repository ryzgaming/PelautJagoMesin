import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/workspace/efek-review/qa-resume-modes');out.mkdir(exist_ok=True)
rows={}
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 for mode in ['normal','real']:
  page=b.new_page(viewport={'width':1280,'height':800});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:orig.call(this,t,...a)}")
  page.goto('http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5'+('&real' if mode=='real' else ''),wait_until='networkidle');page.wait_for_function('window.__ready');page.wait_for_timeout(1800)
  def snap(): return page.evaluate('({fire:__fire.probe("c1"),flow:__flow.probe("jacket"),time:performance.now()})')
  page.evaluate('__flow.pause();__fire.pause()');paused=[snap()];page.wait_for_timeout(500);paused.append(snap())
  page.evaluate('__flow.resume();__fire.resume()');resumed=[snap()]
  for _ in range(3):page.wait_for_timeout(500);resumed.append(snap())
  data={'paused':paused,'resumed':resumed,'badge':page.locator('#badge').inner_text(),'xray_pressed':page.locator('#xray').get_attribute('aria-pressed'),'errors':errors}
  data['pause_stable']=paused[0]['fire']['crank_deg']==paused[1]['fire']['crank_deg'] and paused[0]['flow']['fraction']==paused[1]['flow']['fraction']
  data['fire_resume_moves']=len(set(x['fire']['crank_deg'] for x in resumed))>1
  data['flow_resume_moves']=len(set(x['flow']['fraction'] for x in resumed))>1
  page.screenshot(path=str(out/f'{mode}.png'));rows[mode]=data;page.close()
 b.close()
(out/'report.json').write_text(json.dumps(rows,indent=2));print(json.dumps({k:{x:v[x] for x in ['pause_stable','fire_resume_moves','flow_resume_moves','badge','xray_pressed','errors']} for k,v in rows.items()}))
assert all(v['pause_stable'] and v['fire_resume_moves'] and v['flow_resume_moves'] and not v['errors'] for v in rows.values())
