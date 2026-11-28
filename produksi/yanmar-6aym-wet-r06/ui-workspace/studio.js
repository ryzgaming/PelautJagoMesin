import {createEngineSession} from '../runtime/engine-session.js';
import {presentation} from './presentation.js';

const $=id=>document.getElementById(id);
const stage=$('stage'), panel=$('panel'), panelBody=$('panel-body');
const previousViews=[];
let filter='', assemblyControls=null;
const audioSetting='yanmar-6aym-audio-muted';
let muted=false;
try { muted=window.localStorage?.getItem(audioSetting)==='true'; } catch {}
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const engine=createEngineSession({host:$('canvas'),muted,volume:Number($('audio-volume').value)/100});
const ws=engine.workspace;
const {state,entries,groups,driveViews,flowViews,initialView,spreadVectors,fluid,tourStages,
  componentEntry,componentName,componentGroup,scopeFor,scopeReady,scopeInspectable,assemblyRows,
  rowsInScope,rowProxy,shellCanReveal,flowDirectionKnown,activeEngineMode,applyPose,
  refreshHighlight,frame,focusDrive,updateClipPlane,updateFlowAppearance,
  resetPower:clearDriveClocks,beginTour,nextTour,finishTour,renderView}=ws;
let T,camera,controls,renderer,roots,data,stopDiagram;
function readBindings() {
  ({T,camera,controls,renderer,roots,data}=ws.context);
}
function toggleCutaway(scope) {
  ws.toggleCutaway(scope);
  $('cutaway')?.setAttribute('aria-pressed',String(state.cutaway));
  updateNav();
}
const driveCategories={timing:'Roda gigi timing',starter:'Starter',alternator:'Alternator dan sabuk',
  freshwater:'Pompa air tawar',seawater:'Pompa air laut',lubrication:'Pelumasan',fuel:'Bahan bakar',turbo:'Turbocharger'};
const labels = {
  BLOCK:'Blok silinder', HEADS:'Kepala silinder', OILPAN:'Bak oli', FLYWHEEL:'Roda gila',
  FRONT:'Ujung peredam', INTAKE:'Pemasukan udara', EXHAUST:'Gas buang', FUEL:'Bahan bakar',
  COOLING:'Pendinginan', LUBE:'Pelumasan', ELECTRIC:'Kelistrikan', CRANK:'Poros engkol',
  MAIN:'Bantalan utama', PISTON:'Piston dan ring', ROD:'Batang penghubung', LINER:'Liner silinder',
  CAM:'Poros nok', VALVE:'Mekanisme katup', FUELINJ:'Injektor', TIMING:'Roda gigi timing',
  OILPUMP:'Pompa oli', AIRCOOLER:'Intercooler', INJECTION:'Pompa injeksi',
  'COOLANT-PUMP':'Pompa air tawar','SEAWATER-PUMP':'Pompa air laut'
};
const systemLabels = {
  fuel:'Bahan bakar', lubrication:'Pelumasan', freshwater:'Air tawar', seawater:'Air laut',
  'intake-exhaust':'Udara dan gas buang', 'air-exhaust':'Udara dan gas buang', air_exhaust:'Udara dan gas buang'
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, handler, pressed) {
  const node = element('button', text);
  node.type = 'button';
  node.addEventListener('click', handler);
  if (pressed !== undefined) node.setAttribute('aria-pressed', String(pressed));
  return node;
}
function groupName(id) {
  return labels[id.replace(/^RAK-(?:INT-)?/, '')] || data?.assemblies[id]?.name || id;
}
function setPanel(title, render) {
  $('panel-title').textContent = title;
  panelBody.replaceChildren();
  render(panelBody);
  panel.hidden = false;
  $('parts').setAttribute('aria-expanded', String(state.mode === 'parts'));
}
function closePanel() {
  panel.hidden = true;
  $('parts').setAttribute('aria-expanded','false');
}
function figureRefs(line) {
  return (String(line).includes('D05') ? String(line).match(/\bfig(?:ure)?\.?\s*(\d{1,3})\b/i)?.[1] : null) ||
    String(line).match(/\bD05-(\d{1,3})\b/)?.[1];
}
function sourceLinks(parent, refs = [], partReference = false) {
  if (!Array.isArray(refs)) refs = [refs];
  const list = element('ul', undefined, 'registry');
  let catalogLinked = false;
  for (const ref of refs) {
    if (!ref) continue;
    const line = typeof ref === 'string' ? ref : ref.locator || ref.id || JSON.stringify(ref);
    const item = element('li', line);
    const figure = figureRefs(line);
    const source = (figure && data.sources.find(({id})=>id==='D05-'+figure)) ||
      data.sources.find(({id}) => line.startsWith(id) || line.includes(' '+id));
    const exactURL = figure && data.figureSources?.[figure];
    const url = exactURL || source?.url;
    if (url) {
      if (exactURL || source?.id.startsWith('D05')) catalogLinked = true;
      const link = element('a', 'Buka sumber');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(document.createTextNode(' · '), link);
    }
    list.append(item);
  }
  if (partReference && !catalogLinked) {
    const url = data.sources.find(({id})=>id==='D05')?.url;
    if (url) {
      const item = element('li');
      const link = element('a','Katalog umum 6AYM-WET');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      list.append(item);
    }
  }
  if (list.children.length) parent.append(list);
}
function showParts() {
  setPanel('Komponen', (body) => {
    const byGroup = new Map();
    for (const entry of entries.values()) {
      const group = componentGroup(entry);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push(entry);
    }
    const field = element('input');
    field.id = 'part-filter';
    field.type = 'search';
    field.value = filter;
    field.placeholder = 'Contoh: fitting, pipa, EXT-FUEL';
    const label = element('label','Cari nama atau ID komponen');
    label.htmlFor = field.id;
    const search = element('div',undefined,'parts-search');
    search.append(label,field);
    const results = element('div',undefined,'parts-results');
    body.append(search,results);
    const render = () => {
      const query = filter.toLocaleLowerCase('id-ID').trim();
      const exact = componentEntry(query.toUpperCase());
      results.replaceChildren();
      for (const [key, parts] of byGroup) {
        const visible = parts.filter(entry=>exact ? entry === exact :
          !query || (componentName(entry)+' '+entry.id+' '+groupName(key)).toLocaleLowerCase('id-ID').includes(query));
        if (!visible.length) continue;
        const section = element('details');
        section.open = Boolean(query) || visible.some(({id}) => id === state.selected);
        section.append(element('summary', groupName(key) + ' · ' + visible.length));
        const list = element('div', undefined, 'group-items');
        for (const entry of visible) {
          const action = button(componentName(entry), () => select(entry.id), entry.id === state.selected);
          action.append(element('small',entry.id));
          list.append(action);
        }
        section.append(list);
        results.append(section);
      }
      if (!results.children.length) results.append(element('p', entries.size ?
        'Tidak ada komponen yang cocok.' : 'Inventaris model belum tersedia.'));
    };
    field.addEventListener('input',()=>{ filter = field.value; render(); });
    render();
  });
}
function appendNotes(parent, notes) {
  for (const note of [].concat(notes || [])) {
    const text = typeof note === 'string' ? note : note?.text || note?.summary || note?.note;
    if (text) parent.append(element('p',text));
  }
}
function appendCoverage(parent, entry) {
  const scope = scopeFor(entry);
  const object = data.coverage?.by_object?.[entry.id];
  const coverage = object || data.coverage?.by_assembly?.[componentGroup(entry)] ||
    data.coverage?.by_assembly?.[componentGroup(entry).replace(/^RAK-INT-/,'INT-')];
  if (entry.xray_shell && !shellCanReveal(entry)) {
    parent.append(element('p',scope
      ? 'Model isi belum tersedia pada tampilan ini.'
      : 'Isi rakitan belum tersedia pada tampilan ini. Rumah tetap terlihat buram saat X-ray aktif.', 'coverage-note'));
  }
  if (!scope && coverage) {
    const details = element('details',undefined,'details');
    details.append(element('summary','Cakupan bukti'+(coverage.status ? ' · '+coverage.status : '')));
    appendNotes(details, coverage.summary);
    appendNotes(details, coverage.open);
    sourceLinks(details,coverage.source_refs);
    parent.append(details);
  }
}
function partFunction(entry, recipe) {
  const text = entry.function || entry.fungsi ||
    recipe?.parts?.find(({id})=>id===entry.id)?.function ||
    scopeFor(entry)?.parts?.find(({id})=>id===entry.id)?.function;
  return text === componentName(entry) ? undefined : text;
}
function scopeLabel(scope) {
  return (scopeReady(scope) ? 'Lihat isi ' : 'Lihat bagian ')+scope.content_name;
}
function openContents(entry) {
  const scope = scopeFor(entry);
  if (!scopeInspectable(scope)) return;
  const reveal = scopeReady(scope);
  if (reveal) state.xray = true;
  openDiagram(entry, scope.id, {spread:!reveal});
}
function contentButton(entry) {
  const scope = scopeFor(entry);
  if (!scopeInspectable(scope) || state.assemblyGroup === scope.id) return null;
  return button(scopeLabel(scope), () => openContents(entry));
}
function updateContentsTool() {
  const tool = $('inspect-contents');
  const scope = scopeFor(entries.get(state.selected));
  tool.hidden = state.mode !== 'assembly' || !scopeInspectable(scope) || state.assemblyGroup === scope.id;
  if (!tool.hidden) {
    tool.textContent = scopeReady(scope) ? 'Isi rakitan' : 'Bagian rakitan';
    tool.setAttribute('aria-label',scopeLabel(scope));
  }
}
function appendInspectionLinks(parent, entry) {
  const targets = data.inspectionLinks?.[componentGroup(entry)] ||
    data.inspectionLinks?.[scopeFor(entry)?.parent] || [];
  const valid = targets.filter(id=>groups.has(id) && assemblyRows(id,entry).length);
  if (!valid.length) return;
  const list = element('details',undefined,'evidence');
  list.append(element('summary','Mekanisme terkait'));
  const actions = element('div',undefined,'actions');
  for (const id of valid) actions.append(button(groupName(id),()=>openDiagram(entry,id)));
  list.append(actions);
  parent.append(list);
}
function appendInjectorPlates(parent, entry) {
  if (scopeFor(entry)?.parent !== 'RAK-INT-FUELINJ') return;
  const inline = $('embedded-injector-plates');
  if (!inline) {
    const link = element('a','Diagram injektor berlabel');
    link.href = '../agensi/referensi/viewer/injector-plates/injector-legend.html';
    parent.append(link);
    return;
  }
  const assets = JSON.parse(inline.textContent);
  const plates = element('details',undefined,'injector-plates');
  plates.append(element('summary','Diagram injektor berlabel'));
  for (const [name,alt] of [['section','Potongan injektor mekanis berlabel'],
    ['exploded','Tampak urai injektor mekanis berlabel']]) {
    const image = element('img');
    image.src = assets[name];
    image.alt = alt;
    image.loading = 'lazy';
    plates.append(image);
  }
  const pdf = element('a','Unduh diagram dan daftar fungsi (PDF)');
  pdf.href = assets.pdf;
  pdf.download = 'diagram-injektor-6aym-wet.pdf';
  plates.append(pdf);
  parent.append(plates);
}
function appendFunctionalProfile(body,entry) {
  const registry=data?.functionRegistry;
  const row=registry?.components?.[entry.id];
  const profile=registry?.profiles?.[row?.profile];
  if (!profile) return;
  const details=element('details',undefined,'details');
  details.append(element('summary','Cara kerja · '+(profile.label || row.category || row.profile)));
  appendNotes(details,profile.function);
  for (const [key,label] of [['off','Mesin mati'],['starting','Mulai'],['running','Berjalan'],['stopping','Stop']]) {
    if (profile[key]) details.append(element('p',label+' · '+profile[key]));
  }
  if (profile.status) details.append(element('small',profile.status));
  appendNotes(details,row.limits);
  sourceLinks(details,(row.source_refs || []).map(ref=>Number.isInteger(ref) ? registry.source_refs?.[ref] : ref));
  body.append(details);
}
function renderComponent(entry) {
  setPanel(componentName(entry), (body) => {
    const actions = element('div', undefined, 'actions');
    const contents = contentButton(entry);
    if (contents) actions.append(contents);
    const functionRow=data.functionRegistry?.components?.[entry.id];
    const drive=driveViews.get(functionRow?.controller);
    if (drive) actions.append(button('Lihat saat bekerja',()=>{
      changeMode('drives');
      selectDrive(drive.spec.id);
    }));
    const route=flowViews.get(functionRow?.route_ids?.[0])?.route;
    if (route) actions.append(button('Sorot aliran',()=>{
      changeMode('operation');
      pickFlow(route.system);
      state.route=route.id;
      updateFlowAppearance();
      updateOperationDock();
    }));
    actions.append(button('Daftar komponen', () => changeMode('parts')));
    if (entry.object) actions.append(button(state.isolated ? 'Tampilkan semua' : 'Isolasi', () => {
      state.isolated = !state.isolated;
      applyPose();
      frame();
      renderComponent(entry);
    }, state.isolated));
    const scope = scopeFor(entry);
    const group = scope?.anchor === entry.id ? scope.parent : componentGroup(entry);
    const parts = assemblyRows(group, entry);
    if (entry.object && (parts.length > 1 || (parts.length && scope?.anchor === entry.id))) {
      actions.append(button('Eksplor rakitan', () => openDiagram(entry,group)));
    }
    body.append(element('span', (entry.status || 'UNVERIFIED').toString() + ' · ' + entry.id, 'status'),actions);
    appendNotes(body,partFunction(entry,data.assemblies[componentGroup(entry)]));
    appendNotes(body,entry.notes || entry.catatan || entry.note);
    const partNumbers = [].concat(entry.part_number || entry.nomor_oem || []).filter(Boolean);
    if (partNumbers.length) body.append(element('p', 'Nomor katalog ' + partNumbers.join(', ')));
    body.append(element('small','Jumlah pada model '+(entry.quantity || entry.count || entry.jumlah || 1)));
    appendCoverage(body,entry);
    appendFunctionalProfile(body,entry);
    appendInspectionLinks(body,entry);
    appendInjectorPlates(body,entry);
    sourceLinks(body, entry.source_refs || entry.sumber,true);
  });
}
function showAssemblySelection(entry) {
  if (!entry) return;
  const selectedRow = rowProxy(entry,state.assemblyGroup);
  for (const [key, control] of assemblyControls) control.setAttribute('aria-pressed', String(key === selectedRow));
  const detail = $('assembly-detail');
  detail.replaceChildren(element('h3', componentName(entry)), element('p', (entry.status || 'UNVERIFIED')+' · '+entry.id));
  const action = contentButton(entry);
  if (action) detail.append(action);
  appendNotes(detail,partFunction(entry,data.assemblies[state.assemblyGroup]));
  appendCoverage(detail,entry);
  appendFunctionalProfile(detail,entry);
  appendInspectionLinks(detail,entry);
  appendInjectorPlates(detail,entry);
  updateContentsTool();
  const number = [].concat(entry.part_number || entry.nomor_oem || []).filter(Boolean);
  if (number.length) detail.append(element('small','Nomor katalog '+number.join(', ')));
  const evidence = element('details',undefined,'evidence');
  evidence.append(element('summary','Catatan dan sumber komponen'));
  appendNotes(evidence,entry.notes || entry.catatan || entry.note);
  sourceLinks(evidence,entry.source_refs || entry.sumber,true);
  if (evidence.children.length > 1) detail.append(evidence);
}
function select(id) {
  return engine.select(id);
}
function renderSelection(id) {
  const entry=componentEntry(id);
  if (!entry) return;
  if (state.mode==='assembly') showAssemblySelection(entry);
  else changeMode('component');
}
function openDiagram(entry, id = componentGroup(entry), options = {}) {
  const group = groups.get(id)?.object;
  const components = assemblyRows(id,entry);
  if (!group || !components.length) return;
  if (options.remember !== false) previousViews.push({
    mode:state.mode, selected:state.selected, isolated:state.isolated, group:state.assemblyGroup,
    spread:state.assemblySpread, cutaway:state.cutaway,
    cutawayNormal:state.cutawayNormal?.clone(), position:camera.position.clone(), target:controls.target.clone(),
    aspect:camera.aspect
  });
  leaveDiagram();
  state.mode = 'assembly';
  clearDriveClocks();
  state.assemblyGroup = id;
  assemblyControls = new Map();
  state.assemblySpread = options.spread !== false;
  state.cutaway = Boolean(options.cutaway && state.xray);
  state.cutawayNormal = options.cutawayNormal || null;
  const membersByRow = new Map(components.map(part=>[part.id,rowsInScope(part,id)]));
  state.assemblyParts = new Set(Array.from(membersByRow.values()).flat().map(part=>part.id));
  applyPose();
  const authored = data.assemblies[id] || {};
  const sheetHost = element('div',undefined,'diagram-host');
  const actions = element('div',undefined,'actions');
  setPanel('Eksplor rakitan', body => {
    const toolbar = element('div',undefined,'assembly-toolbar');
    actions.append(button('Kembali', restoreDiagram));
    const activeScope = scopeFor(entries.get(authored.anchor));
    if (activeScope?.id === id && scopeReady(activeScope)) {
      const cut = button('Potongan rumah',()=>toggleCutaway(activeScope),state.cutaway);
      cut.id = 'cutaway';
      actions.append(cut);
    }
    toolbar.append(actions);
    const detail = element('section', undefined, 'details');
    detail.id = 'assembly-detail';
    toolbar.append(detail);
    body.append(toolbar);
    if (authored.parent) {
      const context = element('details',undefined,'details');
      context.append(element('summary','Cakupan model'+(authored.status ? ' · '+authored.status : '')));
      const instructions = scopeReady(activeScope)
        ? 'Potongan rumah memperlihatkan satu sisi rumah. X-ray membuat rumah transparan. Gunakan Uraikan untuk memisahkan bagian.'
        : 'Gunakan Uraikan untuk memisahkan bagian yang tersedia.';
      context.append(element('p',instructions));
      appendNotes(context,authored.notes);
      sourceLinks(context,authored.source_refs);
      body.append(context);
    }
    body.append(sheetHost);
  });
  const boxes = components.map(({object}) => new T.Box3().setFromObject(object));
  const order = components.map((part, index) => ({part,index,center:boxes[index].getCenter(new T.Vector3())}));
  const vector = new T.Vector3(...(spreadVectors[id.replace(/^RAK-(?:INT-)?/,'')] || [1,0,0]));
  const direction = vector.lengthSq() ? vector.normalize() : new T.Vector3(1,0,0);
  order.sort((a,b) => a.center.dot(direction)-b.center.dot(direction));
  const offsets = new Map(order.map(({part}, index) => {
    const item = authored.parts?.find(row => row.id === part.id);
    const offset = item?.offset_m;
    const magnitude = Math.min(.065, .4 / components.length);
    return [part.id, Array.isArray(offset) ? new T.Vector3(...offset) :
      direction.clone().multiplyScalar((index-(order.length-1)/2)*magnitude)];
  }));
  const meshes = [];
  const rows = [];
  const trows = [];
  for (const part of components) {
    const key = part.id;
    const number = [].concat(part.part_number || part.nomor_oem || []).filter(Boolean).join(', ');
    rows.push([key, componentName(part), part.quantity || part.count || part.jumlah || 1, number,
      partFunction(part,authored)]);
    const control = button(componentName(part), () => select(key), state.selected === key);
    assemblyControls.set(key, control);
    trows.push(control);
    for (const member of membersByRow.get(key)) member.object.traverse(mesh => {
      if (!mesh.isMesh || mesh.userData.component !== member.id) return;
      const inverseRotation = mesh.parent.getWorldQuaternion(new T.Quaternion()).invert();
      mesh.userData.no = key;
      mesh.userData.ws = mesh.position.clone();
      mesh.userData.ev = offsets.get(key).clone().applyQuaternion(inverseRotation);
      mesh.userData.authoredOffset = Array.isArray(authored.parts?.find(row=>row.id===key)?.offset_m);
      meshes.push(mesh);
    });
  }
  const part = {group,rows,meshes,trows,idn:groupName(id)};
  const model = {camera, axis:'x', cfg:{nosLabel:'No. katalog'}, initialSpread:state.assemblySpread, toggleHost:actions,
    onPose:(spread,changed)=> {
      state.assemblySpread = spread;
      refreshHighlight();
      updateClipPlane();
      if (changed) frame();
    },
    rowStatus:(_part,row) => ({jumlah:'ilustrasi', nomor:row[3] ? 'katalog' : 'model', identifier:row[3]})};
  state.diagramActive=true;
  stopDiagram = window.openAssemblyDiagram(model, part, stage, sheetHost);
  select(state.assemblyParts.has(entry.id) ? entry.id : components[0].id);
  if (options.reposition !== false) {
    if (authored.view?.some(Boolean)) {
      const view = new T.Vector3(...authored.view).normalize();
      if (Math.abs(view.y) > .95) view.x = .24;
      camera.position.copy(controls.target).add(view);
    }
    requestAnimationFrame(() => { if (state.assemblyGroup === id) frame(); });
  }
  updateNav();
}
function leaveDiagram() {
  if (!stopDiagram) return;
  stopDiagram();
  stopDiagram = null;
  state.diagramActive=false;
  assemblyControls = null;
  state.assemblyGroup = null;
  state.assemblyParts = null;
  state.cutaway = false;
  state.cutawayNormal = null;
}
function restoreDiagram() {
  const view = previousViews.pop();
  leaveDiagram();
  if (!view) return;
  state.selected = view.selected;
  state.isolated = view.isolated;
  if (view.mode === 'assembly') openDiagram(entries.get(view.selected),view.group,{
    remember:false,spread:view.spread,reposition:false,cutaway:view.cutaway,cutawayNormal:view.cutawayNormal
  });
  else changeMode(view.mode);
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  controls.update();
  if (Math.abs(camera.aspect/view.aspect-1) > .04) frame();
}
const phaseLabels = {off:'Mesin mati',engaging:'Pinion masuk',cranking:'Starter memutar',firing:'Pembakaran mulai',running:'Mesin hidup',stopping:'Mesin melambat'};
function updateAudioControls() {
  const toggle=$('audio-toggle');
  toggle.textContent=muted ? 'Suara' : 'Suara aktif';
  toggle.setAttribute('aria-pressed',String(!muted));
  toggle.title=muted ? 'Aktifkan suara ilustrasi' : 'Matikan suara ilustrasi. Volume tersedia di Opsi.';
  $('audio-field').hidden=muted;
}
function routeList() {
  return data?.flows?.routes?.filter(route=>route.system===state.flow) || [];
}
function unsetDetailFilter() {
  state.route = null;
  updateFlowAppearance();
}
function pickFlow(key) {
  engine.setFlow(key);
}
function systemFlow(key) {
  return key === 'intake-exhaust' ? (['intake','exhaust'].includes(state.flow) ? state.flow : 'intake') : key;
}
function routeEvidence(body) {
  const figure = routeList();
  if (state.flow === 'none') return;
  if (!figure.length) {
    body.append(element('p','Rute 3D untuk aliran ini belum tersedia.'));
    return;
  }
  body.append(element('h3','Rute pada model'));
  if (state.flow==='freshwater') body.append(element('p','Saat dingin, pompa mensirkulasikan air melalui bypass. Saat termostat membuka dalam simulasi pemanasan, aliran menuju penukar panas. Bypass digunakan sebagai skema arah.'));
  const ports = new Map((data.flows?.ports || []).map(port=>[port.id,port.name || port.id]));
  const container = element('div',undefined,'flow-detail');
  container.append(button('Tampilkan seluruh rute',()=>{
    unsetDetailFilter();
    return state.mode === 'systems' ? showSystems() : showOperation();
  },!state.route));
  for (const route of figure) {
    const card = element('details',undefined,'details');
    card.open = state.route === route.id;
    card.append(element('summary',route.name || route.id));
    card.append(element('small',(route.kind === 'physical' ? 'Jalur model' : 'Skematis')+
      ' · Geometri '+(route.geometry_status || 'UNVERIFIED')+' · Arah '+(route.direction_status || 'UNKNOWN')));
    const labels = [ports.get(route.from) || route.from,ports.get(route.to) || route.to];
    if (labels.every(Boolean)) card.append(element('p',labels.join(flowDirectionKnown(route) ? ' → ' : ' · ')));
    const action = button('Sorot rute',()=>{
      state.route = route.id;
      updateFlowAppearance();
      updateOperationDock();
      return state.mode === 'systems' ? showSystems() : showOperation();
    },state.route===route.id);
    card.append(action);
    appendNotes(card,route.note || route.condition);
    sourceLinks(card,route.source_refs);
    container.append(card);
  }
  body.append(container);
}
function appendFlowGaps(body) {
  const gaps=data.flows?.gaps;
  if (!gaps?.length) return;
  const details=element('details',undefined,'details');
  details.append(element('summary','Batas pemetaan'));
  for (const gap of gaps) {
    appendNotes(details,gap);
    if (gap?.source_refs) sourceLinks(details,gap.source_refs);
  }
  body.append(details);
}
function showSystems() {
  setPanel('Sistem', body => {
    const tabs = element('div', undefined, 'tabs');
    tabs.setAttribute('aria-label','Pilih sistem');
    for (const graph of data.systems) tabs.append(button(systemLabels[graph.system] || graph.system,
      () => { state.system = graph.system; pickFlow(systemFlow(graph.system)); showSystems(); }, state.system === graph.system));
    body.append(tabs);
    const graph = data.systems.find(({system}) => system === state.system);
    if (!graph) { body.append(element('p', 'Data sistem belum tersedia.')); return; }
    body.append(element('span', graph.status, 'status'), element('p', graph.applicability));
    routeEvidence(body);
    appendFlowGaps(body);
    const names = new Map(graph.nodes.map(node => [node.id, node.name || node.label || node.id]));
    const list = element('ol', undefined, 'system-edges');
    for (const edge of graph.edges) {
      const item = element('li');
      const known = ['DOCUMENTED','OBSERVED','INFERRED'].includes(edge.status);
      const separator = known ? ' → ' : ' · ';
      item.append(element('h3', (names.get(edge.from) || edge.from) + separator + (names.get(edge.to) || edge.to)),
        element('span', edge.status || 'UNKNOWN', 'status'));
      if (edge.purpose) item.append(element('p', edge.purpose));
      if (edge.operating_condition) item.append(element('small', edge.operating_condition));
      const detail = element('details');
      detail.append(element('summary','Rujukan hubungan'));
      sourceLinks(detail, edge.source_refs);
      item.append(detail);
      list.append(item);
    }
    body.append(list);
    if (graph.gaps?.length) {
      const details = element('details');
      details.append(element('summary','Batas verifikasi'));
      for (const gap of graph.gaps) details.append(element('p', gap));
      body.append(details);
    }
  });
}
function filmLink(parent) {
  const url=presentation.film;
  if (!url || !['http:','https:'].includes(window.location?.protocol)) return;
  const view = element('a','Tonton film operasi r06');
  view.href = url;
  view.className = 'film-link';
  parent.append(view);
}
function reviewLink(parent) {
  if (!presentation.revisionReview || !['http:','https:'].includes(window.location?.protocol)) return;
  const link=element('a','Bandingkan starting r05–r06');
  link.href=presentation.revisionReview;
  link.className='film-link';
  parent.append(link);
}
function comparisonLink(parent) {
  if (!presentation.filterComparison || !['http:','https:'].includes(window.location?.protocol)) return;
  const link=element('a','Bandingkan area filter dengan foto');
  link.href=presentation.filterComparison;
  link.className='film-link';
  parent.append(link);
}
function driveAuditLink(parent) {
  if (!presentation.driveAudit || !['http:','https:'].includes(window.location?.protocol)) return;
  const link=element('a','Baca ringkasan audit gerak');
  link.href=presentation.driveAudit;
  link.className='film-link';
  parent.append(link);
}
function showOperation() {
  setPanel('Rute dan pengoperasian', body => {
    body.append(element('p','Tekan Mulai untuk menjalankan urutan pengaitan starter, putaran, pembakaran, dan idle. Ketuk Suara untuk membisukan atau menyalakan kembali.'),
      element('p','Gerak poros dan partikel diperlambat. Suara sintetis mengikuti RPM simulasi, sementara sudut engkol ditampilkan dalam gerak lambat.'),
      element('p','Putaran cranking 220 rpm dan idle 650 rpm adalah setelan peragaan.'),
      element('p','Garis utuh mengikuti pipa yang dimodelkan. Garis putus-putus menunjukkan bagian skematis. Penanda bergerak mengikuti arah jalur yang tersedia.'),
      element('p','Pulsa per silinder mengikuti urutan 1–4–2–6–3–5. Pada Potongan blok, proyeksi nyala menandai ruang bakar. Bentuk semprotan bersifat ilustratif.'),
      element('p','Manual mencatat awal suplai pompa 16° sebelum TMA. Jeda hidraulik, durasi semprotan dan waktu tempuh penanda diperagakan.'));
    if (driveViews.size) body.append(button('Lihat penggerak',()=>changeMode('drives')));
    if (driveViews.has('starter-pinion')) body.append(button('Fokus starter',showStarter));
    routeEvidence(body);
    appendFlowGaps(body);
    filmLink(body);
    reviewLink(body);
    comparisonLink(body);
    sourceLinks(body, ['D02 · Operation Manual','D03 · H-rating']);
  });
  updateOperationDock();
}
function updateOperationDock() {
  if (!data) return;
  $('operation-controls').hidden = !activeEngineMode();
  if (!activeEngineMode()) return;
  const onDrives=state.mode==='drives';
  const tour = state.tour && tourStages[state.tour.index];
  $('drive-controls').hidden=!onDrives;
  $('tour-controls').hidden=onDrives;
  $('drive-field').hidden=!onDrives;
  $('flow-field').hidden=onDrives;
  const running = $('operation-toggle');
  running.disabled = !engine.snapshot().ready;
  running.textContent = state.running ? 'Jeda' : state.enginePhase==='off' && !tour ? 'Mulai' : 'Lanjut';
  $('operation-stop').disabled=running.disabled || (state.enginePhase==='off' && !tour);
  running.setAttribute('aria-pressed',String(state.running));
  $('operation-info').textContent=onDrives ? 'Rincian' : 'Rute';
  $('operation-info').setAttribute('aria-expanded',String(!panel.hidden));
  const cut = $('flow-cut');
  const chamber=$('chamber-focus');
  chamber.hidden=onDrives || !state.flowCut || Boolean(tour);
  chamber.textContent=state.combustionFocus ? 'Seluruh potongan' : 'Fokus ruang bakar';
  chamber.setAttribute('aria-pressed',String(state.combustionFocus));
  cut.hidden = onDrives || !renderer || !roots?.[0] || Boolean(tour);
  cut.setAttribute('aria-pressed',String(state.flowCut));
  const status = $('operation-status');
  const clock=phaseLabels[state.enginePhase];
  status.textContent=tour
    ? tour.title+' · '+(state.running ? (tour.operate ? clock : 'Mesin berhenti') : 'Jeda')
    : (state.running || state.enginePhase==='off' ? '' : 'Jeda · ')+clock;
  $('flow-select').value = state.flow;
  $('flow-select').disabled = Boolean(tour);
  $('operation-tour').hidden = state.mode !== 'operation';
  $('operation-tour').textContent = tour ? 'Keluar tur' : 'Tur animasi';
  $('drive-entry').hidden = state.mode !== 'operation' || Boolean(tour) || !driveViews.size;
  $('starter-entry').hidden=state.mode!=='operation' || Boolean(tour) || !driveViews.has('starter-pinion');
  $('tour-next').hidden = !tour;
  $('tour-next').textContent = state.tour?.index === tourStages.length-1 ? 'Selesai' : 'Lewati';
  $('drive-select').value=state.driveId || '';
  $('drive-select').disabled=!driveViews.size;
  $('drive-focus').disabled=!driveViews.has(state.driveId);
  $('drive-starter').hidden=![...driveViews.values()].some(({spec})=>spec.mode==='starting');
  $('drive-starter').textContent='Starter';
  const theme = fluid[state.flow];
  const key = $('flow-key');
  key.textContent = onDrives ? 'Gerak diperlambat' :
    theme ? theme.label+' · '+(state.route ? 'Rute terpilih' :
    routeList().length ? (state.xray ? 'utuh = pipa · putus = skema' : 'pipa terpilih · X-ray untuk skema') : 'Rute 3D belum tersedia') :
    tour?.fire ? 'Cahaya jingga · pembakaran ilustratif' : '';
  if (state.flowCut) key.textContent=state.combustionFocus ? 'Ruang bakar · potongan blok' : 'Potongan blok · proyeksi nyala';
  if (!onDrives && !tour) key.textContent=(key.textContent ? key.textContent+' · ' : '')+'Gerak diperlambat';
  key.style.setProperty('--flow-color',onDrives ? '#79ead0' : theme ? '#'+theme.color.toString(16).padStart(6,'0') : '#ff9d52');
}
function showSources() {
  setPanel('Sumber dan batas model', body => {
    body.append(element('p','Varian H 555 kW pada 1.840 rpm dipilih sebagai konfigurasi rujukan. Cakupan mencakup peralatan yang terpasang pada mesin.'),
      element('h3','Ukuran katalog nominal'),
      element('p','2,000 × 1,305 × 1,431 m (panjang × lebar × tinggi). D03, halaman PDF 17.'),
      element('h3','Ekstrem proyeksi gambar teknik'));
    const ext = data.extrema;
    if (ext?.length === 3) {
      const values = ext.map(value => Number(value).toLocaleString('id-ID',{minimumFractionDigits:3,maximumFractionDigits:3}));
      body.append(element('p', values.join(' × ') + ' m (panjang × lebar × tinggi). Estimasi tepi-ke-tepi pada gambar D03. Tepi komponen mengikuti datum gambar dan batas pandang.'));
    }
    body.append(element('p','Rekonstruksi pembelajaran independen. Afiliasi dengan Yanmar tidak ada.'));
    if (['http:','https:'].includes(window.location?.protocol)) {
      const catalogue = element('a','Telusuri daftar suku cadang Yanmar');
      catalogue.href = './suku-cadang.html';
      body.append(catalogue);
    }
    reviewLink(body);
    comparisonLink(body);
    driveAuditLink(body);
    const registered = element('ul',undefined,'registry');
    for (const source of data.sources) {
      const li = element('li');
      const link = element('a', source.id + ' · ' + source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.append(link);
      if (source.status) li.append(element('small', source.status));
      registered.append(li);
    }
    body.append(registered);
    appendFunctionSources(body);
  });
}
function appendFunctionSources(parent,ids) {
  const sources=(data?.functionSources || []).filter(source=>!ids || ids.includes(source.id));
  if (!sources.length) return;
  const details=element('details',undefined,'details');
  details.open=Boolean(ids);
  details.append(element('summary','Video dan manual cara kerja'));
  const list=element('ul',undefined,'registry');
  for (const source of sources) {
    const item=element('li');
    const link=element('a',source.title);
    link.href=source.url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    item.append(link,element('small',[source.scope,source.limitations].filter(Boolean).join(' · ')));
    list.append(item);
  }
  details.append(list);
  parent.append(details);
}
function updateNav() {
  for (const node of document.querySelectorAll('[data-mode]')) node.setAttribute('aria-pressed',
    String(node.dataset.mode === state.mode || (node.dataset.mode==='operation' && state.mode==='drives')));
  $('xray').setAttribute('aria-pressed',String(state.xray));
  $('spread-box').hidden = state.mode !== 'overview';
  document.body.classList.toggle('overview-open',state.mode === 'overview');
  updateContentsTool();
  updateOperationDock();
}
function changeMode(mode) {
  if (!data) return;
  leaveDiagram();
  previousViews.length = 0;
  if (state.tour && mode !== 'operation') finishTour();
  if (mode!=='drives' && engine.snapshot().capPressure!==null) engine.setCapTest(null);
  state.combustionFocus=false;
  state.mode = mode;
  $('operation-options').open=false;
  if (!engineModes.includes(mode)) {
    state.flowCut=false;
    clearDriveClocks();
  }
  if (mode==='drives') {
    state.xray=true;
    state.flowCut=false;
  }
  if (mode === 'systems') state.flow = systemFlow(state.system);
  state.route = null;
  if (['home','overview',...engineModes].includes(mode)) {
    state.poseOverview = mode === 'overview';
    state.selected = null;
    state.isolated = false;
  }
  updateNav();
  if (mode === 'parts') showParts();
  else if (mode === 'systems') showSystems();
  else if (mode === 'operation' || mode==='drives') closePanel();
  else if (mode === 'component') renderComponent(entries.get(state.selected));
  else if (mode === 'sources') showSources();
  else closePanel();
  applyPose();
  updateOperationDock();
  if (['home','overview',...engineModes].includes(mode)) renderView();
}

function showStarter() {
  if (!driveViews.has('starter-pinion')) return;
  if (state.mode!=='drives') changeMode('drives');
  selectDrive('starter-pinion');
}
function selectDrive(id) {
  if (engine.selectDrive(id) && !panel.hidden) showDriveDetails();
}
function showDriveDetails() {
  setPanel('Mekanisme penggerak',body=>{
    driveAuditLink(body);
    const view=driveViews.get(state.driveId);
    if (!view) {
      body.append(element('p','Data gerak penggerak belum tersedia pada model ini.'));
      filmLink(body);
      return;
    }
    const {spec}=view;
    body.append(element('h3',spec.label || spec.id),
      element('p',spec.status || 'UNVERIFIED','status'));
    appendNotes(body,spec.note || spec.notes);
    if (view.covers.size) body.append(element('p','X-ray memperlihatkan bagian bergerak di balik rumah yang terkait.'));
    if (spec.id.startsWith('cap-') && engine.snapshot().capTestSupported) {
      const choices=element('div',undefined,'actions');
      for (const [label,pressure] of [['Duduk normal',null],['Relief +120 kPa',120],['Alir balik −4 kPa',-4]]) {
        const control=button(label,()=>{
          if (state.enginePhase!=='off') return;
          engine.setCapTest(pressure);
          showDriveDetails();
        },engine.snapshot().capPressure===pressure);
        control.disabled=state.enginePhase!=='off';
        choices.append(control);
      }
      body.append(element('h3','Peragaan tekanan pada tutup'),
        element('p','Gunakan saat mesin mati. Angka merupakan contoh tekanan relatif untuk memperlihatkan buka dan tutup katup.'), choices);
    }
    if (spec.mode==='starting') {
      body.append(element('p','Tekan Mulai. Pinion bergeser masuk sebelum poros engkol berputar, lalu mundur saat mesin hidup. Aktifkan X-ray untuk melihatnya.'));
      appendFunctionSources(body,['USER-START','DENSO-MAN']);
    }
    const details=element('details',undefined,'details');
    details.append(element('summary','Bagian yang bergerak'));
    const list=element('ul',undefined,'registry');
    for (const id of spec.targets || []) {
      const entry=entries.get(id);
      list.append(element('li',entry ? componentName(entry) : id));
    }
    details.append(list);
    body.append(details);
    if (view.covers.size) {
      const stationary=element('details',undefined,'details');
      stationary.append(element('summary','Rumah yang tetap diam'));
      const fixed=element('ul',undefined,'registry');
      for (const id of view.covers) {
        const entry=entries.get(id);
        if (entry?.object) fixed.append(element('li',componentName(entry)));
      }
      if (fixed.children.length) { stationary.append(fixed); body.append(stationary); }
    }
    sourceLinks(body,spec.source_refs);
    const analogies={turbo:['GARRETT-VID'],seawater:['JABSCO-VID'],freshwater:['GRUNDFOS-VID'],fuel:['YM-SERVICE']};
    if (analogies[spec.system]) appendFunctionSources(body,analogies[spec.system]);
    const gaps=data.drivetrain?.gaps || [];
    if (gaps.length) {
      const caveats=element('details',undefined,'details');
      caveats.append(element('summary','Batas peragaan'));
      appendNotes(caveats,gaps);
      body.append(caveats);
    }
    filmLink(body);
    reviewLink(body);
    comparisonLink(body);
  });
}

const engineModes=['systems','operation','drives'];
function populateDrives() {
  const field=$('drive-select');
  field.replaceChildren();
  const categories=new Map();
  for (const {spec} of driveViews.values()) {
    const category=spec.system || 'other';
    if (!categories.has(category)) {
      const group=element('optgroup');
      group.label=driveCategories[category] || 'Penggerak lain';
      categories.set(category,group);
      field.append(group);
    }
    const option=element('option',spec.label || spec.id);
    option.value=spec.id;
    categories.get(category).append(option);
  }
}
let lastPhase;
engine.subscribe(({type,detail,state:telemetry})=>{
  if (type==='select') { renderSelection(detail); return; }
  if (type==='change') {
    if (lastPhase!==telemetry.phase && state.mode==='drives' && state.driveId?.startsWith('cap-') && !panel.hidden) showDriveDetails();
    lastPhase=telemetry.phase;
    updateNav();
    return;
  }
  if (type==='audio-error') {
    $('audio-toggle').title='Audio belum tersedia. Ketuk untuk mencoba lagi.';
    return;
  }
  if (type==='context-lost') {
    $('loading').textContent='Tampilan 3D terputus. Informasi komponen masih dapat dibuka.';
    $('loading').hidden=false;
    filmLink($('loading'));
    reviewLink($('loading'));
    return;
  }
  if (type==='context-restored') {
    $('loading').hidden=Boolean(roots?.every(Boolean));
    return;
  }
  readBindings();
  if (type==='inventory') {
    $('review-status').hidden=data.reviewApproved===true;
    if (engine.snapshot().audioSupported) {
      $('audio-toggle').hidden=false;
      updateAudioControls();
    }
  } else if (type==='ready') {
    $('loading').hidden=!detail.partial;
    if (detail.partial) $('loading').textContent='Sebagian aset 3D gagal dimuat. Inventaris komponen tetap tersedia.';
    populateDrives();
    if (activeEngineMode()) updateOperationDock();
  }
});
async function start() {
  const params = new URLSearchParams(window.location?.search || '');
  const requested = params.get('part');
  const view = params.get('view');
  try {
    await engine.load();
  } catch (error) {
    $('loading').textContent=error.message || 'Model 3D tidak dapat ditampilkan pada perangkat ini.';
    filmLink($('loading'));
    reviewLink($('loading'));
  }
  const entry = componentEntry(requested);
  if (!entry) {
    if (['operation','tour','drives'].includes(view) && data) changeMode(view==='drives' ? 'drives' : 'operation');
    if (view==='drives' && driveViews.has(params.get('drive'))) selectDrive(params.get('drive'));
    if (view === 'tour' && renderer && roots?.some(Boolean)) beginTour(false);
    return;
  }
  select(entry.id);
  const scope = scopeFor(entry);
  if (!['section','exploded'].includes(view)) return;
  const section = view === 'section';
  if (section ? !scopeReady(scope) : !scopeInspectable(scope)) return;
  state.xray = section;
  openDiagram(entry,scope.id,{spread:!section});
  if (section) requestAnimationFrame(()=>{
    if (state.assemblyGroup === scope.id && !state.cutaway) toggleCutaway(scope);
  });
}
for (const node of document.querySelectorAll('[data-mode]')) node.addEventListener('click', () => changeMode(node.dataset.mode));
$('inspect-contents').addEventListener('click',()=>openContents(entries.get(state.selected)));
$('parts').addEventListener('click', () => changeMode('parts'));
$('sources').addEventListener('click', () => changeMode('sources'));
$('reset').addEventListener('click', () => {
  state.xray = false;
  clearDriveClocks();
  filter = '';
  $('spread').value = 50;
  state.overviewSpread=.5;
  $('spread-value').value = '50%';
  if (camera) camera.position.copy(controls.target).add(new T.Vector3(...initialView));
  changeMode('home');
});
$('close').addEventListener('click', () => {
  if (state.mode === 'assembly') restoreDiagram();
  else { closePanel(); updateOperationDock(); }
});
$('operation-toggle').addEventListener('click',()=>{
  if (!activeEngineMode() || $('operation-toggle').disabled) return;
  if (state.running) engine.pause();
  else engine.start();
});
$('audio-toggle').addEventListener('click',async()=>{
  if (!engine.snapshot().audioSupported) return;
  const toggle=$('audio-toggle');
  if (muted) {
    toggle.disabled=true;
    const unlocked=await engine.unlockAudio();
    toggle.disabled=false;
    if (!unlocked) {
      toggle.textContent='Suara';
      toggle.title='Audio tidak dapat dibuka. Ketuk untuk mencoba lagi.';
      return;
    }
  }
  muted=!muted;
  try { window.localStorage?.setItem(audioSetting,String(muted)); } catch {}
  engine.setMuted(muted);
  updateAudioControls();
});
$('audio-volume').addEventListener('input',()=>{
  engine.setVolume(Number($('audio-volume').value)/100);
});
$('operation-stop').addEventListener('click',()=>{
  engine.stop();
});
$('operation-reset').addEventListener('click',()=>{
  $('operation-options').open=false;
  engine.reset();
});
$('flow-select').addEventListener('change',()=>{
  pickFlow($('flow-select').value);
  if (!panel.hidden) (state.mode === 'systems' ? showSystems : showOperation)();
});
$('operation-info').addEventListener('click',()=>{
  if (!panel.hidden) closePanel();
  else if (state.mode === 'systems') showSystems();
  else if (state.mode === 'drives') showDriveDetails();
  else showOperation();
  updateOperationDock();
});
$('operation-tour').addEventListener('click',()=>{
  $('operation-options').open=false;
  if (state.tour) finishTour();
  else beginTour(!reducedMotion());
});
$('drive-entry').addEventListener('click',()=>changeMode('drives'));
$('drive-back').addEventListener('click',()=>changeMode('operation'));
$('drive-focus').addEventListener('click',()=>focusDrive());
$('drive-select').addEventListener('change',()=>selectDrive($('drive-select').value));
$('drive-starter').addEventListener('click',showStarter);
$('starter-entry').addEventListener('click',showStarter);
$('tour-next').addEventListener('click',()=>nextTour());
$('flow-cut').addEventListener('click',()=>{
  $('operation-options').open=false;
  engine.setBlockSection(!state.flowCut);
});
$('chamber-focus').addEventListener('click',()=>{
  $('operation-options').open=false;
  engine.setChamberFocus(!state.combustionFocus);
});
$('xray').addEventListener('click',()=>{
  engine.setXray(!state.xray);
  if (!state.xray) $('cutaway')?.setAttribute('aria-pressed','false');
  if (state.mode==='assembly') showAssemblySelection(entries.get(state.selected));
});
$('spread').addEventListener('input', () => { $('spread-value').value = $('spread').value + '%'; engine.setOverviewSpread(Number($('spread').value)/100); });
$('spread').addEventListener('change', () => frame());
window.addEventListener('keydown',event => {
  if (event.key !== 'Escape') return;
  if (state.mode === 'assembly') restoreDiagram();
  else if (!panel.hidden) { closePanel(); updateOperationDock(); }
});
start();
