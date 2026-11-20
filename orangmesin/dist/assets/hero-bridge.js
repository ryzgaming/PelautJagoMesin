// Retains the existing geometry and simulation engine. Only the presentation changes.
if(new URLSearchParams(location.search).get('hero')==='1'){
 const model=window.__pp;
 if(model){
   model.parts.forEach(p=>p.mats.forEach(m=>{if(!m.transparent){m.userData.paint=p.key==='motor'?0x747c85:(p.key==='base'?0x31373f:0xa8afb5);m.color.setHex(m.userData.paint);m.metalness=.72;m.roughness=.32;}}));
   if(model.room)model.room.group.visible=false;
   model.controls.autoRotate=false;
   document.querySelector('#bPins')?.click();
   const status=document.createElement('output');status.id='hero-state';status.hidden=true;status.textContent='assembly';document.body.append(status);
   addEventListener('message',e=>{
     if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='om-hero')return;
     const action=e.data.action;
     const click=id=>document.getElementById(id)?.click();
     function reset(){click('bReset');['bSection','bSpin'].forEach(id=>{if(document.getElementById(id)?.getAttribute('aria-pressed')==='true')click(id);});}
     if(action==='reset')reset();
     else if(action==='explode'){reset();const ex=document.querySelector('#ex');ex.value='0.65';ex.dispatchEvent(new Event('input',{bubbles:true}));}
     else if(action==='cutaway'){reset();click('bSection');}
     else if(action==='play'){reset();click('bSection');click('bSpin');}
     else return;
     status.textContent=action;document.documentElement.dataset.heroMode=action;
   });
 }
}
if(new URLSearchParams(location.search).get('hero')==='1'&&!window.__pp){
 document.querySelector('#app').innerHTML='<div class="hero-fallback" role="img" aria-label="Pratinjau statis Shinko GJ — WebGL tidak tersedia"><img src="foto/shinko-gj-sim-desktop.png" alt="Pratinjau simulator Shinko GJ"></div>';
 function report(){parent.postMessage({type:'om-model-status',ready:false},location.origin);}
 report();addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='om-hero')report();});
}else if(new URLSearchParams(location.search).get('hero')==='1')parent.postMessage({type:'om-model-status',ready:true},location.origin);
