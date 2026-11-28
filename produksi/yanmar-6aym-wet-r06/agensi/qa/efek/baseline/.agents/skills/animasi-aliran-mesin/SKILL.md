---
name: animasi-aliran-mesin
description: Membuat dan memeriksa animasi aliran air pendingin, air laut, oli, bahan bakar, udara dan gas buang serta efek pembakaran (semburan injektor, nyala api per firing order) di viewer three.js mesin Orang Mesin (mode Pengoperasian, tombol Start, X-ray). Pakai saat menambah atau memperbaiki animasi fluida, pembakaran, atau tur Start mesin. Jangan dipakai untuk menentukan rute pipa; rute dan arah berasal dari FLOW-ROUTING.
---

# Animasi aliran dan pembakaran mesin

Tujuan: aliran terlihat seperti cairan sungguhan di dalam pipa (badan cairan, kilau tepi, gelombang
yang mengalir, gelembung kecil, pengisian saat Start), tetap ringan di HP, dan tetap jujur terhadap
bukti rute. Keindahan tidak boleh menambah jalur yang tidak terbukti.

## Lokasi alat (relatif ke root repo)

| Alat | Path | Fungsi |
|---|---|---|
| Modul animasi | `.agents/skills/animasi-aliran-mesin/scripts/flow-ribbons.js` | `OrangMesinFlow.create(THREE, {routes, scope, style})` membuat pita cairan dari `model/flow/routes.json` |
| Modul pembakaran | `.agents/skills/animasi-aliran-mesin/scripts/combustion-glow.js` | `OrangMesinFire.create(THREE, {cylinders, firingOrder, style, timing, kinematics})` semburan + nyala per silinder |
| Gaya efek | `.agents/skills/animasi-aliran-mesin/references/gaya-efek.json` | Satu-satunya tempat warna/terang/kecepatan visual. Dipoles Gemini; dipakai semua viewer |
| Lab efek | `.agents/skills/animasi-aliran-mesin/scripts/lab.html` | Mesin sintetis 4 silinder: aliran + pembakaran + piston; `?auto=1.5&xray`, `?real` |
| Demo/uji | `.agents/skills/animasi-aliran-mesin/scripts/demo.html` | Halaman uji; `?routes=…&scope=…` memuat rute sungguhan, `?auto=2` langsung Start, `?xray` |
| Perekam QA | `.agents/skills/animasi-aliran-mesin/scripts/capture_flow.py` | Rekam frame + lembar kontak + skor gerak + sampel runtime FLOW-ROUTING |
| Palet media | `.agents/skills/animasi-aliran-mesin/references/palet-media.md` | Warna per media (keluarga ISO 14726) dan kecepatan visual |
| Kontrak rute | `tools/gpt-production/FLOW-ROUTING.md` | Sumber kebenaran rute, arah, dan berkas review |
| Animasi gerak mesin di Blender | `.agents/skills/blender-animasi-mesin/` | Piston, katup, poros, kamera tur; ekspor GLB beranimasi |

three.js yang dipakai situs: `dist/assets/three.min.js` (r128, global `THREE`). Modul juga jalan di r150+.

## Alur kerja

1. **Ambil rute, jangan menggambar ulang.** Baca `model/flow/routes.json` dan `scope.json` hasil
   `spesialis_jalur_fluida`. Titik span adalah centerline meter di datum glTF (Y-up). Media diambil
   dari `scope.circuits[...].medium`; nama bebas seperti "jacket water" atau "lube oil" dipetakan
   otomatis, sisanya lewat opsi `medium: {linkId: "lube_oil"}`. Periksa `flow.warnings`.
2. **Pasang di viewer.**
   ```js
   const flow = OrangMesinFlow.create(THREE, {routes, scope, mobile: innerWidth < 760, ratedRpm: 1800});
   engineRoot.add(flow.group);          // anak dari root mesin agar ikut transform/eksplor
   startButton.onclick = () => flow.start({fillSeconds: 2.5});
   xrayButton.onchange = on => flow.setXray(on);   // lintasan hidden hanya tampil saat X-ray
   rpmSlider.oninput = e => flow.setRpm(+e.target.value);
   // loop: flow.update(clock.getDelta());  pause()/resume() menjaga fase
   window.__flow = flow;                // wajib untuk capture_flow.py
   ```
   Jari-jari default 12 mm; sesuaikan per media dengan `radiusByMedium` agar pita tetap di dalam
   lumen pipa (lebih kecil dari ID pipa, tidak menembus dinding).
3. **Pembakaran.** Muat `gaya-efek.json` lalu:
   ```js
   const fire = OrangMesinFire.create(THREE, {style, firingOrder: ["c1","c5","c3","c6","c2","c4"],  // dari manual
     cylinders: [{id: "c1", position: [...], axis: [0,1,0], bore_m: 0.15, injector: [...]}, ...],
     kinematics: {stroke_m, rod_length_m},          // dari register gerak; api mengikuti mahkota piston
     timing: {semburan_mulai_deg: -12}});          // bila manual memuat timing injeksi
   engineRoot.add(fire.group); fire.start();          // loop: fire.update(dt)
   // klip GLB "siklus": fire.setCrank(mixer.time / clip.duration * 720) agar piston dan api sinkron
   ```
   `position` = pusat ruang bakar di TMA, dari datum model. Interval nyala tak merata (mesin V)
   memakai `phase_deg` per silinder alih-alih `firingOrder`. Tanpa sumber firing order, jangan
   menampilkan pembakaran sebagai urutan resmi; tandai estimasi di legenda.
4. **Saat Start (urutan tur yang disarankan):** pompa oli prelube → oli mengisi galeri → poros
   berputar → bahan bakar → pembakaran sesuai firing order dokumen → air pendingin dan air laut →
   gas buang. Satukan dengan kamera tur bila ada. Waktu animasi boleh diperlambat demi keterbacaan,
   catat skala waktunya (`timeScale`).
5. **Rute estimasi tetap ditandai.** Link tanpa `geometry_basis` OBSERVED/DOCUMENTED atau berstatus
   partial/unverified otomatis tampil putus-putus dan lebih redup. Jangan menyembunyikan penanda ini.
6. **Periksa dengan mata, bukan hanya angka.** Pakai kontrol browser yang disediakan lingkungan.
   `capture_flow.py` (Playwright) hanya bila aturan runtime mengizinkan Playwright (lihat
   `tools/gpt-production/PROMPT-GPT.md`); bila tidak, rekam frame yang sama lewat kontrol browser.
   Sajikan repo/folder lewat server lokal, lalu:
   ```bash
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "http://localhost:8766/<viewer>.html?auto=2" --out <attempt>/qa/flow-anim-desktop --link <link_id>
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "…&xray" --out <attempt>/qa/flow-anim-mobile --viewport mobile --link <link_id> --xray
   ```
   Buka `sheet.png` dengan alat baca gambar dan nilai: warna tiap media benar, arah sesuai panah
   dokumen, pita tidak keluar dari pipa, gelombang terlihat bergerak, lintasan hidden muncul hanya
   saat X-ray, label/kontrol tidak tertutup di HP. `report.json` memberi skor gerak, error konsol,
   dan enam sampel runtime (running/paused/resumed) yang bisa disalin ke
   `qa/flow-inspection.json → runtime`. Exit 2 berarti tidak bergerak atau ada error.
7. **Kirim bukti ke QA independen**: lembar frame desktop + HP, report.json, dan hash `routes.json`
   yang benar-benar dimuat.

## Pembagian tugas (keputusan pemilik)

- **Pemoles visual (Gemini, lihat `GEMINI.md` di root)** memperbaiki tampilan efek: shader di
  `flow-ribbons.js`/`combustion-glow.js` dan nilai di `gaya-efek.json`, diuji di `lab.html`.
- **Codex/Claude di produksi mesin** tidak mendesain efek sendiri. Mereka memuat pustaka ini dan
  `gaya-efek.json`, lalu menyambungkan data mesin (rute, firing order, timing, kinematika).
  Perbaikan tampilan otomatis berlaku untuk semua mesin.
- Nama fungsi dan opsi publik (create, start, pause, resume, setRpm, setXray, setCrank, update,
  probe, links, phases) dijaga stabil oleh `tests/flow-ribbons.test.mjs` dan
  `tests/combustion-glow.test.mjs`.

## Standar tampilan

- Satu ShaderMaterial per media (bukan ribuan partikel CPU). Target ≥ 50 fps desktop, ≥ 30 fps HP.
- Cairan: badan semi-transparan + kilau tepi + gelombang komet + gelembung. Gas: tanpa badan,
  gelombang tipis bercahaya (additive).
- Kecepatan visual relatif: gas > air > bahan bakar > oli. Semua mengikuti rpm (`setRpm`).
- Kontras di latar graphite Studio Gelap; jangan ubah tema workspace (lihat `docs/WORKSPACE_UI.md`).
- Tidak ada efek yang menyiratkan data resmi (angka tekanan/debit) tanpa sumber.
- Pembakaran: api tidak melebihi bore, menyala hanya di ruang bakar, urutan dari dokumen. Pada putaran
  nyata api berkedip terlalu cepat untuk dibaca; tampilkan mode gerak lambat dengan label rpm tampilan.

## Yang tidak boleh

- Menggambar centerline sendiri di viewer atau "merapikan" rute demi estetika.
- Menyatakan animasi lolos tanpa melihat lembar frame. Timer atau JSON saja tetap UNVERIFIED.
- Memakai video AI atau animasi 3D orang lain sebagai acuan bentuk/rute (lihat AGENTS.md).
