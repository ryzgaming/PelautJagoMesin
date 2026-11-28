import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const harnessUrl = new URL(process.env.YANMAR_QA_ROOT ? '../../../'+process.env.YANMAR_QA_ROOT+'/review/tools/state-check.mjs' : '../../review/tools/state-check.mjs', import.meta.url);
const harness = await readFile(harnessUrl, 'utf8');
const stop = harness.indexOf("assert.equal(run('roots.every(Boolean)'),true);");
if (stop < 0) throw Error('State harness bootstrap unavailable');
const adapter = harness.slice(0, stop).replaceAll('import.meta.url', JSON.stringify(harnessUrl.href));
const phase = process.env.YANMAR_QA_PHASE || 'running';
if (!['running','starting'].includes(phase)) throw Error('Invalid drivetrain phase');
const degreeStep = Number(process.env.YANMAR_QA_STEP || 4);
const degreeLimit = Number(process.env.YANMAR_QA_LIMIT || 720);
if (!(degreeStep>0 && degreeLimit>0 && degreeLimit<=720)) throw Error('Invalid crank sampling');
const capture = `
assert.equal(run('roots.every(Boolean)'), true);
export default JSON.parse(run(\`(() => {
const meshes = roots.flatMap(root => {
  const found = [];
  root.traverse(object => { if (object.isMesh) found.push(object); });
  return found;
});
const key = object => object.userData.component || object.name;
const matrix = o => Array.from(o.matrixWorld.elements);
const setPose = (degree, live) => {
  if (typeof applyDrivetrain === "function") state.mode = "operation";
  const angle = degree * Math.PI / 180;
  state.angle = angle % (4 * Math.PI);
  state.simTime = live ? angle / 3 : 0;
  state.enginePhase = '${phase}';
  if ('starterEngaged' in state) state.starterEngaged = live && degree > 0 && state.enginePhase === 'starting';
  if (state.driveAngles) for (const key of Object.keys(state.driveAngles)) {
    state.driveAngles[key] = key === 'both' || key === state.enginePhase ? angle : 0;
  }
  applyKinematics();
  if (typeof applyDrivetrain === 'function') applyDrivetrain();
  scene.updateMatrixWorld(true);
};
const restPose = () => setPose(0,false);
restPose();
const baseline = meshes.map(matrix);
const driveNodeSet = new Set(typeof driveViews === 'undefined' ? [] : [...driveViews.values()].flatMap(drive => drive.parts.map(part => part.object)));
const auditNodes = roots.flatMap(root => {
  const found = [];
  root.traverse(object => {
    if (driveNodeSet.has(object) || object.name.startsWith('MOT-') || /^(EXT-(FRONT-02|FLYWHEEL-02|FLYWHEEL-20))$/.test(object.name)) found.push(object);
  });
  return found;
});
const pivotData = auditNodes.map(object => ({name:object.name, parent:object.parent?.name, rest:matrix(object)}));
setPose(1,true);
auditNodes.forEach((object,i) => {
  pivotData[i].atOneDegree = matrix(object);
  pivotData[i].relative = Array.from(object.matrixWorld.clone().multiply(new T.Matrix4().fromArray(pivotData[i].rest).invert()).elements);
});
const configuration = data.kinematics.viewer;
const frames = [];
const splitComponentTransforms = new Set();
const tracked = new Set();
for (let degree = 0; degree <= ${degreeLimit}; degree += ${degreeStep}) {
  setPose(degree,true);
  const moved = {};
  meshes.forEach((object, i) => {
    const now = matrix(object);
    if (now.every((n, j) => Math.abs(n - baseline[i][j]) < 1e-9)) return;
    const original = new T.Matrix4().fromArray(baseline[i]);
    const id = key(object);
    const delta = Array.from(object.matrixWorld.clone().multiply(original.invert()).elements);
    if (moved[id] && moved[id].some((n,j)=>Math.abs(n-delta[j])>1e-8)) splitComponentTransforms.add(id);
    moved[id] = delta;
    tracked.add(key(object));
  });
  frames.push({degree, moved});
}
restPose();
return JSON.stringify({meshes:[...new Set(meshes.map(key))], tracked:[...tracked].sort(), frames, splitComponentTransforms:[...splitComponentTransforms], pivotData, configuration, drivetrain:data.drivetrain, revision:data.revision,
  resetError:Math.max(...meshes.map((o, i)=>Math.max(...matrix(o).map((n,j)=>Math.abs(n-baseline[i][j])))))});
})()\`));
`;
const generated = await import('data:text/javascript;base64,' + Buffer.from(adapter + capture).toString('base64'));
const hashes = {};
for (const [name,file] of [['exterior','exterior.glb'],['internal','internal.glb'],['studio','studio.js'],['data','data.json']]) {
  hashes[name] = createHash('sha256').update(await readFile(new URL('../assets/' + file, harnessUrl))).digest('hex');
}
await writeFile(process.argv[2], JSON.stringify({...generated.default, hashes}));
console.log(JSON.stringify({poses: generated.default.frames.length, monitoredMeshes: generated.default.meshes.length, movingMeshes: generated.default.tracked.length, splitComponentTransforms:generated.default.splitComponentTransforms, resetError: generated.default.resetError}));
