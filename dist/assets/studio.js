// Shared by the public simulator and the authorized premium iframe.
(() => {
  const byId = id => document.getElementById(id);
  const root = byId('simroot');
  // Some models describe their systems in the component tree.
  const system = byId('m-sys') || byId('m-learn');
  const operation = byId('m-op');
  if (!root || root.classList.contains('studio') || !system || !operation ||
      document.documentElement.classList.contains('om-hero')) return;

  root.classList.add('studio');
  const room = window.__pp?.room?.group;
  if (room) room.visible = false;
  if (window === window.top) {
    const back = document.createElement('a');
    back.className = 'btn cb';
    back.href = '/#catalog';
    back.textContent = 'Katalog';
    root.querySelector('.topbar').append(back);
  }

  const dock = document.createElement('nav');
  dock.className = 'studio-dock';
  dock.setAttribute('aria-label', 'Mode workspace');
  root.append(dock);

  const modes = [[system, 'Sistem'], [operation, 'Pengoperasian']];
  for (const [button, label] of modes) {
    button.querySelector('span').textContent = label;
    button.title = label;
    button.classList.add('btn', 'cb');
    button.setAttribute('aria-controls', 'shop');
    dock.append(button); // Keep the model's existing mode handler and simulation state.
    button.addEventListener('click', () => {
      byId('pbody').scrollTop = 0;
    });
  }

  const list = byId('plist');
  if (system.id === 'm-learn' && list) {
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Cari komponen atau nomor bagian';
    search.setAttribute('aria-label', search.placeholder);
    const entries = Array.from(list.querySelectorAll('li:not(.maj)'), item => ({
      item, text: item.textContent.toLocaleLowerCase('id')
    }));
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase('id');
      for (const {item, text} of entries) item.hidden = !text.includes(query);
      for (const group of list.querySelectorAll('li.maj')) {
        group.hidden = !group.querySelector('li:not([hidden])');
      }
    });
    list.before(search);
  }

  const close = byId('bClose');
  close.click();
  function syncPanel() {
    for (const [button, label] of modes) {
      const active = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-expanded', String(active && !root.classList.contains('nopanel')));
      if (active) byId('pTitle').textContent = label;
    }
  }
  syncPanel();
  new MutationObserver(syncPanel).observe(root, {
    attributes: true, attributeFilter: ['class', 'data-mode']
  });
  close.addEventListener('click', () => {
    (dock.querySelector('[aria-pressed="true"]') || system).focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !root.classList.contains('nopanel')) close.click();
  });
})();
