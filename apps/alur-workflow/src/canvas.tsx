"use client";
import {useEffect,useState,useRef,type PointerEvent as PE} from "react";
import {Zap,GitBranch,Mail,ClipboardList,Plus,Minus,Scan,MousePointer2,Hand,Layers,Check,X,Bot,Type,ListChecks,Calculator,Gauge,Plug,Puzzle,Compass,BookOpenCheck,Boxes,ShieldCheck,Megaphone,Handshake,Headset,Landmark,Users} from "lucide-react";
import {type Graph,type Kind,type Step,type Port,validate,branches} from "./flow";
import {pluginById} from "./plugins";
import {directoryByKind} from "./directory";
import {agentByKind,divisionByKey,type DivisionKey} from "./organization";
const divisionIcons:Record<DivisionKey,typeof Zap>={eksekutif:Compass,kurikulum:BookOpenCheck,produk:Boxes,qa:ShieldCheck,growth:Megaphone,sales:Handshake,cs:Headset,finance:Landmark};
function agentLabel(kind:Kind){const agent=agentByKind.get(kind);return agent&&divisionByKey.get(agent.division)!.short+(agent.lead?" · Lead":"")+" · Fase "+agent.phase;}
const icons={trigger:Zap,condition:GitBranch,confirm:Mail,review:ClipboardList};
const categories={trigger:"Pemicu",condition:"Logika",confirm:"Aksi",review:"Aksi"};
const types={trigger:"Pemicu formulir",condition:"Percabangan",confirm:"Konfirmasi formulir",review:"Antrean review"};
const groupIcons = {"Teks":Type,"Daftar":ListChecks,"Pemeriksaan":GitBranch,"Angka":Calculator,"Satuan mesin":Gauge,"Robot laporan":Bot};
export function typeName(kind:Kind) { const agent=agentByKind.get(kind); return directoryByKind.get(kind)?.group ?? pluginById.get(kind)?.group ?? (agent&&divisionByKey.get(agent.division)!.name) ?? types[kind as keyof typeof types]; }
function theme(kind:Kind) { const agent=agentByKind.get(kind); if(agent) return "agent div-"+agent.division; return directoryByKind.has(kind) ? "robot" : pluginById.has(kind) ? (branches(kind)?"condition":"robot") : kind; }
export function Mark({kind}:{kind:Kind}) {
 const plugin=pluginById.get(kind);
 const entry=directoryByKind.get(kind);
 if(entry?.icon)return <span className="mark service-mark"><img alt="" width={30} height={30} src={import.meta.env.BASE_URL+"connectors/"+entry.icon}/></span>;
 const agent=agentByKind.get(kind);
 const Icon=agent?divisionIcons[agent.division]:entry?(entry.group==="Plugin Claude Code"?Puzzle:Plug):plugin?groupIcons[plugin.group]:icons[kind as keyof typeof icons];
 return <span className={'mark '+theme(kind)}><Icon size={22}/></span>
}
export function Canvas({g,select,selected,update,add,notify,trace,organization}:{g:Graph,select:(id:string)=>void,selected:string|null,update:(g:Graph)=>void,add:()=>void,notify:(s:string)=>void,trace:string[],organization?:()=>void}){
 const area=useRef<HTMLDivElement>(null),[dims,size]=useState({w:1000,h:660}),[zoom,Z]=useState(1),[pan,P]=useState({x:0,y:0}),[hand,H]=useState(false);
 const [wire,W]=useState<{from:string,port:Port}|null>(null);
 const drag=useRef<{id:string|null,x:number,y:number,startX:number,startY:number,moved:boolean}|null>(null);
 useEffect(()=>{const el=area.current;if(!el)return;const o=new ResizeObserver(()=>size({w:el.clientWidth,h:el.clientHeight}));o.observe(el);return()=>o.disconnect()},[]);
 useEffect(()=>{P({x:0,y:0});Z(1);W(null);if(g.nodes.length>12){const t=requestAnimationFrame(()=>fitRef.current());return()=>cancelAnimationFrame(t)}},[g.id]);
 const scale=Math.min(1.18,Math.max(.32,(dims.w-30)/920))*zoom;
 const tx=(dims.w-920*scale)/2+pan.x,ty=(dims.h-462*scale)/2+pan.y;
 const limit=(n:number)=>Math.max(.35,Math.min(2.5,n));
 const fitRef=useRef(()=>{});
 function fit(){const xs=g.nodes.map(n=>n.x),ys=g.nodes.map(n=>n.y);const x=Math.min(...xs)-20,y=Math.min(...ys)-20,w=Math.max(...xs)+236-x,h=Math.max(...ys)+110-y;
 const z=limit(Math.min((dims.w-35)/w,(dims.h-145)/h,1.18)/(scale/zoom));Z(z);P({x:(460-x-w/2)*(scale/zoom)*z,y:(231-y-h/2)*(scale/zoom)*z});}
 fitRef.current=fit;
 function start(e:PE,id:string|null){if(e.button!==0||wire)return;const n=g.nodes.find(i=>i.id===id);drag.current={id:hand?null:id,x:e.clientX,y:e.clientY,startX:n&&!hand?n.x:pan.x,startY:n&&!hand?n.y:pan.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
 function move(e:PE){const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)<4&&!d.moved)return;d.moved=true;
 if(!d.id)P({x:d.startX+dx,y:d.startY+dy});else update({...g,nodes:g.nodes.map(n=>n.id===d.id?{...n,x:d.startX+dx/scale,y:d.startY+dy/scale}:n)});}
 function end(){const d=drag.current;if(d?.id&&!d.moved)select(d.id);drag.current=null;}
 function connect(to:string,source=wire){if(!source)return;const graph={...g,edges:[...g.edges.filter(e=>!(e.from===source.from&&e.port===source.port)),{...source,to}]};
 try{validate(graph);update(graph);notify("Langkah terhubung.");W(null)}catch(e){notify((e as Error).message);W(null)}}
 const offset=(p:Port)=>p==="yes"?31:p==="no"?63:47;
 return <div className={'canvas'+(hand?' hand':'')} ref={area} onPointerDown={e=>start(e,null)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null}}>
 <div className="canvas-tools" onPointerDown={e=>e.stopPropagation()}><button className="secondary add" onClick={add}><Plus size={17}/> Langkah</button>{organization&&<button className="secondary add org-button" title="Buka organisasi 57 agent" aria-label="Buka organisasi 57 agent" onClick={organization}><Users size={17}/><span>Organisasi</span></button>}<div className="toolgroup"><button className={!hand?'active':''} title="Pilih langkah" aria-label="Pilih langkah" onClick={()=>H(false)}><MousePointer2 size={16}/></button><button className={hand?'active':''} title="Geser kanvas" aria-label="Geser kanvas" onClick={()=>H(true)}><Hand size={16}/></button></div></div>
 {wire&&<div className="wirehint" onPointerDown={e=>e.stopPropagation()}>Pilih titik masuk pada langkah tujuan.<button onClick={()=>W(null)} aria-label="Batalkan sambungan"><X size={15}/></button></div>}
 <div className="world" style={{transform:'translate('+tx+'px,'+ty+'px) scale('+scale+')'}}>
 <svg className="lines" aria-hidden="true">{g.edges.map(e=>{const a=g.nodes.find(n=>n.id===e.from),b=g.nodes.find(n=>n.id===e.to);if(!a||!b)return null;
 const x=a.x+218,y=a.y+offset(e.port),ex=b.x,ey=b.y+47,m=Math.max(40,Math.abs(ex-x)*.55),mid=(x+ex)/2,my=(y+ey)/2,yes=e.port==="yes";
 return <g key={e.from+e.port}><path className={trace.includes(a.id)&&trace.includes(b.id)?"lit":""} d={'M '+x+' '+y+' C '+(x+m)+' '+y+', '+(ex-m)+' '+ey+', '+ex+' '+ey}/>{e.port!=="out"&&<g transform={'translate('+mid+' '+my+')'}><rect x={yes?-16:-23} y="-11" width={yes?32:46} height="22" rx="9"/><text y="4" textAnchor="middle">{yes?"Ya":"Tidak"}</text></g>}</g>})}</svg>
 {g.nodes.map(n=><div key={n.id} role="button" tabIndex={0} aria-label={n.name} className={['node',theme(n.kind),selected===n.id?'selected':'',trace.includes(n.id)?'executed':''].join(' ')} style={{left:n.x,top:n.y}} onKeyDown={e=>{if(e.target===e.currentTarget&&e.key==="Enter")select(n.id)}} onPointerDown={e=>{e.stopPropagation();start(e,n.id)}}>
 <div className="node-inner"><Mark kind={n.kind}/><div><small>{directoryByKind.get(n.kind)?.group ?? pluginById.get(n.kind)?.group ?? agentLabel(n.kind) ?? categories[n.kind as keyof typeof categories]}</small><strong>{n.name}</strong></div></div>
 {trace.includes(n.id)&&<span className="ran"><Check size={12}/></span>}
 {n.kind!=="trigger"&&<button className={'socket inlet'+(wire?' target':'')} data-in={n.id} aria-label={'Hubungkan ke '+n.name} onPointerDown={e=>e.stopPropagation()} onClick={()=>wire?connect(n.id):notify("Pilih titik keluar langkah asal terlebih dahulu.")}/>}
 {(branches(n.kind)?["yes","no"]:["out"]).map(p=><button key={p} className={'socket outlet'+(wire?.from===n.id&&wire?.port===p?' armed':'')} aria-label={'Sambungkan '+n.name+' '+p} style={{top:offset(p as Port)}} onPointerDown={e=>{e.stopPropagation();W({from:n.id,port:p as Port});e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{e.stopPropagation();const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-in]')?.getAttribute('data-in');if(t)connect(t,{from:n.id,port:p as Port})}} onClick={e=>{if(e.detail===0)W({from:n.id,port:p as Port})}}/>)}
 </div>)}</div>
 <div className="zoom toolgroup" onPointerDown={e=>e.stopPropagation()}><button aria-label="Perkecil" onClick={()=>Z(limit(zoom-.15))}><Minus size={16}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Perbesar" onClick={()=>Z(limit(zoom+.15))}><Plus size={16}/></button><i/><button title="Paskan kanvas" aria-label="Paskan kanvas" onClick={fit}><Scan size={16}/></button></div>
 <div className="canvas-count"><Layers size={14}/>{g.nodes.length} langkah</div></div>
}
