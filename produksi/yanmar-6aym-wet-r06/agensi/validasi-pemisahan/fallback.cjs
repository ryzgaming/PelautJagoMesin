/* Test UI behavior with unavailable GLB files without changing package files. */
const assert=require('node:assert/strict');
const {writeFile}=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.QA_URL || 'http://127.0.0.1:4197/yanmar-6aym-wet-r06/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM||undefined,headless:true,args:[
   '--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const rows=[];
 try{
 for(const ui of ['studio','minimal']){
    const p=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    p.on('pageerror',err=>errors.push(err.message));
    await p.route('**/model/assets/*.glb',route=>route.fulfill({status:404,body:'QA fixture missing GLB'}));
    await p.goto(new URL(ui==='studio'?'ui-workspace/?view=operation':'ui-workspace/minimal.html',base).href);
    await p.getByText(/Aset 3D gagal dimuat/).waitFor({timeout:50000});
    if(ui==='studio'){
      assert.equal(await p.locator('#operation-toggle').isDisabled(),true);
      await p.locator('#parts').click();
      await p.locator('#part-filter').fill('EXT-FUEL-03');
      assert.equal(await p.locator('.parts-results').getByText('EXT-FUEL-03').count(),1);
    }else{
      assert.equal(await p.locator('[data-command=start]').isDisabled(),true);
      await p.locator('#inventory').selectOption('EXT-FUEL-03');
      await p.locator('#selection').getByText(/EXT-FUEL-03/).waitFor();
    }
    assert.deepEqual(errors,[]);
    rows.push({ui,displayedBlockedMessage:true,commandsDisabled:true,inventoryStillUsable:true,errors});
    await p.close();
 }
 }finally{await browser.close();}
 await writeFile('agensi/validasi-pemisahan/browser/fallback.json',JSON.stringify(rows,null,2)+'\n');
 console.log(JSON.stringify(rows));
})().catch(error=>{console.error(error);process.exitCode=1});
