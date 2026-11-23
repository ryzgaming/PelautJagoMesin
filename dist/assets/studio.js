// This script runs inside each simulator, including authorized sandbox documents.
(() => {
  const root = document.getElementById('simroot');
  if (!root || document.documentElement.classList.contains('om-hero')) return;
  const byId = id => document.getElementById(id);
  const tools = byId('ctrl');
  const slider = byId('ex')?.closest('.exwrap');
  if (!tools || !slider || !byId('bPanel')) return;
  if (root.classList.contains('studio')) return;
  root.classList.add('studio');
  if (window === window.top) {
    const back = document.createElement('a');
    back.className = 'btn cb';
    back.href = '/#catalog';
    back.textContent = 'Katalog';
    root.querySelector('.topbar').append(back);
  }
  const dock = document.createElement('nav');
  dock.className = 'studio-dock';
  dock.setAttribute('aria-label', 'Alat workspace');
  root.append(dock);

  function action(label, iconSource, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn cb';
    const icon = iconSource?.querySelector('svg')?.cloneNode(true);
    if (icon) button.append(icon);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    button.addEventListener('click', handler);
    dock.append(button);
    return button;
  }

  function moveControl(id, label) {
    const button = byId(id);
    if (!button) return;
    button.querySelector('span').textContent = label;
    dock.append(button);
  }

  const panel = byId('bPanel');
  if (panel.getAttribute('aria-pressed') === 'true') byId('bClose').click();
  const parts = action('Komponen', panel, () => {
    if (panel.getAttribute('aria-pressed') === 'true' &&
        byId('m-learn')?.getAttribute('aria-pressed') === 'true') {
      byId('bClose').click();
    } else {
      byId('m-learn')?.click();
      if (panel.getAttribute('aria-pressed') !== 'true') panel.click();
    }
  });
  parts.setAttribute('aria-controls', 'shop');
  function syncPanel() {
    parts.setAttribute('aria-expanded', String(!root.classList.contains('nopanel') &&
      byId('m-learn')?.getAttribute('aria-pressed') === 'true'));
  }
  syncPanel();
  const panelObserver = new MutationObserver(syncPanel);
  panelObserver.observe(root, {attributes:true, attributeFilter:['class']});
  if (byId('m-learn')) panelObserver.observe(byId('m-learn'), {attributes:true, attributeFilter:['aria-pressed']});
  moveControl('bSection', 'Potongan');
  slider.classList.add('studio-explode');
  root.append(slider);
  slider.querySelector('label').textContent = 'Jarak bongkar';
  function toggleTray(tray, button, open) {
    tray.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }
  const explode = action('Bongkar', slider, () => {
    toggleTray(tools, more, false);
    toggleTray(slider, explode, slider.hidden);
  });
  moveControl('bSpin', 'Animasi');
  moveControl('bReset', 'Reset');
  const more = action('Alat', byId('bMenu'), () => {
    toggleTray(slider, explode, false);
    toggleTray(tools, more, tools.hidden);
  });
  toggleTray(slider, explode, false);
  toggleTray(tools, more, false);
  const room = window.__pp?.room?.group;
  if (room) {
    room.visible = false;
    const roomButton = action('Ruang mesin', byId('bXray'), () => {
      room.visible = !room.visible;
      roomButton.setAttribute('aria-pressed', String(room.visible));
    });
    tools.append(roomButton);
    roomButton.setAttribute('aria-pressed', 'false');
  }
  const displayOptions = ['bSection', 'bXray', 'bMat', 'bIso', 'bPins', 'bSpin']
    .map(byId).filter(Boolean)
    .map(button => [button, button.getAttribute('aria-pressed')]);
  byId('bReset')?.addEventListener('click', () => {
    toggleTray(slider, explode, false);
    for (const [button, initial] of displayOptions) {
      if (button.getAttribute('aria-pressed') !== initial) button.click();
    }
  });

  const list = byId('plist');
  if (list) {
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

  const selected = byId('stSel');
  if (selected) {
    let previous = selected.textContent;
    new MutationObserver(() => {
      const name = selected.textContent;
      if (name !== previous && name !== '–' && root.classList.contains('nopanel') &&
          byId('m-learn')?.getAttribute('aria-pressed') === 'true') panel.click();
      previous = name;
    }).observe(selected, {childList:true});
  }
  byId('selgo')?.addEventListener('click', () => {
    if (root.classList.contains('nopanel')) panel.click();
  });
  if (matchMedia('(max-width: 760px)').matches && !root.classList.contains('nomenu')) byId('bMenu').click();
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!tools.hidden) { toggleTray(tools, more, false); more.focus(); }
    else if (!slider.hidden) { toggleTray(slider, explode, false); explode.focus(); }
    else if (!root.classList.contains('nopanel')) { byId('bClose').click(); parts.focus(); }
  });
})();
