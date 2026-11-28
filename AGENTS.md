# Panduan penyempurnaan simulator

## Standar UI workspace mesin lintas sesi

- Sebelum membuat atau mengubah workspace mesin, baca [Standar Workspace Studio Gelap](docs/WORKSPACE_UI.md) dan [memori proyek](docs/PROJECT_MEMORY.md).
- Keputusan pemilik: **konsep nomor 2 — Studio Gelap** adalah format wajib untuk semua workspace mesin yang sudah dibuat maupun mesin baru pada sesi berikutnya. Terapkan melalui komponen/aset UI bersama jika memungkinkan.
- Workspace 3D memenuhi viewport, tema graphite gelap dengan aksen teal, navigasi mengambang di bawah berisi **Eksplor keseluruhan**, **Sistem**, **Pengoperasian**, dan **X-ray** secara berurutan, panel komponen/informasi dapat ditutup dan awalnya tertutup. Workspace dibuka dengan mesin terpasang. Mengetuk Eksplor keseluruhan membuka penggeser Jarak urai (0–100%, awal 50%) yang memisahkan rakitan utama mengikuti sumbu mesin. Gunakan warna cat eksterior berdasarkan foto produk tiap seri dan pertahankan material logam atau karet yang terlihat. Tombol keempat, X-ray, menyalakan atau mematikan transparansi rumah mesin di semua tampilan, termasuk detail rakitan. Pertahankan pilihan X-ray saat berpindah mode. Sesuaikan kontrol untuk HP dan desktop.
- Pemilik menyetujui **Eksplor rakitan** untuk semua model. Gunakan implementasi bersama di [assembly-diagram.js](dist/assets/assembly-diagram.js) pada PelautSim, dan uji ketuk komponen → diagram bernomor → rapatkan → kembali untuk setiap mesin lama maupun baru.
- Ketentuan ini mengatur workspace mesin, bukan UI Alur, dashboard, geometri, atau hak akses. Pertahankan batas publik/premium dan penanda ketidakpastian model.
- Bandingkan tangkapan layar setiap mesin langsung dengan Shinko, termasuk respons premium pelanggan dan admin yang memiliki lapisan UI lama. Catat cakupan implementasi dan hasil uji per mesin. Standar yang terdokumentasi tidak berarti seluruh mesin sudah dimigrasi. Jangan mengganti arah desain ini tanpa arahan baru pemilik.

Situs ini menampilkan satu simulator gratis (Shinko GJ Simulator) dan tiga katalog premium (MAN L23/30H Mk3, Tanabe H-74, Alfa Laval MAB 206S-24). Harga dan rencana pembayaran ada di `docs/PEMBAYARAN.md`. Jangan tambahkan lagi Taiko HD300B, Shinko GJ versi lama (`shinko-gj`), Mitsubishi SJ-H, atau DESMI NSLH ke dashboard tanpa permintaan pemilik.

## Prioritas model 3D

Untuk produksi dengan GPT/Codex, baca [prompt produksi GPT](tools/gpt-production/PROMPT-GPT.md) dan [toolkit](tools/gpt-production/README.md). Panduan ini mengadopsi lampiran pemilik 28 November 2026; contoh Caterpillar dan hasil QA historis tidak menjadi bukti untuk mesin baru.

1. Pakai rekaman POV atau vlog mesin nyata untuk bentuk yang terlihat, serta foto, gambar potongan, dimensi, dan dokumen pabrikan untuk ukuran dan varian tepat. Jangan gunakan animasi 3D sebagai acuan bentuk. Daftar awal dan tingkat kecocokannya ada di `dist/referensi.html`.
2. Cocokkan skala, siluet, proporsi, volume utama, posisi poros, rumah, pipa, dan sambungan dari tampak depan, samping, atas, dan perspektif sebelum memperhalus detail.
3. Periksa model dengan material netral. Benahi bentuk dan hubungan komponen terlebih dahulu, lalu tambahkan detail geometri, material, tekstur, dan cahaya.
4. Jangan menyajikan bentuk atau ukuran rekaan sebagai data resmi. Pertahankan penanda estimasi visual di materi belajar.
5. Bandingkan hasil pada desktop dan ponsel. Periksa juga pemilihan komponen, mode bongkar, dan akses katalog saat WebGL atau pustaka 3D gagal.
6. **Wajib multi-agen (keputusan pemilik):** setiap pembuatan mesin dikerjakan oleh subagen nyata per peran. Riset dokumen, foto, dan video berjalan paralel. Exterior dan Internal Modeler terpisah. QA independen yang tidak ikut membuat model memeriksa render enam sudut (depan, belakang, kiri, kanan, atas, 3/4) terhadap referensi dari sudut yang sama dan berhak menolak. Satu pekerja yang mengerjakan semua peran sendiri tidak diterima. Rincian dan gerbang `review` ada di [README worker](apps/alur-workflow/worker/README.md#wajib-multi-agen-aturan-pemilik).

Untuk simulasi mekanisme, tugaskan `spesialis_kinematika_benturan` memetakan tiap mesh ke bagian diam/bergerak per kondisi operasi. Gunakan [register gerak dan pemeriksaan benturan](tools/gpt-production/MOTION-QA.md) hingga pengujian viewer.

Untuk perpipaan, lorong cor dan animasi fluida, aktifkan agen lintas rakitan `spesialis_jalur_fluida` sesuai [petunjuk registrasi dan uji rute](tools/gpt-production/FLOW-ROUTING.md).

### Alat animasi (wajib dipakai untuk animasi gerak dan aliran)

Skill repo ada di `.agents/skills/` (Codex memuatnya otomatis saat dibuka dari root repo; agen lain membaca SKILL.md-nya langsung):

- **`animasi-aliran-mesin`** — air pendingin, air laut, oli, bahan bakar, udara, gas buang dan **pembakaran** di viewer three.js. Modul `scripts/flow-ribbons.js` dan `scripts/combustion-glow.js`, gaya bersama `references/gaya-efek.json`, lab `scripts/lab.html`, demo `scripts/demo.html`, perekam QA `scripts/capture_flow.py`, palet `references/palet-media.md` (keluarga warna ISO 14726). **Codex dan Claude tidak mendesain efek fluida/pembakaran sendiri**; muat pustaka dan gaya ini, lalu sambungkan data mesin. Tampilan efek dipoles Gemini sesuai [GEMINI.md](GEMINI.md).
- **`blender-animasi-mesin`** — poros engkol, batang, piston, katup dan kamera tur di Blender. Rig kinematika `scripts/crank_rig.py`, strip frame `scripts/render_strip.py`. Angka gerak mengikuti register [MOTION-QA](tools/gpt-production/MOTION-QA.md).
- **Blender MCP** — server `blender` di `.codex/config.toml` (`uvx mcp-for-blender`, mode aman, telemetri mati). Butuh Blender terbuka dengan add-on "MCP for Blender". Tool `look` menampilkan strip frame animasi; pakai untuk melihat hasil sebelum menyerahkan. Tanpa Blender GUI, pakai skrip headless di skill.

Animasi tidak boleh diserahkan sebelum lembar frame (web) atau strip frame (Blender) dibuka dan dinilai. Rute aliran tetap berasal dari FLOW-ROUTING, bukan digambar demi estetika.

Pada produksi dan revisi model mesin, koordinator juga [menugaskan spesialis tiap rakitan](tools/gpt-production/SPECIALISTS.md) sebelum memodelkan. Gunakan daftar dari `specialist-briefs`, teruskan subkomponen yang diharapkan kepada modeler, dan periksa komponen tersembunyi hingga dapat dipilih melalui viewer.

Untuk tugas pemodelan atau revisi bentuk mesin, gunakan agen proyek `referensi_visual` (foto), `pemodel_eksterior` (eksterior), dan `qa_visual_viewer` (QA independen). Ikuti [cara menjalankan agen](tools/gpt-production/ROLE-PROMPTS.md#agen-proyek-untuk-kemiripan-dan-viewer). Koordinator meneruskan foto dan penanda, model dan hash, lalu temuan QA di antara tiga peran ini.

Dashboard ada di `dist/index.html`. Hanya `dist/shinko-gj-sim.html` yang berisi simulator publik. Berkas premium ada di `premium-source/`; jangan menyalinnya ke `dist/` sebelum autentikasi dan pemeriksaan akses server siap. `scripts/build-premium-catalog.py` membuat tiga halaman katalog publik. `scripts/add-catalog-fallback.py` menambahkan katalog cadangan saat 3D gagal dimuat pada berkas simulator sumber.
