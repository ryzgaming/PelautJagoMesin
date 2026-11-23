import test from 'node:test';
import assert from 'node:assert/strict';
import {manV4CompactRuntime,manV4CompactStyles} from '../server/man-v4-compact.mjs';
import {injectManV4,MAN_V4_REVIEW_ORIGIN,MAN_V4_PRODUCTION_ORIGIN} from '../server/man-v4-internal.mjs';
import {handleApi} from '../server/api.mjs';
import {assemblyExplorerRuntime} from '../server/assembly-explorer.mjs';

const original='<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app">Premium MAN viewer</div></body></html>';
test('compact MAN UI is syntactically valid and retains original premium model',()=>{
  assert.doesNotThrow(()=>new Function(manV4CompactRuntime));
  const html=injectManV4(original,{compact:true});
  assert.match(html,/id="man-v4-native-css"/);
  assert.match(html,/v4-compact-bar/);
  assert.match(html,/⋯ Lainnya/);
  assert.match(html,/▧ Rakitan/);
  assert.match(html,/≋ Sistem/);
  assert.match(html,/Premium MAN viewer/);
  assert.doesNotMatch(manV4CompactRuntime,/WebGLRenderer|fetch\s*\(|service.role|new THREE\./i);
});
test('one panel at a time; full controls are preserved inside More',()=>{
  for(const key of ['dataset.compactPanel','openPanel','closeAll','closeAssembly','v4-compact-more','v4-compact-advanced','v4-compact-native','modebar']){
    assert(manV4CompactRuntime.includes(key),key);
  }
  assert.match(manV4CompactStyles, /data-compact-panel=components/);
  assert.match(manV4CompactStyles, /v4-view-modes/);
  assert.match(manV4CompactStyles, /data-compact-panel=systems/);
  assert.match(manV4CompactStyles, /@media\(max-width:850px\)/);
  assert.match(manV4CompactStyles, /#simroot\.v4-mounted\.v4-compact \.ctrl\{display:none!important\}/);
  assert.match(manV4CompactStyles, /v4-advanced-open \.ctrl\{display:flex!important\}/);
  assert.match(manV4CompactRuntime, /pinButton\.click\(\)/);
  assert.match(manV4CompactRuntime, /aria-pressed/);
});
test('production keeps existing admin V4 while preview uses compact V4',()=>{
  assert.doesNotMatch(injectManV4(original),/v4-compact-bar/);
  assert.match(injectManV4(original,{compact:true}),/v4-compact-bar/);
  assert.equal(MAN_V4_PRODUCTION_ORIGIN,'https://pelautjagomesin.pages.dev');
  assert.equal(MAN_V4_REVIEW_ORIGIN,'https://chatgpt-man-workspace-v4-ui.pelautjagomesin.pages.dev');
});
test('assembly subcomponent and advanced options are collapsed by default',()=>{
  assert.match(assemblyExplorerRuntime, /make\('details','om-assembly-subparts'\)/);
  assert.match(assemblyExplorerRuntime, /make\('details','om-assembly-more'\)/);
  assert.match(assemblyExplorerRuntime, /essentials\.append\(next,reassemble,togglePins\)/);
  for(const v of ['setExLvl','setOne','bPins','bMat','bIso']) assert(assemblyExplorerRuntime.includes(v));
});
