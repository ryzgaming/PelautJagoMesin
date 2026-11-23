# Standar workspace mesin — Studio Gelap

Keputusan pemilik, 24 November 2026 (Asia/Jakarta): gunakan **konsep nomor 2 — Studio Gelap** untuk seluruh workspace mesin yang sudah dibuat dan yang dibuat pada sesi mendatang. Dokumen ini menjadi acuan implementasi lintas sesi, dibaca bersama AGENTS.md.

## Susunan dan tampilan

- Canvas/model 3D mengisi viewport penuh; tidak ditempatkan dalam kartu dashboard. Gunakan tinggi viewport dinamis dan perhitungkan safe area HP.
- Tema graphite gelap, permukaan panel sedikit lebih terang, teks terang, aksen teal untuk kontrol aktif dan seleksi. Jangan bergantung pada warna saja untuk menandakan state.
- Bar atas menampilkan nama mesin dan tautan kembali ke katalog.
- Navigasi bawah berurutan **Eksplor keseluruhan**, **Sistem**, **Pengoperasian**. Eksplor keseluruhan menjadi tampilan awal dengan mesin utuh dan panel tertutup. Sistem serta Pengoperasian membuka materi masing-masing.
- Sistem membuka simulasi sistem milik model. Jika mesin hanya memiliki materi susunan komponen, gunakan daftar komponen beserta penjelasannya. Pengoperasian membuka petunjuk serta kontrol operasi yang tersedia pada mesin tersebut.
- Saat pelanggan mengetuk komponen utama yang memiliki data isi, tampilkan **Eksplor rakitan** di luar canvas. Aksi itu mengisolasi komponen terpilih dan membuka daftar bagian dari rakitan yang sama. Rakitan dibuka terurai dengan nomor penunjuk yang terhubung ke bagian 3D dan daftar bernama. Tampilkan nomor katalog dan jumlah sesuai model, tandai item yang baru tersedia di katalog, dan sediakan Rapatkan/Uraikan. Jarak pisah adalah ilustrasi. Kembali memulihkan mode asal.
- Kendalikan kamera langsung melalui model. Daftar mode tambahan dan toolbar inspeksi terpisah disembunyikan dari tampilan pelanggan.

## HP dan desktop

- Di Sistem, sediakan area tersendiri untuk canvas, panel, indikator dan navigasi. Panel Sistem atau rakitan berada di samping canvas saat layar lebar, atau di bawahnya pada HP tegak. Menutup panel memperluas canvas.
- HP portrait: gunakan panel bawah yang dapat ditutup dengan tinggi terbatas dan isi scroll; toolbar tidak terpotong dan tombol mudah disentuh (target sekitar 44 CSS px).
- HP landscape: batasi tinggi bar dan panel agar canvas tetap dapat dipakai; hindari tabrakan dengan safe area, label, atau toolbar.
- Pertahankan orbit, zoom/pinch, pan sesuai kemampuan viewer; sediakan pemilihan via daftar untuk komponen kecil, petunjuk singkat, label kontrol, fokus keyboard terlihat, dan reduced motion bila ada animasi UI.
- Pertahankan loading, error WebGL/aset, serta akses informasi komponen cadangan. Jangan menutupi error dengan loading tanpa akhir.

## Cakupan implementasi

- Berlaku untuk mesin publik, premium, dan mesin baru; penyesuaian UI tidak mengubah izin akses atau mempublikasikan sumber premium.
- Gunakan stylesheet/komponen/template bersama yang sesuai stack repo. Mesin baru wajib memakai standar ini; migrasikan mesin lama tanpa menghilangkan fitur yang sudah bekerja.
- saVRee adalah patokan pengalaman viewer pembelajaran (komponen, potongan, bongkar, animasi), bukan sumber model, aset, logo, atau salinan tampilan.
- Referensi visual: [papan konsep](design/workspace-concepts.png), **kuadran kanan atas nomor 2**. Bagian lain pada papan tidak dipilih. Geometri pompa pada ilustrasi bukan sumber teknik dan bukan target penggantian model mesin.

## Pemeriksaan penerimaan

1. Inventarisasi semua entry point workspace dan fitur tiap mesin; catat cakupan migrasi, termasuk yang belum diuji.
2. Simpan dan lihat screenshot sebelum/sesudah dengan mesin, kamera, pose, dan viewport sama. Periksa desktop, HP portrait, serta landscape melalui browser; bedakan emulasi dari HP nyata.
3. Uji panel buka/tutup, pencarian/seleksi, fokus kamera, mode yang didukung, peralihan Sistem/Pengoperasian, Start/Stop, dan tutup panel. Pastikan state komponen tidak bergeser setelah reset.
4. Periksa overflow, target sentuh, fokus keyboard, label panjang, safe area, dan kegagalan WebGL/aset. Jalankan pemeriksaan repo yang relevan.
5. Laporkan implementasi, pengujian, dan deployment secara terpisah. Dokumen atau mockup saja tidak membuktikan UI sudah diterapkan.
