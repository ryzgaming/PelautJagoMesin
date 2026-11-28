const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { writeFile } = require('node:fs/promises');
const {resolve}=require('node:path');
const output=resolve('qa/r06/baseline');
const cases=[{name:'desktop',width:1280,height:800,dpr:1},{name:'hp',width:390,height:844,dpr:2}];

(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for(const viewport of cases) {
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:viewport.dpr,hasTouch:viewport.name==='hp',isMobile:viewport.name==='hp'});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:4195/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof roots!=='undefined' && roots?.every(Boolean) && typeof renderer!=='undefined' && renderer?.getContext(),null,{timeout:35000});
      const samples=[];
      const snapshot=async label=>{
        const result=await page.evaluate(label=>{
          const ctx=renderer.getContext();
          const info=ctx.getExtension('WEBGL_debug_renderer_info');
          const op=document.getElementById('operation-status');
          return {label, mode:state.mode,running:state.running,time:state.simTime,angle:state.angle,phase:state.enginePhase,
            engaged:state.starterEngaged,clocks:{...state.driveAngles},controls:[...document.querySelectorAll('#operation-controls button:not([hidden])')].map(b=>b.textContent.trim()),
            status:op?.textContent.trim(),viewport:[innerWidth,innerHeight,devicePixelRatio],renderer:info?ctx.getParameter(info.UNMASKED_RENDERER_WEBGL):null,
            contextLost:ctx.isContextLost(),stage:state.tour?.index??null,overflow:document.documentElement.scrollWidth-innerWidth};
        },label);
        samples.push(result);
        await page.screenshot({path:resolve(output,`${viewport.name}-${label}.png`),animations:'disabled'});
      };
      await snapshot('home');
      await page.locator('[data-mode=operation]').click();
      await snapshot('operation-ready');
      await page.locator('#operation-toggle').click();
      await page.waitForFunction(()=>state.simTime>0.1);
      await snapshot('normal-start');
      await page.locator('#operation-toggle').click();
      await snapshot('pause');
      await page.locator('#operation-reset').click();
      await snapshot('reset');
      await page.locator('#drive-entry').click();
      await page.locator('#drive-starter').click();
      await snapshot('starter-selected');
      await page.locator('#operation-toggle').click();
      await page.waitForFunction(()=>state.starterEngaged);
      await snapshot('starter-spinning');
      await writeFile(resolve(output,viewport.name+'.json'),JSON.stringify({samples,errors},null,2));
      await context.close();
      console.log(viewport.name,JSON.stringify({samples:samples.map(e=>[e.label,e.phase,e.engaged,e.running]),errors}));
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
