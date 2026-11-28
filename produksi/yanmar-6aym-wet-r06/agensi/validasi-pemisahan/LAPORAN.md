# Audit paket terpisah r06

**Pemisahan model, UI, dan agensi lulus.** Studio Gelap dan panel ringkas menjalankan modul mesin, inventaris, dan kedua GLB yang sama. Panel ringkas hanya memanggil API sesi. Studio memakai adaptor `workspace` untuk diagram dan panel rakitan yang lebih rinci. Kode inti menerima kontainer kanvas dan tidak mencari kontrol DOM atau mengimpor UI.

Kedua GLB identik dengan r06 asli. Seluruh 1,184 ID mesh cocok dengan registri komponen. Audit menelusuri 7,819 jalur arsip r01–r06 dan mengonfirmasi setiap entri memiliki objek yang benar. Semua 2.314 berkas r06 di luar 79 cache cocok dengan berkas sumber; master Blender, referensi, catatan agensi dan bukti QA ikut tersedia. Arsip membedakan profil asli dari brief tugas yang direkonstruksi.

Empat uji Chromium WebGL mencakup kedua UI pada 1280 × 800 dan emulasi HP 390 × 844 DPR 2. Tombol aktual menyelesaikan urutan start, jeda, lanjut, stop dan reset. Kedua UI bisa memilih EXT-FUEL-03. Uji kegagalan kedua GLB memperlihatkan pesan galat, menonaktifkan start dan mempertahankan akses inventaris.

Observer khusus QA mengambil matriks dunia dari 1.184 komponen pada sepuluh sampel waktu yang sama, termasuk reset. Hash matriks sama pada keempat skenario. Observer hanya ditambahkan pada respons modul di browser uji. Semua file aktif yang disimpan tetap sama sebelum dan setelah uji.

Browser menjalankan paket dari subpath HTTP dengan ANGLE SwiftShader. Pemeriksaan memetakan 32 rujukan HTML dan modul serta tidak menemukan jalur runtime absolut ke workspace pembuat. Perangkat fisik, ukuran OEM dan 696 persinggungan r05 yang belum diklasifikasikan tetap berstatus belum terverifikasi.

## Bukti

- [Hasil audit](hasil.json)
- [Studio desktop](browser/studio-desktop.png) dan [HP](browser/studio-hp.png)
- [Panel ringkas desktop](browser/minimal-desktop.png) dan [HP](browser/minimal-hp.png)
- [Snapshot matriks dan status browser](browser/ringkasan.json)
- [Uji tanpa GLB](browser/fallback.json)
- [Pemetaan arsip dan berkas asli](inventaris.json)
- [Batas modul dan jalur](batas-runtime.json)
