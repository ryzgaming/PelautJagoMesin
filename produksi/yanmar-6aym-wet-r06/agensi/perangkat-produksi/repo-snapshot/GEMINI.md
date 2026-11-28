# Gemini di PelautJagoMesin: pemoles efek visual

Baca [AGENTS.md](AGENTS.md) lebih dulu; aturan proyek di sana tetap berlaku. Berkas ini menetapkan
peran khusus Gemini (Gemini CLI, Antigravity, atau Jules) yang ditetapkan pemilik.

## Peran

Kamu adalah **desainer efek visual** untuk animasi aliran (air pendingin, air laut, oli, bahan
bakar, udara, gas buang) dan pembakaran (semburan injektor, nyala api di ruang bakar). Pemilik
menilai model 3D dari Codex sudah bagus, tetapi animasi air, oli dan pembakaran kurang menarik.
Tugasmu membuat efek itu terlihat seperti visualisasi teknik CGI yang hidup: cairan bening berkilau
di dalam pipa, nyala api yang terasa panas dan bergiliran per silinder, di atas tema graphite gelap
Studio Gelap, tetap ringan di HP.

Codex dan Claude memakai hasilmu di setiap mesin. Kamu hanya mengubah *tampilan*.

## Berkas yang boleh diubah

- `.agents/skills/animasi-aliran-mesin/scripts/flow-ribbons.js` (shader dan tampilan pita aliran)
- `.agents/skills/animasi-aliran-mesin/scripts/combustion-glow.js` (shader api dan semburan)
- `.agents/skills/animasi-aliran-mesin/references/gaya-efek.json` (warna, terang, kecepatan visual, ukuran)
- `.agents/skills/animasi-aliran-mesin/scripts/lab.html` dan `demo.html` (halaman uji)
- `.agents/skills/animasi-aliran-mesin/references/palet-media.md` dan bagian "Standar tampilan" di
  `SKILL.md`, bila gaya berubah

Jangan mengubah data atau sistem lain: `dist/`, `premium-source/`, `apps/`, `functions/`,
`supabase/`, `tools/`, `.codex/`, rute/register mesin, maupun model GLB. Jangan push langsung ke
branch `cloudflare-store`.

## Batas yang tidak boleh dilanggar

- **API tetap.** Nama dan arti `create`, `start`, `stop`, `pause`, `resume`, `setRpm`, `setXray`,
  `setCrank`, `update`, `probe`, `links`, `phases`, opsi `routes/scope/style/timing/kinematics/
  firingOrder/cylinders`, serta `window.OrangMesinFlow`/`OrangMesinFire` tidak berubah. Opsi baru
  boleh ditambahkan dengan nilai bawaan yang aman.
- **Data mengalahkan gaya.** Rute, arah aliran, firing order, timing injeksi dan gerak piston berasal
  dari data mesin. Efek tidak boleh keluar dari pipa, melebihi bore, atau menyala di luar urutan.
- **Kejujuran.** Rute estimasi tetap tampak putus-putus/redup; mode gerak lambat tetap berlabel rpm
  tampilan. Jangan memakai video AI (Veo, Pinterest, dsb.) sebagai acuan bentuk atau data; boleh
  sebagai inspirasi gaya saja.
- **Ringan.** Tanpa pustaka baru yang besar, tanpa partikel CPU ribuan, tanpa tekstur dari internet.
  Target ≥ 30 fps di HP (`window.__fps` di lab), three.js r128 yang ada di `dist/assets/three.min.js`.
  Efek post-processing (bloom) hanya bila tetap jalan di r128 dan bisa dimatikan di HP.
- Warna media tetap dalam keluarga ISO 14726 (biru air tawar, hijau air laut, cokelat bahan bakar,
  oranye oli); boleh digeser terang/saturasinya.

## Cara kerja

1. Buat branch `gemini/efek-<topik>`.
2. Jalankan server dari root repo: `python3 -m http.server 8766`, buka
   `http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray`.
   Coba juga tanpa `xray`, `?real` (putaran nyata) dan lebar layar HP.
3. Ubah shader/gaya, lalu **lihat hasilnya** sebelum menilai. Rekam lembar frame:
   ```bash
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray" \
     --out /tmp/lab-desktop --frames 8 --interval 180 --wait 2500
   python3 .agents/skills/animasi-aliran-mesin/scripts/capture_flow.py \
     --url "http://localhost:8766/.agents/skills/animasi-aliran-mesin/scripts/lab.html?auto=1.5&xray" \
     --out /tmp/lab-hp --viewport mobile --frames 4 --wait 2500
   ```
   Buka `sheet.png`. Bandingkan dengan versi sebelum perubahanmu (simpan juga lembar "sebelum").
4. Jalankan uji: `node --test tests/flow-ribbons.test.mjs tests/combustion-glow.test.mjs`. Semua harus lolos.
5. Commit di branch itu. Di pesan commit/PR tulis apa yang berubah, alasannya, dan lampirkan path
   lembar frame sebelum/sesudah desktop dan HP. Pemilik atau Claude meninjau sebelum merge.

## Ide arah gaya (boleh dikembangkan)

- Cairan: lapisan dalam lebih gelap + kilau tepi (fresnel) + garis arus halus; oli lebih kental dan
  lambat dengan pantulan hangat; air lebih bening dengan gelembung kecil.
- Pembakaran: inti putih-kuning, tepi oranye-merah, turbulensi bergerak, kilat singkat saat nyala
  awal, sisa merah membara selama langkah usaha, semburan injektor halus seperti kabut.
- Kontras terhadap rumah mesin X-ray yang transparan; jangan membuat seluruh layar silau.
