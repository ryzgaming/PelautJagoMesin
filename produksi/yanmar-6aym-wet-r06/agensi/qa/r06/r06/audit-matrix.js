// Supplemental deterministic sweep. Native start buttons are checked separately.
(() => {
  const manifest=data.drivetrain;
  const lookup=id=>entries.get(id)?.object || roots.map(root=>root.getObjectByName(id)).find(Boolean);
  const targetsByGroup=new Map([...driveViews].map(([id,{parts}])=>[id,new Map(parts.map(part=>[part.id,part.object]))]));
  const plans=new Map(manifest.groups.map(spec=>[spec.id,spec]));
  const movable=[];
  for(const spec of plans.values()) for(const id of spec.targets) {
    const object=targetsByGroup.get(spec.id)?.get(id);
    if(object) movable.push({spec,id,object});
  }
  for(const id of manifest.legacy?.nodes||[]) {
    const object=lookup(id);
    if(object) movable.push({spec:{id:'legacy'},id,object});
  }
  const frozen=manifest.stationary.map(({id,reason})=>({id,reason,object:lookup(id)})).filter(row=>row.object);
  const unresolvedFrozen=manifest.stationary.map(x=>x.id).filter(id=>!lookup(id));
  const missing=manifest.groups.flatMap(spec=>spec.targets.filter(id=>!targetsByGroup.get(spec.id)?.has(id)).map(id=>[spec.id,id]));
  const prepare=()=>{
    state.running=false;
    state.angle=0;
    state.simTime=0;
    clearDriveClocks();
    applyKinematics();
    applyDrivetrain();
    scene.updateMatrixWorld(true);
  };
  prepare();
  const focusedLegacyMeshes=['EXT-FLYWHEEL-20','EXT-FLYWHEEL-02','INT-CAM-01','INT-CRANK-10']
    .map(id=>({id,object:lookup(id)})).filter(row=>row.object);
  const base=new Map([...movable,...frozen,...focusedLegacyMeshes].map(({object})=>[object,object.matrixWorld.elements.slice()]));
  const restMorph=new Map();
  for(const row of movable) row.object.traverse(child=>{
    if(child.morphTargetInfluences)restMorph.set(child,child.morphTargetInfluences.slice());
  });
  const delta=object=>Math.max(...object.matrixWorld.elements.map((x,i)=>Math.abs(x-base.get(object)[i])));
  let clock=0, starter=0;
  const samples=[];
  const transforms=[];
  const trajectory=[...movable.filter(row=>/oil-pump|timing|starter|governor|rack|pinion|metering|plunger|thermostat|coolant-shaft|seawater-shaft|turbo|cap-/.test(row.spec.id)),...focusedLegacyMeshes];
  const inverse=new Map(trajectory.map(({object})=>[object,new T.Matrix4().fromArray(base.get(object)).invert()]));
  const trackedMovements=new Map(movable.map(row=>[row.id,{id:row.id,group:row.spec.id,actuation:row.spec.actuation||row.spec.mode,max:0,phases:{}}]));
  const fixedDrift={};
  let maxMorph=0;
  const pose=(phase,rpm,duration,crankStep,engagement,record=true)=>{
    clock+=crankStep;
    if(engagement>0)starter+=crankStep;
    state.enginePhase=phase;
    state.rpm=rpm;
    state.simTime=1;
    state.starterEngagement=engagement;
    state.driveAngles={both:clock,running:clock,starting:starter};
    state.angle=clock%(4*Math.PI);
    mechanics.tick({phase,dt:duration,rpm,crankRadians:clock,starterRadians:starter,engagement});
    if(!record)return;
    applyKinematics();
    applyDrivetrain();
    scene.updateMatrixWorld(true);
    for(const row of movable){
      const score=delta(row.object);
      const motion=trackedMovements.get(row.id);
      motion.max=Math.max(motion.max,score);
      motion.phases[phase]=Math.max(motion.phases[phase]||0,score);
    }
    for(const {id,object} of frozen)fixedDrift[id]=Math.max(fixedDrift[id]||0,delta(object));
    for(const [mesh,morph] of restMorph){
      const height=Math.max(...mesh.morphTargetInfluences.map((v,i)=>Math.abs(v-morph[i])));
      maxMorph=Math.max(maxMorph,height);
    }
    const sample={phase,angle:state.angle,warm:mechanics.inspect().tempC, engagement};
    samples.push(sample);
    if (window.qaCaptureGeometry) transforms.push({...sample, moved:Object.fromEntries(trajectory
      .filter(({object})=>delta(object)>1e-9).map(({id,object})=>[id,object.matrixWorld.clone().multiply(inverse.get(object)).toArray()]))});
  };
  const branchVisibility=label=>{
    const original=state.flow;
    const xray=state.xray;
    state.flow='freshwater';
    state.xray=true;
    updateFlowAppearance();
    const branch=[...flowViews.values()].filter(item=>item.route.thermal_branch).map(item=>({
      id:item.route.id, branch:item.route.thermal_branch, guideVisible:item.group.visible, kind:item.route.kind,
      particles:item.particles.filter(particle=>particle.visible).length,
      ribbons:(routeRibbons?.group.children||[]).filter(mesh=>mesh.visible && mesh.userData.flow?.link===item.route.id).length,
    }));
    state.flow=original;
    state.xray=xray;
    updateFlowAppearance();
    return {label,temperature:mechanics.inspect().tempC,branch};
  };
  state.enginePhase='running';
  state.rpm=650;
  const cold=branchVisibility('cold');
  prepare();
  for(let i=0;i<=5;i++)pose('engaging',0,.07,0,i/5);
  const step=4*Math.PI/180;
  for(let i=0;i<96;i++)pose('cranking',220,.003125,.25*Math.PI/180,1);
  for(let i=1;i<=180;i++)pose('cranking',220,.05,step,1);
  for(let i=0;i<20;i++)pose('firing',220+430*i/20,.05,step,i<12?1:0);
  for(let i=0;i<180;i++)pose('running',650,.05,step,0);
  for(let i=0;i<130;i++)pose('running',650,.8,step,0,i%8===0);
  for(let i=0;i<16;i++)pose('running',650,.05,step,0);
  const warm=branchVisibility('warm');
  for(let i=1;i<=20;i++)pose('stopping',650*(1-i/20),.05,step*(1-i/20),0);
  const warmThermostatC=mechanics.inspect().tempC;
  prepare();
  const cap=[];
  for(const test of [null,120,-4,null]){
    mechanics.setCapTest(test);
    applyDrivetrain();
    scene.updateMatrixWorld(true);
    const measured={};
    for(const row of movable.filter(row=>row.spec.id.startsWith('cap-'))){
      const offset=row.object.matrixWorld.elements[13]-base.get(row.object)[13];
      const change=delta(row.object);
      measured[row.id]={yOffsetM:offset,matrixDifference:change};
      const stat=trackedMovements.get(row.id);
      stat.max=Math.max(stat.max,change);
      stat.phases.bench=Math.max(stat.phases.bench||0,change);
    }
    cap.push({pressureKPa:test,measured});
  }
  prepare();
  const restored=Math.max(...movable.map(({object})=>delta(object)));
  const report={counts:{groups:manifest.groups.length,direct:manifest.groups.reduce((n,s)=>n+s.targets.length,0),legacy:manifest.legacy?.nodes?.length||0,
      stationary:frozen.length,uniqueTargets:trackedMovements.size,frames:samples.length},
    restored,missing,unresolvedFrozen, fixedDrift,maxMorph,warmThermostatC,cap, coolant:[cold,warm],
    unobserved:[...trackedMovements.values()].filter(row=>row.max<1e-7),
    targetMotion:[...trackedMovements.values()],samples,transforms,
    assetRegistry:data.revision};
  return report;
})()
