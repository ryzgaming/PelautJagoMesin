/* Procedural teaching sound. No recordings; not an acoustic measurement of Yanmar.
 * Six cylinders, four strokes: firing frequency = rpm * 6 / 120 = rpm / 20 Hz.
 * Instantiate once. Call unlock() directly in a user-gesture handler, then update(). */
(function (root) {
  'use strict';
  const PHASES = new Set(['off', 'engaging', 'cranking', 'firing', 'running', 'stopping']);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));
  function create(options) {
    const opt = options || {};
    let context = null, graph = null, disposed = false, unlocked = false;
    let muted = false, volume = .35, hidden = Boolean(root.document?.hidden);
    let state = {phase: 'off', rpm: 0, elapsed: 0, paused: false};
    let lastClickElapsed = null, pendingClick = false;
    const targets = new Map(), shots = new Set();
    // Cancelling only future events preserves the current interpolated value. The
    // cache also prevents growing automation queues on every animation frame.
    function approach(param, value, seconds) {
      if (!context || targets.get(param) === value) return;
      const now = context.currentTime;
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
      param.setTargetAtTime(value, now, seconds || .035);
      targets.set(param, value);
    }
    function makeGraph() {
      const ctx = context, sources = [], nodes = [];
      const gain = (v) => {const n=ctx.createGain();n.gain.value=v;nodes.push(n);return n;};
      const filter = (type, hz, q) => {const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=hz;n.Q.value=q || .7;nodes.push(n);return n;};
      const osc = (type, hz) => {const n=ctx.createOscillator();n.type=type;n.frequency.value=hz;sources.push(n);nodes.push(n);return n;};
      const master=gain(0), limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;
      limiter.attack.value=.004;limiter.release.value=.16;nodes.push(limiter);
      master.connect(limiter);limiter.connect(ctx.destination);
      const starterGain=gain(0), engineGain=gain(0), bodyGain=gain(0), mechanicalGain=gain(0), exhaustGain=gain(0), turboGain=gain(0);
      [starterGain,engineGain,bodyGain,mechanicalGain,exhaustGain,turboGain].forEach(n=>n.connect(master));
      const starter=osc('triangle',220), starterFilter=filter('bandpass',800,1.2);
      starter.connect(starterFilter);starterFilter.connect(starterGain);
      const engine=osc('sine',30), body=osc('sine',15), turbo=osc('sine',1300);
      // A finite harmonic pulse train has a blunt impulse rather than an aliased
      // square wave. The engine filter provides the low-frequency exhaust body.
      const real=new Float32Array(49), imaginary=new Float32Array(49);
      for(let i=1;i<real.length;i++) real[i]=Math.exp(-i*.09);
      engine.setPeriodicWave(ctx.createPeriodicWave(real,imaginary));
      const engineFilter=filter('lowpass',900,.8);
      engine.connect(engineFilter);engineFilter.connect(engineGain);
      body.connect(bodyGain);turbo.connect(turboGain);
      const noiseBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2),ctx.sampleRate);
      const data=noiseBuffer.getChannelData(0);let seed=651286;
      for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
      const noise=ctx.createBufferSource();noise.buffer=noiseBuffer;noise.loop=true;sources.push(noise);nodes.push(noise);
      const mechanicalFilter=filter('bandpass',1700,.75),exhaustFilter=filter('lowpass',430,.7);
      noise.connect(mechanicalFilter);mechanicalFilter.connect(mechanicalGain);
      noise.connect(exhaustFilter);exhaustFilter.connect(exhaustGain);
      // Modulate exhaust noise at the exact six-cylinder firing frequency.
      const modulation=gain(.02);engine.connect(modulation);modulation.connect(exhaustGain.gain);
      sources.forEach(s=>s.start());
      return {master,starterGain,engineGain,bodyGain,mechanicalGain,exhaustGain,turboGain,
        starter,engine,body,turbo,engineFilter,modulation,sources,nodes};
    }
    function click() {
      if(!graph || !unlocked || hidden || muted || state.paused) return;
      pendingClick=false;
      const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.075),context.sampleRate);
      const samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++) {
        const t=i/context.sampleRate;
        samples[i]=.45*Math.sin(2*Math.PI*920*t)*Math.exp(-t*90)+.24*Math.sin(2*Math.PI*180*t)*Math.exp(-t*50);
      }
      const source=context.createBufferSource();source.buffer=buffer;source.connect(graph.master);shots.add(source);
      source.onended=()=>{shots.delete(source);source.disconnect();};source.start();
    }
    function apply() {
      if(!graph || disposed) return;
      const running=state.phase==='running'||state.phase==='firing';
      const coasting=state.phase==='stopping';
      const cranking=state.phase==='cranking';
      const rpm=state.rpm, spinning=rpm>1, active=state.phase!=='off';
      const audible=unlocked&&!muted&&!hidden&&!state.paused&&active;
      approach(graph.master.gain,audible?volume:0,.015);
      approach(graph.starter.frequency,120+rpm*1.9,.025);
      approach(graph.starterGain.gain,cranking?.14:0,.025);
      approach(graph.engine.frequency,Math.max(1,rpm/20),.018);
      approach(graph.body.frequency,Math.max(8,rpm/60),.025);
      approach(graph.engineFilter.frequency,550+rpm*.55,.04);
      approach(graph.engineGain.gain,running&&spinning?.38:0,.025);
      approach(graph.bodyGain.gain,spinning?(running?.19:coasting?.05:.045):0,.025);
      approach(graph.mechanicalGain.gain,spinning?(running?.047:cranking?.065:coasting?.025:0):0,.035);
      approach(graph.exhaustGain.gain,running&&spinning?.065:0,.035);
      approach(graph.modulation.gain,running&&spinning?.055:0,.025);
      approach(graph.turbo.frequency,1000+rpm*.9,.14);
      // No asserted turbo speed or boost pressure: restrained illustrative layer.
      approach(graph.turboGain.gain,running&&rpm>900?.009*clamp((rpm-900)/940,0,1):0,.2);
    }
    function visibility() { hidden=Boolean(root.document?.hidden);apply(); }
    root.document?.addEventListener('visibilitychange',visibility);
    const api={
      async unlock() {
        if(disposed) return false;
        // Call from a real tap/click. No AudioContext exists before this point.
        if(root.navigator?.userActivation && !root.navigator.userActivation.isActive && !opt.context) return false;
        try {
          if(!context) {
            const Audio=root.AudioContext||root.webkitAudioContext;
            if(!opt.context&&!Audio) return false;
            context=opt.context||new Audio({latencyHint:'interactive'});
            graph=makeGraph();
          }
          if(context.state==='suspended'&&typeof context.resume==='function'&&!opt.offline) await context.resume();
          unlocked=context.state==='running'||Boolean(opt.offline);
          apply();if(pendingClick&&state.phase==='engaging')click();return unlocked;
        } catch (_) {unlocked=false;apply();return false;}
      },
      update(value) {
        if(disposed) return;
        const next=value||{},previous=state.phase;
        state={phase:PHASES.has(next.phase)?next.phase:'off',rpm:clamp(next.rpm,0,3000),
          elapsed:Math.max(0,Number(next.elapsed)||0),paused:Boolean(next.paused)};
        apply();
        if(state.phase!=='engaging')pendingClick=false;
        if(state.phase==='engaging'&&previous!=='engaging'&&!state.paused) {lastClickElapsed=state.elapsed;pendingClick=true;click();}
      },
      setMuted(value) {muted=Boolean(value);apply();},
      setVolume(value) {volume=clamp(value,0,1);apply();},
      probe() {return {...state,unlocked,muted,volume,hidden,disposed,contextState:context?.state||'uncreated',
        firingHz:state.rpm/20,audible:unlocked&&!muted&&!hidden&&!state.paused&&state.phase!=='off',
        nodes:graph?.nodes.length||0,activeOneShots:shots.size,lastClickElapsed,
        targets:graph?{master:targets.get(graph.master.gain),starter:targets.get(graph.starterGain.gain),combustion:targets.get(graph.engineGain.gain)}:null};},
      async dispose() {
        if(disposed)return;disposed=true;unlocked=false;
        root.document?.removeEventListener('visibilitychange',visibility);
        if(graph){graph.sources.forEach(s=>{try{s.stop();}catch(_){}});graph.nodes.forEach(n=>n.disconnect());}
        shots.forEach(s=>{try{s.stop();}catch(_){}s.disconnect();});shots.clear();
        if(context&&!opt.context&&context.state!=='closed') await context.close();
        graph=null;targets.clear();
      }
    };
    return api;
  }
  root.OrangMesinAudio={create,description:'Suara ilustrasi sintetis, bukan rekaman atau pengukuran Yanmar 6AYM-WET.'};
})(typeof window!=='undefined'?window:globalThis);
