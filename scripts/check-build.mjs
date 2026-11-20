import {readFile,readdir,stat} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
for(const name of ['index','workspace','admin','shinko-gj-sim','tanabe-h74','alfa-laval-mab206s','man-l2330h']){const s=await readFile('dist/'+name+'.html','utf8');assert(s.includes('<html'));if(['tanabe-h74','alfa-laval-mab206s','man-l2330h'].includes(name))assert(!s.includes('WebGLRenderer'),'Premium source must never be published as a static asset');}
for(const file of await readdir('dist/assets'))if(file.endsWith('.js'))execFileSync(process.execPath,['--check','dist/assets/'+file]);
for(const f of ['three.min.js','OrbitControls.js'])assert((await stat('dist/assets/'+f)).size>1000);
const homepage=await readFile('dist/index.html','utf8');assert(homepage.includes('Engineering.'));assert(homepage.includes('Reimagined.'));
const css=await readFile('dist/assets/site.css','utf8');for(const color of ['#090B0E','#272C33','#B7EE76','#F4F5F7'])assert(css.includes(color));
console.log('Build verified: static assets, V3 palette, JS syntax, premium source exclusion.');
