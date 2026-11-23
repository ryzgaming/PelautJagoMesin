# Memori proyek PelautJagoMesin

## Keputusan aktif

- **UI-001 · 24 November 2026 · pilihan pemilik:** konsep **2 — Studio Gelap** adalah standar workspace mesin untuk seluruh mesin lama dan mesin baru lintas sesi. Spesifikasi: [WORKSPACE_UI.md](WORKSPACE_UI.md); referensi: [papan konsep, kuadran kanan atas](design/workspace-concepts.png). Dibaca melalui AGENTS.md.
- Workspace yang dimaksud adalah viewer mesin 3D, bukan halaman Alur/antrean agen.
- Pertahankan model, data komponen, serta batas akses publik/premium saat menyeragamkan UI.

## Penerapan Studio Gelap · 24 November 2026

Shinko memuat `dist/assets/studio.css` dan `studio.js` langsung. Untuk MAN L23/30H Mk3, Tanabe H-74, dan Alfa Laval MAB 206S-24, `dist/assets/workspace.js` menyertakan kedua aset di dokumen simulator setelah respons akses berhasil. Viewer PelautSim baru dapat memakai jalur yang sama. Saat mengemas viewer mandiri, sertakan kedua aset sesudah UI PelautSim siap. Untuk runtime lain, ikuti kontrak interaksi di [standar workspace](WORKSPACE_UI.md).

Chromium dengan WebGL software menguji viewport 1280×800, 390×844 dan 844×390. Pada keempat mesin, canvas memenuhi viewport, panel dapat dibuka dan ditutup, potongan aktif, jarak bongkar kembali ke nol setelah reset, dan zoom dapat digunakan. Tiga mesin premium diuji di iframe sandbox dengan respons akses lokal yang memuat salinan simulator dari branch main. Pengujian akun premium produksi dan perangkat fisik masih terbuka.

Pada Shinko, pengujian tambahan memeriksa informasi setelah memilih komponen, filter daftar dan katalog cadangan saat Three.js gagal dimuat. Perbandingan kiri sebelum dan kanan sesudah tersedia untuk [desktop](design/studio-shinko-desktop.webp) dan [HP](design/studio-shinko-hp.webp).
