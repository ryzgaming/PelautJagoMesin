/* Diagnostic camera match. Normal interaction acceptance is verify_browser.cjs. */
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {readFile,writeFile,mkdir}=require('node:fs/promises');
const {join}=require('node:path');
(async()=>{
 const side=process.argv[2]||'baseline';
 const out='qa/r06/'+side;
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 for(const [name,width,height,dpr] of [['desktop',1280,800,1],['hp',390,844,2]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:name==='hp',hasTouch:name==='hp'});
  const page=await context.newPage();
  page.setDefaultTimeout(55000);
  await page.goto('http://127.0.0.1:'+(side==='baseline'?'4195':'4196')+'/');
  await page.waitForFunction(()=>typeof roots!=='undefined' && roots?.every(Boolean) && renderer?.info.render.triangles>1000);
  await page.locator('[data-mode=operation]').click();
  if(side==='baseline') {
    await page.locator('#drive-entry').click();
    await page.locator('#drive-select').selectOption('starter-pinion');
    await page.locator('#xray').click();
    const source=process.env.R06_QA_CAMERA_FROM;
    if(source){
      const pivot=JSON.parse(await readFile(join(source,name+'-starter-camera.json'),'utf8'));
      await page.evaluate(pivot=>{
        camera.position.fromArray(pivot.position);
        controls.target.fromArray(pivot.target);
        camera.fov=pivot.fov;
        camera.updateProjectionMatrix();
        controls.update();
      },pivot);
    }
  } else {
    await page.locator('#starter-entry').click();
    if(!await page.evaluate(()=>state.xray)) await page.locator('#xray').click();
    const previous=JSON.parse(await readFile(join('qa/r06/baseline',name+'-starter-camera.json')));
    await page.evaluate(previous=>{
      camera.position.fromArray(previous.position);
      controls.target.fromArray(previous.target);
      camera.fov=previous.fov;
      camera.updateProjectionMatrix();
      controls.update();
    },previous);
  }
  const details=await page.evaluate(()=>({
    angle:state.angle,mode:state.mode,drive:state.driveId,xray:state.xray,position:camera.position.toArray(),
    target:controls.target.toArray(),fov:camera.fov,aspect:camera.aspect,
    canvas:[renderer.domElement.clientWidth,renderer.domElement.clientHeight],
  }));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:join(out,name+'-starter-close.png'),timeout:45000});
  await writeFile(join(out,name+'-starter-camera.json'),JSON.stringify(details,null,2));
  await context.close();
 }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
