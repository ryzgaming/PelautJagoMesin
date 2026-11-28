import { readFile } from 'node:fs/promises';

const harnessUrl = new URL('../../review/tools/state-check.mjs',import.meta.url);
const harness = await readFile(harnessUrl,'utf8');
const stop = harness.indexOf("assert.equal(run('roots.every(Boolean)'),true);");
if(stop<0)throw Error('Flow test mock bootstrap unavailable');
const bootstrap=harness.slice(0,stop).replaceAll('import.meta.url',JSON.stringify(harnessUrl.href));
const assertions=String.raw`
function frames() {
  const queue=Array.from(managedFrames);
  managedFrames.clear();
  for(const [,fn] of queue) fn();
}
assert.equal(run('roots.every(Boolean)'),true);
assert.equal(run('data.revision'),'r04');
assert.equal(run('state.mode'),'home');
assert.equal(run('flowGroup.visible'),false);
const host=entries.get('canvas');
host.clientWidth=390;
host.clientHeight=780;
for(const resize of resizeObservers)resize();
frames();
assert.equal(run('camera.aspect'),.5);
modes[1].click();
assert.equal(run('state.mode'),'systems');
assert.equal(entries.get('operation-controls').hidden,false);
modes[2].click();
assert.equal(run('state.mode'),'operation');
const control=entries.get('flow-select');
const totals={};
for(const key of ['fuel','intake','exhaust','freshwater','seawater','lubrication']) {
  control.value=key;
  control.dispatch('change');
  assert.equal(run('state.flow'),key);
  if(!run('state.xray'))entries.get('xray').click();
  const count=run("Array.from(flowViews.values()).filter(x=>x.group.visible&&x.route.system===state.flow).length");
  assert.equal(count,run('routeList().length'));
  assert.ok(count>0,'No visible route in '+key);
  totals[key]=count;
  assert.equal(run("Array.from(flowViews.values()).some(x=>x.group.visible&&x.route.system!==state.flow)"),false);
  assert.ok(run("[...flowViews.values()].filter(v=>v.group.visible).every(v=>{const l=v.group.children[0];const n=v.route.points.length;return v.length>0&&l.geometry.attributes.position.count===n&&(v.route.kind==='physical'?l.material.isLineBasicMaterial===true:l.material.isLineDashedMaterial===true);})"));
}
control.value='fuel';
control.dispatch('change');
entries.get('operation-toggle').click();
assert.equal(run('state.running'),true);
run('renderer.loop(0);renderer.loop(50);renderer.loop(100);renderer.loop(150);');
const at=run('state.simTime');
assert.ok(at>0);
const before=run("JSON.stringify([...flowViews.values()].filter(v=>v.group.visible).flatMap(v=>v.particles.map(p=>p.position.toArray())))");
entries.get('operation-toggle').click();
assert.equal(run('state.running'),false);
run('renderer.loop(200);renderer.loop(250);');
assert.equal(run('state.simTime'),at);
assert.equal(run("JSON.stringify([...flowViews.values()].filter(v=>v.group.visible).flatMap(v=>v.particles.map(p=>p.position.toArray())))"),before);
entries.get('operation-toggle').click();
run('renderer.loop(300);renderer.loop(350);');
assert.ok(run('state.simTime')>at);
entries.get('operation-reset').click();
assert.equal(run('state.running || state.simTime!==0 || state.angle!==0'),false);
assert.ok(run("Array.from(flowViews.values()).filter(v=>v.group.visible).every(v=>v.particles.every(p=>!p.visible))"));

const pulses=JSON.parse(run("(function(){const report=[]; for(let cylinder=1;cylinder<=6;cylinder++){const chain=[...flowViews.values()].filter(v=>v.route.system==='fuel'&&v.route.event==='injection'&&v.route.cylinder===cylinder); const idx=data.kinematics.viewer.firing_order.indexOf(cylinder); let last=null,maxStep=0,bad=0; const visited=new Set(); state.simTime=1; for(let n=1;n<400;n++){state.angle=(708+idx*120+n*30/400)%720*Math.PI/180; updateFlowParticles(); const active=chain.filter(v=>v.group.visible&&v.particles.some(p=>p.visible));if(active.length!==1){bad++;continue;} const current=active[0].particles.find(p=>p.visible).position;visited.add(active[0].route.id);if(last)maxStep=Math.max(maxStep,current.distanceTo(last));last=current.clone();}report.push({cylinder,multipleOrEmptySteps:bad,maxStepM:maxStep,visited:[...visited],expect:chain.length});}resetOperation();return JSON.stringify(report);})()"));
assert.equal(pulses.length,6);
for(const p of pulses) {
  assert.equal(p.multipleOrEmptySteps,0,JSON.stringify(p));
  assert.equal(p.visited.length,p.expect,JSON.stringify(p));
  assert.ok(p.maxStepM<.02,'Unexpected injection pulse jump: '+JSON.stringify(p));
}

entries.get('operation-tour').click();
assert.equal(run('state.tour.index'),0);
assert.ok(run('state.xray'));
entries.get('operation-toggle').click();
assert.equal(run('state.running'),false);
const tour0=run('state.tour.elapsed');
run('renderer.loop(400);renderer.loop(450);');
assert.equal(run('state.tour.elapsed'),tour0);
entries.get('operation-toggle').click();
let clock=450;
const stages=[];
let sawSpread=false;
for(let step=0;step<800&&run('Boolean(state.tour)');step++) {
  clock+=50;
  run('renderer.loop('+clock+')');
  const index=run('state.tour?.index');
  if(index!==undefined&&!stages.includes(index)) stages.push(index);
  if(run('state.tourSpread>.15'))sawSpread=true;
}
assert.deepEqual(stages,Array.from({length:run('tourStages.length')},(_,i)=>i));
assert.ok(sawSpread);
assert.equal(run('state.tour===null && state.tourSpread===0 && !state.running'),true);
assert.ok(run("groups.get('RAK-FLYWHEEL').object.position.distanceTo(groups.get('RAK-FLYWHEEL').base)<1e-6"));
entries.get('reset').click();
assert.equal(run('state.mode'),'home');
assert.equal(run('flowGroup.visible'),false);
console.log(JSON.stringify({status:'PASS',mock:'GLTFLoader and Three graph with mock DOM/renderer',viewport:[390,780],totals,injectionContinuousAcrossPorts:pulses,tourStages:stages,pauseClockProtected:true,restoredMainGroups:true}));
`;
try {
  await import('data:text/javascript;base64,'+Buffer.from(bootstrap+assertions).toString('base64'));
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
