// Export actual GLTFLoader world matrices after applying the released viewer mechanisms.
// Reuse the project's Three.js test bootstrap to collect transforms without requiring a GPU.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url=new URL('../../../review/tools/state-check.mjs',import.meta.url);
const harness=await readFile(url,'utf8');
const end=harness.indexOf("assert.equal(run('roots.every(Boolean)'),true);");
if(end<0)throw Error('Unable to initialize the viewer state harness.');
let bootstrap=harness.slice(0,end).replaceAll('import.meta.url',JSON.stringify(url.href));
if(process.env.YANMAR_FILM_DRAFT){
  const project=new URL('../../../',import.meta.url);
  const customLoader = `const file=async path=>{
    const name=path.split('/').at(-1);
    if(['internal.glb','exterior.glb'].includes(name))return readFile(new URL('model/'+name.split('.')[0]+'/'+name,${JSON.stringify(project.href)}));
    if(name==='data.json'){
       const doc=JSON.parse(await readFile(new URL(path,assets),'utf8'));
       try{doc.drivetrain=JSON.parse(await readFile(new URL('model/motion/drivetrain.json',${JSON.stringify(project.href)}),'utf8'))}catch{}
       return Buffer.from(JSON.stringify(doc));
    }
    return readFile(new URL(path,assets));
  };`;
  bootstrap=bootstrap.replace('const file = async path => readFile(new URL(path,assets));',customLoader);
}
const host=`
export {run};
`;
const {run}=await import('data:text/javascript;base64,'+Buffer.from(bootstrap+host).toString('base64'));
const [sampleFile,output]=process.argv.slice(2);
const samples=JSON.parse(await readFile(sampleFile,'utf8'));
const config=JSON.stringify(samples.names);
const count=run(`(() => {
  globalThis.filmNodes=${config}.map(id=>roots.map(root=>root?.getObjectByName(id)).find(Boolean));
  return filmNodes.filter(Boolean).length;
})()`);
const indices=run("filmNodes.map((n,i)=>n?i:-1).filter(i=>i>=0)");
if (count<samples.names.length-4)throw Error('Viewer misses model nodes '+run('filmNodes.map((n,i)=>n?null:i).filter(i=>i!==null)').map(i=>samples.names[i]).slice(0,18).join(', '));
run(`globalThis.filmIndex=${JSON.stringify(indices)}`);
const mats=new Float32Array(samples.frames.length*indices.length*16);
const setup=run("typeof applyDrivetrain==='function' && Boolean(data.drivetrain?.groups?.length) && driveViews.size>0");
if (!setup && !process.env.YANMAR_FILM_DRAFT)throw Error('R05 drivetrain implementation has yet to load.');
for(let f=0;f<samples.frames.length;f++){
 const sample=samples.frames[f];
 const array=run(`(() => {
   const frame=${JSON.stringify(sample)};
   state.mode='operation';state.xray=true;state.running=true;
   if(typeof setEnginePhase==='function')setEnginePhase(frame.phase);
   else state.enginePhase=frame.phase;
   state.starterEngaged=frame.phase==='starting' && frame.start>0;
   state.driveAngles={running:frame.run,starting:frame.start,both:frame.run+frame.start};
   state.angle=frame.angle;state.simTime=frame.time;
   applyKinematics();
   if (typeof applyDrivetrain==='function')applyDrivetrain();
   scene.updateMatrixWorld(true);
   const out=new Float32Array(filmIndex.length*16);
   for(let i=0;i<filmIndex.length;i++)filmNodes[filmIndex[i]].matrixWorld.toArray(out,i*16);
   return out;
 })()`);
 mats.set(array,f*indices.length*16);
}
const bytes=Buffer.from(mats.buffer);
await writeFile(output,bytes);
await writeFile(output+'.json',JSON.stringify({indices,frames:samples.frames.length,weight:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),includesR05Drives:setup}));
console.log('Sampled '+samples.frames.length+' poses from '+count+' viewer nodes.');
