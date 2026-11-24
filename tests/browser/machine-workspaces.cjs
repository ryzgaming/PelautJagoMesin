// Run against npm run dev with QA_PREMIUM_DIR pointing to private simulator HTML fixtures.
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');

const origin = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:5173').origin;
const fixtures = process.env.QA_PREMIUM_DIR;
const sizes = [{width: 390, height: 844}, {width: 844, height: 390}, {width: 1280, height: 800}];

async function checkWorkspace(page, id) {
  const viewer = page.frameLocator('#workspace-frame');
  const dock = viewer.locator('.studio-dock');
  const buttons = dock.getByRole('button');
  await buttons.first().waitFor();
  assert.deepEqual((await buttons.allTextContents()).map(text => text.trim()),
    ['Eksplor keseluruhan', 'Sistem', 'Pengoperasian', 'X-ray']);

  await buttons.nth(0).click();
  assert.equal(await viewer.locator('#ex').inputValue(), '0.5');
  await buttons.nth(3).click();
  for (const idx of [1, 2]) {
    await buttons.nth(idx).click();
    const panel = viewer.locator('#shop');
    await panel.waitFor();
    const [canvas, details] = await Promise.all([viewer.locator('#gl').boundingBox(), panel.boundingBox()]);
    assert.ok(canvas && details && canvas.width > 0 && canvas.height > 0);
    assert.ok(canvas.x + canvas.width <= details.x + 1 || canvas.y + canvas.height <= details.y + 1,
      id + ' — panel ' + await buttons.nth(idx).innerText() + ' menutup kanvas pada ' + JSON.stringify(page.viewportSize()));
    if (idx === 2) {
      const clipped = await panel.evaluate(async () => {
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const {camera, parts} = window.__pp;
        const point = new THREE.Vector3();
        for (const part of parts) {
          let outside = false;
          part.group.traverseVisible(mesh => {
            if (!mesh.isMesh || outside) return;
            const vertices = mesh.geometry.getAttribute('position');
            for (let i = 0; i < vertices.count; i++) {
              point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(camera);
              if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) {
                outside = true;
                break;
              }
            }
          });
          if (outside) return part.key;
        }
        return null;
      });
      assert.equal(clipped, null, id + ' — komponen terpotong di Pengoperasian: ' + clipped);
    }
    assert.equal(await buttons.nth(3).getAttribute('aria-pressed'), 'true');
    await viewer.locator('#bClose').click();
    assert.equal(await panel.isVisible(), false);
  }
  await buttons.nth(3).click();
}

async function checkCatalogFallback(page, id) {
  await page.goto(origin + '/workspace.html?product=' + encodeURIComponent(id));
  const catalog = page.frameLocator('#workspace-frame').locator('.catalog-fallback');
  await catalog.getByRole('button', {name: 'Coba ulang tampilan 3D'}).waitFor();
  const group = catalog.locator('details').first();
  await group.locator('summary').first().click();
  assert.ok(await group.locator('details summary').first().isVisible());
}

async function main() {
  assert.ok(fixtures, 'Set QA_PREMIUM_DIR to a private directory of <product-id>.html fixtures.');
  const browser = await chromium.launch({executablePath: process.env.QA_CHROMIUM, args: ['--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/commerce/access')) {
        const {productId} = route.request().postDataJSON();
        assert.match(productId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        const body = await readFile(path.join(fixtures, productId + '.html'));
        return route.fulfill({contentType: 'text/html', body});
      }
      if (url.pathname.includes('/commerce/')) return route.fulfill({json: {}});
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + '/workspace.html');
    const ids = await page.evaluate(async () => (await import('/assets/app.js')).fallbackProducts.map(p => p.id));
    assert.ok(ids.length);
    for (const id of ids) {
      await page.goto(origin + '/workspace.html?product=' + encodeURIComponent(id));
      for (const size of sizes) {
        await page.setViewportSize(size);
        await checkWorkspace(page, id);
        console.log('PASS', id, size.width + '×' + size.height);
      }
    }
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
      };
    });
    for (const id of ids) {
      await checkCatalogFallback(page, id);
      console.log('PASS', id, 'fallback');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
