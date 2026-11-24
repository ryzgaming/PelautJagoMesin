// Uses the inventory and learning cards supplied by the current simulator.
window.showMachineCatalog = function (cfg, reason) {
  const app = document.getElementById('app');
  const reference = document.getElementById('learnMore');
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const main = element('main');
  main.append(element('p', cfg.eyebrow || 'Simulator permesinan kapal', 'eyebrow'), element('h1', cfg.title));
  const status = element('div', '', 'fallback-status');
  status.setAttribute('role', 'status');
  const actions = element('div', '', 'fallback-actions');
  const retry = element('button', 'Coba ulang tampilan 3D');
  retry.type = 'button';
  retry.addEventListener('click', () => {
    // An inline premium viewer needs its host to fetch the renderer again.
    if (location.href === 'about:srcdoc') window.parent.postMessage('retry-machine-workspace', '*');
    else location.reload();
  });
  actions.append(retry);
  status.append(element('p', reason + ' Katalog komponen dan materi belajar tetap tersedia.'), actions);
  main.append(status);

  const catalog = element('section');
  catalog.append(element('h2', 'Katalog komponen'));
  for (const [key, part] of Object.entries(cfg.data || {})) {
    const rows = part.rows || [];
    const group = element('details');
    const label = element('summary', part.en || key);
    label.append(element('span', ' · ' + rows.length + ' komponen', 'fallback-count'));
    group.append(label);
    for (const text of [part.idn, part.fn, part.chk]) {
      if (text) group.append(element('p', text));
    }
    for (const row of rows) {
      const item = element('details');
      const name = (row[0] ? row[0] + ' · ' : '') + (row[1] || 'Komponen');
      const detail = 'Jumlah: ' + (row[2] || 'tidak tersedia') + '. Material: ' + (row[3] || 'tidak tersedia') + '.';
      item.append(element('summary', name), element('p', detail));
      const description = row[3 + cfg.variants.length];
      if (description) item.append(element('p', description));
      group.append(item);
    }
    catalog.append(group);
  }

  const learning = element('section');
  learning.append(element('h2', 'Materi belajar'));
  if (reference) {
    for (const control of reference.querySelectorAll('button, input, select')) control.disabled = true;
    learning.append(reference);
  }
  const grid = element('div', '', 'fallback-grid');
  grid.append(catalog, learning);
  main.append(grid);
  app.className = 'catalog-fallback';
  app.replaceChildren(main);
};
