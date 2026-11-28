/*!
 * Orang Mesin — animasi aliran fluida di dalam pipa/lorong (three.js r128+).
 * Pita cairan bergerak sepanjang centerline routes.json: badan cairan semi-transparan dengan
 * pantulan tepi, gelombang "komet" yang mengalir searah lintasan, pengisian bertahap saat Start,
 * jeda/lanjut tanpa lompatan fase, kecepatan mengikuti putaran mesin, dan lintasan tersembunyi
 * yang hanya tampil saat X-ray. Tanpa partikel CPU: satu ShaderMaterial per media, ringan di HP.
 *
 * Pemakaian (script biasa, THREE global):
 *   <script src="flow-ribbons.js"></script>
 *   const flow = OrangMesinFlow.create(THREE, {routes, scope});
 *   scene.add(flow.group); flow.start();            // isi pipa lalu mengalir
 *   // di loop render: flow.update(dt, camera)
 * Modul ES: import "./flow-ribbons.js"; lalu globalThis.OrangMesinFlow.
 * Lisensi: bagian dari repo PelautJagoMesin.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OrangMesinFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Warna mengikuti keluarga warna ISO 14726 (penandaan pipa kapal), dicerahkan agar terbaca di
  // latar graphite. Gas buang memakai rona panas karena hitam/abu tidak terlihat; lihat references/.
  const MEDIA = {
    fresh_water: {label: "Air tawar pendingin", color: "#3aa8ff", speed: 1.0, body: 0.34, density: 2.2, glow: false},
    sea_water:   {label: "Air laut",            color: "#2fd88f", speed: 1.0, body: 0.32, density: 2.2, glow: false},
    lube_oil:    {label: "Oli pelumas",         color: "#ffb02e", speed: 0.55, body: 0.55, density: 1.6, glow: false},
    fuel:        {label: "Bahan bakar",         color: "#c8743a", speed: 0.8, body: 0.5, density: 2.6, glow: false},
    charge_air:  {label: "Udara bilas/masuk",   color: "#b9dcf2", speed: 2.4, body: 0.08, density: 3.2, glow: true},
    exhaust:     {label: "Gas buang",           color: "#ff6a3d", speed: 2.8, body: 0.1, density: 3.0, glow: true},
    start_air:   {label: "Udara start",         color: "#c9ced6", speed: 3.0, body: 0.06, density: 3.6, glow: true},
    unknown:     {label: "Media belum dikenal", color: "#9aa5ad", speed: 0.8, body: 0.2, density: 2.0, glow: false},
  };
  const KEYWORDS = [
    ["sea_water", /sea|laut|raw water/i],
    ["fuel", /fuel|bahan bakar|hfo|mdo|mgo|diesel oil|solar/i],
    ["lube_oil", /lub|\boli\b|pelumas|\boil\b/i],
    ["start_air", /start(ing)?.?air|udara start/i],
    ["exhaust", /exhaust|gas buang|flue/i],
    ["charge_air", /charge|scav|intake|udara (masuk|bilas)|air inlet|boost/i],
    ["fresh_water", /fresh|jacket|coolant|cooling|tawar|ht water|lt water|pendingin/i],
  ];
  const VALID_BASIS = /^(OBSERVED|DOCUMENTED)$/i;

  /** Kunci media dari nama bebas di scope.json ("jacket water", "lube oil", "udara bilas"...). */
  function mediumKey(name) {
    if (!name) return "unknown";
    if (MEDIA[name]) return name;
    for (const [key, re] of KEYWORDS) if (re.test(name)) return key;
    return "unknown";
  }

  const vertex = `
    attribute float aS;
    varying float vS; varying float vA; varying vec3 vN; varying vec3 vV;
    void main(){
      vS = aS; vA = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const fragment = `
    uniform vec3 uColor; uniform float uPhase, uDensity, uBody, uOpacity, uFill, uVisible, uEstimated, uBubbles;
    varying float vS; varying float vA; varying vec3 vN; varying vec3 vV;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      if (vS > uFill || uVisible <= 0.001) discard;
      float x = (vS - uPhase) * uDensity;
      float cell = floor(x), f = fract(x);
      float j = hash(cell) * 0.3;
      float tail = clamp((f - 0.1 - j) / 0.6, 0.0, 1.0);
      float comet = tail * tail * (1.0 - smoothstep(0.72, 0.8, f));
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      float front = 1.0 - smoothstep(0.0, 0.15, uFill - vS);
      // Gelembung/serpih kecil yang ikut arus (cairan) memberi kesan volume dan kecepatan.
      vec2 g = vec2((vS - uPhase * 1.15) * 14.0, vA * 7.0);
      vec2 gi = floor(g), gf = fract(g) - 0.5;
      float b = step(0.82, hash(gi.x * 17.0 + gi.y * 131.0)) * (1.0 - smoothstep(0.08, 0.22, length(gf)));
      float body = uBody * (0.45 + 1.0 * fres);
      float a = body + comet * 0.9 + front * 0.6 + b * uBubbles * 0.55;
      if (uEstimated > 0.5) a *= step(0.5, fract(vS * 6.0)) * 0.6 + 0.15;
      vec3 col = mix(uColor * (0.8 + 0.4 * comet), vec3(1.0), clamp(comet * 0.55 + fres * 0.2 + front * 0.45 + b * uBubbles * 0.5, 0.0, 1.0));
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity * uVisible);
    }`;

  function create(THREE, options) {
    const opt = Object.assign({
      routes: null, scope: null, medium: {}, mobile: false, radius: 0.012,
      radiusByMedium: {}, timeScale: 1, ratedRpm: 1000, showEstimated: true, palette: {}, style: null,
    }, options || {});
    if (!opt.routes || !opt.routes.links) throw new Error("OrangMesinFlow: routes.links wajib diisi (format routes.json).");
    // Gaya bersama (references/gaya-efek.json → "media") lalu palette per viewer; nilai bawaan MEDIA.
    const styleMedia = (opt.style && opt.style.media) || {};
    const media = {};
    for (const k of Object.keys(MEDIA)) media[k] = Object.assign({}, MEDIA[k], styleMedia[k] || {}, opt.palette[k] || {});

    const group = new THREE.Group();
    group.name = "orang-mesin-flow";
    const materials = new Map(), links = new Map(), warnings = [];
    const circuits = (opt.scope && opt.scope.circuits) || {};
    const scopeLinks = (opt.scope && opt.scope.links) || {};
    let rpm = opt.ratedRpm, running = false, xray = false, filled = Infinity, fillRate = 0;
    const hiddenFade = {value: 0};
    const tracked = new Map();

    function material(key, hidden, estimated) {
      const id = key + (hidden ? ":h" : "") + (estimated ? ":e" : "");
      if (materials.has(id)) return materials.get(id);
      const m = media[key];
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false,
        depthTest: !hidden, side: THREE.DoubleSide,
        blending: m.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          uColor: {value: new THREE.Color(m.color)}, uPhase: {value: 0}, uDensity: {value: m.density},
          uBody: {value: m.body}, uOpacity: {value: estimated ? 0.6 : 1}, uFill: {value: 1e9},
          uVisible: hidden ? hiddenFade : {value: 1}, uEstimated: {value: estimated ? 1 : 0}, uBubbles: {value: m.glow ? 0 : 1},
        },
      });
      mat.userData = {key, hidden, estimated, phase: 0};
      materials.set(id, mat);
      return mat;
    }

    for (const [linkId, link] of Object.entries(opt.routes.links)) {
      const spans = (link.spans || []).filter(s => Array.isArray(s.points) && s.points.length >= 2);
      if (!spans.length) continue;
      const circuit = circuits[(scopeLinks[linkId] || {}).circuit] || {};
      const key = mediumKey(opt.medium[linkId] || circuit.medium || link.medium);
      if (key === "unknown") warnings.push(linkId + ": media tidak dikenal (" + (circuit.medium || link.medium || "kosong") + ")");
      const estimated = !VALID_BASIS.test(String(link.geometry_basis || "")) || /partial|unverified/i.test(String(link.status || ""));
      if (estimated && !opt.showEstimated) continue;
      const radius = opt.radiusByMedium[key] || opt.radius;
      const entry = {id: linkId, key, estimated, curves: [], lengths: [], total: 0, meshes: []};
      for (const span of spans) {
        const pts = span.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        const len = curve.getLength();
        const seg = Math.max(8, Math.min(opt.mobile ? 160 : 320, Math.ceil(len * (opt.mobile ? 30 : 60))));
        const geo = new THREE.TubeGeometry(curve, seg, radius, opt.mobile ? 8 : 12, false);
        // Jarak sepanjang lintasan (meter) dihitung kumulatif agar gelombang menyambung antar span.
        const uv = geo.attributes.uv, s = new Float32Array(uv.count);
        for (let i = 0; i < uv.count; i++) s[i] = entry.total + uv.getX(i) * len;
        geo.setAttribute("aS", new THREE.BufferAttribute(s, 1));
        const mesh = new THREE.Mesh(geo, material(key, span.kind === "hidden", estimated));
        mesh.name = "flow:" + linkId + ":" + (span.passage || span.carrier || entry.curves.length);
        mesh.renderOrder = span.kind === "hidden" ? 20 : 10;
        mesh.userData.flow = {link: linkId, medium: key, kind: span.kind, carrier: span.carrier, passage: span.passage};
        group.add(mesh);
        entry.curves.push(curve); entry.lengths.push(len); entry.total += len; entry.meshes.push(mesh);
      }
      links.set(linkId, entry);
    }
    const longest = Math.max(0, ...[...links.values()].map(l => l.total));

    function setUniform(name, value) { for (const m of materials.values()) m.uniforms[name].value = value; }
    function speedOf(key) { return media[key].speed * (rpm / opt.ratedRpm) * opt.timeScale; }

    const api = {
      group, media, warnings,
      links: () => [...links.values()].map(l => ({id: l.id, medium: l.key, label: media[l.key].label, length_m: l.total, estimated: l.estimated})),
      /** Mulai: pipa terisi dari inlet ke outlet selama fillSeconds, lalu mengalir. */
      start(o) {
        const sec = (o && o.fillSeconds != null) ? o.fillSeconds : 2.5;
        running = true; filled = sec > 0 ? 0 : Infinity; fillRate = sec > 0 ? longest / sec : 0;
        setUniform("uFill", sec > 0 ? 0 : 1e9);
      },
      stop() { running = false; filled = 0; fillRate = 0; setUniform("uFill", 0); },
      pause() { running = false; },
      resume() { running = true; },
      get running() { return running; },
      setRpm(value, rated) { rpm = Math.max(0, value); if (rated) opt.ratedRpm = rated; },
      /** X-ray: lintasan tersembunyi (di dalam coran/housing) memudar masuk; tidak tertutup benda padat. */
      setXray(on) { xray = !!on; },
      showMedia(keys) { const set = keys ? new Set(keys.map(mediumKey)) : null; for (const l of links.values()) for (const m of l.meshes) m.visible = !set || set.has(l.key); },
      update(dt) {
        dt = Math.min(Math.max(dt || 0, 0), 0.1);
        hiddenFade.value += ((xray ? 1 : 0) - hiddenFade.value) * Math.min(1, dt * 6);
        if (!running) return;
        for (const m of materials.values()) { m.userData.phase += speedOf(m.userData.key) * dt; m.uniforms.uPhase.value = m.userData.phase; }
        if (filled < longest + 0.2) { filled += fillRate * dt; setUniform("uFill", filled >= longest ? 1e9 : filled); if (filled >= longest) filled = Infinity; }
      },
      /**
       * Sampel QA (FLOW-ROUTING runtime): posisi kepala gelombang pertama pada link, sebagai
       * fraksi panjang lintasan dan titik world (datum mesin, tanpa transform viewer bila group di root).
       */
      probe(linkId, o) {
        const l = links.get(linkId); if (!l) return null;
        const mat = l.meshes[0].material, density = mat.uniforms.uDensity.value;
        const phase = mat.userData.phase;
        // Ikuti SATU gelombang yang sama antar panggilan (kepala di s = (k + 0.76)/density + phase),
        // sehingga fraksi naik monoton sampai gelombang keluar dari outlet (rollover → reset).
        let k = tracked.get(linkId);
        const head = n => (n + 0.76) / density + phase;
        if (k == null || (o && o.reset) || head(k) > l.total) { k = Math.ceil(-phase * density - 0.76); tracked.set(linkId, k); }
        const s = Math.max(0, Math.min(head(k), l.total));
        let rest = s, i = 0;
        while (i < l.lengths.length - 1 && rest > l.lengths[i]) { rest -= l.lengths[i]; i++; }
        const p = l.curves[i].getPointAt(Math.min(1, rest / l.lengths[i])).clone();
        group.updateWorldMatrix(true, false); p.applyMatrix4(group.matrixWorld);
        return {link: linkId, medium: l.key, state: running ? "running" : "paused", fraction: s / l.total,
          phase_m: phase, world: [p.x, p.y, p.z], visible: l.meshes[i].visible && (l.meshes[i].userData.flow.kind !== "hidden" || hiddenFade.value > 0.5)};
      },
      dispose() { for (const l of links.values()) for (const m of l.meshes) m.geometry.dispose(); for (const m of materials.values()) m.dispose(); group.clear(); },
    };
    return api;
  }

  return {create, MEDIA, mediumKey, version: "1.0.0"};
});
