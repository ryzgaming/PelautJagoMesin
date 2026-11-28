const starterRadiansPerSecond = 1.4;
const crankRadiansPerSecond = 2.1;
const phaseDuration = {engaging:.35, cranking:1.45, firing:.85, stopping:1.05};
const phaseNext = {engaging:'cranking', cranking:'firing', firing:'running', stopping:'off'};
export const idleRPM = 650;

export function createPowertrainState() {
  return {enginePhase:'off',phaseTime:0,rpm:0,angle:0,running:false,simTime:0,
    stopRPM:0,stopEngagement:0,starterEngagement:0,driveAngles:{running:0,starting:0,both:0}};
}

export function createPowertrain({state=createPowertrainState(), mechanics, changed=()=>{}, ringTeeth=180}={}) {
  function phaseChange(phase) {
    state.phaseTime=0;
    if (phase==='engaging') {
      mechanics?.setCapTest?.(null);
      const pitch=2*Math.PI/ringTeeth;
      const difference=state.driveAngles.both-state.driveAngles.starting;
      state.driveAngles.starting+=difference-Math.round(difference/pitch)*pitch;
    }
    if (phase==='stopping') {
      state.stopRPM=state.rpm;
      state.stopEngagement=state.starterEngagement;
    }
    if (phase==='off') {
      state.rpm=0;
      state.starterEngagement=0;
    }
    state.enginePhase=phase;
    changed();
  }
  function reset() {
    state.phaseTime=0;
    state.rpm=0;
    state.stopRPM=0;
    state.stopEngagement=0;
    state.starterEngagement=0;
    state.enginePhase='off';
    for (const phase of Object.keys(state.driveAngles)) state.driveAngles[phase]=0;
    mechanics?.reset();
    state.running=false;
    state.angle=0;
    state.simTime=0;
    changed();
  }
  function smoothstep(x) {
    return x*x*(3-2*x);
  }
  function step(delta, stage) {
    if (!state.running || !Number.isFinite(delta) || delta<=0) return;
    while (delta>0 && state.enginePhase!=='off') {
      const phase=state.enginePhase;
      const duration=phaseDuration[phase] ?? Infinity;
      const slice=Math.min(.05,delta,Math.max(0,duration-state.phaseTime));
      state.phaseTime+=slice;
      delta-=slice;
      const progress=Math.min(1,state.phaseTime/duration);
      let speed=0;
      if (phase==='engaging') state.starterEngagement=smoothstep(progress);
      if (phase==='cranking') {
        state.rpm=220*Math.min(1,progress*5);
        speed=starterRadiansPerSecond*state.rpm/220;
      }
      if (phase==='firing') {
        state.rpm=220+(idleRPM-220)*smoothstep(progress);
        speed=starterRadiansPerSecond+(crankRadiansPerSecond-starterRadiansPerSecond)*smoothstep(progress);
      }
      if (phase==='running') {
        state.rpm=idleRPM;
        state.starterEngagement=1-smoothstep(Math.min(1,state.phaseTime/.24));
        speed=stage?.speed || crankRadiansPerSecond;
      }
      if (phase==='stopping') {
        state.rpm=state.stopRPM*(1-progress);
        state.starterEngagement=state.stopEngagement*(1-smoothstep(Math.min(1,state.phaseTime/.24)));
        speed=crankRadiansPerSecond*state.rpm/idleRPM;
      }
      const step=speed*slice;
      state.driveAngles.both+=step;
      state.driveAngles.running+=step;
      if (state.starterEngagement>0) state.driveAngles.starting+=step;
      state.angle=state.driveAngles.both%(4*Math.PI);
      state.simTime+=slice*(state.rpm/idleRPM);
      if (slice>0) mechanics?.tick({phase,phaseTime:state.phaseTime,dt:slice,rpm:state.rpm,
        crankRadians:state.driveAngles.both,starterRadians:state.driveAngles.starting,engagement:state.starterEngagement});
      if (Number.isFinite(duration) && state.phaseTime>=duration) {
        phaseChange(phaseNext[phase]);
        if (state.enginePhase==='off' && !state.tour) {
          state.running=false;
          changed();
        }
      }
    }

  }

  function start() {
    if (state.running) return false;
    state.running=true;
    if (state.enginePhase==='off') phaseChange('engaging');
    else changed();
    return true;
  }
  function pause() {
    if (!state.running) return false;
    state.running=false;
    changed();
    return true;
  }
  function stop() {
    if (['off','stopping'].includes(state.enginePhase)) return false;
    state.running=true;
    phaseChange('stopping');
    return true;
  }
  function snapshot() {
    return Object.freeze({...state,driveAngles:Object.freeze({...state.driveAngles})});
  }
  return Object.freeze({start,pause,resume:()=>state.enginePhase!=='off' && start(),stop,reset,step,snapshot});
}
