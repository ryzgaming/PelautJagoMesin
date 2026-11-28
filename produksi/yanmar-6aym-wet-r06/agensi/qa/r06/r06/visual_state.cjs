/* A real WebGL diagnostic at a chosen crank moment after native UI acceptance. */
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {writeFile,readFile,mkdir}=require('node:fs/promises');
const {join}=require('node:path');
(async()=>{
 const out=process.env.R06_QA_OUTPUT||'qa/r06/browser';
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 for (const [name,width,height,dpr] of [['desktop',1280,800,1],['hp',390,844,2]]) {
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:name==='hp',hasTouch:name==='hp'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:4196/');
   await page.waitForFunction(()=>typeof roots!=='undefined' && roots?.every(Boolean) && renderer?.info.render.triangles>1000,null,{timeout:60000});
   await page.locator('[data-mode=operation]').click();
   const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await paint();
   await page.screenshot({path:join(out,name+'-operation-ready.png'),timeout:45000});
   await page.locator('#starter-entry').click();
   await paint();
   const starter=await page.evaluate(()=>({
     drive:state.driveId, angle:state.angle, xray:state.xray, phase:state.enginePhase,
     position:camera.position.toArray(), target:controls.target.toArray(), fov:camera.fov, aspect:camera.aspect,
   }));
   await page.screenshot({path:join(out,name+'-starter-close.png'),timeout:45000});
   await writeFile(join(out,name+'-starter-camera.json'),JSON.stringify(starter,null,2));
   await page.locator('#drive-back').click();
   const toggled=await page.evaluate(()=>state.xray);
   if(!toggled)await page.locator('#xray').click();
   await page.locator('details.operation-options summary').click();
   await page.locator('#flow-cut').click();
   const opts=page.locator('details.operation-options');
   if(!await opts.evaluate(node=>node.open)) await opts.locator('summary').click();
   await page.getByRole('button',{name:'Fokus ruang bakar',exact:true}).click();
   if(await opts.evaluate(node=>node.open)) await opts.locator('summary').click();
   await page.evaluate(()=>{
      const id=2, viewer=data.kinematics.viewer, index=viewer.firing_order.indexOf(id);
      const radians=(index*120+32)*Math.PI/180;
      state.running=false;
      phaseChange('firing');
      state.phaseTime=.52;
      state.rpm=500;
      state.simTime=1;
      state.driveAngles={both:radians,running:radians,starting:0};
      state.angle=radians;
      mechanics.tick({phase:'firing',dt:.25,rpm:state.rpm,crankRadians:radians,starterRadians:0,engagement:0});
      pickFlow('fuel');
      applyPose();
      updateClipPlane();
      tickFlowEffects(.05);
      scene.updateMatrixWorld(true);
      renderer.render(scene,camera);
   });
   await paint();
   const evidence=await page.evaluate(()=>({phase:state.enginePhase,angle:state.angle,rpm:state.rpm,
     realFlames:chamberFire.group.children.filter(n=>n.name.startsWith('api:')&&n.visible).map(n=>n.name),
     activeRibbons:routeRibbons.group.visible, camera:camera.position.toArray(),target:controls.target.toArray(),
     triangles:renderer.info.render.triangles,gpu:renderer.getContext().isContextLost()}));
   await page.screenshot({path:join(out,name+'-firing-diagnostic.png'),timeout:45000});
   await page.evaluate(()=>{
     phaseChange('cranking');
     updateFlowAppearance();
     tickFlowEffects(.05);
     renderer.render(scene,camera);
   });
   await paint();
   evidence.crankingFlameCount=await page.evaluate(()=>chamberFire.group.children.filter(n=>n.name.startsWith('api:')&&n.visible).length);
   evidence.errors=errors;
   await writeFile(join(out,name+'-visual.json'),JSON.stringify(evidence,null,2));
   await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
