---
name: lookdev-efek-mesin
description: Panduan look-development dan rekayasa shader GLSL (three.js r128 / WebGL1) untuk memoles kualitas visual aliran fluida dan pembakaran ruang bakar di pustaka bersama Orang Mesin (`flow-ribbons.js`, `combustion-glow.js`, `gaya-efek.json`). Pakai khusus saat memoles tampilan efek visual di `.agents/skills/animasi-aliran-mesin/`. Jangan dipakai untuk menentukan rute pipa, kinematika, atau merakit mesin individual.
---

# Look-Development Efek Visual Mesin (Fluida & Pembakaran)

Skill ini dipakai oleh profil `spesialis_efek_visual` (atau sesi poles efek sesuai `GEMINI.md`) untuk mengangkat tampilan shader di `.agents/skills/animasi-aliran-mesin/` dari prototipe fungsional menjadi visualisasi CGI teknik yang hidup di atas tema graphite gelap Studio Gelap (`#12171c` / `#0b0e11`), sambil menjaga performa HP dan kontrak API.

## Berkas target & batas perubahan

| Berkas | Peran dalam Look-Dev | Batas Ketat |
|---|---|---|
| `.agents/skills/animasi-aliran-mesin/scripts/flow-ribbons.js` | Shader aliran cair & gas sepanjang `TubeGeometry` (`aS`) | API & `probe()` tidak boleh berubah; 1 `ShaderMaterial` per media |
| `.agents/skills/animasi-aliran-mesin/scripts/combustion-glow.js` | Shader semburan injektor & nyala api ruang bakar | Api wajib di dalam `bore_m`, mengikuti `signedAngle` & `kinematics` |
| `.agents/skills/animasi-aliran-mesin/references/gaya-efek.json` | Preset warna, terang, kecepatan, turbulensi, dan parameter gaya | Tidak menggantikan data resmi (`routes`, `firingOrder`, `timing`) |
| `.agents/skills/animasi-aliran-mesin/scripts/lab.html` | Lab uji 4 silinder sintetis (desktop & HP) | Pertahankan `window.__flow`, `window.__fire`, `window.__fps` |
| `.agents/skills/lookdev-efek-mesin/references/rubrik-visual-cgi.md` | Rubrik optik per media ISO 14726 & fase pembakaran | Acuan wajib saat mengevaluasi `sheet.png` |

## Teknik Shader GLSL (WebGL1 / three.js r128 Safe)

Seluruh kode GLSL wajib valid pada WebGL1 (tanpa fitur GLSL ES 3.00, tanpa `texelFetch`, tanpa loop dinamis besar). Hindari branching berat di fragment shader agar tetap >= 30 fps di HP.

### 1. Peningkatan Aliran Fluida (`flow-ribbons.js`)
Audit kelemahan umum shader dasar: cairan dan oli sering tampak seragam seperti pipa neon datar, gelembung terlihat kotak/teratur, dan gas terlihat seperti garis putus biasa. Perbaiki dengan pendekatan berlapis berikut:

- **Kedalaman optik cairan (*deep core + Fresnel rim*):**
  - Bagian tengah penampang pipa (`facing = abs(dot(N, V))`) dibuat sedikit lebih pekat/gelap (absorpsi cahaya di dalam kolom cairan), sedangkan tepi silinder (`fres = pow(1.0 - facing, 2.2)`) memantulkan kilau spekular halus yang meniru tabung berisi cairan bening.
  - Bedakan profil viskositas per media lewat uniform gaya (misalnya `uViscosity` atau turunan dari `uBody`/`uBubbles`):
    - **Air tawar & air laut:** inti lebih jernih, *fresnel* tajam bernuansa sejuk, dua lapis *micro-bubbles* berkecepatan sedikit berbeda (efek paralaks aliran), plus garis arus (*streamlines*) tipis memanjang mengikuti `vS`.
    - **Oli pelumas:** badan lebih pekat dan hangat (amber-emas gelap di inti, kilau madu di tepi), pergerakan lambat, gelombang komet lebih panjang dan lembut (*viscous surge*), gelembung sangat sedikit dan halus.
    - **Bahan bakar:** padat, kontras hangat tembaga-cokelat, pulsa bertekanan cepat dan rapat di pipa berdiameter lebih kecil (`fuel`).
- **Karakter gas (*charge_air*, *start_air*, *exhaust*):**
  - Gunakan `AdditiveBlending` tanpa badan cair tebal.
  - Ganti gelombang komet kaku dengan pita arus turbulen tipis (*layered sine/value noise* sepanjang `vS` dan keliling `vA`) yang memudar lembut di tepi (`facing`), sehingga terasa seperti aliran gas bertekanan atau gas buang panas, bukan batang solid.
  - Untuk `exhaust`, tambahkan variasi suhu halus dari oranye terang di puncak gelombang ke merah-bara di ekornya.
- **Kejelasan pengisian (*Start fill*) & mode X-ray:**
  - Pertahankan *meniscus / leading front* yang bercahaya jelas saat `uFill` merambat maju agar urutan Start terbaca dalam 1 detik.
  - Saat X-ray aktif (`hidden` span memudar masuk), jaga opasitas agar tidak menumpuk terlalu silau saat dua pipa berpotongan di layar.
  - Pastikan jalur estimasi (`uEstimated > 0.5`) selalu tampak putus-putus dan lebih redup dibanding rute `DOCUMENTED`/`OBSERVED`.

### 2. Peningkatan Pembakaran Diesel (`combustion-glow.js`)
Audit kelemahan umum shader dasar: semburan injektor berupa kerucut dengan garis `step()` kasar/kotak, dan bola api tampak terlalu bulat/seragam sepanjang langkah usaha. Perbaiki menjadi empat fase optik kontinu berdasarkan sudut engkol `s = signedAngle(...)`:

- **Fase 1 — Semburan Injektor Teratomisasi (`semburan_mulai_deg` s.d. `semburan_selesai_deg`):**
  - Ganti pola `step()` kasar pada `sprayFragment` dengan kabut atomisasi halus: kombinasikan *radial/edge fade* (menggunakan `abs(dot(vN, vV))` agar tepi kerucut tidak tajam seperti kertas), aliran *streaks* berkecepatan tinggi yang memanjang dari ujung nozzle (`vUv.y = 0`) menuju ruang bakar, serta pelebaran kabut (*soft mist*) di ujung bawah kerucut.
  - Beri transisi warna lembut dari putih-biru dingin di ujung nozzle ke putih-kuning hangat saat mulai menyentuh udara terkompresi mendekati TMA.
- **Fase 2 — *Ignition Flash* Awal (`0` s.d. `naik_deg`):**
  - Tambahkan pulsa kilat singkat yang terkonsentrasi di inti atas dekat ujung injektor (suhu tertinggi, putih-kuning `#fff4cf`), sebelum api melebar penuh memenuhi bore.
- **Fase 3 — Ekspansi Api Turbulen (awal langkah usaha):**
  - Gunakan *2-octave* 3D noise (atau *fbm* ringan 2 lapis yang aman untuk GPU HP) yang bergerak ke bawah mengikuti ekspansi piston (`-uTime` pada sumbu silinder) dengan *swirl* ringan di bidang horizontal.
  - Bentuk tepi api dengan *soft spherical/cylindrical attenuation* berdasarkan `vP / uR` sehingga tepi api tidak pernah tampak seperti bola geometris kaku, tetap terkurung di dalam diameter `bore_m`, dan mengisi ruang di atas mahkota piston saat `kinematics` aktif.
- **Fase 4 — Sisa Bara (*Ember Afterglow*) saat Meredup:**
  - Ketika intensitas `uI` turun di fase akhir `padam_deg`, geser suhu warna dari kuning-oranye menuju merah bara gelap sebelum padam, sehingga mata langsung menangkap urutan *firing order* dan transisi langkah usaha tanpa membuat layar silau.
- **Pencahayaan Lokal (`PointLight`):**
  - Tetap aktif hanya di desktop (`g.cahaya && !opt.mobile`) dengan jarak terikat `bore_m * cahaya_jarak_bore` agar menerangi dinding blok/mahkota piston di sekitar silinder yang sedang menyala saja.

### 3. Kalibrasi Parameter di `gaya-efek.json`
- Simpan semua angka tuning baru dengan nama kunci deskriptif Bahasa Indonesia atau struktur konsisten di `gaya-efek.json`, dan pastikan nilai bawaan (`DEFAULT` di JS) selalu menjadi *fallback* jika file JSON tidak memuat kunci baru.
- Jaga agar setiap warna tetap berada dalam keluarga ISO 14726 sesuai `references/palet-media.md`.

## Protokol Verifikasi Wajib (Sebelum & Sesudah)

Jangan pernah menilai kualitas efek hanya dari membaca kode GLSL. Ikuti urutan ini:

1. **Rekam kondisi SEBELUM** (dari root repo, server HTTP lokal aktif di port 8766):
   ```bash
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray" \
     --out /tmp/efek-sebelum-desktop --frames 8 --interval 180 --wait 2500
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray" \
     --out /tmp/efek-sebelum-hp --viewport mobile --frames 4 --wait 2500

   ```
2. Buka sheet.png SEBELUM, nilai setiap item menggunakan references/rubrik-visual-cgi.md, lalu rumuskan daftar perbaikan spesifik.
3. Terapkan polesan pada flow-ribbons.js, combustion-glow.js, dan gaya-efek.json.
4. Rekam kondisi SESUDAH dengan parameter identik ke /tmp/efek-sesudah-desktop dan /tmp/efek-sesudah-hp, plus cek cepat mode non-X-ray (?auto=1.5) dan putaran nyata (?auto=1.5&xray&real).
5. Bandingkan sheet.png SEBELUM vs SESUDAH untuk desktop dan HP. Pastikan tidak ada clipping, overexposure (putih meledak), atau artefak tepi mesh.
6. Jalankan uji kontrak otomatis:
   ```bash
   node --test tests/viewer/flow-ribbons.test.mjs tests/viewer/combustion-glow.test.mjs

   ```
   Semua tes wajib lulus, report.json wajib memiliki "errors": [], "motion_ok": true, serta seluruh flag runtime (moves_when_running, pause_stable, resume_continues) bernilai true.
