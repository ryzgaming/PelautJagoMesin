import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePremiumWorkspace, studioFiles} from '../dist/assets/premium-workspace.js';

const assets = Object.fromEntries(studioFiles.map(name => [name, '/* ' + name + ' */']));

test('customer and decorated admin documents boot the same Studio after the simulator', () => {
  const engine = '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>' +
    '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>' +
    '<script>startMachine()</script>';
  const customer = '<html><head></head><body>' + engine + '</body></html>';
  const admin = customer.replace('</head>', '<style id="man-v4-native-css">old layout</style><style id="om-assembly-css">old detail</style></head>')
    .replace('</body>', '<script id="man-v4-native-js">oldLayout()</script><script id="om-assembly-js">oldDetail()</script></body>');
  const prepared = preparePremiumWorkspace(customer, 'man-l2330h', assets);
  assert.equal(preparePremiumWorkspace(admin, 'man-l2330h', assets), prepared);
  assert.doesNotMatch(prepared, /cdn\.jsdelivr/);
  const order = ['simulator-theme.css', 'studio.css', '</head>', 'three.min.js', 'OrbitControls.js', 'startMachine()', 'assembly-diagram.js', 'studio.js', '</body>'];
  const offsets = order.map(fragment => prepared.indexOf(fragment));
  assert.ok(offsets.every((offset,i) => offset >= 0 && (!i || offset > offsets[i-1])));
});

test('archived HTML fragments still receive the shared theme and viewer', () => {
  const html = preparePremiumWorkspace('<main id="simroot"></main>', 'tanabe-h74', assets);
  assert.match(html, /^<style>/);
  assert.ok(html.indexOf('studio.js') > html.indexOf('</main>'));
});
