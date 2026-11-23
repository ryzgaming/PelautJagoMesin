import {api,ready,showAccount,errorMessage} from './app.js';

const $ = (s) => document.querySelector(s);
const machineId = 'man-l2330h';
const componentGroups = [
  {name:'STRUCTURE',parts:[
    {key:'base',name:'Base Frame',note:'Dudukan utama mesin dan sistem mounting; bentuk model merupakan interpretasi edukasi.'},
    {key:'frame',name:'Engine Frame & Crankcase',note:'Struktur penopang silinder dan ruang mekanisme poros.'}
  ]},
  {name:'CYLINDER ASSEMBLY',parts:[
    {key:'head',name:'Cylinder Head',note:'Kepala silinder dan susunan peralatan katup terkait.'},
    {key:'liner',name:'Cylinder Liner',note:'Permukaan kerja piston dan struktur liner silinder.'},
    {key:'piston',name:'Piston Assembly',note:'Menerima tekanan pembakaran dan meneruskan gaya gerak.'},
    {key:'rod',name:'Connecting Rod',note:'Meneruskan gerak piston ke crankshaft.'}
  ]},
  {name:'ROTATING & VALVE TRAIN',parts:[
    {key:'crank',name:'Crankshaft & Main Bearings',note:'Mengonversi gerak bolak-balik menjadi putaran.'},
    {key:'cam',name:'Camshaft',note:'Mengatur mekanisme valve dan pompa sesuai konfigurasi mesin.'},
    {key:'valve',name:'Valve Gear',note:'Mekanisme penggerak katup pada engine cylinder head.'},
    {key:'gear',name:'Gear Train',note:'Transmisi putaran ke peralatan mesin.'}
  ]},
  {name:'AUXILIARY SYSTEMS',parts:[
    {key:'fuel',name:'Fuel Injection',note:'Pompa dan injector yang berkaitan dengan penyemprotan bahan bakar.'},
    {key:'tc',name:'Turbocharger',note:'Turbin gas buang menggerakkan kompresor udara pengisian.'},
    {key:'front',name:'Pumps & Front Equipment',note:'Kelompok pompa, filter, dan perlengkapan sisi depan mesin.'},
    {key:'alt',name:'Alternator',note:'Generator yang digerakkan oleh mesin bantu diesel.'}
  ]}
];
const components=componentGroups.flatMap(g=>g.parts);

const systems=[
  {id:'air',name:'Air System',label:'AIR / CHARGE AIR',icon:'≋',color:'#55c9f1',nodes:['Intake','Turbo','Cooler','Manifold','Cylinder'],steps:[
    ['Intake air','Udara segar diarahkan ke sisi kompresor turbocharger.','Udara menyediakan oksigen yang diperlukan untuk proses pembakaran.', 'tc'],
    ['Turbocharging','Kompresor turbocharger meningkatkan tekanan udara masuk.','Lebih banyak udara mendukung proses pembakaran sesuai kondisi kerja mesin.', 'tc'],
    ['Charge-air cooling','Udara bertekanan didinginkan sebelum dialirkan ke mesin.','Pendinginan mengurangi temperatur udara pengisian dan meningkatkan densitasnya.', 'front'],
    ['Air distribution','Udara pengisian didistribusikan menuju bagian intake silinder.','Suplai antar silinder harus sesuai rancangan intake mesin.', 'head'],
    ['Combustion intake','Udara masuk melalui mekanisme intake valve pada mesin empat langkah.','Oksigen di silinder diperlukan sebelum injeksi dan pembakaran.', 'valve']
  ],reason:'Sistem udara memasok oksigen pembakaran melalui turbocharger dan charge-air cooling. Diagram ini skematis, bukan rute pipa aktual.'},
  {id:'fuel',name:'Fuel System',label:'FUEL / INJECTION',icon:'◉',color:'#edb35b',nodes:['Supply','Condition','Pump','Injector','Combustion'],steps:[
    ['Fuel supply','Bahan bakar yang telah diolah disuplai ke mesin sesuai persyaratan sistem.','Mutu, temperatur, dan kebersihan suplai memengaruhi keandalan injeksi.', 'front'],
    ['Fuel conditioning','Aliran bahan bakar dipantau dan dikondisikan untuk sistem injeksi.','Kondisi suplai yang tidak sesuai dapat mengganggu atomisasi dan pembakaran.', 'fuel'],
    ['Injection pump','Pompa injeksi menghasilkan tekanan untuk penyemprotan bahan bakar.','Injeksi perlu berlangsung pada urutan dan kondisi yang tepat.', 'fuel'],
    ['Injector nozzle','Injector menyemprot bahan bakar ke ruang bakar.','Atomisasi membantu pencampuran bahan bakar dan udara.', 'fuel'],
    ['Combustion','Pembakaran menghasilkan tekanan yang bekerja pada piston.','Gaya dari piston diubah menjadi tenaga putar oleh mekanisme engkol.', 'piston']
  ],reason:'Sistem bahan bakar mengatur suplai dan injeksi. Parameter aktual harus mengikuti project guide dan manual operasi tipe mesin.'},
  {id:'lube',name:'Lubricating',label:'LUBRICATION / OIL',icon:'◈',color:'#d5cf7b',nodes:['Sump','Pump','Filter','Bearing','Return'],steps:[
    ['Oil reservoir','Minyak pelumas ditampung di sistem oli mesin.','Volume dan kualitas oli menentukan kemampuan sirkulasi.', 'base'],
    ['Lubricating pump','Pompa mempertahankan sirkulasi pelumas saat operasi.','Aliran oli diperlukan untuk menjaga lapisan pelumas komponen bergerak.', 'front'],
    ['Filter & cooler','Minyak melewati elemen filter dan pengendalian temperatur sesuai sistem.','Kebersihan oli dan viskositas yang tepat melindungi komponen.', 'front'],
    ['Bearings & motion','Minyak disalurkan ke bantalan dan titik gesekan.','Pelumasan mengurangi kontak logam, gesekan, dan keausan.', 'crank'],
    ['Oil return','Oli mengalir kembali untuk disirkulasikan lagi.','Sirkulasi berkesinambungan mendukung operasi normal mesin.', 'base']
  ],reason:'Pelumasan membantu membentuk film oli, membuang sebagian panas dan melindungi bantalan serta komponen bergerak.'},
  {id:'cool',name:'Cooling',label:'COOLING / TEMPERATURE',icon:'❄',color:'#66d7d2',nodes:['Pump','Engine','Thermostat','Cooler','Return'],steps:[
    ['Coolant pump','Pompa menggerakkan media pendingin melalui sirkuit mesin.','Aliran yang memadai diperlukan untuk mengambil panas.', 'front'],
    ['Cooling passages','Media pendingin menyerap panas dari bagian mesin yang dirancang untuk didinginkan.','Temperatur komponen harus dijaga sesuai batas pabrikan.', 'liner'],
    ['Temperature control','Sistem mengatur temperatur media pendingin berdasarkan kondisi operasi.','Perubahan temperatur tidak terkendali memengaruhi toleransi dan keandalan.', 'front'],
    ['Heat exchanger','Panas dipindahkan dari sirkuit mesin ke sistem pendinginan berikutnya.','Pembuangan panas menjaga keseimbangan termal.', 'front'],
    ['Circulation return','Media kembali ke jalur sirkulasi untuk menerima panas berikutnya.','Sistem pendingin bekerja sebagai rangkaian yang berulang.', 'front']
  ],reason:'Tujuan sistem cooling adalah membuang panas dan menjaga temperatur komponen dalam rentang yang ditetapkan manual untuk varian mesin.'},
  {id:'start',name:'Starting Air',label:'STARTING AIR / CRANKING',icon:'▷',color:'#baadff',nodes:['Receiver','Safety','Starter','Crank','Running'],steps:[
    ['Stored air','Udara tekan tersedia dari starting air receiver.','Udara menyediakan energi awal untuk sistem starting.', 'front'],
    ['Starting interlocks','Persyaratan keselamatan dan izin start diperiksa.','Interlock mencegah percobaan start pada kondisi yang tidak diizinkan.', 'front'],
    ['Starting device','Sistem starting menggunakan udara tekan untuk memutar mesin sesuai rancangan.','Mesin perlu diputar sebelum menghasilkan tenaga melalui pembakaran.', 'front'],
    ['Crank rotation','Crankshaft mulai berputar dan siklus kerja berlangsung.','Perputaran awal memungkinkan urutan intake, compression dan pembakaran.', 'crank'],
    ['Self-sustaining','Ketika pembakaran stabil, sistem starting dilepas.','Sistem starter tidak boleh tetap terhubung saat mesin berjalan normal.', 'piston']
  ],reason:'Pada L23/30H mesin bantu empat langkah, sistem udara start memutar mesin sebagai sumber energi awal. Peralatan dan interlock spesifik wajib mengikuti dokumen instalasi.'},
  {id:'exhaust',name:'Exhaust Gas',label:'EXHAUST / ENERGY RECOVERY',icon:'↗',color:'#ec9872',nodes:['Cylinder','Exh. Valve','Manifold','Turbine','Outlet'],steps:[
    ['Exhaust stroke','Gas pembakaran didorong keluar pada langkah buang.','Gas sisa harus dikeluarkan sebelum siklus berikutnya.', 'piston'],
    ['Exhaust valve','Exhaust valve membuka sesuai urutan camshaft.','Timing katup memengaruhi pertukaran gas.', 'valve'],
    ['Exhaust manifold','Gas buang dikumpulkan dan dialirkan menuju turbocharger.','Kondisi aliran gas memengaruhi energi turbin.', 'head'],
    ['Turbine drive','Energi gas buang menggerakkan turbin turbocharger.','Turbin memasok energi untuk kompresor sisi udara.', 'tc'],
    ['Exhaust outlet','Gas diteruskan ke sistem exhaust sesuai instalasi kapal.','Jalur exhaust harus mengikuti batas back pressure pabrikan.', 'tc']
  ],reason:'Energi gas buang dimanfaatkan untuk menggerakkan kompresor turbocharger. Warna jalur pada diagram merupakan ilustrasi edukasi.'}
];

const parameterRows=[
  ['Varian','MAN L23/30H Mk3','Referensi model'],
  ['Tipe mesin','Diesel, 4-stroke','Auxiliary generator'],
  ['Konfigurasi model','6 silinder, in-line','Simulator yang ada'],
  ['Putaran acuan','720 / 750 rpm','Tercantum pada model edukasi; cek rating varian'],
  ['Tekanan udara isi','Sesuai beban & manual','Tidak diasumsikan'],
  ['Tekanan minyak pelumas','Sesuai manual','Tidak diasumsikan'],
  ['Temperatur jacket water','Sesuai manual','Tidak diasumsikan'],
  ['Temperatur gas buang','Sesuai kondisi beban','Gunakan tren & batas alarm resmi']
];
const faults=[
  {name:'Tekanan udara pengisian rendah',causes:['Filter udara kotor atau saluran udara bermasalah','Kinerja turbocharger menurun','Kondisi cooler atau kebocoran saluran'],check:'Bandingkan pembacaan instrumen dengan referensi beban. Periksa filter, cooler, sambungan dan turbocharger sesuai prosedur aman.'},
  {name:'Temperatur gas buang tidak merata',causes:['Perbedaan kualitas pembakaran antar silinder','Kondisi injector atau suplai bahan bakar','Perbedaan kondisi udara atau kompresi'],check:'Bandingkan tren tiap silinder dan kondisi beban. Jangan mengubah setelan injeksi tanpa prosedur resmi.'},
  {name:'Tekanan minyak pelumas rendah',causes:['Level atau temperatur minyak tidak sesuai','Hambatan filter atau masalah pompa','Pembacaan instrumen bermasalah'],check:'Ikuti alarm dan prosedur keselamatan mesin. Verifikasi indikasi serta kondisi sirkulasi pelumas.'},
  {name:'Suhu pendingin tinggi',causes:['Aliran pendingin tidak memadai','Performa heat exchanger menurun','Gangguan pengendali temperatur'],check:'Bandingkan aliran dan tren temperatur terhadap manual. Ikuti prosedur sebelum membuka sistem pendingin.'},
  {name:'Gagal starting',causes:['Tekanan starting air tidak memadai','Interlock keselamatan masih aktif','Peralatan start atau kontrol tidak siap'],check:'Periksa status izin start, energi starting dan interlock berdasarkan instruksi OEM.'}
];

let currentSystem=0,currentStep=0,showReason=false,autoTimer=null,selectedComponent='head',modelReady=false,bridgeToken=null,activeMode='normal';
const frame=$('#v4-engine');
function notify(text){$('#v4-view-feedback').textContent=text;}
function setAuth(text){$('#v4-auth-status').textContent=text;}
function setModelState(text){$('#v4-view-status').textContent=text;}
function setControls(active){modelReady=active;document.querySelectorAll('[data-view],[data-action]').forEach(b=>b.disabled=!active);$('#v4-part-focus').disabled=!active;}
function sendModel(type,action,value){
  if(!modelReady||!frame.contentWindow||!bridgeToken)return false;
  frame.contentWindow.postMessage({tag:'om-man-v4',token:bridgeToken,type:type,action:action,value:value},'*');
  return true;
}
function markMode(mode){
  activeMode=mode;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('v4-button-active',b.dataset.view===mode);});
}
function makeBridge(token){
  // The frame uses an opaque sandbox origin. Validate parent origin and per-frame nonce.
  const lines=[
    '(function(){',
    'var token='+JSON.stringify(token)+';',
    'var expectedOrigin='+JSON.stringify(location.origin)+';',
    'function report(type,extra){try{parent.postMessage(Object.assign({tag:"om-man-v4",token:token,type:type},extra||{}),expectedOrigin);}catch(e){}}',
    'function el(id){return document.getElementById(id);}',
    'function toggle(id,want){var b=el(id);if(!b)return false;var is=b.getAttribute("aria-pressed")==="true";if(is!==want)b.click();return true;}',
    'function click(id){var b=el(id);if(!b)return false;b.click();return true;}',
    'function explode(n){var x=el("ex");if(!x)return false;x.value=String(n);x.dispatchEvent(new Event("input",{bubbles:true}));x.dispatchEvent(new Event("change",{bubbles:true}));return true;}',
    'function mode(m){',
      'if(m==="normal"){click("bReset");toggle("bSection",false);toggle("bXray",false);explode(0);toggle("bSpin",false);return true;}',
      'if(m==="explode"){toggle("bSection",false);explode(0.85);return true;}',
      'if(m==="cutaway"){explode(0);return toggle("bSection",true);}',
      'if(m==="animate"){click("m-op");return toggle("bSpin",true);}',
      'return false;',
    '}',
    'function selectPart(key){var pp=window.__pp;var parts=pp&&pp.parts;var p=parts&&parts.find(function(p){return p.key===key;});if(p&&p.li&&typeof p.li.click==="function"){click("m-learn");p.li.click();return true;}return false;}',
    'addEventListener("message",function(e){',
    'if(e.source!==parent||e.origin!==expectedOrigin||!e.data||e.data.tag!=="om-man-v4"||e.data.token!==token)return;',
    'try{var ok=false;var d=e.data;',
      'if(d.type==="mode")ok=mode(d.action);',
      'else if(d.type==="control"){var ids={"rotate":"bRot","zoom-in":"bZi","zoom-out":"bZo","reset":"bReset"};ok=!!ids[d.action]&&click(ids[d.action]);}',
      'else if(d.type==="select")ok=selectPart(d.action);',
      'else if(d.type==="ping")ok=true;',
      'report("action-result",{ok:ok,action:d.action||d.type});',
    '}catch(err){report("action-result",{ok:false,action:e.data.action,error:"CONTROL_UNAVAILABLE"});}',
    '});',
    'function ready(){report("ready",{hasViewer:!!el("gl"),hasComponents:!!(window.__pp&&window.__pp.parts),hasExplosion:!!el("ex"),hasCutaway:!!el("bSection"),hasAnimation:!!el("bSpin")});}',
    'if(document.readyState==="complete")ready();else addEventListener("load",ready,{once:true});',
    'setTimeout(ready,1300);',
    '})();'
  ];
  return '<script>'+lines.join('\n')+'<\/script>';
}

async function loadEngine(){
  setModelState('Memeriksa izin');
  setAuth('Memeriksa akses MAN premium melalui server...');
  $('#v4-load').disabled=true;
  try{
    await ready;
    const html=await api('access',{productId:machineId},true);
    if(typeof html!=='string'||!/<html[\s>]/i.test(html))throw new Error('PRODUCT_FILE_NOT_READY');
    bridgeToken=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    const bridge=makeBridge(bridgeToken);
    const embedded=/<\/body\s*>/i.test(html)?html.replace(/<\/body\s*>/i,bridge+'</body>'):html+bridge;
    frame.srcdoc=embedded;
    frame.hidden=false;
    $('#v4-frame-placeholder').hidden=true;
    setModelState('Memuat model');
    setAuth('');
    notify('Model MAN asli sedang dimuat. Kontrol V4 aktif setelah viewer memberikan respons.');
  }catch(err){
    frame.hidden=true;
    $('#v4-frame-placeholder').hidden=false;
    setControls(false);
    setModelState('Akses diperlukan');
    setAuth(errorMessage(err));
    if(['SIGN_IN_REQUIRED','SESSION_EXPIRED'].includes(err.message)) {
      $('#v4-load').textContent='Masuk untuk memuat MAN';
    }else {
      $('#v4-load').textContent='Coba muat ulang';
    }
  }finally{$('#v4-load').disabled=false;}
}

addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!event.data||event.data.tag!=='om-man-v4'||event.data.token!==bridgeToken)return;
  if(event.data.type==='ready'){
    const caps=event.data;
    if(caps.hasViewer){
      setControls(true);
      setModelState('3D aktif');
      notify('3D Viewer aktif. Gunakan Assembly, Exploded, Cutaway, Animate, atau sentuh langsung komponen.');
    }else{
      setModelState('Viewer sedang dimuat');
      notify('Mesin masih memuat. Kontrol bawaan simulator tetap bisa digunakan jika tersedia.');
    }
  }
  if(event.data.type==='action-result'){
    notify(event.data.ok?'Kontrol '+(event.data.action||'')+' diterapkan pada model MAN.':'Kontrol tersebut belum tersedia pada model yang sedang dimuat; coba kontrol langsung di viewer.');
  }
});

function renderComponents(){
  const q=($('#v4-component-search').value||'').trim().toLowerCase();
  const tree=$('#v4-tree');
  tree.replaceChildren();
  let matches=0;
  for(const group of componentGroups){
    const shown=group.parts.filter(p=>(p.name+' '+p.note).toLowerCase().includes(q));
    if(!shown.length)continue;
    const box=document.createElement('div');box.className='v4-group';
    const title=document.createElement('div');title.className='v4-group-name';title.textContent=group.name;box.append(title);
    for(const p of shown){
      matches++;
      const btn=document.createElement('button');btn.type='button';btn.className='v4-part'+(p.key===selectedComponent?' selected':'');
      const name=document.createElement('span');name.textContent='◇ '+p.name;
      const arrow=document.createElement('span');arrow.textContent='↗';
      btn.append(name,arrow);
      btn.onclick=()=>{
        selectedComponent=p.key;updateSelected();renderComponents();
        if(!sendModel('select',p.key)){notify('Komponen dipilih. Untuk fokus di mesin, muat viewer 3D terlebih dahulu.');}
      };
      box.append(btn);
    }
    tree.append(box);
  }
  if(matches===0){const p=document.createElement('p');p.className='v4-feedback';p.textContent='Tidak ada komponen yang sesuai pencarian.';tree.append(p);}
}
function updateSelected(){
  const p=components.find(c=>c.key===selectedComponent)||components[0];
  $('#v4-part-name').textContent=p.name;$('#v4-part-note').textContent=p.note;
}
function setTab(reason){
  showReason=reason;$('#v4-tab-explanation').setAttribute('aria-selected',String(!reason));$('#v4-tab-reason').setAttribute('aria-selected',String(reason));renderStep();
}
function stopAuto(){
  if(autoTimer!==null)clearInterval(autoTimer);
  autoTimer=null;$('#v4-auto').textContent='▶ Auto Play';
}
function startAuto(){
  stopAuto();$('#v4-auto').textContent='Ⅱ Pause';
  autoTimer=setInterval(()=>{
    const s=systems[currentSystem];
    if(currentStep>=s.steps.length-1){stopAuto();return;}
    currentStep++;renderStep();
  },3400);
}
function changeSystem(index){
  stopAuto();currentSystem=index;currentStep=0;showReason=false;
  $('#v4-tab-explanation').setAttribute('aria-selected','true');
  $('#v4-tab-reason').setAttribute('aria-selected','false');
  renderSystems();renderStep();startAuto();
}
function renderSystems(){
  const el=$('#v4-systems');el.replaceChildren();
  systems.forEach((s,i)=>{
    const b=document.createElement('button');b.type='button';b.className='v4-system'+(currentSystem===i?' selected':'');
    b.setAttribute('aria-pressed',String(currentSystem===i));
    const icon=document.createElement('span');icon.className='v4-sicon';icon.textContent=s.icon;
    const title=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');
    strong.textContent=s.name;small.textContent=s.label;title.append(strong,small);b.append(icon,title);
    b.onclick=()=>changeSystem(i);el.append(b);
  });
}
function renderFlow(){
  const s=systems[currentSystem], el=$('#v4-flow-diagram');el.replaceChildren();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 620 120');
  svg.setAttribute('role','presentation');
  const stepWidth=575/(s.nodes.length-1);
  const nodeX=i=>23+i*stepWidth;
  const mk=(tag,attr,txt)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attr))n.setAttribute(k,String(v));if(txt!==undefined)n.textContent=txt;svg.append(n);return n;};
  mk('line',{x1:nodeX(0),y1:42,x2:nodeX(s.nodes.length-1),y2:42,stroke:'#52666f','stroke-width':4,'stroke-linecap':'round'});
  const pct=(currentStep/(s.nodes.length-1));
  mk('line',{x1:nodeX(0),y1:42,x2:nodeX(0)+(nodeX(s.nodes.length-1)-nodeX(0))*pct,y2:42,stroke:s.color,'stroke-width':4,'stroke-linecap':'round',class:'v4-flow-stroke'});
  s.nodes.forEach((label,i)=>{
    const x=nodeX(i);
    const active=i===currentStep;
    mk('circle',{cx:x,cy:42,r:active?17:13,class:'v4-node'+(active?' active':'')});
    mk('text',{x:x,y:45,'text-anchor':'middle',class:'v4-node-number'+(active?' v4-node-active':'')},String(i+1));
    mk('text',{x:x,y:76,'text-anchor':'middle',class:'v4-node-title'},label);
  });
  el.append(svg);
}
function renderStep(){
  const s=systems[currentSystem],d=s.steps[currentStep];
  $('#v4-flow-name').textContent=s.name;
  $('#v4-step-counter').textContent=String(currentStep+1).padStart(2,'0')+' / '+String(s.steps.length).padStart(2,'0');
  $('#v4-progress-bar').style.width=String((currentStep+1)/s.steps.length*100)+'%';
  $('#v4-flow-step').textContent=d[0];
  $('#v4-narrative').textContent=showReason?(d[2]+' '+s.reason):d[1];
  renderFlow();
  if(modelReady&&d[3])sendModel('select',d[3]);
}
function renderSpecs(){
  const el=$('#v4-specs');
  for(const [name,value,source] of parameterRows){
    const box=document.createElement('div');box.className='v4-spec';
    const l=document.createElement('label');l.textContent=name;
    const val=document.createElement('strong');val.textContent=value;
    const note=document.createElement('small');note.textContent=source;
    box.append(l,val,note);el.append(box);
  }
}
function renderFaults(){
  const list=$('#v4-fault-list');list.replaceChildren();
  for(let i=0;i<faults.length;i++){
    const b=document.createElement('button');b.type='button';b.className='v4-fault';
    const warning=document.createElement('i');warning.textContent='⚠';
    const name=document.createElement('span');name.textContent=faults[i].name;
    const arrow=document.createElement('span');arrow.textContent='›';
    b.append(warning,name,arrow);
    b.addEventListener('click',()=>{
      list.querySelectorAll('.v4-fault').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      const detail=$('#v4-fault-detail');detail.replaceChildren();
      const title=document.createElement('strong');title.textContent=faults[i].name+' — Kemungkinan penyebab';
      const ol=document.createElement('ol');
      for(const cause of faults[i].causes){const li=document.createElement('li');li.textContent=cause;ol.append(li);}
      const check=document.createElement('p');check.textContent='Pemeriksaan edukasi: '+faults[i].check;
      const note=document.createElement('p');note.textContent='Wajib mengikuti prosedur keselamatan serta dokumen OEM. Ini bukan diagnosis pasti.';
      detail.append(title,ol,check,note);
    });
    list.append(b);
  }
}
$('#v4-component-search').addEventListener('input',renderComponents);
$('#v4-part-focus').onclick=()=>{if(!sendModel('select',selectedComponent))notify('Viewer 3D belum siap.');};
$('#v4-previous').onclick=()=>{stopAuto();const s=systems[currentSystem];currentStep=(currentStep-1+s.steps.length)%s.steps.length;renderStep();};
$('#v4-next').onclick=()=>{stopAuto();const s=systems[currentSystem];currentStep=(currentStep+1)%s.steps.length;renderStep();};
$('#v4-auto').onclick=()=>autoTimer!==null?stopAuto():startAuto();
$('#v4-tab-explanation').onclick=()=>setTab(false);
$('#v4-tab-reason').onclick=()=>setTab(true);
$('#v4-account').onclick=showAccount;
$('#v4-load').onclick=async()=>{if($('#v4-load').textContent.includes('Masuk')){await showAccount();return;}await loadEngine();};
$('#account-dialog').addEventListener('close',()=>{if(!modelReady&&sessionStorage.getItem('om-session'))loadEngine();});
document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>{
  if(!sendModel('mode',btn.dataset.view))return;
  markMode(btn.dataset.view);
});
document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>sendModel('control',btn.dataset.action));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAuto();});
renderComponents();updateSelected();renderSystems();renderStep();renderSpecs();renderFaults();
await loadEngine();
