/* Private test of both actual UIs under a substituted URL prefix.
 * Adds only a test observer and deterministic clock to an intercepted module response. */
const assert=require('node:assert/strict');
const {readFile,writeFile,mkdir}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {join}=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.QA_URL || 'http://127.0.0.1:4197/yanmar-6aym-wet-r06/';
const out='agensi/validasi-pemisahan/browser';
const observe=String.raw`
  globalThis.__packageQA={
    snapshot,
    inventory,
    inspect:()=>({
      geometry:roots.map(root=>Boolean(root)), triangles:renderer.info.render.triangles,
      gpu:renderer.getContext().getParameter(renderer.getContext().RENDERER),
      contextLost:renderer.getContext().isContextLost(), audio:engineAudio?.probe(), viewport:[innerWidth,innerHeight,globalThis.devicePixelRatio]
    }),
    fixedPose:()=>{
      renderer.setAnimationLoop(null);
      setMode('operation');
      resetOperation();
      power.start();
      const result=[];
      for(let i=0;i<=205;i++){
        if(i)advanceSimulation(.02);
        if([0,10,35,55,90,105,145,175,205].includes(i)){
          scene.updateMatrixWorld(true);
          const poses=[...entries].map(([id,entry])=>[id,entry.object?.matrixWorld.elements.slice()||null]);
          result.push({index:i,phase:state.enginePhase,rpm:state.rpm,theta:state.angle,engage:state.starterEngagement,poses});
        }
      }
      power.stop();
      for(let i=0;i<70;i++) if(state.running)advanceSimulation(.02);
      resetOperation();
      scene.updateMatrixWorld(true);
      result.push({index:'reset',phase:state.enginePhase,poses:[...entries].map(([id,entry])=>[id,entry.object?.matrixWorld.elements.slice()||null])});
      return result;
    }
  };
`;

async function main(){
 await mkdir(out,{recursive:true});
 const core=await readFile('model/runtime/engine-session.js','utf8');
 const marker='  return Object.freeze({load,';
 assert.equal(core.indexOf(marker),core.lastIndexOf(marker));
 assert.notEqual(core.indexOf(marker),-1);
 const modified=core.replace(marker,observe+'\n'+marker);
 const sha=createHash('sha256').update(core).digest('hex');
 const activeFiles=['model/manifest.json','model/runtime/engine-session.js','model/runtime/powertrain.js',
 'model/assets/exterior.glb','model/assets/internal.glb','model/assets/data.json',
 'ui-workspace/index.html','ui-workspace/studio.js','ui-workspace/minimal.html','ui-workspace/minimal.js'];
 const fingerprints=async()=>Object.fromEntries(await Promise.all(activeFiles.map(async name=>[
   name,createHash('sha256').update(await readFile(name)).digest('hex')
 ])));
 const fingerprintsBefore=await fingerprints();
 const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM||undefined,headless:true,args:[
  '--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
 for(const ui of ['studio','minimal']){
  for(const dev of [{name:'desktop',w:1280,h:800,dpr:1},{name:'hp',w:390,h:844,dpr:2}]){
    const config={ui,name:dev.name};
    if(process.env.QA_ONLY && process.env.QA_ONLY!==ui+'-'+dev.name)continue;
    const context=await browser.newContext({viewport:{width:dev.w,height:dev.h},deviceScaleFactor:dev.dpr,
      hasTouch:dev.name==='hp',isMobile:dev.name==='hp'});
    const page=await context.newPage();
    await page.route('**/model/runtime/engine-session.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:modified}));
    page.setDefaultTimeout(65000);
    const errors=[], requests=new Set(), bad=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>requests.add(request.url()));
    page.on('response',response=>{if(!response.ok()&&!response.url().endsWith('/favicon.ico'))bad.push([response.status(),response.url()]);});
    try{
      const path=ui==='studio'?'ui-workspace/?view=operation':'ui-workspace/minimal.html';
      await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
      const wait=fn=>page.waitForFunction(fn,null,{timeout:130000});
      await wait(()=>window.__packageQA?.snapshot().ready && window.__packageQA.inspect().triangles>1000);
      const initial=await page.evaluate(()=>({state:__packageQA.snapshot(),canvas:__packageQA.inspect(),parts:__packageQA.inventory().length,
          overflow:document.documentElement.scrollWidth-innerWidth,studioCanvas:document.querySelector('#canvas canvas')!==null,
          minimalCanvas:document.querySelector('#engine-view canvas')!==null,
          foreignStudioLayout:[...document.querySelectorAll('#panel,#operation-controls,#parts')].length}));
      config.initial=initial;
      assert.equal(initial.parts,1184);assert.deepEqual(initial.canvas.geometry,[true,true]);assert.equal(initial.canvas.contextLost,false);
      assert.equal(initial.overflow,0);
      if(ui==='minimal')assert.equal(initial.foreignStudioLayout,0,'Studio DOM in alternate UI');
      assert.equal(initial.state.phase,'off');
      const operation=ui==='studio';
      const control=name=>page.locator(operation ? ({
          start:'#operation-toggle',pause:'#operation-toggle',resume:'#operation-toggle',stop:'#operation-stop',reset:'#operation-reset'})[name]
          : `[data-command="${name}"]`);
      if(operation && !await control('start').isVisible())await page.locator('[data-mode=operation]').click();
      await page.evaluate(()=>{
        window.__phases=[];
        const tick=()=>{
          const phase=__packageQA.snapshot().phase;
          if(window.__phases.at(-1)!==phase)window.__phases.push(phase);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await control('start').click();
      await wait(()=>__packageQA.snapshot().phase==='cranking');
      await control('pause').click();
      const before=await page.evaluate(()=>__packageQA.snapshot());
      assert.ok(before.paused);
      await page.waitForTimeout(700);
      const after=await page.evaluate(()=>__packageQA.snapshot());
      assert.equal(after.crankAngle,before.crankAngle);
      assert.equal(after.phaseTime,before.phaseTime);
      await control('resume').click();
      await wait(()=>__packageQA.snapshot().phase==='running' && __packageQA.snapshot().starterEngagement===0);
      await control('stop').click();
      await wait(()=>__packageQA.snapshot().phase==='off');
      const phases=await page.evaluate(()=>window.__phases);
      config.phases=phases;
      assert.deepEqual(phases.slice(0,7),['off','engaging','cranking','firing','running','stopping','off']);
      if(operation){
        const opts=page.locator('details.operation-options');
        if(!await opts.evaluate(element=>element.open))await opts.locator('summary').click();
      }
      await control('reset').click();
      const reset=await page.evaluate(()=>__packageQA.snapshot());
      assert.equal(reset.crankAngle,0);assert.equal(reset.rpm,0);assert.equal(reset.phase,'off');
      if(operation){
        await page.locator('#parts').click();
        await page.locator('#part-filter').fill('EXT-FUEL-03');
        await page.locator('.parts-results button').first().click();
      }else{
        await page.locator('#inventory').selectOption('EXT-FUEL-03');
      }
      config.selected=await page.evaluate(()=>__packageQA.snapshot().selection);
      assert.equal(config.selected,'EXT-FUEL-03');
      assert.deepEqual(errors,[]);
      assert.deepEqual(bad,[]);
      assert.ok([...requests].every(url=>url.startsWith(base)),JSON.stringify([...requests]));
      assert.ok([...requests].some(url=>url.endsWith('/model/assets/exterior.glb')));
      assert.ok([...requests].some(url=>url.endsWith('/model/assets/internal.glb')));
      config.requests=[...requests].sort();
      const screenshot=join(out,`${ui}-${dev.name}.png`);
      await page.screenshot({path:screenshot,timeout:50000});
      const rows=await page.evaluate(()=>__packageQA.fixedPose());
      assert.equal(rows.length,10);assert.equal(rows[0].poses.length,1184);
      assert.ok(rows.every(row=>row.poses.every(([,matrix])=>matrix?.length===16)));
      config.matrixRows=rows.map(row=>({at:row.index,phase:row.phase,
           hash:createHash('sha256').update(JSON.stringify(row.poses)).digest('hex')}));
      config.coreModuleSha256=sha;
      config.error=null;
      await writeFile(join(out,`${ui}-${dev.name}.json`),JSON.stringify(config,null,2)+'\n');
      results.push(config);
      console.log(JSON.stringify({ui,device:dev.name,phases,resetAngle:reset.crankAngle,selected:config.selected,poseSamples:rows.length}));
    }catch(e){
      const probe=await page.evaluate(()=>({state:window.__packageQA?.snapshot(),phases:window.__phases,
                                           text:document.body.textContent?.slice(0,800)})).catch(()=>null);
      await writeFile(join(out,`${ui}-${dev.name}-failure.json`),JSON.stringify({...config,error:e.message,probe,errors,bad},null,2)+'\n');
      throw e;
    }finally{await context.close();}
  }
 }
 if(results.length>1)for(const candidate of results.slice(1))assert.deepEqual(candidate.matrixRows,results[0].matrixRows);
 const fingerprintsAfter=await fingerprints();
 assert.deepEqual(fingerprintsAfter,fingerprintsBefore,'Package runtime changed during test');
 await writeFile(join(out,'ringkasan.json'),JSON.stringify({pass:true,fingerprints:fingerprintsAfter,results,sameFrameFullMatrixIdentity:results.length>1,sourceObservationOnly:true},null,2)+'\n');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
