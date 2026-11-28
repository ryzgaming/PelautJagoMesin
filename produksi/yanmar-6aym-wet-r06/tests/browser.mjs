import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=new URL(process.env.PACKAGE_URL || 'http://127.0.0.1:8080/');
const executablePath=process.env.CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,executablePath,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});

try {
  for (const plan of [
    {file:'index.html',width:820,height:620,status:'#operation-status',select:'#starter-entry',
      start:'#operation-toggle',pause:'#operation-toggle',resume:'#operation-toggle',stop:'#operation-stop'},
    {file:'minimal.html',width:390,height:730,status:'#status',select:'#starter',
      start:'[data-command=start]',pause:'[data-command=pause]',resume:'[data-command=resume]',stop:'[data-command=stop]'}
  ]) {
    const page=await browser.newPage({viewport:{width:plan.width,height:plan.height}});
    page.setDefaultTimeout(90000);
    const errors=[];
    const assets=new Set();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{
      const path=new URL(response.url()).pathname;
      if (response.ok() && path.includes('/model/assets/')) assets.add(path.split('/').at(-1));
    });
    await page.goto(new URL('ui-workspace/'+plan.file,base).href,{waitUntil:'domcontentloaded'});
    if (plan.file==='index.html') {
      await page.locator('#loading[hidden]').waitFor({state:'attached'});
      await page.locator('[data-mode=operation]').click();
      await page.locator('#operation-info').click();
      await page.getByText('Rute pada model',{exact:true}).waitFor();
      await page.locator('#operation-info').click();
    }
    const status=page.locator(plan.status);
    const stateIncludes=(parts)=>page.waitForFunction(
      ({selector,parts})=>parts.some(part=>document.querySelector(selector)?.textContent.includes(part)),
      {selector:plan.status,parts});
    await stateIncludes(['Mesin mati']);
    assert.deepEqual([...assets].sort(),['data.json','exterior.glb','internal.glb']);
    assert.equal(await page.locator('canvas').count(),1);
    await page.locator(plan.select).click();
    if (plan.file==='index.html') assert.equal(await page.locator('#drive-select').inputValue(),'starter-pinion');
    else assert.equal(await page.locator('#inventory option').count(),1185);
    await page.locator(plan.start).click();
    await stateIncludes(['Starter memutar','Pembakaran mulai','Mesin hidup']);
    await page.locator(plan.pause).click();
    await stateIncludes(['Jeda ·']);
    const paused=await status.textContent();
    await page.waitForTimeout(350);
    assert.equal(await status.textContent(),paused);
    await page.locator(plan.resume).click();
    await page.waitForFunction(
      selector=>document.querySelector(selector)?.textContent==='Mesin hidup',plan.status);
    await page.locator(plan.stop).click();
    await stateIncludes(['Mesin mati']);
    await page.locator('#xray').click();
    assert.equal(await page.locator('#xray').getAttribute('aria-pressed'),'false');

    if (plan.file==='index.html') {
      await page.goto(new URL('ui-workspace/?part=INT-FUELINJ-61&view=section',base).href,{waitUntil:'domcontentloaded'});
      await page.locator('#assembly-detail').waitFor({state:'visible'});
      await page.locator('#cutaway[aria-pressed=true]').waitFor({state:'attached'});
      assert.match(await page.locator('#assembly-detail').textContent(),/INT-FUELINJ-61/);
    } else {
      await page.locator('#inventory').selectOption('EXT-BLOCK-01');
      assert.match(await page.locator('#selection').textContent(),/EXT-BLOCK-01/);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS '+plan.file+' · shared GLBs, native WebGL, starter, pause/resume, stop and selection.');
    await page.close();
  }
} finally {
  await browser.close();
}
