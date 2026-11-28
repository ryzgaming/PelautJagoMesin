/* Lifecycle-conditioned behavior shared by the review viewer and the offline audit. */
(function (scope) {
  'use strict';
  const clamp=(value,low=0,high=1)=>Math.min(high,Math.max(low,value));
  const approach=(value,target,dt,tau)=>target+(value-target)*Math.exp(-dt/tau);
  const tau=Math.PI*2;
  function vaneCompression(angle) {
    let value=0;
    for (let i=0;i<14;i++) {
      const a=angle+.30+.12*value+1.08;
      const d=Math.atan2(Math.sin(a),Math.cos(a));
      value=Math.abs(d)<.60 ? Math.cos(Math.PI*d/1.20)**2 : 0;
    }
    return value;
  }
  function applyVanes(object,angle) {
    if (!object) return;
    const weights=Array.from({length:10},(_,i)=>vaneCompression(angle+i*tau/10));
    object.traverse(child=>{
      if (!child.morphTargetInfluences || !child.morphTargetDictionary) return;
      weights.forEach((weight,i)=>{
        const idx=child.morphTargetDictionary['VANE_'+String(i+1).padStart(2,'0')];
        if (idx!==undefined) child.morphTargetInfluences[idx]=weight;
      });
    });
  }
  function create() {
    let st,capTest=null;
    function reset() {
      capTest=null;
      st={phase:'off',crank:0,starter:0,pinion:0,armature:0,engagement:0,
          turbo:0,turboRate:0,centrifuge:0,centrifugeRate:0,oil:0,fuel:0,rack:0,
          governor:0,tempC:30,capPressure:null,elapsed:0,startingRate:0,pinionRate:0,clutch:'lepas'};
    }
    reset();
    function integrateFree(angleKey,rateKey,target,dt,decay) {
      const before=st[rateKey];
      const after=approach(before,target,dt,decay);
      st[angleKey]+=target*dt+(before-target)*decay*(1-Math.exp(-dt/decay));
      st[rateKey]=after;
      if (!target && after<.00015) st[rateKey]=0;
    }
    function tick({phase,dt,rpm,crankRadians,starterRadians,engagement,coolantGaugeKPa}) {
      const t=Math.max(0,Number(dt)||0),crank=Number(crankRadians)||0;
      const starter=Number(starterRadians)||0,eng=clamp(Number(engagement)||0);
      const delta=Math.max(0,crank-st.crank);
      const rate=t ? delta/t : 0;
      const speed=clamp((Number(rpm)||0)/650,0,3);
      const starterPowered=phase==='cranking';
      const combustion=phase==='firing' || phase==='running';
      const injection=starterPowered || combustion;
      st.elapsed=phase===st.phase ? st.elapsed+t : 0;
      st.fuel=injection ? 1 : 0;
      st.capPressure=Number.isFinite(coolantGaugeKPa)?coolantGaugeKPa:capTest;
      const rackCommand=phase==='engaging' || phase==='cranking' ? 1 :
          combustion ? .32+.48*(1-clamp(speed)) : 0;
      st.rack=approach(st.rack,rackCommand,t,phase==='stopping'?.035:.16);
      st.governor=approach(st.governor,clamp(speed**2),t,.16);
      st.oil=approach(st.oil,clamp(speed*1.8),t,speed>.02?.46:.85);
      // Exhibition thermal time is compressed. Thresholds and stroke are from
      // D01 p168; starting temperature and the heat/cool time constants are estimates.
      st.tempC=approach(st.tempC,combustion?88:30,t,combustion?32:190);
      integrateFree('turbo','turboRate',combustion?rate*(.38+.62*clamp(speed)):0,t,combustion?.75:1.25);
      integrateFree('centrifuge','centrifugeRate',rate*st.oil,t,rate>.001?.90:1.10);
      if (phase==='engaging' || starterPowered) {
        st.armature=starter;
        st.pinion=starter;
        st.startingRate=starterPowered?rate:0;
        st.pinionRate=starterPowered?rate:0;
      } else if ((phase==='firing' || phase==='running') && eng>.10) {
        // The driving motor is de-energized. The teeth remain registered to the
        // flywheel as the newly firing engine overtakes the motor.
        st.pinion+=delta;
        st.pinionRate=rate;
        integrateFree('armature','startingRate',0,t,.15);
      } else {
        integrateFree('armature','startingRate',0,t,.15);
        integrateFree('pinion','pinionRate',0,t,.18);
      }
      if (phase==='off' && st.elapsed>3) {
        st.turboRate=0; st.centrifugeRate=0; st.startingRate=0; st.pinionRate=0;
      }
      st.clutch=eng<.10?'lepas':starterPowered?'menggerakkan':'angkat bebas';
      st.phase=phase; st.crank=crank; st.starter=starter; st.engagement=eng;
    }
    function sample(spec) {
      const act=spec.actuation || spec.mode;
      const v={clock:st.crank,travel:0,angle:0,scaleStroke:1,engagement:st.engagement};
      switch(act) {
        case 'starter_drive': v.clock=st.armature; break;
        case 'starter_pinion': v.clock=st.pinion; break;
        case 'starter_shift': v.clock=0; break;
        case 'turbo': v.clock=st.turbo; break;
        case 'centrifuge': v.clock=st.centrifuge; break;
        case 'injection': v.scaleStroke=st.fuel; break;
        case 'fuel-rack': v.travel=.005*st.rack; break;
        case 'fuel-metering': v.angle=.005/.0175*st.rack; break;
        case 'governor-shifter': v.travel=.0016*st.governor; break;
        case 'governor-spring': v.travel=-.0016*st.governor; break;
        case 'governor-link': v.angle=.05*st.governor; break;
        case 'governor-weight': v.angle=spec.pivot_sign*.085*st.governor; break;
        case 'cap-pressure':
        case 'cap-spring':
        case 'cap-return': {
          const p=st.capPressure??0;
          const lift=.003*clamp((p-108)/12);
          v.travel=act==='cap-spring'?-lift:lift;
          if (act==='cap-return') v.travel-=.0012*clamp(-p/4);
          break;
        }
        case 'thermostat':
        case 'thermostat-spring': {
          const fraction=clamp((st.tempC-spec.opens_c)/(spec.full_open_c-spec.opens_c));
          v.travel=-.008*fraction;
          break;
        }
      }
      return v;
    }
    function setCapTest(kPa) {
      capTest=Number.isFinite(kPa)?clamp(kPa,-10,135):null;
      st.capPressure=capTest;
    }
    return {tick,reset,sample,setCapTest,coasting:()=>st.phase==='off' && st.elapsed<=3 && Math.max(st.turboRate,st.centrifugeRate,st.pinionRate,st.startingRate)>.00015,inspect:()=>({...st})};
  }
  const api={create,vaneCompression,applyVanes};
  scope.FunctionalMotion=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window==='undefined' ? globalThis : window);
