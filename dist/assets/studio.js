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
  const footer = document.createElement('footer');
  footer.className = 'studio-footer';
  footer.append(dock);
  root.append(footer);

  const whole = document.createElement('button');
  whole.type = 'button';
  whole.append(document.createElement('span'));
  const xray = whole.cloneNode(true);
  let activeMode = whole;
  const modes = [[whole, 'Eksplor keseluruhan'], [system, 'Sistem'], [operation, 'Pengoperasian'], [xray, 'X-ray']];
  for (const [button, label] of modes) {
    button.querySelector('span').textContent = label;
    button.title = label;
    button.classList.add('btn', 'cb');
    button.setAttribute('aria-controls', 'shop');
    dock.append(button); // Keep the model's existing mode handler and simulation state.
    button.addEventListener('click', () => {
      activeMode = button;
      if (button === whole || button === xray) {
        model.shop.setTab('learn');
        close.click();
        for (const id of ['bSection', 'bIso']) {
          const control = byId(id);
          if (control?.getAttribute('aria-pressed') === 'true') control.click();
        }
        model?.clearSelection?.();
        byId('bReset').click();
        applyInspectionPose(button);
        scheduleOverviewFit();
      }
      syncPanel();
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
  const backLabel = document.createElement('span');
  backLabel.textContent = 'Kembali';
  backLabel.hidden = true;
  close.append(backLabel);
  const detail = byId('detail');
  const learn = byId('m-learn');
  const isolate = byId('bIso');
  const model = window.__pp;
  const parts = model?.parts || [];
  const initialZoomLimit = model?.controls.maxDistance;
  function applyInspectionPose(mode) {
    if (mode !== whole && mode !== xray) model.controls.maxDistance = initialZoomLimit;
    model.setOverviewPose(mode === whole);
    const control = byId('bXray');
    if ((control.getAttribute('aria-pressed') === 'true') !== (mode === xray)) control.click();
  }
  const explore = document.createElement('button');
  explore.type = 'button';
  explore.className = 'btn studio-explore';
  explore.textContent = 'Eksplor rakitan';
  explore.hidden = true;
  const context = document.createElement('div');
  context.className = 'studio-selection';
  const partName = document.createElement('span');
  context.append(partName, explore);
  context.hidden = true;
  footer.prepend(context);

  let assemblyView = null;
  function selectedPart() {
    return parts.find(part => part.li?.getAttribute('aria-pressed') === 'true');
  }
  function syncSelection() {
    const part = selectedPart();
    if (assemblyView && !part) {
      assemblyView.part.li.click();
      return;
    }
    const available = !assemblyView && root.dataset.mode !== 'op' &&
      part?.rows?.length > 0 && learn && isolate;
    context.hidden = explore.hidden = !available;
    partName.textContent = available ? (part.idn || part.en) : '';
  }
  if (detail) new MutationObserver(syncSelection).observe(detail, {childList:true});

  function leaveAssembly() {
    if (!assemblyView) return;
    assemblyView.disposeDiagram?.();
    if (assemblyView.isolatedByUs && isolate.getAttribute('aria-pressed') === 'true') isolate.click();
    byId('bReset')?.click();
    assemblyView = null;
    root.classList.remove('studio-assembly');
  }
  explore.addEventListener('click', () => {
    const part = selectedPart();
    if (!part?.rows?.length || assemblyView) return;
    const snapshot = {
      part,
      position: model.camera.position.clone(),
      target: model.controls.target.clone(),
      zoomLimit: model.controls.maxDistance,
      wasOpen: !root.classList.contains('nopanel'),
      previousMode: activeMode,
      isolatedByUs: isolate.getAttribute('aria-pressed') !== 'true'
    };
    applyInspectionPose(null);
    learn.click();
    assemblyView = snapshot;
    activeMode = snapshot.previousMode;
    part.li.click();
    if (assemblyView.isolatedByUs) isolate.click();
    root.classList.add('studio-assembly');
    snapshot.disposeDiagram = window.openAssemblyDiagram(model, part, byId('stage'), byId('pbody'));
    // Frame the selected geometry using the smaller viewport dimension.
    requestAnimationFrame(() => {
      if (assemblyView !== snapshot) return;
      const sphere = new THREE.Sphere();
      const bounds = new THREE.Box3().setFromObject(part.group);
      if (bounds.isEmpty()) return;
      bounds.getBoundingSphere(sphere);
      const {camera, controls} = model;
      const direction = camera.position.clone().sub(controls.target).normalize();
      const vertical = camera.fov * Math.PI / 360;
      const angle = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
      const distance = Math.min(controls.maxDistance,
        Math.max(controls.minDistance, 1.15 * sphere.radius / Math.sin(angle)));
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      controls.update();
    });
    byId('pbody').scrollTop = 0;
    syncPanel();
    close.focus();
  });

  // Release isolation before the simulator handles a navigation click.
  for (const [button] of modes) button.addEventListener('click', () => {
    leaveAssembly();
    if ((activeMode === whole || activeMode === xray) && (button === system || button === operation)) {
      applyInspectionPose(null);
      byId('bReset').click();
    }
  }, true);
  close.addEventListener('click', event => {
    if (!assemblyView) return;
    event.stopImmediatePropagation();
    const {previousMode, wasOpen, position, target, zoomLimit} = assemblyView;
    leaveAssembly();
    // Back preserves the original pick and camera. An explicit Overview click resets both.
    if (previousMode === whole || previousMode === xray) applyInspectionPose(previousMode);
    else previousMode?.click();
    if (!wasOpen) close.click();
    model.controls.maxDistance = zoomLimit;
    model.camera.position.copy(position);
    model.controls.target.copy(target);
    model.controls.update();
    syncPanel();
    (explore.hidden ? system : explore).focus();
  }, true);

  const stage = byId('stage');
  // Fit visible machine geometry in camera coordinates. Room, pipe diagrams and
  // presentation helpers must not enlarge the overview bounds.
  function fitOverview() {
    if (!model || (activeMode !== whole && activeMode !== xray) || assemblyView || selectedPart()) return;
    const {camera, controls} = model;
    const aspect = stage.clientWidth / stage.clientHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const points = [];
    const bounds = new THREE.Box3();
    controls.update();
    camera.updateMatrixWorld();
    for (const part of parts) {
      if (!part.group.visible) continue;
      part.group.updateWorldMatrix(true, true);
      for (const mesh of part.meshes) {
        if (!mesh.visible) continue;
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (box.isEmpty()) continue;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld)
                .applyMatrix4(camera.matrixWorldInverse);
              bounds.expandByPoint(point);
              points.push(point);
            }
          }
        }
      }
    }
    if (!points.length) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const vertical = Math.tan(camera.getEffectiveFOV() * Math.PI / 360) * 0.90;
    let distance = controls.minDistance;
    for (const point of points) {
      point.sub(center);
      distance = Math.max(distance, point.z + Math.abs(point.x)/(vertical*aspect),
        point.z + Math.abs(point.y)/vertical);
    }
    // Tall screens can need a wider zoom range to show separated assemblies.
    controls.maxDistance = Math.max(initialZoomLimit, distance);
    controls.target.copy(center).applyMatrix4(camera.matrixWorld);
    camera.position.set(0,0,distance).applyQuaternion(camera.quaternion).add(controls.target);
    controls.update();
  }
  let fitFrame;
  function scheduleOverviewFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitOverview);
  }
  if (window.ResizeObserver) new ResizeObserver(scheduleOverviewFit).observe(stage);
  applyInspectionPose(whole);
  scheduleOverviewFit();

  const readouts = [...stage.querySelectorAll('.plhud, #discl, .pumpnote')];
  close.click();
  function syncPanel() {
    const inSystem = activeMode !== operation;
    root.classList.toggle('studio-overview', activeMode === whole && !assemblyView);
    backLabel.hidden = !assemblyView;
    close.setAttribute('aria-label', assemblyView ? 'Kembali ke ' + activeMode.textContent.toLowerCase() : 'Tutup panel');
    root.classList.toggle('studio-system', inSystem);
    // Keep instrument readings and model notices available outside the canvas.
    for (const item of readouts) {
      const container = inSystem ? byId('pbody') : stage;
      if (item.parentElement !== container) container.prepend(item);
    }
    for (const [button, label] of modes) {
      const active = button === activeMode;
      button.setAttribute('aria-current', active ? 'page' : 'false');
      button.setAttribute('aria-expanded', String(active && !root.classList.contains('nopanel')));
      if (active) byId('pTitle').textContent = assemblyView ? 'Eksplor rakitan' : label;
    }
    syncSelection();
  }
  syncPanel();
  new MutationObserver(syncPanel).observe(root, {
    attributes:true, attributeFilter:['class','data-mode']
  });
  close.addEventListener('click', () => {
    activeMode.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !root.classList.contains('nopanel')) close.click();
  });
})();
