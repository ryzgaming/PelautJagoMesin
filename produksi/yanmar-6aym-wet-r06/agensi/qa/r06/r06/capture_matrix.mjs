import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url=new URL('../../review/tools/state-check.mjs',import.meta.url);
const harness=await readFile(url,'utf8');
const stop=harness.indexOf("assert.equal(run('roots.every(Boolean)'),true);");
if(stop<0)throw Error('GLTF state harness unavailable');
const adapter=harness.slice(0,stop).replaceAll('import.meta.url',JSON.stringify(url.href));
const source=await readFile(new URL('audit-matrix.js',import.meta.url),'utf8');
const runner=`
assert.equal(run('roots.every(Boolean)'),true);
run("state.mode='operation';window.qaCaptureGeometry=true");
export default run(${JSON.stringify(source)});
`;
const generated=await import('data:text/javascript;base64,'+Buffer.from(adapter+runner).toString('base64'));
const hashes={};
for(const file of ['exterior.glb','internal.glb','studio.js','data.json','functional-motion.js']){
 hashes[file]=createHash('sha256').update(await readFile(new URL('../assets/'+file,url))).digest('hex');
}
await writeFile(process.argv[2],JSON.stringify({...generated.default,hashes}));
const {counts,missing,unresolvedFrozen,restored,unobserved,maxMorph}=generated.default;
console.log(JSON.stringify({counts,missing,unresolvedFrozen,restored,unobserved,maxMorph}));
