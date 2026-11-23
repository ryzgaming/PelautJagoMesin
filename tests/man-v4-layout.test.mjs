import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile('dist/man-v4-review.html','utf8');
const js=await readFile('dist/assets/man-v4.js','utf8');
const css=await readFile('dist/assets/man-v4.css','utf8');

test('MAN V4 review entry redirects to the real protected simulator workspace',()=>{
  assert.match(html,/workspace\.html\?product=man-l2330h/);
  assert.doesNotMatch(html,/WebGLRenderer|THREE\.Scene|<canvas/);
  assert.match(js,/api\('access',\{productId:machineId\},true\)/);
  assert.match(js,/frame\.srcdoc=embedded/);
  assert.doesNotMatch(js,/service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('component exploration and 6 guided systems are present',()=>{
  for(const key of ['head','liner','piston','crank','fuel','tc','alt'])assert.match(js,new RegExp("key:'"+key+"'"));
  for(const label of ['Air System','Fuel System','Lubricating','Cooling','Starting Air','Exhaust Gas'])assert(js.includes(label),label);
  assert.match(js,/showReason/);
  assert.match(js,/renderFlow/);
  assert.match(js,/startAuto/);
});

test('review page does not change prices or grant customer access',()=>{
  assert.doesNotMatch(html,/Rp\s?0|49000|checkoutEnabled/);
  assert.match(js,/SIGN_IN_REQUIRED/);
  assert.doesNotMatch(js,/entitlements\.insert|grant.*premium|user\.email\s*===/i);
});
test('responsive layout, reduced motion and safe model controls',()=>{
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(js,/event\.source!==frame\.contentWindow/);
  assert.match(js,/e\.source!==parent\|\|e\.origin!==expectedOrigin/);
  assert.match(js,/window\.__pp/);
});

test('only authenticated V4 MAN activates full-screen mobile host',async()=>{
  const host=await readFile('dist/assets/workspace.js','utf8');
  const outerStyle=await readFile('dist/assets/site.css','utf8');
  assert.match(host,/id==='man-l2330h'&&html\.includes\('id="man-v4-native-css"'\)/);
  assert.match(host,/document\.body\.classList\.toggle\('v4-workspace-host'/);
  assert.match(outerStyle,/body\.v4-workspace-host \.workspace-frame\{[^}]*height:100dvh/);
  assert.match(outerStyle,/body\.v4-workspace-host \.workspace-header\{display:none!important\}/);
  assert.match(outerStyle,/body\.v4-workspace-host \.site-header/);
});
