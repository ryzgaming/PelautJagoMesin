// Detail view for PelautSim. Each callout is scoped to one catalog row in one assembly.
window.openAssemblyDiagram = function (model, part, stage, panel) {
  const T = window.THREE;
  const box = new T.Box3().setFromObject(part.group);
  const size = box.getSize(new T.Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.01);
  function visibleInAssembly(mesh) {
    for (let object = mesh; object && object !== part.group; object = object.parent) {
      if (!object.visible) return false;
    }
    return true;
  }
  const rows = part.rows.map((row, index) => {
    const geometry = part.meshes.filter(mesh => mesh.userData.no === row[0]);
    return {row, index, modeled:geometry.length > 0, meshes:geometry.filter(visibleInAssembly)};
  });
  const mapped = rows.filter(entry => entry.meshes.length);
  const poses = [];
  for (const [order, entry] of mapped.entries()) {
    const authored = entry.meshes.some(({userData:u}) => u.ev?.lengthSq() || u.rx?.v.lengthSq());
    for (const mesh of entry.meshes) {
      const u = mesh.userData;
      const offset = u.ev?.clone() || new T.Vector3();
      if (u.rx) {
        const direction = u.rx.v.clone();
        if (!u.rx.loc && u.rotSrc) {
          const axis = part.ax2 ? part.rk : model.axis;
          const unit = new T.Vector3();
          unit[axis] = 1;
          direction.applyAxisAngle(unit, -u.rotSrc.rotation[axis]);
        }
        offset.add(direction);
      }
      // Catalog-only spacing for tagged geometry without an authored displacement.
      if (!authored && mapped.length > 1) offset[model.axis] = (order / (mapped.length - 1) - 0.5) * span;
      poses.push({mesh, base:u.ws.clone(), offset});
    }
  }

  const layer = document.createElement('div');
  layer.className = 'assembly-callouts';
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  layer.append(svg);
  stage.append(layer);
  const sheet = document.createElement('section');
  sheet.className = 'assembly-sheet';
  const heading = document.createElement('h3');
  heading.textContent = part.idn || part.en;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn';
  const note = document.createElement('p');
  note.textContent = 'Nomor penunjuk mengikuti daftar di bawah. Jarak urai bersifat ilustratif.';
  const list = document.createElement('ol');
  sheet.append(heading, note, toggle, list);
  panel.prepend(sheet);
  const markers = [];
  const quantityLabels = {
    ilustrasi: 'Jumlah pada model', dihitung: 'Jumlah dari gambar',
    interpretasi: 'Jumlah perkiraan', referensi: 'Jumlah dari referensi'
  };
  for (const entry of rows) {
    const {row,index,meshes} = entry;
    const li = document.createElement('li');
    const control = document.createElement(meshes.length ? 'button' : 'span');
    if (meshes.length) control.type = 'button';
    control.textContent = row[1];
    const meta = document.createElement('small');
    const status = model.rowStatus?.(part, row) || {};
    const modelNumber = status.nomor === 'model' || status.nomor === 'model-resmi' || part.meta?.[row[0]]?.n === 'model';
    const sourceLabel = modelNumber ? 'No. posisi model' : model.cfg?.nosLabel || 'No. referensi';
    const identifier = /^[–—]/.test(String(row[0])) ? 'Nomor belum tersedia'
      : sourceLabel + ' ' + row[0];
    const quantity = status.jumlah === 'belum' || /^[–—]$/.test(String(row[2]))
      ? 'Jumlah belum tersedia' : (quantityLabels[status.jumlah] || 'Jumlah') + ' ' + row[2];
    const labels = [identifier, quantity];
    if (!meshes.length) labels.push(entry.modeled ? 'Tersembunyi pada tampilan ini' : 'Data katalog');
    meta.textContent = labels.join(' · ');
    li.append(control, meta);
    list.append(li);
    if (!meshes.length) continue;
    const select = () => part.trows[index].click();
    control.addEventListener('click', select);
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.textContent = String(index + 1);
    marker.setAttribute('aria-label', (index + 1) + '. ' + row[1]);
    marker.addEventListener('click', select);
    const line = document.createElementNS(svg.namespaceURI,'line');
    svg.append(line);
    layer.append(marker);
    // Anchor on the largest mesh carrying this row's identifier.
    let anchor, radius = -1;
    for (const mesh of meshes) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      if (mesh.geometry.boundingSphere.radius > radius) {
        anchor = mesh;
        radius = mesh.geometry.boundingSphere.radius;
      }
    }
    // A real surface vertex keeps the pointer on metal, including hollow rings.
    const vertices = anchor.geometry.getAttribute('position');
    const local = new T.Vector3().fromBufferAttribute(vertices, 0);
    for (let i = 1; i < vertices.count; i++) {
      if (vertices.getY(i) > local.y) local.fromBufferAttribute(vertices, i);
    }
    markers.push({anchor,local,marker,line,control,index,point:new T.Vector3()});
  }

  let spread = true;
  function applyPose() {
    for (const {mesh,base,offset} of poses) {
      mesh.userData.ws.copy(base);
      if (spread) mesh.userData.ws.add(offset);
      mesh.position.copy(mesh.userData.ws);
    }
    part.group.updateMatrixWorld(true);
    toggle.textContent = spread ? 'Rapatkan rakitan' : 'Uraikan rakitan';
  }
  toggle.hidden = !poses.some(p => p.offset.lengthSq()>0);
  toggle.addEventListener('click', () => { spread = !spread; applyPose(); });
  applyPose();

  let frame;
  function project() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const columns = [[],[]];
    for (const entry of markers) {
      const {anchor,local,point,marker,line,index,control} = entry;
      point.copy(local).applyMatrix4(anchor.matrixWorld).project(model.camera);
      const visible = Math.abs(point.x)<1 && Math.abs(point.y)<1 && Math.abs(point.z)<1;
      marker.hidden = !visible;
      line.style.display = visible ? '' : 'none';
      const active = part.trows[index].getAttribute('aria-pressed') === 'true';
      if (entry.active !== active) {
        control.setAttribute('aria-pressed', String(active));
        marker.setAttribute('aria-pressed', String(active));
        entry.active = active;
      }
      if (visible) columns[point.x < 0 ? 0 : 1].push(entry);
    }
    columns.forEach((entries, side) => {
      // The numbered list remains complete on narrow or crowded views.
      const capacity = Math.max(1, Math.floor((h - 4) / 28));
      if (entries.length > capacity) {
        entries.sort((a,b) => Number(b.active) - Number(a.active) || a.index - b.index);
        for (const {marker,line} of entries.splice(capacity)) {
          marker.hidden = true;
          line.style.display = 'none';
        }
      }
      entries.sort((a,b) => b.point.y - a.point.y);
      const step = Math.min(30,(h-32)/Math.max(1,entries.length-1));
      let last = 14-step;
      entries.forEach(({point,marker,line}, i) => {
        const x = (1+point.x)*w/2, y = (1-point.y)*h/2;
        const lx = side ? w-18 : 18;
        const ly = Math.min(h-16-(entries.length-1-i)*step, Math.max(last+step,y));
        last = ly;
        marker.style.transform = 'translate('+lx+'px,'+ly+'px) translate(-50%,-50%)';
        line.setAttribute('x1',x); line.setAttribute('y1',y);
        line.setAttribute('x2',lx); line.setAttribute('y2',ly);
      });
    });
    frame = requestAnimationFrame(project);
  }
  project();
  return () => {
    cancelAnimationFrame(frame);
    for (const {mesh,base} of poses) { mesh.userData.ws.copy(base); mesh.position.copy(base); }
    sheet.remove();
    layer.remove();
  };
};
