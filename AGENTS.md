# Panduan penyempurnaan simulator

Situs ini menampilkan satu simulator gratis (Shinko GJ Simulator) dan tiga katalog premium (MAN L23/30H Mk3, Tanabe H-74, Alfa Laval MAB 206S-24). Harga dan rencana pembayaran ada di `docs/PEMBAYARAN.md`. Jangan tambahkan lagi Taiko HD300B, Shinko GJ versi lama (`shinko-gj`), Mitsubishi SJ-H, atau DESMI NSLH ke dashboard tanpa permintaan pemilik.

## Prioritas model 3D

1. Pakai rekaman POV atau vlog mesin nyata untuk bentuk yang terlihat, serta foto, gambar potongan, dimensi, dan dokumen pabrikan untuk ukuran dan varian tepat. Jangan gunakan animasi 3D sebagai acuan bentuk. Daftar awal dan tingkat kecocokannya ada di `dist/referensi.html`.
2. Cocokkan skala, siluet, proporsi, volume utama, posisi poros, rumah, pipa, dan sambungan dari tampak depan, samping, atas, dan perspektif sebelum memperhalus detail.
3. Periksa model dengan material netral. Benahi bentuk dan hubungan komponen terlebih dahulu, lalu tambahkan detail geometri, material, tekstur, dan cahaya.
4. Jangan menyajikan bentuk atau ukuran rekaan sebagai data resmi. Pertahankan penanda estimasi visual di materi belajar.
5. Bandingkan hasil pada desktop dan ponsel. Periksa juga pemilihan komponen, mode bongkar, dan akses katalog saat WebGL atau pustaka 3D gagal.

Dashboard ada di `dist/index.html`. Hanya `dist/shinko-gj-sim.html` yang berisi simulator publik. Berkas premium ada di `premium-source/`; jangan menyalinnya ke `dist/` sebelum autentikasi dan pemeriksaan akses server siap. `scripts/build-premium-catalog.py` membuat tiga halaman katalog publik. `scripts/add-catalog-fallback.py` menambahkan katalog cadangan saat 3D gagal dimuat pada berkas simulator sumber.
