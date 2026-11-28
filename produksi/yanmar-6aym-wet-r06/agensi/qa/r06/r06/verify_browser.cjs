/* Real Chromium acceptance. The audio sink is observed by a parallel native analyser. */
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const { chromium }=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {writeFile,mkdir,readFile}=require('node:fs/promises');
const {resolve,join}=require('node:path');
const url=process.env.R06_QA_URL||'http://127.0.0.1:4196/';
const output=resolve(process.env.R06_QA_OUTPUT||'qa/r06/browser');
const fast=process.env.R06_QA_FAST==='1';
const plan=[
  {name:'desktop',width:1280,height:800,dpr:1},
  {name:'hp',width:390,height:844,dpr:2},
];
if(process.env.R06_QA_REDUCED==='1') plan.push({name:'hp-reduced',width:390,height:844,dpr:2,reduced:true});
if(process.env.R06_QA_DEVICE) plan.splice(0,plan.length,...plan.filter(v=>v.name===process.env.R06_QA_DEVICE));

async function main(){
 await mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium', headless:true,
   args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  for(const view of plan) await verify(browser,view);
 } finally {await browser.close();}
}
async function verify(browser,view) {
 const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:view.dpr,
   hasTouch:view.name.startsWith('hp'),isMobile:view.name.startsWith('hp'),reducedMotion:view.reduced?'reduce':'no-preference'});
 const page=await context.newPage();
 page.setDefaultTimeout(55000);
 const errors=[], slow=[], timeline=[], checks=[], screenshots=[];
 const computeHashes=async()=>Object.fromEntries(await Promise.all(
  ['data.json','exterior.glb','internal.glb','studio.js','functional-motion.js','combustion-glow.js','flow-ribbons.js','engine-audio.js']
   .map(async(part)=>[part,createHash('sha256').update(await readFile(join('review/assets',part))).digest('hex')])
 ));
 const hashes=await computeHashes();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',entry=>{if(entry.type()==='error'&&!entry.text().includes('404'))errors.push(entry.text());});
 await page.addInitScript(()=>{
    const source=AudioNode.prototype.connect;
    let active;
    const seen=new Set();
    AudioNode.prototype.connect=function(node,...args){
       const output=source.call(this,node,...args);
       if(node===this.context.destination&&!seen.has(this)){
         seen.add(this);
         const analyser=this.context.createAnalyser();
         analyser.fftSize=2048;
         source.call(this,analyser);
         active={analyser,buffer:new Float32Array(analyser.fftSize)};
       }
       return output;
    };
    window.qaMeter=()=>{
      if(!active)return {rms:0,peak:0,sinks:seen.size};
      const {analyser,buffer}=active;
      analyser.getFloatTimeDomainData(buffer);
      return {rms:Math.sqrt(buffer.reduce((sum,v)=>sum+v*v,0)/buffer.length),
        peak:buffer.reduce((m,v)=>Math.max(m,Math.abs(v)),0),sinks:seen.size};
    };
 });
 try {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof roots!=='undefined' && roots?.every(Boolean) && renderer?.getContext() && renderer.info.render.triangles>1000);
  const diagnostics=await page.evaluate(()=>{
    const ctx=renderer.getContext(),gpu=ctx.getExtension('WEBGL_debug_renderer_info');
    return {viewport:[innerWidth,innerHeight,devicePixelRatio],gpu:gpu?ctx.getParameter(gpu.UNMASKED_RENDERER_WEBGL):null,
      revision:data.revision, groups:driveViews.size, targets:[...driveViews.values()].reduce((n,v)=>n+v.parts.length,0),
      reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, bodyOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  const shot=async name=>{
    const filename=join(output,`${view.name}-${name}.png`);
    await page.screenshot({path:filename,animations:'disabled',timeout:35000});
    screenshots.push(filename);
  };
  await page.locator('[data-mode=operation]').click();
  const initial=await page.evaluate(()=>({phase:state.enginePhase,audio:engineAudio?.probe(),meter:qaMeter()}));
  assert.equal(initial.phase,'off');
  assert.equal(initial.audio?.contextState,'uncreated');
  assert.equal(initial.meter.sinks,0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  if(!fast) await shot('operation-ready');
  await page.locator('#xray').click();
  if(fast&&view.name==='hp'&&process.env.R06_QA_STARTER_FOCUS==='1') await page.locator('#starter-entry').click();
  const effectNote=await page.evaluate(()=>({
    shadedCombustion:Boolean(chamberFire),ribbons:Boolean(routeRibbons),
    mechanics:Boolean(mechanics),mechanicsProbe:mechanics?.inspect?.()??null,
  }));
  await page.evaluate(()=>{
    const tracked=new Map();
    for (const [name,group] of driveViews) tracked.set(name,group.parts.map(({object})=>object));
    const fixed=['EXT-BLOCK-01','EXT-FLYWHEEL-01','EXT-OILPAN-01','EXT-INTAKE-01','EXT-FUEL-03','EXT-EXHAUST-30']
      .map(id=>entries.get(id)?.object).filter(Boolean);
    const original=new Map();
    scene.updateMatrixWorld(true);
    for(const object of [...fixed,...[...tracked.values()].flat()]) original.set(object,object.matrixWorld.elements.slice());
    const matrixDelta=object=>Math.max(...object.matrixWorld.elements.map((v,i)=>Math.abs(v-original.get(object)[i])));
    const trace=[];
    const moving={};
    const history=[];
    let finger=-1;
    window.qaTrace={trace,moving,history,stop:false};
    const tick=(now)=>{
      if(window.qaTrace.stop)return;
      const phase=state.enginePhase;
      const raw=qaMeter();
      scene.updateMatrixWorld(true);
      const previous=trace.at(-1);
      const clock=state.driveAngles.both;
      const angle=state.angle;
      const effects=typeof chamberFire!=='undefined' && chamberFire?.group?.visible;
      const visibleCylinders=chamberFire
        ? (chamberFire.group.visible ? chamberFire.group.children.filter(part=>part.visible&&part.name.startsWith('api:')).map(part=>Number(part.name.split(':')[1])) : [])
        : combustionGroup?.children?.filter(node=>node.visible).map(node=>node.userData.cylinder).filter(n=>Number.isInteger(n))||[];
      const fixedDrift=Math.max(...fixed.map(matrixDelta));
      let maxMotion=0;
      for (const [name,objects] of tracked) {
        const delta=Math.max(0,...objects.map(matrixDelta));
        maxMotion=Math.max(maxMotion,delta);
        if(delta>1e-7) (moving[name]??={})[phase]=Math.max(delta,moving[name][phase]||0);
      }
      if(previous?.phase!==phase){
        history.push({phase,time:now,angle,phaseTime:state.phaseTime});
        finger=history.length-1;
      }
      if(!previous || now-previous.wall>25 || previous.phase!==phase){
        trace.push({phase,stage:finger,elapsed:state.phaseTime,rpm:state.rpm,engage:state.starterEngagement,
          status:document.getElementById('operation-status').textContent.trim(),
          running:state.running,clock,angle,wall:now,fixedDrift,maxMotion,effects,visibleCylinders,
          audio:engineAudio?.probe(),...raw});
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  let session=null;
  if(process.env.R06_QA_RECORD==='1'&&view.name==='hp'){
    const frames=join(output,`${view.name}-frames`);
    await mkdir(frames,{recursive:true});
    session=await context.newCDPSession(page);
    const pending=[];
    let count=0;
    session.on('Page.screencastFrame',frame=>{
      session.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
      const entry={file:`frame-${String(count++).padStart(5,'0')}.jpg`,timestamp:frame.metadata.timestamp};
      timeline.push(entry);
      pending.push(writeFile(join(frames,entry.file),Buffer.from(frame.data,'base64')));
    });
    await session.send('Page.startScreencast',{format:'jpeg',quality:68,maxWidth:760,maxHeight:860,everyNthFrame:2});
    slow.push(async()=>{await session.send('Page.stopScreencast');await Promise.all(pending);await writeFile(join(frames,'timeline.json'),JSON.stringify(timeline));});
  }
  // Use actual controls. Leave clock to the render loop; never set state or advance it directly.
  const toggle=page.locator('#operation-toggle');
  const stop=page.locator('#operation-stop');
  const reset=page.locator('#operation-reset');
  const startTime=Date.now();
  await toggle.click();
  await page.waitForFunction(()=>engineAudio?.probe().contextState==='running'&&!engineAudio?.probe().muted);
  await page.waitForFunction(()=>state.enginePhase==='cranking'&&state.rpm>140,null,{timeout:120000});
  await toggle.click();
  const paused=await page.evaluate(()=>({rpm:state.rpm, angle:state.angle, running:state.running,phase:state.enginePhase}));
  assert.equal(paused.running,false);
  await page.waitForTimeout(750);
  const still=await page.evaluate(()=>({rpm:state.rpm,angle:state.angle,running:state.running,phase:state.enginePhase, meter:qaMeter()}));
  assert.deepEqual({rpm:still.rpm,angle:still.angle,running:still.running,phase:still.phase},paused);
  assert.ok(still.meter.rms<.001,`Pause waveform RMS ${still.meter.rms}`);
  await toggle.click();
  if(!view.reduced&&!fast) await shot('start-resumed');
  await page.waitForFunction(()=>state.enginePhase==='running'&&state.phaseTime>.30&&state.starterEngagement===0,null,{timeout:130000});
  const timeToIdle=Date.now()-startTime;
  if(!fast)await shot('running');
  await page.locator('#audio-toggle').click();
  await page.waitForFunction(()=>engineAudio.probe().muted&&!engineAudio.probe().audible);
  await page.waitForTimeout(650);
  assert.ok((await page.evaluate(()=>qaMeter())).rms<.001);
  await page.locator('#audio-toggle').click();
  await page.waitForFunction(()=>!engineAudio.probe().muted&&engineAudio.probe().audible);
  await page.waitForFunction(()=>qaMeter().rms>.002,null,{timeout:15000});
  await stop.click();
  await page.waitForFunction(()=>state.enginePhase==='off'&&state.rpm===0&&state.starterEngagement===0,null,{timeout:105000});
  await page.waitForTimeout(550);
  const stopped=await page.evaluate(()=>({angle:state.angle,running:state.running,audio:engineAudio.probe(),meter:qaMeter()}));
  assert.ok(stopped.meter.rms<.001&&!stopped.audio.audible);
  assert.equal(stopped.running,false);
  await toggle.click();
  await page.waitForFunction(()=>state.enginePhase==='cranking',null,{timeout:65000});
  const options=page.locator('details.operation-options');
  if(await options.count() && !await options.evaluate(element=>element.open)){
    await options.locator('summary').click();
  }
  await reset.click();
  const resetPose=await page.evaluate(()=>({phase:state.enginePhase,angle:state.angle,engage:state.starterEngagement,rpm:state.rpm,clocks:state.driveAngles}));
  assert.deepEqual(resetPose,{phase:'off',angle:0,engage:0,rpm:0,clocks:{both:0,running:0,starting:0}});
  if(!fast)await shot('reset');
  for(const finalize of slow.splice(0))await finalize();
  const captured=await page.evaluate(()=>{
    qaTrace.stop=true;
    return qaTrace;
  });
  if(!view.reduced&&!fast) {
    await page.locator('#starter-entry').click();
    const previous=JSON.parse(await readFile(join('qa/r06/baseline',view.name+'-starter-camera.json')));
    await page.evaluate(previous=>{
      camera.position.fromArray(previous.position);
      controls.target.fromArray(previous.target);
      camera.fov=previous.fov;
      camera.updateProjectionMatrix();
      controls.update();
    },previous);
    const cameraMatch=await page.evaluate(()=>({
      position:camera.position.toArray(), target:controls.target.toArray(), fov:camera.fov, aspect:camera.aspect,
      xray:state.xray, cold:state.enginePhase, drive:state.driveId,
    }));
    assert.ok(cameraMatch.xray && cameraMatch.drive==='starter-pinion');
    await shot('starter-close');
    await writeFile(join(output,`${view.name}-starter-camera.json`),JSON.stringify(cameraMatch,null,2));
    await page.locator('[data-mode=operation]').click();
  }
  let capUI=null;
  if(fast&&view.name==='desktop'&&process.env.R06_QA_CAP_UI==='1'){
    await page.locator('#drive-entry').click();
    await page.locator('#drive-select').selectOption('cap-pressure');
    await page.locator('#operation-info').click();
    const bench=async name=>{
      await page.getByRole('button',{name,exact:true}).click();
      return page.evaluate(()=>{scene.updateMatrixWorld(true);return {
        pressure:mechanics.inspect().capPressure,
        matrices:Object.fromEntries([382,383,384].map(n=>[n,entries.get('EXT-COOLING-'+n).object.matrixWorld.toArray()]))
      };});
    };
    const seated=await bench('Duduk normal');
    const pressure=await bench('Relief +120 kPa');
    const vacuum=await bench('Alir balik −4 kPa');
    const reset=await bench('Duduk normal');
    assert.equal(seated.pressure,null);
    assert.equal(pressure.pressure,120);
    assert.equal(vacuum.pressure,-4);
    assert.notDeepEqual(pressure.matrices['382'],seated.matrices['382']);
    assert.notDeepEqual(pressure.matrices['383'],seated.matrices['383']);
    assert.notDeepEqual(vacuum.matrices['384'],seated.matrices['384']);
    assert.deepEqual(reset.matrices,seated.matrices);
    capUI={seated,pressure,vacuum,reset};
  }
  const stageOrder=captured.history.map(x=>x.phase).slice(0,6);
  assert.deepEqual(stageOrder,['off','engaging','cranking','firing','running','stopping']);
  for(const phase of ['cranking','firing','running']){
    assert.ok(captured.trace.some(x=>x.phase===phase&&x.rms>.001),`No genuine native waveform in ${phase}`);
  }
  assert.ok(!captured.trace.some(x=>x.peak>=.999),'Audio clip');
  assert.ok(Math.max(...captured.trace.map(x=>x.fixedDrift))<1e-6,'Fixed-parts drift');
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(diagnostics.bodyOverflow,0);
  assert.equal(await page.evaluate(()=>renderer.getContext().isContextLost()),false);
  let matrix=null;
  if(view.name==='desktop' && process.env.R06_QA_MATRIX==='1'){
    await page.evaluate(()=>{window.qaCaptureGeometry=true;});
    const source=await readFile('qa/r06/audit-matrix.js','utf8');
    matrix=await page.evaluate(source);
    await writeFile(join(output,'matrix-audit.json'),JSON.stringify(matrix));
    assert.deepEqual(matrix.missing,[]);
    assert.deepEqual(matrix.unresolvedFrozen,[]);
    assert.ok(matrix.restored<1e-6);
    assert.ok(Object.values(matrix.fixedDrift).every(delta=>delta<1e-6));
  }
  const endHashes=await computeHashes();
  const filesChangingAfterLoad=Object.keys(hashes).filter(name=>hashes[name]!==endHashes[name]);
  await writeFile(join(output,`${view.name}.json`),JSON.stringify({hashes,filesChangingAfterLoad,diagnostics,initial,effectNote,stageOrder,timeToIdle,checks,
    paused,still,stopped,resetPose,errors,screenshots,recordedFrames:timeline.length,matrix:matrix?.counts,capUI,captured},null,2));
  console.log(JSON.stringify({view:view.name,diagnostics,stageOrder,timeToIdle,sampledFrames:captured.trace.length,
    recordedFrames:timeline.length,motionGroups:Object.keys(captured.moving).length,effectNote,errors}));
 }catch(e){
  const evidence=await page.evaluate(()=>({state:typeof state==='undefined'?null:state,trace:window.qaTrace})).catch(()=>null);
  await writeFile(join(output,`${view.name}-failure.json`),JSON.stringify({error:e.message,evidence,errors},null,2));
  throw e;
 }finally{
  for(const finalize of slow.splice(0))await finalize().catch(()=>{});
  await context.close();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
