# Panduan penyempurnaan simulator

## Standar UI workspace mesin lintas sesi

- Sebelum membuat atau mengubah workspace mesin, baca [Standar Workspace Studio Gelap](docs/WORKSPACE_UI.md) dan [memori proyek](docs/PROJECT_MEMORY.md).
- Keputusan pemilik: **konsep nomor 2 — Studio Gelap** adalah format wajib untuk semua workspace mesin yang sudah dibuat maupun mesin baru pada sesi berikutnya. Terapkan melalui komponen/aset UI bersama jika memungkinkan.
- Workspace 3D memenuhi viewport, tema graphite gelap dengan aksen teal, navigasi mengambang di bawah berisi **Eksplor keseluruhan**, **Sistem**, **Pengoperasian**, dan **X-ray** secara berurutan, panel komponen/informasi dapat ditutup dan awalnya tertutup. Workspace dibuka dengan mesin terpasang. Mengetuk Eksplor keseluruhan memperlihatkan rakitan utama terurai mengikuti sumbu masing-masing mesin. X-ray memperlihatkan bagian dalam melalui rumah mesin pada posisi terpasang. Sesuaikan kontrol untuk HP dan desktop.
- Pemilik menyetujui **Eksplor rakitan** untuk semua model. Gunakan implementasi bersama di [assembly-diagram.js](dist/assets/assembly-diagram.js) pada PelautSim, dan uji ketuk komponen → diagram bernomor → rapatkan → kembali untuk setiap mesin lama maupun baru.
- Ketentuan ini mengatur workspace mesin, bukan UI Alur, dashboard, geometri, atau hak akses. Pertahankan batas publik/premium dan penanda ketidakpastian model.
- Catat cakupan implementasi dan hasil uji per mesin. Standar yang terdokumentasi tidak berarti seluruh mesin sudah dimigrasi. Jangan mengganti arah desain ini tanpa arahan baru pemilik.

Situs ini menampilkan satu simulator gratis (Shinko GJ Simulator) dan tiga katalog premium (MAN L23/30H Mk3, Tanabe H-74, Alfa Laval MAB 206S-24). Harga dan rencana pembayaran ada di `docs/PEMBAYARAN.md`. Jangan tambahkan lagi Taiko HD300B, Shinko GJ versi lama (`shinko-gj`), Mitsubishi SJ-H, atau DESMI NSLH ke dashboard tanpa permintaan pemilik.

## Prioritas model 3D

1. Pakai rekaman POV atau vlog mesin nyata untuk bentuk yang terlihat, serta foto, gambar potongan, dimensi, dan dokumen pabrikan untuk ukuran dan varian tepat. Jangan gunakan animasi 3D sebagai acuan bentuk. Daftar awal dan tingkat kecocokannya ada di `dist/referensi.html`.
2. Cocokkan skala, siluet, proporsi, volume utama, posisi poros, rumah, pipa, dan sambungan dari tampak depan, samping, atas, dan perspektif sebelum memperhalus detail.
3. Periksa model dengan material netral. Benahi bentuk dan hubungan komponen terlebih dahulu, lalu tambahkan detail geometri, material, tekstur, dan cahaya.
4. Jangan menyajikan bentuk atau ukuran rekaan sebagai data resmi. Pertahankan penanda estimasi visual di materi belajar.
5. Bandingkan hasil pada desktop dan ponsel. Periksa juga pemilihan komponen, mode bongkar, dan akses katalog saat WebGL atau pustaka 3D gagal.

Dashboard ada di `dist/index.html`. Hanya `dist/shinko-gj-sim.html` yang berisi simulator publik. Berkas premium ada di `premium-source/`; jangan menyalinnya ke `dist/` sebelum autentikasi dan pemeriksaan akses server siap. `scripts/build-premium-catalog.py` membuat tiga halaman katalog publik. `scripts/add-catalog-fallback.py` menambahkan katalog cadangan saat 3D gagal dimuat pada berkas simulator sumber.
