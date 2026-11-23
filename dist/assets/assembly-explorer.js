(function(){
'use strict';
function initialize(){
  var root=document.getElementById('simroot'), api=window.__pp;
  if(!root||!api||!Array.isArray(api.parts)||api.parts.length===0)return false;
  if(root.dataset.assemblyExplorerMounted==='true')return true;
  // The public Shinko hero is an embedded landing-page visual, not a full workspace.
  if(new URLSearchParams(location.search).get('hero')==='1')return true;
  var stage=document.getElementById('stage'), center=root.querySelector('.center');
  var slider=document.getElementById('ex'), pinsButton=document.getElementById('bPins'),
      isoButton=document.getElementById('bIso'), matButton=document.getElementById('bMat');
  if(!center||!stage||!slider||!pinsButton||!isoButton)return false;
  root.dataset.assemblyExplorerMounted='true';

  function make(tag,cls,content){
    var el=document.createElement(tag);
    if(cls)el.className=cls;
    if(content!==undefined)el.textContent=content;
    return el;
  }
  function button(txt,fn,cl){
    var el=make('button',cl||'',txt);el.type='button';if(fn)el.addEventListener('click',fn);return el;
  }
  function pressed(el){return !!el&&el.getAttribute('aria-pressed')==='true';}
  function setPressed(el,want){if(el&&pressed(el)!==want)el.click();}
  function setExplode(fraction){
    var v=Math.max(0,Math.min(1,Number(fraction)||0));
    slider.value=String(v);
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    slider.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function selectInModel(p, row){
    if(!p)return false;
    var parts=api.parts;
    if(p.li&&typeof p.li.click==='function')p.li.click();
    if(row!==null&&row!==undefined){
      var index=(p.rows||[]).findIndex(function(r){return String(r[0])===String(row);});
      if(index>=0&&p.trows&&p.trows[index]&&typeof p.trows[index].click==='function'){
        p.trows[index].click();return true;
      }
    }
    return !!p.li;
  }
  var active=false,chosen=null,level=0,showPins=false,colorMode='engine',
      original=null,selectedRow=null,filter='',userWantedIsolation=true;
  var launch=button('◈  Eksplor Rakitan',function(){active?leave():enter();},'om-assembly-launch');
  launch.id='om-assembly-launch';
  launch.setAttribute('aria-expanded','false');
  var nativeModes=center.querySelector('.v4-view-modes');
  if(nativeModes)nativeModes.append(launch);
  else center.insertBefore(launch,stage);

  var control=make('section','om-assembly-control');
  control.id='om-assembly-control';control.hidden=true;
  control.setAttribute('aria-label','Eksplor rakitan bertingkat');
  var heading=make('div','om-assembly-head');
  var back=button('← Kembali ke mesin',leave,'om-assembly-back');
  var title=make('div','om-assembly-title');
  title.append(make('strong','', 'Eksplor Rakitan'));
  title.append(make('small','', 'Komponen → subkomponen → tingkat urai'));
  heading.append(back,title);
  var choose=make('div','om-assembly-choose');
  var assemblyLabel=make('label','', 'Rakitan');
  assemblyLabel.setAttribute('for','om-assembly-select');
  var picker=make('select','');picker.id='om-assembly-select';
  var parts=api.parts.filter(function(p){return p&&p.key&&Array.isArray(p.rows);});
  for(var i=0;i<parts.length;i++){
    var op=make('option','',String(parts[i].no||i+1)+'. '+String(parts[i].en||parts[i].idn||parts[i].key));
    op.value=parts[i].key;picker.append(op);
  }
  choose.append(assemblyLabel,picker);
  control.append(heading,choose);
  var desc=make('p','om-assembly-desc','Pilih rakitan untuk memeriksa komponennya. Tingkat 1 membuka komponen utama; tingkat 2 membuka bagian yang lebih kecil jika tersedia. Bukan urutan servis.');
  var chips=make('div','om-assembly-parts');
  chips.setAttribute('aria-label','Pilih subkomponen rakitan');
  var search=make('input','om-assembly-search');
  search.type='search';search.placeholder='Cari nomor atau nama subkomponen';
  search.setAttribute('aria-label','Cari subkomponen');
  control.append(desc,search,chips);

  var actions=make('section','om-assembly-actions');
  actions.id='om-assembly-actions';actions.hidden=true;
  actions.setAttribute('aria-label','Penguraian rakitan');
  var toolbar=make('div','om-assembly-toolbar');
  var prev=button('← Tingkat sebelumnya',function(){setLevel(level-1);},'om-assembly-quiet');
  var levelInfo=make('span','om-assembly-level','Rakitan utuh');
  var next=button('Urai tingkat ini →',function(){setLevel(level+1);},'om-assembly-primary');
  prev.id='om-assembly-prev';next.id='om-assembly-next';
  toolbar.append(prev,levelInfo,next);
  var bottom=make('div','om-assembly-bottom');
  var reassemble=button('↶ Pasang kembali',function(){setLevel(0);},'om-assembly-quiet');
  var showAll=button('▣ Lihat semua',function(){
    userWantedIsolation=false;
    setPressed(isoButton,false);syncState();
    setStatus('Seluruh rakitan ditampilkan. Pilih rakitan lagi untuk isolasi.');
  },'om-assembly-quiet');
  var scale=make('label','om-assembly-range-label','Jarak urai');
  var range=make('input','om-assembly-range');range.type='range';range.min='0';range.max='100';range.step='5';range.value='0';range.id='om-assembly-range';
  scale.append(range);
  bottom.append(reassemble,scale,showAll);
  var toggles=make('div','om-assembly-toggles');
  var togglePins=button('Tampilkan nomor',function(){showPins=!showPins;syncState();},'om-assembly-quiet');
  togglePins.id='om-assembly-pins';
  togglePins.setAttribute('aria-pressed','false');
  var colorBtn=button('Warna: Mesin',function(){
    colorMode=colorMode==='engine'?'material':'engine';syncState();
  },'om-assembly-quiet');
  colorBtn.id='om-assembly-color';
  var status=make('p','om-assembly-status','');status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  toggles.append(togglePins,colorBtn);
  var footnote=make('p','om-assembly-note','Warna mesin mengikuti skema cat dan material pada model yang tersedia; tidak otomatis menjadi bukti warna asli pabrikan.');
  actions.append(toolbar,bottom,toggles,status,footnote);
  center.insertBefore(control,stage);
  stage.after(actions);

  function setStatus(s){status.textContent=s;}
  function syncState(){
    setPressed(pinsButton,showPins);
    root.classList.toggle('om-assembly-numbers-hidden',!showPins);
    togglePins.textContent=showPins?'Sembunyikan nomor':'Tampilkan nomor';
    togglePins.setAttribute('aria-pressed',String(showPins));
    if(matButton)setPressed(matButton,colorMode==='material');
    colorBtn.textContent=colorMode==='engine'?'Warna: Mesin':'Warna: Material';
    colorBtn.setAttribute('aria-pressed',String(colorMode==='material'));
    if(userWantedIsolation&&chosen)setPressed(isoButton,true);
  }
  function renderChips(){
    chips.replaceChildren();
    if(!chosen)return;
    var rows=chosen.rows||[],q=search.value.toLowerCase().trim();
    var list=rows.filter(function(r){return !q||(String(r[0])+' '+String(r[1])).toLowerCase().includes(q);});
    var visible=0;
    list.forEach(function(r){
      var key=String(r[0]),name=String(r[1]||'Komponen');
      var hasMesh=(chosen.meshes||[]).some(function(m){return m.userData&&String(m.userData.no)===key;});
      var b=button(key+' · '+name,function(){
        selectedRow=key;
        selectInModel(chosen,key);
        if(typeof api.setOne==='function')api.setOne(chosen.key+':'+key);
        setExplode(Math.max(0.2,Number(slider.value)||0.2));
        if(typeof api.refresh==='function')api.refresh();
        syncChips();
        setStatus(hasMesh?'Komponen '+name+' dipilih dan disorot.':'Nomor '+key+' terdaftar; bentuk 3D terpisah belum terverifikasi.');
      },'om-assembly-chip');
      b.dataset.row=key;
      b.setAttribute('aria-pressed',String(selectedRow===key));
      if(!hasMesh)b.title='Komponen terdata, representasi 3D terpisah mungkin belum tersedia';
      chips.append(b);visible++;
    });
    if(!visible)chips.append(make('span','om-assembly-placeholder','Tidak ada komponen yang cocok.'));
  }
  function syncChips(){
    chips.querySelectorAll('button[data-row]').forEach(function(b){
      b.setAttribute('aria-pressed',String(b.dataset.row===selectedRow));
    });
  }
  function choosePart(key){
    var p=parts.find(function(x){return x.key===key;});
    if(!p)return;
    chosen=p;selectedRow=null;filter='';
    search.value='';picker.value=p.key;
    userWantedIsolation=true;
    selectInModel(p,null);
    setPressed(isoButton,true);
    if(typeof api.setOne==='function')api.setOne(null);
    setLevel(0);
    renderChips();
    setStatus('Rakitan '+(p.en||p.idn||p.key)+' dipilih. Tekan Urai tingkat ini untuk membuka susunan visual.');
  }
  function setLevel(n){
    level=Math.max(0,Math.min(2,Math.trunc(Number(n)||0)));
    if(typeof api.setExLvl==='function')api.setExLvl(level===0?2:(level===1?3:4));
    if(typeof api.setOne==='function')api.setOne(null);
    selectedRow=null;
    setExplode(level===0?0:0.86);
    range.value=level===0?'0':'86';
    levelInfo.textContent=level===0?'Rakitan utuh':'Terurai · tingkat '+level;
    prev.disabled=level===0;next.disabled=level===2;
    syncChips();syncState();
    setStatus(level===0?'Rakitan dalam posisi terpasang.':'Tingkat '+level+' menampilkan struktur visual berdasarkan data model; bukan urutan servis resmi.');
  }
  range.addEventListener('input',function(){
    setExplode(Number(range.value)/100);
    if(Number(range.value)>0&&level===0){
      level=1;
      if(typeof api.setExLvl==='function')api.setExLvl(3);
      levelInfo.textContent='Terurai · tingkat 1';
      prev.disabled=false;next.disabled=false;
    }
  });
  picker.addEventListener('change',function(){choosePart(picker.value);});
  search.addEventListener('input',renderChips);
  function enter(){
    if(active)return;
    active=true;
    original={pins:pressed(pinsButton),mat:pressed(matButton),iso:pressed(isoButton),explode:Number(slider.value)||0,lvl:typeof api.exState==='function'?api.exState().lvl:2};
    showPins=false;colorMode='engine';
    launch.setAttribute('aria-expanded','true');
    launch.textContent='◈ Tutup Rakitan';
    root.classList.add('om-assembly-mode');
    control.hidden=false;actions.hidden=false;
    var spin=document.getElementById('bSpin');if(pressed(spin))spin.click();
    var learn=document.getElementById('m-learn');if(learn)learn.click();
    choosePart(parts[0].key);syncState();
  }
  function leave(){
    if(!active)return;
    active=false;
    if(typeof api.setOne==='function')api.setOne(null);
    setExplode(original.explode);
    if(typeof api.setExLvl==='function')api.setExLvl(original.lvl||2);
    setPressed(isoButton,original.iso);
    setPressed(pinsButton,original.pins);
    if(matButton)setPressed(matButton,original.mat);
    root.classList.remove('om-assembly-mode','om-assembly-numbers-hidden');
    control.hidden=true;actions.hidden=true;
    launch.setAttribute('aria-expanded','false');launch.textContent='◈  Eksplor Rakitan';
    original=null;
  }
  // Names and color use the original source model; UI never recolors geometry.
}
if(initialize())return;
var tries=0;
var interval=setInterval(function(){
  tries++;
  if(initialize()||tries>=50)clearInterval(interval);
},160);
})();