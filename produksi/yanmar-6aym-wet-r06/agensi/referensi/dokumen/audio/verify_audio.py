import json,base64,wave,struct,math
from urllib.parse import quote
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
SRC=HERE.parents[1]/'review/assets/engine-audio.js'
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--autoplay-policy=user-gesture-required'])
 page=browser.new_page()
 html='<button id="unlock">Suara ilustrasi</button><script>'+SRC.read_text()+'</script><script>window.sound=OrangMesinAudio.create();(async()=>{const before=sound.probe();const unlocked=await sound.unlock();window.preGesture={before,unlocked,after:sound.probe()}})()</script>'
 page.goto('data:text/html,'+quote(html))
 page.wait_for_function('window.preGesture!==undefined')
 results={'pre_gesture':page.evaluate('preGesture')}
 assert results['pre_gesture']['before']['contextState']=='uncreated'
 assert not results['pre_gesture']['unlocked']
 page.evaluate('''document.querySelector('button').onclick=async()=>{window.didUnlock=await sound.unlock();sound.update({phase:'cranking',rpm:220,elapsed:0,paused:false})}''')
 page.click('button');page.wait_for_function('window.didUnlock===true')
 results['after_gesture']=page.evaluate('sound.probe()')
 assert results['after_gesture']['targets']['starter']>0 and results['after_gesture']['targets']['combustion']==0
 results['pause']=page.evaluate('''()=>{sound.update({phase:'running',rpm:650,paused:true});return sound.probe()}''')
 assert results['pause']['targets']['master']==0
 results['resume']=page.evaluate('''()=>{sound.update({phase:'running',rpm:650});return sound.probe()}''')
 assert results['resume']['firingHz']==32.5 and results['resume']['targets']['combustion']>0
 results['muted']=page.evaluate('''()=>{sound.setMuted(true);return sound.probe()}''')
 assert results['muted']['targets']['master']==0
 results['visibility']=page.evaluate('''()=>{sound.setMuted(false);Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return sound.probe()}''')
 assert results['visibility']['targets']['master']==0
 results['restored']=page.evaluate('''()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));return sound.probe()}''')
 results['node_reuse']=page.evaluate('''()=>{const initial=sound.probe().nodes;for(let i=0;i<1000;i++)sound.update({phase:'running',rpm:650+i%3});return {initial,final:sound.probe().nodes}}''')
 assert results['node_reuse']['initial']==results['node_reuse']['final']
 results['stopped']=page.evaluate('''()=>{sound.update({phase:'off',rpm:0});return sound.probe()}''')
 assert results['stopped']['targets']['master']==0
 results['disposed']=page.evaluate('''async()=>{await sound.dispose();return sound.probe()}''')
 assert results['disposed']['contextState']=='closed' and results['disposed']['nodes']==0
 render=page.evaluate('''async()=>{
 const rate=22050, duration=10, ctx=new OfflineAudioContext(1,rate*duration,rate);
 const synth=OrangMesinAudio.create({context:ctx,offline:true});await synth.unlock();synth.setVolume(.35);
 const events=[
 [.5,{phase:'engaging',rpm:0}], [.8,{phase:'cranking',rpm:220}],
 [2.8,{phase:'firing',rpm:380}], [3.3,{phase:'running',rpm:650}],
 [5.6,{phase:'running',rpm:650,paused:true}], [6.3,{phase:'running',rpm:650}],
 [7.5,{phase:'stopping',rpm:450}], [8,{phase:'stopping',rpm:250}],
 [8.5,{phase:'stopping',rpm:80}], [9,{phase:'off',rpm:0}]
 ];
 const snapshots=[];
 const plans=events.map(([time,state])=>ctx.suspend(time).then(()=>{synth.update({...state,elapsed:time});snapshots.push({time,...synth.probe()});return ctx.resume()}));
 const buffer=await ctx.startRendering();await Promise.all(plans);
 const samples=buffer.getChannelData(0);let peak=0;const rms=[];
 for(let j=0;j<20;j++){let sum=0;for(let i=j*rate/2;i<(j+1)*rate/2;i++){const v=samples[i|0];peak=Math.max(peak,Math.abs(v));sum+=v*v;}rms.push(Math.sqrt(sum/(rate/2)));}
 const binary=new Uint8Array(samples.length*2);const view=new DataView(binary.buffer);
 for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
 let str='';for(let i=0;i<binary.length;i+=8192)str+=String.fromCharCode(...binary.subarray(i,i+8192));
 const energy=(a,b)=>{let sum=0;for(let i=Math.floor(a*rate);i<Math.floor(b*rate);i++)sum+=samples[i]*samples[i];return Math.sqrt(sum/Math.floor((b-a)*rate));};
 const silence={pause:energy(5.9,6.2),off:energy(9.5,10)};
 await synth.dispose();return {rate,peak,rms,silence,snapshots,pcm:btoa(str)};
 }''')
 pcm=base64.b64decode(render.pop('pcm'))
 with wave.open(str(HERE/'starting-running-stopping-illustration.wav'),'wb') as out:
  out.setnchannels(1);out.setsampwidth(2);out.setframerate(render['rate']);out.writeframes(pcm)
 assert render['peak']<1 and render['peak']>.01
 assert render['rms'][0]<1e-7
 assert render['rms'][4]>.001
 assert render['rms'][8]>.001
 assert render['silence']['pause']<.00001 and render['silence']['off']<.00001
 results['render']=render
 (HERE/'audio-verification.json').write_text(json.dumps(results,indent=2))
 browser.close()
print(json.dumps({'peak':render['peak'],'rms':render['rms'],'checks':'passed'},indent=2))
