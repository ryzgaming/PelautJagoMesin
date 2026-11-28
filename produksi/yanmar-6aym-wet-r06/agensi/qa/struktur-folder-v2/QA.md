# Audit batas folder Yanmar r06 layout v2

**Lulus dalam cakupan pemisahan folder.** Folder `model/` memuat dua GLB, dua master Blender, dua berkas data, manifest model, dan README metadata. Folder `runtime/` memuat mesin simulasi, manifest runtime, dan pustaka r06. Kode sesi menerima host render dan tidak mencari kontrol atau markup UI. `ui-workspace/` memuat tampilan, sementara alat produksi, referensi dan QA berada di bawah `agensi/`. [Manifest model](../../../model/manifest.json) · [Manifest runtime](../../../runtime/manifest.json)

Impor struktur GLB menemukan 479 ID mesh eksterior dan 705 interior. Seluruh 1.184 ID unik cocok dengan inventaris. SHA kedua GLB, kedua master Blender, inventaris, dan data katalog cocok dengan layout sebelumnya. Pemeriksaan 202 tujuan perpindahan menemukan 194 berkas identik byte-per-byte dan delapan berkas yang diperbarui untuk jalur atau indeks layout v2. Salinan manifest layout v1 identik dan diff arsip asli r01–r06 kosong terhadap baseline `cdb1e2f`. [Hasil model](model.json) · [Peta perpindahan](../../arsip-paket/r06-layout-v2.json) · [Hash perpindahan](moves.json)

Kedua UI lulus di Chromium WebGL pada 1280 × 800 dan emulasi HP 390 × 844 DPR 2. Empat skenario memakai tombol aktual untuk menjalankan start, jeda, lanjut, stop, reset, serta memilih `EXT-FUEL-03`. Sepuluh sampel matriks dunia per skenario identik di kedua UI dan sama dengan bukti layout v1, termasuk saat reset. Observer matriks disisipkan pada respons modul khusus pengujian. File kerja tetap sama selama pengujian. [Hasil browser dan hash](browser.json)

Validator menolak berkas JavaScript di model, GLB di UI, selektor DOM atau HTML di runtime, dan berkas vendor di luar daftar r06. Pemeriksaan ini memvalidasi tautan dokumentasi paket yang aktif dan mengecualikan artefak sejarah agar rujukan audit aslinya tidak berubah.

Pengujian memakai Chromium dan ANGLE SwiftShader. Penggunaan perangkat fisik, penilaian ulang ukuran OEM, dan 696 kontak r05 yang belum diklasifikasikan berada di luar audit struktur ini.

- [Studio desktop](studio-desktop.png) dan [Studio HP](studio-hp.png)
- [Panel ringkas desktop](minimal-desktop.png) dan [panel ringkas HP](minimal-hp.png)
