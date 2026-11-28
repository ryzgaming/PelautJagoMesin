import { readFile } from 'node:fs/promises';

const harnessUrl = new URL('../../review/tools/state-check.mjs', import.meta.url);
const harness = await readFile(harnessUrl, 'utf8');
const end = harness.indexOf("assert.equal(run('roots.every(Boolean)'),true);");
if (end < 0) throw new Error('Cannot find mock bootstrap boundary');
const bootstrap = harness.slice(0,end).replaceAll('import.meta.url', JSON.stringify(harnessUrl.href));
const independentAssertions = `
assert.equal(run('roots.every(Boolean)'),true);
function drawFrames() {
  const frames = Array.from(managedFrames);
  managedFrames.clear();
  for (const [,frame] of frames) frame();
}
function find(root, tag, text) {
  if (root.tagName===tag && root.textContent===text) return root;
  for (const child of root.children) {
    const button = find(child,tag,text);
    if (button) return button;
  }
}
function checkNested(id, anchor) {
  assert.equal(run('state.assemblyGroup'),id);
  assert.equal(run('state.selected'),anchor);
  assert.ok(run(\`
    (() => {
      const recipe=data.assemblies['\${id}'];
      return recipe.parts.every(p=>{
        const object=entries.get(p.id)?.object;
        let found=false;
        object?.traverseVisible(n=>{if(n.isMesh && n.geometry?.attributes.position.count>20) found=true;});
        if(!found) return false;
        for(let n=object;n;n=n.parent) if(!n.visible)return false;
        return true;
      });
    })()
  \`),'All nested mesh parts should be present and visible ancestrally at '+id);
}
assert.equal(run('data.revision'),'r03');
for (const [width,height] of [[390,780],[780,390],[1050,650]]) {
  const host=entries.get('canvas');
  host.clientWidth=width;
  host.clientHeight=height;
  for(const resize of resizeObservers)resize();
  drawFrames();
  assert.equal(run('camera.aspect'),width/height);
}
const anchor=link || 'EXT-INTAKE-02';
const expected=run(\`scopeFor(entries.get('\${anchor}')).id\`);
if (link) {
  drawFrames();
  checkNested(expected,anchor);
  assert.equal(run('state.assemblySpread'),linkView==='exploded');
  assert.equal(run('state.cutaway'),linkView==='section');
  if(linkView==='section'){
    assert.ok(run('state.xray && renderer.localClippingEnabled'));
    assert.ok(run(\`entries.get('\${anchor}-08').object.visible && entries.get('\${anchor}-13').object.visible\`));
  }
} else {
  for (const test of [
      ['EXT-INTAKE-02','RAK-INTAKE','RAK-AIRCOOLER','EXT-INTAKE-08'],
      ['INT-FUELINJ-61','RAK-INT-FUELINJ','RAK-INJECTOR-6','INT-FUELINJ-61-13'],
      ['INT-FUELINJ-11','RAK-INT-FUELINJ','RAK-INJECTOR-1','INT-FUELINJ-11-13'],
  ]) {
    const [id,parent,scope,core]=test;
    if (!run('state.xray')) entries.get('xray').click();
    run(\`select('\${id}')\`);
    const panel=entries.get('panel-body');
    const parentAction=find(panel,'button','Eksplor rakitan');
    assert.ok(parentAction,id+' lacks original parent diagram action');
    parentAction.click();
    drawFrames();
    assert.equal(run('state.assemblyGroup'),parent);
    run(\`state.assemblyControls.get('\${id}').click()\`);
    assert.equal(run('state.selected'),id);
    assert.ok(run(\`state.assemblyParts.has('\${core}')\`));
    assert.equal(entries.get('inspect-contents').hidden,false);
    entries.get('inspect-contents').click();
    drawFrames();
    checkNested(scope,id);
    assert.equal(run('state.xray'),true);
    assert.equal(run('state.assemblySpread'),false);
    assert.ok(run(\`entries.get('\${core}').object.visible\`));
    const values=run(\`JSON.stringify([...shellMaterials].filter(([,v])=>v.entry.id==='\${id}').map(([mesh,v])=>mesh.material===v.transparent))\`);
    const transparent=JSON.parse(values);
    assert.ok(transparent.length>0&&transparent.every(Boolean));
    const cut=entries.get('cutaway');
    cut.click();
    assert.equal(run('state.cutaway'),true);
    assert.ok(run('renderer.localClippingEnabled'));
    cut.click();
    find(panel,'button','Uraikan rakitan').click();
    drawFrames();
    assert.equal(run('state.assemblySpread'),true);
    find(panel,'button','Rapatkan rakitan').click();
    drawFrames();
    assert.equal(run('state.assemblySpread'),false);
    entries.get('close').click();
    drawFrames();
    assert.equal(run('state.assemblyGroup'),parent);
    assert.equal(run('state.selected'),id);
    assert.equal(run('state.xray'),true);
    entries.get('reset').click();
    drawFrames();
  }
}
console.log('PASS: owner row/actions and requested deep link using actual GLTFLoader. DOM/renderer/viewport are mocked.');
`;
await import('data:text/javascript;base64,'+Buffer.from(bootstrap+independentAssertions).toString('base64'));
