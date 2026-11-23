# Memori proyek PelautJagoMesin

## Keputusan aktif

- **UI-001 · 24 November 2026 · pilihan pemilik:** konsep **2 — Studio Gelap** adalah standar workspace mesin untuk seluruh mesin lama dan mesin baru lintas sesi. Spesifikasi: [WORKSPACE_UI.md](WORKSPACE_UI.md); referensi: [papan konsep, kuadran kanan atas](design/workspace-concepts.png). Dibaca melalui AGENTS.md.
- Workspace yang dimaksud adalah viewer mesin 3D, bukan halaman Alur/antrean agen.
- Pertahankan model, data komponen, serta batas akses publik/premium saat menyeragamkan UI.
- **UI-002 · 24 November 2026:** navigasi pelanggan disederhanakan menjadi Sistem dan Pengoperasian. Aturan ini menggantikan susunan tombol di mockup UI-001 dan berlaku untuk model lama serta baru.

- **UI-003 · 24 November 2026:** panel Sistem, indikator dan aksi kontekstual mendapat ruang terpisah dari model. Eksplor rakitan memakai seleksi asli simulator dan menampilkan bagian milik komponen yang diketuk.

## Penerapan Studio Gelap · 24 November 2026

Shinko memuat `dist/assets/studio.css` dan `studio.js` langsung. Untuk MAN L23/30H Mk3, Tanabe H-74, dan Alfa Laval MAB 206S-24, `dist/assets/workspace.js` menyertakan kedua aset di dokumen simulator setelah respons akses berhasil. Viewer PelautSim baru dapat memakai jalur yang sama. Saat mengemas viewer mandiri, sertakan kedua aset sesudah UI PelautSim siap. Untuk runtime lain, ikuti kontrak interaksi di [standar workspace](WORKSPACE_UI.md).

Untuk validasi UI-002, buka kedua mode, periksa isi panel, gunakan Stop pada simulasi, lalu tutup panel. Pastikan hanya dua tombol mode yang terlihat pada desktop, HP portrait, dan landscape. Tiga viewer premium dapat diuji di iframe sandbox dengan respons akses lokal yang memuat salinan simulator dari branch main. Pengujian ini terpisah dari login akun premium produksi.

Perbandingan Shinko sebelum dan sesudah penyederhanaan menu tersedia untuk [desktop](design/studio-shinko-desktop.webp) dan [HP](design/studio-shinko-hp.webp).

Untuk UI-003, Chromium menguji ketuk mesh, pilihan rakitan, daftar bagian yang sesuai, isolasi dan kembali pada keempat mesin di 1280×800, 390×844, dan 844×390. Batas panel dan canvas diperiksa pada Sistem dan saat eksplorasi. Pada Shinko, satu baris bagian juga diuji hingga terpilih. [Perbandingan HP — Sistem sebelumnya, Sistem sekarang, dan eksplorasi rakitan](design/sistem-rakitan-hp.webp).
