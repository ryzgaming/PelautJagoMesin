/*!
 * Orang Mesin — efek pembakaran di ruang bakar (three.js r128+).
 * Tiap silinder: semburan injektor sebelum TMA, nyala api yang naik cepat lalu meredup selama
 * langkah usaha, kilau panas, dan (opsional, desktop) cahaya titik yang menerangi dinding.
 * Waktu mengikuti sudut engkol: urutan nyala dari firing order DOKUMEN, bukan karangan.
 * Tampilan diatur oleh gaya-efek.json → "pembakaran" (lihat references/), sehingga efek bisa
 * dipoles tanpa mengubah cara viewer memakai modul ini.
 *
 *   const fire = OrangMesinFire.create(THREE, {cylinders, firingOrder: ["c1","c3","c4","c2"], style});
 *   engineRoot.add(fire.group); fire.start(); // loop: fire.update(dt)
 *   // atau ikuti klip Blender: fire.setCrank(derajat) setiap frame
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OrangMesinFire = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT = {
    warna_inti: "#fff4cf", warna_api: "#ff9a2e", warna_tepi: "#ff4a1c", warna_semburan: "#d9ecff",
    terang: 1.6, ukuran: 1.0, turbulensi: 0.6, naik_deg: 8, padam_deg: 45,
    semburan_mulai_deg: -14, semburan_selesai_deg: 4, cahaya: true, cahaya_jarak_bore: 3,
  };

  /** Sudut bertanda terhadap TMA pembakaran silinder: 0 = TMA nyala, rentang [-siklus/2, siklus/2). */
  function signedAngle(crankDeg, phaseDeg, cycleDeg) {
    const a = ((crankDeg - phaseDeg) % cycleDeg + cycleDeg) % cycleDeg;
    return a >= cycleDeg / 2 ? a - cycleDeg : a;
  }
  /** Intensitas nyala 0..1: naik linear sampai naik_deg, lalu meluruh eksponensial (padam_deg). */
  function flameAt(s, g) {
    if (s < 0) return 0;
    if (s < g.naik_deg) return s / g.naik_deg;
    return Math.exp(-(s - g.naik_deg) / g.padam_deg);
  }
  function sprayAt(s, g) {
    const a = g.semburan_mulai_deg, b = g.semburan_selesai_deg;
    if (s < a || s > b) return 0;
    return Math.sin(Math.PI * (s - a) / (b - a));
  }

  const flameVertex = `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){
      vP = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const flameFragment = `
    uniform float uI, uTime, uTurb, uBright, uR, uHeat, uFlash;
    uniform vec3 uCore, uFlame, uEdge;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
    float n3(vec3 p){
      vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x), f.y),
                 mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x), f.y), f.z);
    }
    void main(){
      if (uI < 0.002) discard;
      float facing = abs(dot(normalize(vN), normalize(vV)));
      vec3 p = vP / uR;
      vec3 q = p * 3.2;
      q.xz += vec2(sin(q.y + uTime * 1.3), cos(q.y - uTime)) * 0.22;
      float turb = n3(q + vec3(0.0, -uTime * 2.8, uTime * 0.5)) * 0.68
                 + n3(q * 2.1 + vec3(0.7, -uTime * 4.0, 1.3)) * 0.32;
      float density = smoothstep(0.23, 0.72, turb + facing * 0.24);
      // The sphere already fits the bore; radial masking would cut a dark equator.
      float silhouette = smoothstep(0.0, 0.30, facing);
      float flame = mix(0.68, density, clamp(uTurb, 0.0, 1.0));
      float core = pow(facing, 1.6) * smoothstep(0.34, 0.78, turb) *
                   (0.5 + 0.5 * smoothstep(-0.35, 0.7, p.y));
      vec3 ember = uEdge * 0.42;
      vec3 col = mix(ember, mix(uEdge, uFlame, flame), uHeat);
      col = mix(col, uCore, clamp(core * uHeat * 0.78 + uFlash * core * 0.30, 0.0, 0.82));
      float a = uI * silhouette * (0.24 + flame * 0.65);
      gl_FragColor = vec4(col * uBright * (0.64 + 0.36 * uHeat), a);
    }`;
  const sprayFragment = `
    uniform float uI, uTime, uIgnition; uniform vec3 uColor, uWarm;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      if (uI < 0.002) discard;
      float along = 1.0 - vUv.y; // ConeGeometry puts the nozzle apex at uv.y = 1.
      float angle = vUv.x * 6.2831853;
      float travel = along * 16.0 - uTime * 32.0;
      float streak = pow(0.5 + 0.5 * sin(angle * 11.0 + sin(travel) * 0.7), 5.0);
      float droplets = 0.52 + 0.48 * sin(travel * 2.7 + angle * 3.0);
      float facing = abs(dot(normalize(vN), normalize(vV)));
      float edge = smoothstep(0.0, 0.40, facing);
      float tip = smoothstep(0.0, 0.045, along);
      float end = 1.0 - smoothstep(0.52, 1.0, along);
      float mist = 0.17 + streak * (0.22 + 0.27 * droplets);
      float a = uI * tip * end * edge * mist;
      vec3 col = mix(uColor, uWarm, uIgnition * smoothstep(0.12, 0.85, along) * 0.65);
      gl_FragColor = vec4(col, a);
    }`;
  const sprayVertex = `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;

  function create(THREE, options) {
    const opt = Object.assign({cylinders: [], firingOrder: null, cycleDeg: 720, ratedRpm: 1000, rpm: null,
      timeScale: 1, mobile: false, style: null, timing: null, kinematics: null}, options || {});
    if (!opt.cylinders.length) throw new Error("OrangMesinFire: cylinders wajib diisi.");
    if (opt.cycleDeg !== 720 && opt.cycleDeg !== 360) throw new Error("OrangMesinFire: cycleDeg 720 (4 tak) atau 360 (2 tak).");
    // Gaya (tampilan) lalu timing (data mesin dari manual/register) yang selalu menang atas gaya.
    const g = Object.assign({}, DEFAULT, (opt.style && opt.style.pembakaran) || {}, opt.timing || {});
    const byId = new Map(opt.cylinders.map(c => [c.id, c]));
    const order = opt.firingOrder || null;
    if (order) {
      if (order.length !== opt.cylinders.length || new Set(order).size !== order.length || order.some(id => !byId.has(id)))
        throw new Error("OrangMesinFire: firingOrder harus memuat setiap silinder tepat sekali.");
    } else if (opt.cylinders.some(c => typeof c.phase_deg !== "number")) {
      throw new Error("OrangMesinFire: beri firingOrder (interval merata) atau phase_deg tiap silinder dari manual.");
    }
    const phase = new Map(opt.cylinders.map(c => [c.id,
      typeof c.phase_deg === "number" ? c.phase_deg : order.indexOf(c.id) * opt.cycleDeg / order.length]));

    const group = new THREE.Group(); group.name = "orang-mesin-fire";
    const up = new THREE.Vector3(0, 1, 0), parts = [];
    let crank = 0, rpm = opt.rpm != null ? opt.rpm : opt.ratedRpm, running = false, clock = 0;
    const lightsOn = g.cahaya && !opt.mobile;

    for (const c of opt.cylinders) {
      const r = (c.bore_m || 0.1) * 0.5 * g.ukuran;
      const axis = new THREE.Vector3().fromArray(c.axis || [0, 1, 0]).normalize();
      const pos = new THREE.Vector3().fromArray(c.position);
      const uniforms = {
        uI: {value: 0}, uTime: {value: 0}, uHeat: {value: 0}, uFlash: {value: 0}, uTurb: {value: g.turbulensi}, uBright: {value: g.terang}, uR: {value: r},
        uCore: {value: new THREE.Color(g.warna_inti)}, uFlame: {value: new THREE.Color(g.warna_api)}, uEdge: {value: new THREE.Color(g.warna_tepi)},
      };
      const flame = new THREE.Mesh(new THREE.SphereGeometry(r, opt.mobile ? 16 : 28, opt.mobile ? 12 : 20),
        new THREE.ShaderMaterial({vertexShader: flameVertex, fragmentShader: flameFragment, uniforms,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
      flame.position.copy(pos);
      flame.quaternion.setFromUnitVectors(up, axis);
      flame.scale.set(1, 0.55, 1);                       // ruang bakar pipih di sepanjang sumbu bore
      flame.renderOrder = 30; flame.name = "api:" + c.id; flame.visible = false;
      group.add(flame);

      let spray = null;
      if (c.injector) {
        const tip = new THREE.Vector3().fromArray(c.injector), dir = pos.clone().sub(tip), len = dir.length();
        const su = {uI: {value: 0}, uTime: {value: 0}, uColor: {value: new THREE.Color(g.warna_semburan)}, uWarm: {value: new THREE.Color(g.warna_inti)}, uIgnition: {value: 0}};
        spray = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, len, 18, 1, true),
          new THREE.ShaderMaterial({vertexShader: sprayVertex, fragmentShader: sprayFragment, uniforms: su,
            transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending}));
        // Puncak kerucut di ujung injektor, mengembang ke ruang bakar.
        spray.position.copy(tip.clone().add(dir.clone().multiplyScalar(0.5)));
        spray.quaternion.setFromUnitVectors(up, dir.clone().normalize().negate());
        spray.renderOrder = 31; spray.name = "semburan:" + c.id; spray.visible = false;
        group.add(spray);
      }
      let light = null;
      if (lightsOn) {
        light = new THREE.PointLight(new THREE.Color(g.warna_api), 0, (c.bore_m || 0.1) * g.cahaya_jarak_bore, 2);
        light.position.copy(pos); group.add(light);
      }
      parts.push({id: c.id, flame, spray, light, uniforms, bore: c.bore_m || 0.1, r, axis, pos});
    }

    function apply() {
      for (const p of parts) {
        const s = signedAngle(crank, phase.get(p.id), opt.cycleDeg);
        const f = flameAt(s, g), sp = sprayAt(s, g);
        p.uniforms.uI.value = f; p.uniforms.uTime.value = clock;
        p.uniforms.uHeat.value = Math.min(1, Math.max(0, 1 - Math.max(0, s - g.naik_deg) / (g.padam_deg * 2.0)));
        p.uniforms.uFlash.value = s >= 0 && s < g.naik_deg ? Math.sin(Math.PI * s / g.naik_deg) : 0;
        p.flame.visible = f > 0.002;
        // Api tidak melebihi diameter bore. Dengan kinematics, api mengisi ruang antara kepala
        // silinder dan mahkota piston yang turun selama langkah usaha (rumus slider-crank).
        let half = 0.55 * p.r, shift = 0;
        if (opt.kinematics && s > 0) {
          const kr = opt.kinematics.stroke_m / 2, kl = opt.kinematics.rod_length_m, a = s * Math.PI / 180;
          const drop = (kr + kl) - (kr * Math.cos(a) + Math.sqrt(kl * kl - Math.pow(kr * Math.sin(a), 2)));
          half += drop / 2; shift = drop / 2;
        }
        p.flame.scale.set(1, half / p.r, 1);
        p.flame.position.copy(p.pos).addScaledVector(p.axis, -shift);
        if (p.light) p.light.position.copy(p.flame.position);
        if (p.spray) {
          const sprayUniforms = p.spray.material.uniforms;
          sprayUniforms.uI.value = sp;
          sprayUniforms.uTime.value = clock;
          sprayUniforms.uIgnition.value = Math.max(0, Math.min(1,
            (s - g.semburan_mulai_deg) / (g.semburan_selesai_deg - g.semburan_mulai_deg)));
          p.spray.visible = sp > 0.002;
        }
        if (p.light) p.light.intensity = f * g.terang * 1.5;
      }
    }
    apply();

    return {
      group, style: g, phases: () => Object.fromEntries(phase),
      start() { running = true; }, pause() { running = false; }, resume() { running = true; },
      get running() { return running; }, get crankDeg() { return crank; },
      setRpm(value) { rpm = Math.max(0, value); },
      /** Ikuti sudut engkol dari sumber lain (klip Blender / register gerak). */
      setCrank(deg) { crank = ((deg % opt.cycleDeg) + opt.cycleDeg) % opt.cycleDeg; apply(); },
      update(dt) {
        dt = Math.min(Math.max(dt || 0, 0), 0.1);
        if (!running) return;
        clock += dt;
        crank = (crank + rpm * 6 * dt * opt.timeScale) % opt.cycleDeg;
        apply();
      },
      /** Sampel QA: sudut terhadap TMA nyala serta intensitas api/semburan silinder ini. */
      probe(id) {
        if (!phase.has(id)) return null;
        const s = signedAngle(crank, phase.get(id), opt.cycleDeg);
        return {id, crank_deg: crank, angle_from_firing_tdc: s, flame: flameAt(s, g), spray: sprayAt(s, g), state: running ? "running" : "paused"};
      },
      dispose() { for (const p of parts) { p.flame.geometry.dispose(); p.flame.material.dispose(); if (p.spray) { p.spray.geometry.dispose(); p.spray.material.dispose(); } } group.clear(); },
    };
  }

  return {create, signedAngle, flameAt, sprayAt, DEFAULT, version: "1.0.0"};
});
