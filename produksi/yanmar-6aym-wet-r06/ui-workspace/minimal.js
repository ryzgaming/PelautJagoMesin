import {createEngineSession} from '../model/runtime/engine-session.js';

const view=document.querySelector('#engine-view');
const status=document.querySelector('#status');
const selection=document.querySelector('#selection');
const inventory=document.querySelector('#inventory');
const commands=[...document.querySelectorAll('[data-command]')];
const xray=document.querySelector('#xray');
const sound=document.querySelector('#sound');
const starter=document.querySelector('#starter');
const whole=document.querySelector('#whole');
const engine=createEngineSession({host:view});
const phases={off:'Mesin mati',engaging:'Pinion masuk',cranking:'Starter memutar',
  firing:'Pembakaran mulai',running:'Mesin hidup',stopping:'Mesin melambat'};
let failed=false;

function update() {
  const state=engine.snapshot();
  if (!failed) status.textContent=state.ready ?
    (state.paused ? 'Jeda · ' : '')+phases[state.phase] : 'Memuat model';
  for (const button of commands) {
    const name=button.dataset.command;
    button.disabled=!state.ready || (name==='pause' && !state.running) ||
      (name==='resume' && !state.paused) || (name==='start' && state.phase!=='off') ||
      (name==='stop' && ['off','stopping'].includes(state.phase));
  }
  starter.disabled=whole.disabled=xray.disabled=!state.ready;
  xray.setAttribute('aria-pressed',String(state.xray));
  sound.disabled=!state.audioSupported;
  sound.setAttribute('aria-pressed',String(!state.muted));
  sound.textContent=state.muted ? 'Suara mati' : 'Suara aktif';
  inventory.value=state.selection || '';
  selection.textContent=inventory.selectedOptions[0]?.value ? inventory.selectedOptions[0].textContent : '';
}
for (const control of commands) control.addEventListener('click',()=>engine[control.dataset.command]());
starter.addEventListener('click',()=>{ engine.setMode('drives'); engine.selectDrive('starter-pinion'); });
whole.addEventListener('click',()=>engine.setMode('operation'));
xray.addEventListener('click',()=>engine.setXray(!engine.snapshot().xray));
sound.addEventListener('click',async()=>{
  if (!engine.snapshot().muted) engine.setMuted(true);
  else if (await engine.unlockAudio()) engine.setMuted(false);
});
inventory.addEventListener('change',()=>engine.select(inventory.value));
engine.subscribe(({type})=>{
  if (type==='inventory') for (const item of engine.inventory()) {
    const option=new Option(item.name+' · '+item.id,item.id);
    inventory.add(option);
  }
  update();
});
update();
try {
  await engine.load();
  engine.setMode('operation');
} catch (error) {
  failed=true;
  status.textContent=error.message;
  update();
}
