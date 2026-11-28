---
name: blender-animasi-mesin
description: Menganimasikan mekanisme mesin di Blender (poros engkol, batang penghubung, piston, katup, kamera tur) dengan kinematika benar, mengekspor GLB beranimasi untuk viewer, dan memeriksa gerak lewat Blender MCP atau render strip headless. Pakai saat membuat/memperbaiki animasi gerak mesin atau tur Start. Untuk aliran cairan di pipa pakai skill animasi-aliran-mesin.
---

# Animasi mesin di Blender

Animasi yang jelek hampir selalu karena dua hal: gerak ditebak (bukan dihitung) dan agen tidak
pernah melihat hasilnya. Skill ini menutup keduanya.

## Lokasi alat (relatif ke root repo)

| Alat | Path / cara akses | Fungsi |
|---|---|---|
| Blender MCP | MCP server `blender` di `.codex/config.toml` (perintah `uvx mcp-for-blender`) | Kendalikan Blender yang terbuka: `get_addon_status`, `get_scene_info`, `execute_blender_code`, `look` (viewport, multi-sudut, X-ray, **strip frame animasi**) |
| Rig engkol | `.agents/skills/blender-animasi-mesin/scripts/crank_rig.py` | Kunci gerak piston/batang/poros/katup dari rumus slider-crank, siklus 720° mulus, ekspor GLB 1 klip `siklus` |
| Strip animasi | `.agents/skills/blender-animasi-mesin/scripts/render_strip.py` | Render N frame GLB beranimasi → `strip.png` + `strip.json` (objek yang tidak bergerak) |
| Render enam sudut | `tools/gpt-production/render_six.py` | Bentuk statis, bukan gerak |
| Aliran cairan | `.agents/skills/animasi-aliran-mesin/` | Pita cairan di pipa (three.js) |

## Hubungan dengan register gerak

Sumber kebenaran gerak adalah `model/motion/register.json` dari `spesialis_kinematika_benturan`
([MOTION-QA](../../../tools/gpt-production/docs/MOTION-QA.md)). Angka di `rig.json` (sumbu, origin,
stroke, panjang batang, `phase_deg`, timing katup) harus sama dengan hukum di register, dengan
`basis` yang sama. GLB beranimasi dan strip frame adalah alat bantu visual dan pembuktian bentuk
gerak; keputusan benturan tetap mengikuti sweep/probe MOTION-QA, dan viewer menerapkan register.
Bila rig dan register berbeda, register yang diperbaiki lewat spesialis, bukan rig yang diakali.

## Pilih jalur kerja

1. **Blender MCP tersedia** (cek dengan `get_addon_status`; perlu Blender terbuka dan add-on
   "MCP for Blender" aktif di port 9876). Pakai `execute_blender_code` untuk menjalankan isi
   `crank_rig.py`/perubahan, lalu **selalu** `look` mode `frames` (strip animasi) dari depan dan
   samping, plus mode X-ray untuk bagian dalam. Mode aman aktif: skrip berisiko ditolak; jangan
   mematikannya.
2. **Tanpa MCP / cloud headless.** Jalankan skrip dengan `blender --background --python-exit-code 1
   --python <skrip> -- <argumen>` atau, bila modul `bpy` terpasang, `python3 <skrip> -- <argumen>`.
   Gambar hasil dibuka dengan alat baca gambar. Bila Blender tidak ada sama sekali, catat sebagai gap.

## Langkah animasi mekanisme

1. **Data dulu.** Ambil dari dokumen: langkah (stroke), panjang batang (center-to-center), firing
   order, diagram timing katup, arah putar poros. Yang tidak ada → tulis `ESTIMATED` di `basis`
   rig.json dan pertahankan penanda estimasi di viewer.
2. **Siapkan objek.** ID stabil sesuai inventaris. Origin batang penghubung di pena piston
   (small end), origin poros engkol di sumbu poros, piston dan katup bergerak sepanjang sumbunya.
   Bagian yang ikut berputar (web, counterweight, roda gigi) jadi anak poros engkol.
3. **Tulis rig.json** (contoh lengkap di docstring `crank_rig.py`). `phase_deg` tiap silinder dari
   firing order: silinder urutan ke-k menyala pada k·720°/jumlah_silinder (hanya untuk interval nyala
   merata; mesin V atau interval tak merata memakai sudut dari manual).
4. **Jalankan rig:**
   ```bash
   blender model.blend --background --python-exit-code 1 \
     --python .agents/skills/blender-animasi-mesin/scripts/crank_rig.py -- \
     --config <attempt>/model/anim/rig.json --output <attempt>/model/internal/internal-anim.glb
   ```
5. **Lihat geraknya** (wajib, dua sudut minimal; ujung besar batang harus mengikuti pena engkol):
   ```bash
   blender -b --python-exit-code 1 --python .agents/skills/blender-animasi-mesin/scripts/render_strip.py -- \
     --input <attempt>/model/internal/internal-anim.glb --output <attempt>/qa/anim-depan --view depan --xray
   ```
   `strip.json → animated_but_still` yang berisi bagian yang seharusnya bergerak adalah temuan.
   Contoh nyata: arah ayun batang pernah terbalik dan hanya terlihat dari strip tampak depan.
6. **Di viewer three.js**: putar klip `siklus` dengan `AnimationMixer`, `LoopRepeat`, dan
   `mixer.timeScale = rpm / 120 * (cycle_frames / fps)` sehingga satu siklus = dua putaran pada rpm
   aktual. Sinkronkan pembakaran (cahaya emissive di ruang bakar) dan aliran
   (`animasi-aliran-mesin`) ke rpm yang sama.

## Kamera tur Start

- Titik perhatian berurutan sesuai cerita: eksterior → X-ray → komponen yang sedang aktif. Tahan
  1–1,5 detik di tiap titik, gerak kamera ease-in/out, tidak ada potongan lebih cepat dari waktu baca
  label. Gerak mekanisme tetap linear (tanpa ease) agar loop tidak tersendat.
- Di web, kamera tur lebih baik dibuat di viewer (camera-controls/GSAP) supaya mengikuti ukuran
  layar HP; jalur kamera dari Blender boleh diekspor sebagai referensi.

## Yang tidak boleh

- Menebak firing order, timing katup, atau arah putar lalu menyajikannya sebagai data resmi.
- Menyerahkan animasi tanpa strip frame yang sudah dilihat. Angka di JSON saja = UNVERIFIED.
- Mematikan mode aman Blender MCP atau mengizinkan telemetri konten.
- Memakai video AI atau animasi pihak lain sebagai acuan bentuk/gerak (lihat AGENTS.md).
