import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPowertrain } from '../model/runtime/powertrain.js';

const model=new URL('../model/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',model),'utf8'));
for (const [path,sha] of Object.entries(manifest.integrity)) {
  const bytes=await readFile(new URL(path,model));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,path);
}
const inventory=JSON.parse(await readFile(new URL(manifest.assets.inventory,model),'utf8'));
assert.equal(inventory.components.length,manifest.componentCount);
assert.equal(new Set(inventory.components.map(part=>part.id)).size,manifest.componentCount);
for (const path of [manifest.runtime.session,manifest.runtime.powertrain,...manifest.runtime.vendor]) {
  await readFile(new URL(path,model));
}

const samples=[];
const phases=[];
let controller;
controller=createPowertrain({
  mechanics:{tick(sample) {samples.push(sample);}, reset() {samples.length=0;}},
  changed() { phases.push(controller.snapshot().enginePhase); }
});
assert.equal(controller.snapshot().enginePhase,'off');
assert.equal(controller.resume(),false);
controller.start();
controller.step(.17);
assert.equal(controller.snapshot().angle,0);
assert.ok(controller.snapshot().starterEngagement>0 && controller.snapshot().starterEngagement<1);
controller.pause();
const paused=controller.snapshot();
controller.step(.15);
assert.deepEqual(controller.snapshot(),paused);
controller.resume();
controller.step(.45);
assert.equal(controller.snapshot().enginePhase,'cranking');
assert.equal(controller.snapshot().starterEngagement,1);
assert.ok(controller.snapshot().angle>0);
controller.step(2.25);
assert.equal(controller.snapshot().enginePhase,'running');
assert.ok(controller.snapshot().starterEngagement>0);
controller.step(.26);
assert.equal(controller.snapshot().starterEngagement,0);
assert.equal(controller.snapshot().rpm,650);
controller.stop();
assert.equal(controller.snapshot().enginePhase,'stopping');
controller.step(1.1);
assert.equal(controller.snapshot().enginePhase,'off');
assert.equal(controller.snapshot().rpm,0);
controller.start();
const reindexed=controller.snapshot().driveAngles;
assert.ok(Math.abs(Math.sin((reindexed.both-reindexed.starting)*90))<1e-9);
controller.reset();
assert.equal(controller.snapshot().angle,0);
assert.deepEqual(controller.snapshot().driveAngles,{running:0,starting:0,both:0});
assert.deepEqual([...new Set(phases)],['engaging','cranking','firing','running','stopping','off']);
console.log('PASS: model SHA-256, 1,184 unique IDs and DOM-free engine lifecycle.');
