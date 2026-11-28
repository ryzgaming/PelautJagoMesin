import {createPowertrain, createPowertrainState, idleRPM} from './powertrain.js';

async function readJSON(url) {
  const result=await fetch(url);
  if (!result.ok) throw new Error('Aset model tidak dapat dibuka: '+url.pathname);
  return result.json();
}

export function createEngineSession({
  host,
  manifestURL=new URL('../model/manifest.json',import.meta.url),
  manifest:providedManifest,
  deps={three:globalThis.THREE, motion:globalThis.FunctionalMotion, audio:globalThis.OrangMesinAudio,
    flow:globalThis.OrangMesinFlow, fire:globalThis.OrangMesinFire},
  reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true,
  isMobile=()=>globalThis.matchMedia?.('(max-width: 680px), (pointer: coarse)')?.matches===true,
  devicePixelRatio=()=>globalThis.devicePixelRatio || 1,
  muted:initialMuted=false, volume=.35
}={}) {
  if (!host) throw new TypeError('createEngineSession membutuhkan host kanvas.');
  manifestURL=new URL(manifestURL,import.meta.url);
  const T=deps.three;
  let scene,camera,controls,renderer,roots,data,selectionBox,clipPlane,syncViewportSize,resizeObserver;
  const listeners=new Set();
  const mechanics=deps.motion?.create();
  const engineAudio=(globalThis.AudioContext || globalThis.webkitAudioContext) ? deps.audio?.create() : null;
  let muted=Boolean(initialMuted);
  engineAudio?.setMuted(muted);
  engineAudio?.setVolume(volume);
  function emit(type, detail=undefined) {
    const event={type,detail,state:snapshot()};
    for (const listener of listeners) {
      try { listener(event); }
      catch (error) { queueMicrotask(()=>{ throw error; }); }
    }
  }
  function changed() {
    updateFlowAppearance();
    publishSound();
    emit('change');
  }
  const state = {...createPowertrainState(),mode:'home', selected:null, isolated:false, xray:false, system:null, driveId:null, flow:'fuel', route:null, tour:null, tourSpread:0, flowCut:false, combustionFocus:false, poseOverview:false, overviewSpread:.5,diagramActive:false,filter:'', cutaway:false, cutawayNormal:null};
  const power=createPowertrain({state,mechanics,changed});
  function resetPower() { power.reset(); }
  function setMuted(value) {
    muted=Boolean(value);
    engineAudio?.setMuted(muted);
    changed();
  }
  function setVolume(value) { engineAudio?.setVolume(Math.max(0,Math.min(.5,Number(value)||0))); }
  function unlockSound() {
    if (muted || !engineAudio) return;
    engineAudio.unlock().then(ok=>{ if (!ok) emit('audio-error'); });
  }
  // P08 front-left, with the injection side dominant.
  const initialView = [.32,.26,-1];
  const entries = new Map();
  const groups = new Map();
  const shellMaterials = new Map();
  const scopesByPart = new Map();
  const scopesById = new Map();
  const flowViews = new Map();
  const flowPipes = new Map();
  const driveViews = new Map();
  const allDriveCovers=new Set();
  const fluid = {
    fuel:{label:'Bahan bakar',color:0xf6c55c,speed:.56},
    lubrication:{label:'Pelumas',color:0xee9c42,speed:.45},
    freshwater:{label:'Air tawar',color:0x33d5eb,speed:.58},
    seawater:{label:'Air laut',color:0x408ffe,speed:.62},
    intake:{label:'Udara masuk',color:0x56d3f9,speed:.84},
    exhaust:{label:'Gas buang',color:0xff7c55,speed:.78}
  };
  const flowEngineModes = ['systems','operation'];
  const engineModes = [...flowEngineModes,'drives'];
  function injectionWindow(kind) {
    return data.drivetrain?.injection_timing?.[kind+'_window_deg'] || (kind==='nozzle' ? [-12,0] : [-16,0]);
  }
  const tourStages = [
    {title:'Katup dan piston',duration:3.2,fluid:'none',eye:[.35,.29,-1],target:[.66,.28,-.03],distance:2.8,operate:true},
    {title:'Udara masuk',duration:3.2,fluid:'intake',eye:[.37,.60,-1],target:[.63,.55,-.04],distance:3.4,operate:true},
    {title:'Pelumas dan poros engkol',duration:3.2,fluid:'lubrication',eye:[.29,.13,-1],target:[.68,.02,-.03],distance:3.3,operate:true},
    {title:'Siklus pembakaran',duration:4.3,fluid:'none',eye:[1,.15,-.27],target:[.70,.25,0],distance:3.9,operate:true,fire:true,speed:3.15},
    {title:'Urai rakitan',duration:2.1,fluid:'none',eye:[.32,.26,-1],spread:[0,.55]},
    {title:'Rapatkan rakitan',duration:2.1,fluid:'none',eye:[.32,.26,-1],spread:[.55,0]}
  ];
  let flowGroup, combustionGroup, routeRibbons, chamberFire;
  let thermostatOpens=Infinity;
  // Vectors are in the shared meter datum. Parts on the same interface stay together.
  const spreadVectors = {
    BLOCK:[0,0,0], HEADS:[0,.38,0], OILPAN:[0,-.35,0], FLYWHEEL:[-.43,0,0],
    FRONT:[.33,0,0], INTAKE:[0,.67,0], EXHAUST:[0,0,.41], FUEL:[0,0,-.42],
    COOLING:[.59,0,0], LUBE:[0,-.14,-.33], ELECTRIC:[-.44,0,-.28], CRANK:[0,0,0],
    MAIN:[0,-.13,0], PISTON:[0,.17,0], ROD:[0,.09,0], LINER:[0,.28,0],
    CAM:[0,0,.22], VALVE:[0,.55,0], FUELINJ:[0,.48,0], TIMING:[.12,0,0], OILPUMP:[0,-.19,0]
  };

  function componentEntry(id) {
    return entries.get(id) || entries.get(data?.aliases?.[id]);
  }
  function componentName(entry) {
    return entry.nama || entry.name || entry.id;
  }
  function componentGroup(entry) {
    return entry.parent?.startsWith('RAK-') ? entry.parent
      : entry.rakitan || entry.assembly || 'Komponen';
  }
  function scopedMembers(scope) {
    return scope.parts.map(({id})=>entries.get(id)).filter(part=>part?.object);
  }
  function scopeFor(entry) {
    return entry ? scopesByPart.get(entry.id) : null;
  }
  function rowsInScope(part, parent) {
    const child = scopeFor(part);
    if (child?.parent === parent && child.anchor === part.id) {
      return scopedMembers(child).flatMap(member=>rowsInScope(member,child.id));
    }
    return [part];
  }
  function rowProxy(entry, target) {
    let part = entry;
    let scope = scopeFor(part);
    while (scope && scope.id !== target) {
      part = entries.get(scope.anchor);
      if (scope.parent === target) break;
      scope = scopesById.get(scope.parent);
    }
    return part?.id;
  }
  function scopeReady(scope) {
    if (!scope) return false;
    const shells = scopedMembers(scope).some(part=>part.xray_shell);
    return shells && scope.parts.some(({id,role})=>{
      const part = entries.get(id);
      return part?.object && !part.xray_shell &&
        (part.xray_content || /core|internal|interior|inner|mechanism|element|inti/.test(String(role).toLowerCase()));
    });
  }
  function shellCanReveal(entry) {
    if (state.mode==='drives') {
      const view=driveViews.get(state.driveId);
      return view?.covers.has(entry.id) === true || (view?.spec.system==='starter' &&
        ['EXT-FLYWHEEL-01','EXT-FLYWHEEL-02'].includes(entry.id));
    }
    if (activeFlowMode() && !state.isolated && allDriveCovers.has(entry.id)) return true;
    const scope = scopeFor(entry);
    if (scope) return scopeReady(scope);
    if (['EXT-INTAKE-01','EXT-COOLING-01','EXT-EXHAUST-01','EXT-INTAKE-02','EXT-FUEL-01'].includes(entry.id)) return false;
    if (!roots?.[1] && !['RAK-FLYWHEEL','RAK-FRONT'].includes(componentGroup(entry))) return false;
    if (state.mode === 'assembly') return ['RAK-FLYWHEEL','RAK-FRONT'].includes(state.assemblyGroup);
    return !state.isolated;
  }
  function scopeInspectable(scope) {
    return Boolean(scope && scopedMembers(scope).length > 1);
  }
  function assemblyRows(group, anchor) {
    const recipe = data.assemblies[group];
    if (recipe?.parts?.length) return scopedMembers(recipe);
    const scopedCylinder = ['RAK-INT-PISTON','RAK-INT-ROD','RAK-INT-LINER','RAK-INT-VALVE','RAK-INT-FUELINJ'].includes(group);
    const cylinder = (entry) => {
      const parsedParent = entry.parent?.match(/^MOT-INT-[A-Z]+-(\d)(?:-|$)/)?.[1];
      if (parsedParent) return Number(parsedParent);
      const center = new T.Box3().setFromObject(entry.object).getCenter(new T.Vector3());
      return Math.max(1,Math.min(6,Math.round((center.x-.209)/.2)+1));
    };
    const localCylinder = scopedCylinder && anchor?.object ? cylinder(anchor) : null;
    return Array.from(entries.values()).filter(entry => {
      const scope = scopeFor(entry);
      const member = componentGroup(entry) === group || (scope?.parent === group && scope.anchor === entry.id);
      return member && entry.object && (!localCylinder || cylinder(entry) === localCylinder);
    });
  }
  function activeFlowMode() {
    return flowEngineModes.includes(state.mode);
  }
  function activeEngineMode() {
    return engineModes.includes(state.mode);
  }
  function publishSound() {
    const stage=state.tour && tourStages[state.tour.index];
    engineAudio?.update({phase:state.enginePhase,rpm:state.rpm,elapsed:state.phaseTime,
      paused:!state.running || Boolean(stage && !stage.operate)});
  }
  function assemblyGroupVisible(object) {
    const active = groups.get(state.assemblyGroup)?.object;
    for (let parent = active; parent; parent = parent.parent) if (parent === object) return true;
    for (let parent = object; parent; parent = parent.parent) if (parent === active) return true;
    return false;
  }
  function scopeCutObject(scope) {
    const anchor = entries.get(scope?.anchor);
    if (anchor?.xray_shell) return anchor.object;
    return scope ? scopedMembers(scope).find(part=>part.xray_shell)?.object : null;
  }
  function updateClipPlane() {
    if (state.flowCut && activeFlowMode()) {
      clipPlane.set(new T.Vector3(0,0,camera.position.z>=0 ? -1 : 1),0);
      return;
    }
    if (!state.cutaway || !state.cutawayNormal) return;
    const object = scopeCutObject(scopesById.get(state.assemblyGroup));
    if (!object) return;
    object.updateWorldMatrix(true,true);
    const center = new T.Box3().setFromObject(object).getCenter(new T.Vector3());
    clipPlane.setFromNormalAndCoplanarPoint(state.cutawayNormal,center);
  }
  function toggleCutaway(scope) {
    state.cutaway = !state.cutaway;
    if (state.cutaway) {
      state.xray = true;
      const object = scopeCutObject(scope);
      const box = new T.Box3().setFromObject(object);
      const center = box.getCenter(new T.Vector3());
      const size = box.getSize(new T.Vector3()).toArray();
      const major = size.indexOf(Math.max(...size));
      const direction = center.sub(camera.position).normalize();
      const longAxis = scope.cut_axis ? new T.Vector3(...scope.cut_axis).normalize() :
        new T.Vector3().setComponent(major,1);
      direction.addScaledVector(longAxis,-direction.dot(longAxis));
      const authored = scope.cut_normal ? new T.Vector3(...scope.cut_normal) : null;
      if (authored?.lengthSq()) {
        if (authored.dot(direction)<0) authored.negate();
        direction.copy(authored);
      }
      const transverse = Math.abs(longAxis.x) > .9 ? new T.Vector3(0,0,1) : new T.Vector3(1,0,0);
      state.cutawayNormal = direction.lengthSq() > .001 ? direction.normalize() :
        longAxis.clone().cross(transverse).normalize();
    } else state.cutawayNormal = null;

    applyPose();
  }
  const chamberGroups=new Set(['RAK-BLOCK','RAK-HEADS','RAK-INT-LINER','RAK-INT-PISTON',
    'RAK-INT-VALVE','RAK-INT-FUELINJ','RAK-INT-ROD']);
  function inChamberView(object) {
    for (let group=object; group; group=group.parent) if (chamberGroups.has(group.name)) return true;
    return false;
  }
  const linerShell = id => /^INT-LINER-[1-6]1$/.test(id);
  const pistonBody = id => /^INT-PISTON-[1-6]1$/.test(id);
  function inBlockSection(id) {
    return ['EXT-BLOCK-01','EXT-OILPAN-01','EXT-INTAKE-01','EXT-EXHAUST-01'].includes(id) ||
      id.startsWith('EXT-HEADS-') || linerShell(id);
  }
  function applyPose() {
    if (!renderer || !roots) return;
    const spread = state.tourSpread || (state.poseOverview && state.mode !== 'assembly' ? state.overviewSpread : 0);
    for (const [id, {object,base}] of groups) {
      const vector = spreadVectors[id.replace(/^RAK-(?:INT-)?/,'')];
      object.position.copy(base);
      if (vector) object.position.addScaledVector(new T.Vector3(...vector), spread);
      object.visible = state.mode === 'assembly' ? assemblyGroupVisible(object)
        : !state.combustionFocus || inChamberView(object);
    }
    const selectedScope = scopeFor(entries.get(state.selected));
    for (const entry of entries.values()) {
      if (!entry.object) continue;
      const visible = state.mode === 'assembly' ? state.assemblyParts.has(entry.id)
        : !state.isolated || entry.id === state.selected || Boolean(selectedScope && selectedScope === scopeFor(entry));
      entry.object.visible = visible && (!entry.id.startsWith('INT-') ||
        state.xray || state.mode === 'assembly' || entry.id === state.selected);
    }
    updateClipPlane();
    for (const [mesh, {entry, solid, transparent, sliced, chamberSlice}] of shellMaterials) {
      const diagnosticCut = state.cutaway && scopeFor(entry)?.id === state.assemblyGroup;
      const operatingCut = state.flowCut && activeFlowMode() && inBlockSection(entry.id);
      if (operatingCut && state.combustionFocus) mesh.material=chamberSlice;
      else if (diagnosticCut || operatingCut || (state.combustionFocus && pistonBody(entry.id))) mesh.material=sliced;
      else mesh.material=state.xray && !linerShell(entry.id) && !pistonBody(entry.id) && shellCanReveal(entry) ? transparent : solid;
    }
    applyKinematics();
    applyDrivetrain();
    updateFlowAppearance();
    refreshHighlight();
  }
  function refreshHighlight() {
    if (!selectionBox) return;
    const selected = entries.get(state.selected)?.object;
    selectionBox.visible = Boolean(selected && selected.visible);
    if (!selectionBox.visible) return;
    selected.updateWorldMatrix(true,true);
    selectionBox.box.setFromObject(selected);
  }

  let motion;
  function kinematicParts() {
    if (motion) return motion;
    if (!roots || !data.kinematics) return null;
    const config = data.kinematics.viewer;
    if (!config?.enabled || !Array.isArray(config.rotators) || !Array.isArray(config.cylinders)
        || !Number.isFinite(config.throw_m) || !Number.isFinite(config.rod_cc_m)
        || config.rod_cc_m <= config.throw_m) return null;
    const lookup = (id) => roots.map(root => root?.getObjectByName(id)).find(Boolean);
    const rotators = config.rotators.map(entry => ({...entry, object:lookup(entry.node)}));
    const cylinders = config.cylinders.map(entry => ({...entry, rod:lookup(entry.rod), piston:lookup(entry.piston)}));
    if (!rotators.length || !cylinders.length || rotators.some(({object, factor})=>!object || !Number.isFinite(factor))
        || cylinders.some(entry => !entry.rod || !entry.piston || !Number.isFinite(entry.phase_deg))) return null;
    for (const entry of rotators) entry.base = entry.object.quaternion.clone();
    for (const entry of cylinders) {
      entry.rodBase = entry.rod.quaternion.clone();
      entry.pistonBase = entry.piston.position.clone();
      entry.rodPosition = entry.rod.position.clone();
    }
    const cylindersValves = (config.valves || []).flatMap(spec=>{
      const valve=lookup(spec.valve_root), tappet=lookup(spec.tappet_root), rocker=lookup(spec.rocker_root);
      if (!valve || !tappet || !rocker) return [];
      return [{spec,valve,tappet,rocker,valveY:valve.position.y,tappetY:tappet.position.y,
        rockerRest:rocker.quaternion.clone(), springs:(spec.springs || []).map(lookup).filter(Boolean)
          .map(object=>({object,y:object.scale.y}))}];
    });
    motion = {...config, rotators, cylinders,cylindersValves, axis:new T.Vector3(1,0,0)};
    return motion;
  }
  function applyKinematics() {
    const config = kinematicParts();
    if (!config) return;
    const {axis,rotators,cylinders} = config;
    const rotation = new T.Quaternion();
    for (const {object,base,factor} of rotators) {
      object.quaternion.copy(base).premultiply(rotation.setFromAxisAngle(axis,state.angle * factor));
    }
    for (const entry of cylinders) {
      const phase = entry.phase_deg * Math.PI/180;
      const theta = state.angle + phase;
      const pin = (angle) => {
        const y = config.throw_m * Math.cos(angle);
        const z = -config.throw_m * Math.sin(angle);
        return {y,z,wrist:y+Math.sqrt(config.rod_cc_m ** 2-z ** 2)};
      };
      const start = pin(phase);
      const now = pin(theta);
      entry.rod.position.copy(entry.rodPosition);
      entry.rod.position.y += now.y-start.y;
      entry.rod.position.z += now.z-start.z;
      const offset = Math.atan2(-now.z,now.wrist-now.y) - Math.atan2(-start.z,start.wrist-start.y);
      entry.rod.quaternion.copy(entry.rodBase).premultiply(rotation.setFromAxisAngle(axis,offset));
      entry.piston.position.copy(entry.pistonBase);
      entry.piston.position.y += now.wrist-start.wrist;
    }
    for (const {spec,valve,tappet,rocker,valveY,tappetY,rockerRest,springs} of config.cylindersValves) {
      const theta=state.angle*180/Math.PI;
      const window=((theta-spec.lift_center_deg+1080)%720)-360;
      const initial=spec.initial_lift_m || 0;
      const legacyRest=spec.initial_lift_m===undefined && state.simTime===0;
      const lift=!legacyRest && Math.abs(window)<=spec.half_window_deg
        ? Math.cos(Math.PI*window/(2*spec.half_window_deg))**2*spec.lift_max_m : 0;
      const change=Math.abs(lift-initial)<1e-10 ? 0 : lift-initial;
      valve.position.y=valveY-change;
      tappet.position.y=tappetY+change*spec.pushrod_ratio;
      rocker.quaternion.copy(rockerRest);
      if (change) rocker.quaternion.premultiply(rotation.setFromAxisAngle(axis,change/spec.rocker_lever_m));
      for (const {object,y} of springs) {
        object.scale.y=change ? y*(1-lift/spec.spring_height_m)/(1-initial/spec.spring_height_m) : y;
      }
    }
  }
  function frame() {
    if (!renderer || !roots) return;
    if (state.combustionFocus) return frameChamber();
    scene.updateMatrixWorld(true);
    const box = new T.Box3();
    for (const root of roots) root?.traverseVisible(object => {
      if (!object.isMesh) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
    frameBounds(box);
  }
  function frameChamber() {
    const x=data.kinematics.viewer.cylinder_centers[1], y=data.kinematics.viewer.combustion_y;
    frameBounds(new T.Box3(new T.Vector3(x-.305,y-.24,-.10),new T.Vector3(x+.305,y+.21,.12)),[.19,.46,-1]);
  }
  function frameBounds(box, eye) {
    if (box.isEmpty()) return;
    const target = box.getCenter(new T.Vector3());
    const radius = box.getSize(new T.Vector3()).length() / 2;
    const slope = Math.tan(T.MathUtils.degToRad(camera.fov/2));
    const direction = eye ? new T.Vector3(...eye).normalize() : camera.position.clone().sub(controls.target).normalize();
    if (Math.abs(direction.y)>.98) direction.setX(.23).normalize();
    const right = camera.up.clone().cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    let distance = .1;
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      const delta = new T.Vector3(x,y,z).sub(target);
      const needed = Math.max(Math.abs(delta.dot(right))/(slope*camera.aspect),Math.abs(delta.dot(up))/slope);
      distance = Math.max(distance,delta.dot(direction)+needed*1.19);
    }
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    controls.minDistance = Math.max(.08,radius*.18);
    controls.maxDistance = Math.max(15,distance*3);
    controls.update();
  }
  function driveCoverIds(spec) {
    const covers=new Set(spec.cover_ids || spec.case_ids || []);
    for (const id of spec.targets || []) {
      if (id.startsWith('INT-OILPUMP-')) {
        covers.add('EXT-BLOCK-01');covers.add('EXT-OILPAN-01');
      }
      const cylinder=id.match(/^INT-FUELINJ-([1-6])\d/)?.[1];
      if (cylinder) {
        covers.add('EXT-HEADS-0'+cylinder);
        covers.add('EXT-HEADS-'+String(+cylinder+6).padStart(2,'0'));
      }
    }
    return covers;
  }
  function installModels(results) {
    for (const spec of data.drivetrain?.groups || []) for (const id of driveCoverIds(spec)) allDriveCovers.add(id);
    roots = results.map(result => result.status === 'fulfilled' ? result.value.scene : null);
    for (const root of roots) {
      if (!root) continue;
      scene.add(root);
      root.updateMatrixWorld(true);
      root.traverse(object => {
        if (object.name.startsWith('RAK-')) groups.set(object.name,{object,base:object.position.clone()});
        const id = object.userData.id || object.name;
        const entry = entries.get(id);
        if (!entry) return;
        entry.object = object;
        object.traverse(mesh => {
          if (!mesh.isMesh) return;
          mesh.userData.component = id;
          if (!entry.xray_shell && !allDriveCovers.has(id) && !linerShell(id) && !pistonBody(id)) return;
          const hide = (material) => {
            const copy = material.clone();
            copy.transparent = true;
            copy.opacity = .18;
            copy.depthWrite = false;
            return copy;
          };
          const slice = (material) => {
            const copy = material.clone();
            copy.clippingPlanes = [clipPlane];
            copy.side = T.DoubleSide;
            return copy;
          };
          const chamberCut=material=>{
            const copy=slice(material);
            copy.transparent=true;
            copy.opacity=linerShell(id) ? .20 : .26;
            copy.depthWrite=false;
            return copy;
          };
          shellMaterials.set(mesh,{entry,solid:mesh.material,
            chamberSlice:inBlockSection(id) ?
              (Array.isArray(mesh.material) ? mesh.material.map(chamberCut) : chamberCut(mesh.material)) : null,
            transparent:Array.isArray(mesh.material) ? mesh.material.map(hide) : hide(mesh.material),
            sliced:Array.isArray(mesh.material) ? mesh.material.map(slice) : slice(mesh.material)});
        });
      });
    }
    applyPose();
    frame();
  }
  function visibleIntersection(raycaster) {
    const visible = [];
    for (const root of roots) root?.traverseVisible(mesh => {
      if (mesh.isMesh && mesh.userData.component) visible.push(mesh);
    });
    const hits = raycaster.intersectObjects(visible,false).filter(({object,point})=>{
      const shell = shellMaterials.get(object);
      return object.material !== shell?.sliced || clipPlane.distanceToPoint(point) >= 0;
    });
    return hits.find(({object})=>{
      const shell = shellMaterials.get(object);
      return !shell || object.material !== shell.transparent;
    }) || hits[0];
  }
  function objectForDrive(id) {
    return componentEntry(id)?.object || groups.get(id)?.object ||
      roots?.map(root=>root?.getObjectByName(id)).find(Boolean);
  }
  function installDrivetrain() {
    scene.updateMatrixWorld(true);
    for (const spec of data.drivetrain?.groups || []) {
      const axis=new T.Vector3(...(spec.axis || [1,0,0])).normalize();
      const pivot=new T.Vector3(...(spec.pivot_m || [0,0,0]));
      const covers=driveCoverIds(spec);
      const parts=[];
      for (const id of spec.targets || []) {
        const object=objectForDrive(id);
        if (!object?.parent) continue;
        const scope=scopeFor(entries.get(id));
        for (const entry of scope ? scopedMembers(scope) : []) if (entry.xray_shell) covers.add(entry.id);
        object.updateMatrix();
        parts.push({id,object,rest:object.matrix.clone(),parent:object.parent.matrixWorld.clone(),
          invertParent:object.parent.matrixWorld.clone().invert(),
          position:object.position.clone(),orientation:object.quaternion.clone(),scale:object.scale.clone()});
      }
      const beltPath=spec.path_m || spec.points_m || spec.orbit_m;
      const belt=spec.kind==='belt' && beltPath?.length>=3 ? makeBeltPath(beltPath,axis) : null;
      if (!parts.length || (spec.kind==='belt' && !belt)) continue;
      driveViews.set(spec.id,{spec,axis,pivot,parts,covers,belt});
    }
    thermostatOpens=Math.min(Infinity,...[...driveViews.values()].filter(({spec})=>
      spec.actuation==='thermostat').map(({spec})=>spec.opens_c));
    state.driveId=driveViews.keys().next().value || null;
    applyDrivetrain();
  }
  function makeBeltPath(points,axis) {
    const polyline=new T.CurvePath();
    const vertices=points.map(point=>new T.Vector3(...point));
    for (let i=1;i<vertices.length;i++) if (vertices[i].distanceToSquared(vertices[i-1])>1e-12) {
      polyline.add(new T.LineCurve3(vertices[i-1],vertices[i]));
    }
    if (vertices.at(-1).distanceTo(vertices[0])>.0001) polyline.add(new T.LineCurve3(vertices.at(-1),vertices[0]));
    const tangent=polyline.getPoint(.0002).sub(vertices[0]);
    tangent.addScaledVector(axis,-tangent.dot(axis)).normalize();
    return {polyline,start:vertices[0],tangent,length:polyline.getLength()};
  }
  function motionProfile(spec, radians) {
    const profile=spec.profile;
    if (Array.isArray(profile?.samples) && profile.samples.length>1) {
      const {samples,cycle_deg:cycle,step_deg:step}=profile;
      const theta=((radians*180/Math.PI)%cycle+cycle)%cycle;
      const slot=theta/step;
      const index=Math.floor(slot);
      const local=slot-index;
      return (samples[index%samples.length]*(1-local)+samples[(index+1)%samples.length]*local)-samples[0];
    }
    const angle=radians*(spec.ratio || 0);
    const offset=spec.phase_rad || spec.offset_rad || 0;
    return (Math.cos(offset)-Math.cos(angle+offset))/2;
  }
  function applyDrivetrain() {
    if (!driveViews.size || (state.mode==='assembly' && state.diagramActive)) return;
    const op=new T.Matrix4(), inner=new T.Matrix4(), temp=new T.Matrix4();
    const direction=new T.Quaternion(), ay=new T.Vector3(0,1,0), secondary=new T.Vector3();
    const negative=new T.Vector3(), tangent=new T.Vector3();
    const revolve=(destination,axis,point,angle)=>{
      destination.multiply(temp.makeTranslation(point.x,point.y,point.z))
        .multiply(temp.makeRotationAxis(axis,angle))
        .multiply(temp.makeTranslation(-point.x,-point.y,-point.z));
    };
    for (const view of driveViews.values()) {
      const {spec,axis,pivot,parts,belt}=view;
      const moving=activeEngineMode();
      const actuation=moving ? mechanics?.sample(spec) : null;
      const clock=moving ? actuation?.clock ?? state.driveAngles[spec.mode] ?? state.driveAngles.both : 0;
      const angle=clock*(spec.ratio || 0);
      const engagement=moving && spec.mode==='starting' ? actuation?.engagement ?? state.starterEngagement : 0;
      const engage=engagement*(spec.mode_offset_m || 0);
      const engageAngle=engagement*(spec.mode_angle_rad || 0);
      const travel=actuation?.travel || 0;
      const action=actuation?.angle || 0;
      if (spec.actuation==='seawater_vanes') for (const {object} of parts) {
        deps.motion?.applyVanes(object,angle);
      }
      if (!clock && !engage && !engageAngle && !travel && !action) {
        for (const {object,position,orientation,scale} of parts) {
          object.position.copy(position); object.quaternion.copy(orientation); object.scale.copy(scale);
        }
        continue;
      }
      const stroke=motionProfile(spec,clock)*(actuation?.scaleStroke ?? 1);
      const sampled=Array.isArray(spec.profile?.samples);
      op.makeTranslation(axis.x*engage,axis.y*engage,axis.z*engage);
      if (spec.kind==='belt') {
        const distance=clock*(spec.travel_m_per_rad || 0);
        const progress=((distance/belt.length)%1+1)%1;
        const point=belt.polyline.getPoint(progress);
        tangent.copy(belt.polyline.getPoint((progress+.0002)%1)).sub(point);
        tangent.addScaledVector(axis,-tangent.dot(axis)).normalize();
        const yaw=Math.atan2(axis.dot(negative.crossVectors(belt.tangent,tangent)),belt.tangent.dot(tangent));
        op.multiply(temp.makeTranslation(point.x,point.y,point.z))
          .multiply(temp.makeRotationAxis(axis,yaw))
          .multiply(temp.makeTranslation(-belt.start.x,-belt.start.y,-belt.start.z));
      } else if (spec.kind==='reciprocate') {
        const distance=(sampled ? stroke : stroke*(spec.amplitude_m || 0))+travel;
        op.multiply(temp.makeTranslation(axis.x*distance,axis.y*distance,axis.z*distance));
        if (spec.spin_ratio) revolve(op,secondary.fromArray(spec.spin_axis || [1,0,0]).normalize(),pivot,clock*spec.spin_ratio);
        if (action) revolve(op,axis,pivot,action);
      } else if (spec.kind==='spring') {
        const distance=(sampled ? stroke : stroke*(spec.amplitude_m || 0))+travel;
        const ratio=Math.max(.15,1+distance/(spec.length_m || .04));
        direction.setFromUnitVectors(ay,axis);
        op.multiply(temp.makeTranslation(pivot.x,pivot.y,pivot.z))
          .multiply(temp.makeRotationFromQuaternion(direction))
          .multiply(temp.makeScale(1,ratio,1))
          .multiply(temp.makeRotationFromQuaternion(direction.invert()))
          .multiply(temp.makeTranslation(-pivot.x,-pivot.y,-pivot.z));
      } else if (spec.kind==='orbit') {
        revolve(op,axis,pivot,angle);
        revolve(op,axis,secondary.fromArray(spec.secondary_pivot_m),clock*spec.secondary_ratio);
      } else {
        const rotation=spec.kind==='rock' ? (sampled ? stroke : stroke*(spec.angle_rad || 0)) : angle;
        const hinged=spec.actuation==='governor-weight' && spec.secondary_axis && spec.secondary_pivot_m;
        revolve(op,axis,pivot,rotation+engageAngle+(hinged ? 0 : action));
        if (hinged) revolve(op,secondary.fromArray(spec.secondary_axis).normalize(),negative.fromArray(spec.secondary_pivot_m),action);
      }
      for (const {object,rest,parent,invertParent} of parts) {
        inner.copy(invertParent).multiply(op).multiply(parent).multiply(rest);
        inner.decompose(object.position,object.quaternion,object.scale);
      }
    }
  }
  function focusDrive() {
    if (!camera || !roots) return;
    const view=driveViews.get(state.driveId);
    if (!view) return frame();
    scene.updateMatrixWorld(true);
    const box=new T.Box3();
    for (const part of view.parts) box.expandByObject(part.object);
    const center=box.getCenter(new T.Vector3());
    for (const id of new Set([...(view.spec.assembly_ids || []),...view.covers])) {
      const object=objectForDrive(id);
      if (!object) continue;
      const local=new T.Box3().setFromObject(object);
      if (local.getSize(new T.Vector3()).length()<1 && local.getCenter(new T.Vector3()).distanceTo(center)<.55) {
        box.union(local);
      }
    }
    if (box.isEmpty()) return frame();
    const eye=view.spec.view || (view.spec.system==='starter' ? [-.28,.28,1] : [view.pivot.x>.7?.48:-.45,.24,-1]);
    frameBounds(box,eye);
  }
  function flowDirectionKnown(route) {
    return /^(DOCUMENTED|OBSERVED|INFERRED|VERIFIED|ESTIMATED)\b/i.test(route.direction_status || '');
  }
  function installFlowModel() {
    flowGroup = new T.Group();
    flowGroup.name = 'ALIRAN-FLUIDA';
    combustionGroup = new T.Group();
    combustionGroup.name = 'PULSA-PEMBAKARAN-ILUSTRATIF';
    scene.add(flowGroup,combustionGroup);
    for (const route of data.flows?.routes || []) {
      const theme = fluid[route.system];
      if (!theme || route.points?.length < 2) continue;
      const points = route.points.map(point=>new T.Vector3(...point));
      const curve = new T.CurvePath();
      for (let i=1;i<points.length;i++) if (points[i].distanceToSquared(points[i-1])>1e-10) {
        curve.add(new T.LineCurve3(points[i-1],points[i]));
      }
      const length = curve.getLength();
      if (!length) continue;
      const group = new T.Group();
      group.name = route.id;
      const depthTest=route.kind==='physical';
      const builtin = {color:theme.color, transparent:true, opacity:depthTest?.87:.59,depthWrite:false,depthTest};
      const line = new T.Line(new T.BufferGeometry().setFromPoints(points), route.kind==='physical'
        ? new T.LineBasicMaterial(builtin)
        : new T.LineDashedMaterial({...builtin,dashSize:.030,gapSize:.021}));
      line.renderOrder = 20;
      line.computeLineDistances();
      group.add(line);
      let arrow;
      const count = route.event ? 1 : Math.max(1,Math.min(4,Math.ceil(length/.27)));
      const particles = [];
      if (flowDirectionKnown(route)) {
        const anchor = curve.getPoint(.67);
        const direction = curve.getPoint(.69).sub(curve.getPoint(.65)).normalize();
        const size = Math.min(.075,Math.max(.026,length*.18));
        if (direction.lengthSq()) {
          arrow = new T.ArrowHelper(direction,anchor,size,theme.color,size*.5,size*.43);
          arrow.traverse(child=>{
            child.renderOrder = 21;
            if (child.material) { child.material.depthWrite=false;child.material.depthTest=depthTest; }
          });
          group.add(arrow);
        }
        const radius = Math.max(.009,Math.min(.022,(route.radius_m || .012)*.66));
        const geometry = new T.SphereGeometry(radius,10,8);
        const material = new T.MeshBasicMaterial({color:theme.color,depthWrite:false,depthTest});
        for (let i=0;i<count;i++) {
          const bead = new T.Mesh(geometry,material);
          bead.renderOrder=22;
          group.add(bead);
          particles.push(bead);
        }
      }
      flowGroup.add(group);
      const distances=[0];
      for (let i=1;i<points.length;i++) distances.push(distances[i-1]+points[i].distanceTo(points[i-1]));
      flowViews.set(route.id,{group,route,curve,length,particles,line,arrow,points,distances,
        moved:route.motion==='crank_drain' ? points.map(point=>point.clone()) : null});
      if (depthTest) for (const id of route.component_ids || []) {
        const entry=entries.get(id);
        if (!entry?.object || !/pipa|selang|siku|duct|adaptor|elbow|tube|hose/i.test(componentName(entry)) || flowPipes.has(id)) continue;
        const shells=[];
        entry.object.traverse(mesh=>{
          if (!mesh.isMesh || shellMaterials.has(mesh)) return;
          const copy=material=>{
            const ghost=material.clone();
            ghost.transparent=true;
            ghost.opacity=.28;
            ghost.depthWrite=false;
            return ghost;
          };
          shells.push({mesh,solid:mesh.material,ghost:Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material)});
        });
        flowPipes.set(id,shells);
      }
    }
    setEventIntervals();
    installFlowEffects();
    const centers = data.kinematics.viewer.cylinder_centers || [];
    const core = new T.SphereGeometry(.037,14,10);
    const deck = data.kinematics.viewer.combustion_y;
    for (const [index,x] of centers.entries()) {
      const material=new T.MeshBasicMaterial({color:0xff9d52,transparent:true,opacity:0,depthTest:false,depthWrite:false});
      const bead = new T.Mesh(core,material);
      bead.position.set(x,deck,0);
      bead.userData.cylinder=index+1;
      bead.renderOrder=23;
      combustionGroup.add(bead);
    }
    updateFlowAppearance();
  }
  function installFlowEffects() {
    const mobile=isMobile();
    // Tube shaders follow only fixed, directed centerlines. Event chains and crank-mounted
    // passages keep the existing sampled 3D markers so their phase/geometry stays exact.
    if (deps.flow) {
      const links={};
      const style=deps.flow;
      for (const {route} of flowViews.values()) {
        if (route.motion || route.event || !flowDirectionKnown(route)) continue;
        links[route.id]={polyline:true, medium:route.system, status:route.kind==='physical' ? route.geometry_status : 'UNVERIFIED',
          geometry_basis:route.geometry_status,
          radius_m:Math.max(.004,Math.min(.018,(route.radius_m || .010)*.66)),
          spans:[{kind:route.kind==='physical' ? 'visible' : 'hidden',points:route.points}]};
      }
      if (Object.keys(links).length) {
        routeRibbons=deps.flow.create(T,{routes:{links},mobile,ratedRpm:idleRPM,
          palette:Object.fromEntries(Object.entries(fluid).map(([key,{color}])=>[style.mediumKey(key),{color}]))});
        routeRibbons.start({fillSeconds:0});
        routeRibbons.pause();
        scene.add(routeRibbons.group);
      }
    }
    const viewer=data.kinematics.viewer;
    if (!deps.fire || !viewer.enabled || !viewer.bore_m) return;
    const chambers=(viewer.cylinder_centers || []).map((x,index)=>{
      const id=index+1;
      const nozzle=flowViews.get('nozzle-bore-'+id)?.route.points.at(-1);
      return {id, axis:[0,1,0], bore_m:viewer.bore_m, half_height_m:.013, position:[x,viewer.combustion_y,0], injector:nozzle};
    });
    if (chambers.length!==viewer.firing_order?.length) return;
    const [sprayStart,sprayEnd]=injectionWindow('nozzle');
    chamberFire=deps.fire.create(T,{cylinders:chambers, firingOrder:viewer.firing_order, mobile,
      kinematics:{stroke_m:2*viewer.throw_m,rod_length_m:viewer.rod_cc_m},
      timing:{semburan_mulai_deg:sprayStart,semburan_selesai_deg:sprayEnd,padam_deg:16,ukuran:.55,cahaya:false,
        ...(reducedMotion() ? {terang:.8,turbulensi:.16} : {})}});
    scene.add(chamberFire.group);
  }
  function coolantIsWarm() {
    return !mechanics || mechanics.inspect().tempC>thermostatOpens;
  }
  function routeIsActive(route, warm) {
    if (route.thermal_branch==='bypass') return !warm;
    if (route.thermal_branch==='exchanger') return warm;
    return true;
  }
  function tickFlowEffects(delta) {
    if (routeRibbons && flowGroup?.visible) {
      const rpm=state.rpm;
      routeRibbons.setRpm(rpm);
      if (state.running && rpm>0) routeRibbons.resume();
      else routeRibbons.pause();
      routeRibbons.update(delta);
    }
    if (chamberFire) {
      const visible=chamberFire.group.visible;
      const playing=state.running && visible;
      if (playing) chamberFire.resume();
      else chamberFire.pause();
      const degrees=state.angle*180/Math.PI;
      if (visible && (playing || Math.abs(chamberFire.crankDeg-degrees)>1e-8)) chamberFire.setCrank(degrees,reducedMotion() ? 0 : delta);
      if (visible && state.enginePhase==='cranking') {
        for (const part of chamberFire.group.children) if (part.name.startsWith('api:')) part.visible=false;
      }
    }
  }
  function setEventIntervals() {
    const families = new Map();
    for (const item of flowViews.values()) {
      const {route}=item;
      if (!route.event || !item.particles.length) continue;
      const key=[route.system,route.event,route.cylinder].join(':');
      if (!families.has(key)) families.set(key,[]);
      families.get(key).push(item);
    }
    for (const family of families.values()) {
      const bySource=new Map();
      const incoming=new Set();
      for (const item of family) {
        if (!bySource.has(item.route.from)) bySource.set(item.route.from,[]);
        bySource.get(item.route.from).push(item);
        incoming.add(item.route.to);
      }
      const assigned=new Set();
      const ordered=[...family.filter(item=>!incoming.has(item.route.from)),...family];
      for (const seed of ordered) {
        if (assigned.has(seed)) continue;
        const offsets=new Map();
        const walk=(item,offset)=>{
          if (assigned.has(item) || offsets.has(item)) return;
          offsets.set(item,offset);
          for (const next of bySource.get(item.route.to) || []) walk(next,offset+item.length);
        };
        walk(seed,0);
        const length=Math.max(...Array.from(offsets,([item,offset])=>offset+item.length));
        const nozzle=[...offsets].find(([item])=>item.route.id.startsWith('nozzle-bore-'));
        const upstream=nozzle?.[1];
        const [deliveryStart,deliveryEnd]=injectionWindow('delivery');
        const [nozzleStart]=injectionWindow('nozzle');
        const delay=(nozzleStart-deliveryStart)/(deliveryEnd-deliveryStart);
        const fraction=distance=>{
          if (!(upstream>0 && upstream<length && delay>0 && delay<1)) return distance/length;
          return distance<upstream ? distance/upstream*delay : delay+(distance-upstream)/(length-upstream)*(1-delay);
        };
        for (const [item,offset] of offsets) {
          item.eventInterval=[fraction(offset),fraction(offset+item.length)];
          assigned.add(item);
        }
      }
    }
  }
  function eventProgress(cylinder,event) {
    const order = data.kinematics.viewer.firing_order || [];
    const sequence = order.indexOf(cylinder);
    if (sequence<0 || state.simTime<=0) return null;
    const [deliveryStart,deliveryEnd]=injectionWindow('delivery');
    const timing = {
      injection:[720+deliveryStart,deliveryEnd-deliveryStart],intake:[360,180],exhaust:[180,180],combustion:[0,39]
    }[event];
    if (!timing) return null;
    const angle = state.angle*180/Math.PI;
    const elapsed = ((angle-sequence*120-timing[0])%720+720)%720;
    return elapsed<=timing[1] ? elapsed/timing[1] : null;
  }
  function motionPoint(item,progress,target) {
    if (!item.moved) return target.copy(item.curve.getPoint(progress));
    const distance=progress*item.length;
    let i=1;
    while (i<item.distances.length-1 && item.distances[i]<distance) i++;
    const low=item.distances[i-1], interval=item.distances[i]-low;
    return target.copy(item.moved[i-1]).lerp(item.moved[i],interval>0?(distance-low)/interval:0);
  }
  function updateRouteMotion(item) {
    if (item.route.motion==='crank') {
      item.group.rotation.x=-state.angle;
      return;
    }
    if (!item.moved) return;
    const cosine=Math.cos(state.angle),sine=Math.sin(state.angle);
    const position=item.line.geometry.attributes.position;
    for (const [i,point] of item.points.entries()) {
      const weight=item.route.motion_weights?.[i] ?? 0;
      const y=point.y+weight*(point.y*cosine+point.z*sine-point.y);
      const z=point.z+weight*(point.z*cosine-point.y*sine-point.z);
      item.moved[i].set(point.x,y,z);
      position.setXYZ(i,point.x,y,z);
    }
    position.needsUpdate=true;
    item.line.geometry.computeBoundingSphere();
    item.line.computeLineDistances();
    if (item.arrow) {
      motionPoint(item,.67,item.arrow.position);
      const direction=motionPoint(item,.69,new T.Vector3()).sub(motionPoint(item,.65,new T.Vector3())).normalize();
      if (direction.lengthSq()) item.arrow.setDirection(direction);
    }
  }
  function updateFlowParticles() {
    const warm=state.flow!=='freshwater' || coolantIsWarm();
    if (routeRibbons && state.flow==='freshwater') for (const mesh of routeRibbons.group.children) {
      const item=flowViews.get(mesh.userData.flow.link);
      if (item.route.system===state.flow) mesh.visible=item.group.visible && routeIsActive(item.route,warm);
    }
    const hasInjection=['cranking','firing','running'].includes(state.enginePhase);
    for (const item of flowViews.values()) {
      const {group,route,length,particles,eventInterval}=item;
      if (!group.visible) continue;
      updateRouteMotion(item);
      const phase = route.event && (route.event!=='injection' || hasInjection) ? eventProgress(route.cylinder,route.event) : null;
      const [start,end]=eventInterval || [0,1];
      const eventVisible=phase!==null && phase>=start && phase<end;
      for (const [i,bead] of particles.entries()) {
        bead.visible = state.rpm>0 && routeIsActive(route,warm) && (!route.event || eventVisible);
        if (!bead.visible) continue;
        const progress = route.event ? (phase-start)/(end-start) :
          (state.simTime*fluid[route.system].speed/length+i/particles.length)%1;
        motionPoint(item,progress,bead.position);
        bead.scale.setScalar(route.event ? 1 : Math.max(.21,Math.min(1,progress*10,(1-progress)*10)));
      }
    }
    if (!combustionGroup?.visible) return;
    for (const bead of combustionGroup.children) {
      const phase=eventProgress(bead.userData.cylinder,'combustion');
      bead.visible=!chamberFire && phase!==null;
      if (bead.visible) {
        bead.material.opacity=.89*(1-phase);
        bead.scale.setScalar(.60+phase*.7);
      }
    }
  }
  function updateFlowAppearance() {
    if (!flowGroup) return;
    const stage = state.tour && tourStages[state.tour.index];
    const engineTogether = activeFlowMode() && !state.tourSpread && (!stage || stage.operate);
    const showFlows=Boolean(engineTogether && !state.combustionFocus);
    flowGroup.visible = showFlows;
    combustionGroup.visible = Boolean(engineTogether && (stage?.fire || state.xray)
      && ['firing','running'].includes(state.enginePhase));
    if (chamberFire) {
      chamberFire.group.visible=combustionGroup.visible
        || Boolean(engineTogether && state.xray && state.enginePhase==='cranking');
      // In the explicitly selected block section, project the cue at the
      // modeled chamber so nearby port walls cannot mask the learning marker.
      for (const part of chamberFire.group.children) if (part.material) part.material.depthTest=!state.flowCut || state.combustionFocus;
    }
    if (routeRibbons) {
      routeRibbons.setXray(state.xray || Boolean(state.route));
      routeRibbons.group.visible=Boolean(showFlows && state.rpm>0);
    }
    const litPipes=new Set();
    for (const {group,route} of flowViews.values()) {
      group.visible = Boolean(showFlows && route.system===state.flow &&
        (!state.route || state.route===route.id) && (route.kind==='physical' || state.xray || state.route===route.id));
      if (group.visible && route.kind==='physical') for (const id of route.component_ids || []) litPipes.add(id);
    }
    if (routeRibbons) for (const mesh of routeRibbons.group.children) {
      mesh.visible=Boolean(flowViews.get(mesh.userData.flow.link)?.group.visible);
    }
    for (const [id,parts] of flowPipes) for (const {mesh,solid,ghost} of parts) mesh.material=litPipes.has(id)?ghost:solid;
    updateFlowParticles();
  }
  function tourView(spec) {
    const direction = new T.Vector3(...spec.eye).normalize();
    if (!spec.target) {
      camera.position.copy(controls.target).add(direction);
      frame();
      return;
    }
    const target = new T.Vector3(...spec.target);
    const distance = spec.distance*Math.max(1,.72/camera.aspect);
    const position = target.clone().addScaledVector(direction,distance);
    state.tour.camera = {from:camera.position.clone(),fromTarget:controls.target.clone(),position,target};
    if (reducedMotion() || !state.running) moveTourCamera(1);
  }
  function moveTourCamera(progress) {
    const view = state.tour?.camera;
    if (!view) return;
    const blend = progress*progress*(3-2*progress);
    camera.position.copy(view.from).lerp(view.position,blend);
    controls.target.copy(view.fromTarget).lerp(view.target,blend);
    controls.update();
  }
  function setTourStage(index) {
    if (!state.tour || index>=tourStages.length) return finishTour();
    state.tour.index=index;
    state.tour.elapsed=0;
    state.tour.camera=null;
    const stage = tourStages[index];
    state.tour.staticReveal=Boolean(reducedMotion() || !state.running);
    state.tourSpread=stage.spread?.[state.tour.staticReveal ? 1 : 0] || 0;
    setFlow(stage.fluid);
    applyPose();
    publishSound();
    tourView(stage);
    changed();
  }
  function beginTour(play) {
    if (!renderer || !roots?.some(Boolean) || state.tour) return;
    state.tour={index:0,elapsed:0,flow:state.flow,xray:state.xray,flowCut:state.flowCut};
    state.flowCut=false;
    state.combustionFocus=false;
    state.angle=0;
    state.simTime=0;
    resetPower();
    if (play) {
      power.start();
      unlockSound();
    }
    state.xray=true;
    setTourStage(0);
    changed();
  }
  function nextTour() {
    if (state.tour) setTourStage(state.tour.index+1);
  }
  function finishTour() {
    if (!state.tour) return;
    const {xray,flow,flowCut}=state.tour;
    state.tour=null;
    state.tourSpread=0;
    state.running=false;
    state.angle=0;
    state.simTime=0;
    resetPower();
    state.xray=xray;
    state.flowCut=flowCut;
    setFlow(flow);
    applyPose();
    if (camera) {
      camera.position.copy(controls.target).add(new T.Vector3(...initialView));
      frame();
    }
    changed();
  }
  function resetOperation() {
    state.running=false;
    state.simTime=0;
    state.angle=0;
    resetPower();
    if (state.tour) setTourStage(0);
    applyPose();
    changed();
  }
  function advanceSimulation(delta) {
    let stage=state.tour && tourStages[state.tour.index];
    if (stage) {
      state.tour.elapsed+=delta;
      const elapsed=state.tour.elapsed;
      if (elapsed>=stage.duration) {
        setTourStage(state.tour.index+1);
        stage=state.tour && tourStages[state.tour.index];
        if (!state.running) return;
      } else {
        if (!reducedMotion() && elapsed <= .95) moveTourCamera(Math.min(1,elapsed/.9));
        if (stage.spread) {
          const progress = state.tour.staticReveal ? 1 : Math.min(1,elapsed/stage.duration);
          state.tourSpread = stage.spread[0]+(stage.spread[1]-stage.spread[0])*progress;
          applyPose();
          frame();
        }
      }
    }
    if (!stage || stage.operate) {
      power.step(delta,stage);
      publishSound();
      applyKinematics();
      applyDrivetrain();
      updateFlowParticles();
      if (routeRibbons) routeRibbons.group.visible=Boolean(flowGroup.visible && state.rpm>0);
    } else publishSound();
  }
  function initializeViewport() {
    if (!T?.GLTFLoader || !T?.OrbitControls) throw new Error('Pustaka 3D tidak dapat dibuka.');
    clipPlane = new T.Plane();
    scene = new T.Scene();
    selectionBox = new T.Box3Helper(new T.Box3(),0x79ead0);
    selectionBox.visible = false;
    scene.add(selectionBox);
    camera = new T.PerspectiveCamera(35,1,.025,80);
    camera.position.set(...initialView);
    renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(1.7,devicePixelRatio()));
    host.append(renderer.domElement);
    const ambient = new T.HemisphereLight(0xeaf8f6,0x5a4943,1.02);
    scene.add(ambient);
    for (const [x,y,z,color,intensity] of [[1,2,-3,0xfff5df,1.95],[-3,1,2,0xbbdce8,1.3],[4,1,2,0xffffff,.72]]) {
      const light = new T.DirectionalLight(color,intensity);
      light.position.set(x,y,z);
      scene.add(light);
    }
    controls = new T.OrbitControls(camera,renderer.domElement);
    controls.enableDamping = true;
    let start;
    const pointer = new T.Vector2();
    const raycaster = new T.Raycaster();
    renderer.domElement.addEventListener('pointerdown',event => {
      start = event.isPrimary && event.button === 0 ? [event.clientX,event.clientY] : null;
    });
    renderer.domElement.addEventListener('pointerup',event => {
      if (!start || Math.hypot(event.clientX-start[0],event.clientY-start[1])>6 || !roots) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
      raycaster.setFromCamera(pointer,camera);
      const hit = visibleIntersection(raycaster);
      if (hit) selectPart(hit.object.userData.component);
    });
    renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      emit('context-lost');
    });
    renderer.domElement.addEventListener('webglcontextrestored',()=>emit('context-restored'));
    let oldWidth, oldHeight;
    syncViewportSize=(forceFrame=false)=>{
      const width=host.clientWidth, height=host.clientHeight;
      if (!width || !height || (width===oldWidth && height===oldHeight)) return;
      const oldAspect=oldWidth/oldHeight;
      const aspect=width/height;
      oldWidth=width;
      oldHeight=height;
      renderer.setSize(width,height,false);
      camera.aspect=aspect;
      camera.updateProjectionMatrix();
      if (state.mode !== 'component' || state.isolated) {
        if (forceFrame || !Number.isFinite(oldAspect) || Math.abs(aspect/oldAspect-1)>.04) {
          if (state.mode==='drives') focusDrive();
          else frame();
        }
      }
      // Drawing-buffer resize clears the canvas. Repaint before the browser can
      // present the resized frame, particularly when the operation dock appears.
      renderer.render(scene,camera);
      return true;
    };
    if (typeof ResizeObserver!=='undefined') {
      resizeObserver=new ResizeObserver(()=>syncViewportSize());
      resizeObserver.observe(host);
    }
    let before;
    renderer.setAnimationLoop((time) => {
      const delta = Math.min(.2,(time-(before ?? time))/1000);
      before = time;
      if (state.running) advanceSimulation(delta);
      else if (state.enginePhase==='off' && activeEngineMode() && mechanics?.coasting?.()) {
        mechanics.tick({phase:'off',phaseTime:0,dt:delta,rpm:0,crankRadians:state.driveAngles.both,
          starterRadians:state.driveAngles.starting,engagement:0});
        applyDrivetrain();
      }
      tickFlowEffects(delta);
      controls.update();
      renderer.render(scene,camera);
    });
  }

  let loadTask, disposed=false;
  function load() {
    if (disposed) return Promise.reject(new Error('Sesi model sudah ditutup.'));
    return loadTask ||= loadAssets();
  }
  async function loadAssets() {
    const manifest = providedManifest || await readJSON(manifestURL);
    if (manifest.schemaVersion !== 1 || !manifest.assets?.inventory) {
      throw new Error('Manifest model tidak dikenali.');
    }
    const assetURL=name=>new URL(manifest.assets[name],manifestURL);
    const inventoryData=await readJSON(assetURL('inventory'));
    if (disposed) throw new Error('Sesi model sudah ditutup.');
    data=structuredClone(inventoryData);
    for (const entry of data.components) entries.set(entry.id,entry);
    for (const [id,recipe] of Object.entries(data.assemblies)) {
      if (!recipe.parent || !recipe.anchor) continue;
      scopesById.set(id,{...recipe,id,content_name:recipe.content_name || (recipe.name || id).toLocaleLowerCase('id-ID')});
    }
    for (const scope of scopesById.values()) for (const part of scope.parts) {
      const existing=scopesByPart.get(part.id);
      if (!existing || scope.parent===existing.id) scopesByPart.set(part.id,scope);
    }
    state.system=data.systems[0]?.system;
    emit('inventory');
    initializeViewport();
    const loader=new T.GLTFLoader();
    const results=await Promise.allSettled(['exterior','internal'].map(name=>loader.loadAsync(assetURL(name).href)));
    if (disposed) {
      for (const result of results) if (result.status==='fulfilled') result.value.scene.traverse(node=>{
        node.geometry?.dispose();
        for (const material of [].concat(node.material || [])) material.dispose();
      });
      throw new Error('Sesi model sudah ditutup.');
    }
    installModels(results);
    installDrivetrain();
    installFlowModel();
    if (!roots.some(Boolean)) throw new Error('Aset 3D gagal dimuat. Inventaris masih tersedia.');
    emit('ready', {partial:!roots.every(Boolean)});
    return snapshot();
  }

  function setFlow(key) {
    state.flow=Object.hasOwn(fluid,key) ? key : 'none';
    state.route=null;
    updateFlowAppearance();
    changed();
  }
  function selectPart(id) {
    const entry=componentEntry(id);
    if (!entry) return false;
    if (state.mode!=='assembly') state.isolated=state.isolated && state.selected===entry.id;
    state.selected=entry.id;
    refreshHighlight();
    emit('select',entry.id);
    return true;
  }
  function setMode(mode) {
    if (!['home','overview','systems','operation','drives'].includes(mode)) throw new Error('Mode model tidak dikenali.');
    if (state.tour && mode!=='operation') finishTour();
    state.mode=mode;
    state.selected=null;
    state.isolated=false;
    state.combustionFocus=false;
    state.poseOverview=mode==='overview';
    state.route=null;
    if (!activeEngineMode()) { state.flowCut=false; resetPower(); }
    if (mode==='drives') {
      state.xray=true;
      state.flowCut=false;
    }
    applyPose();
    renderView();
    changed();
  }
  function renderView() {
    if (!renderer || !roots?.some(Boolean)) return;
    if (!syncViewportSize?.(true)) {
      if (state.mode==='drives') focusDrive();
      else frame();
      renderer.render(scene,camera);
    }
  }
  function applyXray(value) {
    const wasFocused=state.combustionFocus;
    state.xray=Boolean(value);
    if (!state.xray) {
      state.flowCut=false;
      state.combustionFocus=false;
      state.cutaway=false;
      state.cutawayNormal=null;
    }
    applyPose();
    if (wasFocused && !state.combustionFocus) frame();
    changed();
  }
  function setBlockSection(value) {
    if (!activeFlowMode() || !renderer || state.tour) return false;
    state.flowCut=Boolean(value);
    state.combustionFocus=false;
    if (state.flowCut) state.xray=true;
    applyPose();
    changed();
    return true;
  }
  function setChamberFocus(value) {
    if (!state.flowCut || !activeFlowMode() || !renderer) return false;
    state.combustionFocus=Boolean(value);
    if (state.combustionFocus) frameChamber();
    applyPose();
    if (!state.combustionFocus) frame();
    changed();
    return true;
  }
  function setCapTest(pressure) {
    if (!mechanics?.setCapTest || (pressure!==null && (!Number.isFinite(pressure) || state.enginePhase!=='off'))) return false;
    mechanics.setCapTest(pressure);
    applyDrivetrain();
    changed();
    return true;
  }
  function selectDrive(id) {
    if (!driveViews.has(id)) return false;
    if (!id.startsWith('cap-')) mechanics?.setCapTest?.(null);
    state.driveId=id;
    applyPose();
    focusDrive();
    changed();
    return true;
  }
  function spread(value, reframe=false) {
    state.overviewSpread=Math.max(0,Math.min(1,Number(value)||0));
    applyPose();
    if (reframe) frame();
    changed();
  }
  function startEngine() {
    if (!roots?.some(Boolean)) return false;
    if (!activeEngineMode()) setMode('operation');
    const started=power.start();
    if (started) unlockSound();
    updateFlowAppearance();
    return started;
  }
  function safeStop() {
    if (state.tour) { finishTour(); return true; }
    return power.stop();
  }
  function dispose() {
    if (disposed) return;
    disposed=true;
    resizeObserver?.disconnect();
    renderer?.setAnimationLoop(null);
    controls?.dispose?.();
    routeRibbons?.dispose();
    chamberFire?.dispose();
    const materials=new Set();
    scene?.traverse(node=>{
      if (!node.isMesh && !node.isLine) return;
      node.geometry?.dispose();
      for (const material of [].concat(node.material || [])) materials.add(material);
    });
    for (const [,variants] of shellMaterials) for (const variant of ['solid','transparent','sliced','chamberSlice']) {
      for (const material of [].concat(variants[variant] || [])) materials.add(material);
    }
    for (const material of materials) material.dispose();
    renderer?.dispose();
    renderer?.domElement?.remove();
    engineAudio?.dispose();
    listeners.clear();
  }
  function snapshot() {
    return Object.freeze({
      ready:Boolean(roots?.some(Boolean)), phase:state.enginePhase, paused:!state.running && state.enginePhase!=='off',
      running:state.running, phaseTime:state.phaseTime, rpm:state.rpm, crankAngle:state.angle,
      starterEngagement:state.starterEngagement, selection:state.selected, xray:state.xray, mode:state.mode,
      flow:state.flow, drive:state.driveId, audioSupported:Boolean(engineAudio), muted,
      capTestSupported:Boolean(mechanics?.setCapTest), capPressure:mechanics?.inspect().capPressure ?? null
    });
  }
  function inventory() {
    return [...entries.values()].map(({id,name,nama,status})=>Object.freeze({id,name:nama || name || id,status}));
  }
  // The supplied Studio has an authored 3D assembly sheet. This imperative binding
  // exposes existing objects for that sheet. Other UIs use the public commands above.
  const workspace={
    state, entries, groups, driveViews, flowViews, initialView, spreadVectors, fluid, tourStages,
    componentEntry, componentName, componentGroup, scopeFor, scopeReady, scopeInspectable, assemblyRows,
    scopedMembers, rowsInScope, rowProxy, shellCanReveal, flowDirectionKnown, activeEngineMode, activeFlowMode, applyPose,
    refreshHighlight, toggleCutaway, frame, frameChamber, focusDrive, updateClipPlane, updateFlowAppearance,
    resetPower, resetOperation, beginTour, nextTour, finishTour, publishSound, renderView,
    get context() {return {T,camera,controls,renderer,roots,data};}
  };
  return Object.freeze({load, start:startEngine, pause:power.pause, resume:()=>state.enginePhase!=='off' && startEngine(), stop:safeStop,
    reset:resetOperation, select:selectPart, setMode, setFlow, setXray:applyXray, setOverviewSpread:spread,
    selectDrive, setBlockSection, setChamberFocus, setCapTest, setMuted, setVolume, unlockAudio:()=>engineAudio?.unlock() ?? Promise.resolve(false),
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); }, snapshot, inventory, dispose,
    workspace});
}
