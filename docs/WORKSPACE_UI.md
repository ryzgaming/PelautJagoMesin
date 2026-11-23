# Standar workspace mesin — Studio Gelap

Keputusan pemilik, 24 November 2026 (Asia/Jakarta): gunakan **konsep nomor 2 — Studio Gelap** untuk seluruh workspace mesin yang sudah dibuat dan yang dibuat pada sesi mendatang. Dokumen ini menjadi acuan implementasi lintas sesi, dibaca bersama AGENTS.md.

## Susunan dan tampilan

- Canvas/model 3D mengisi viewport penuh; tidak ditempatkan dalam kartu dashboard. Gunakan tinggi viewport dinamis dan perhitungkan safe area HP.
- Tema graphite gelap, permukaan panel sedikit lebih terang, teks terang, aksen teal untuk kontrol aktif dan seleksi. Jangan bergantung pada warna saja untuk menandakan state.
- Bar atas ringkas: kembali, merek/nama model mesin, bantuan dan kontrol layar penuh bila didukung browser. Layar penuh browser bersifat opsional; canvas tetap memenuhi viewport tanpa izin fullscreen.
- Toolbar utama mengambang di bawah: **Komponen, Potongan, Bongkar, Animasi, Reset**. Tampilkan hanya fitur yang benar-benar didukung model; jangan membuat tombol seolah berfungsi jika datanya belum ada.
- Rail alat di samping boleh digunakan untuk akses tambahan. Hindari duplikasi kontrol yang memenuhi layar.
- Panel daftar/pencarian komponen dan informasi komponen **tertutup saat awal**; muncul atas tindakan pengguna dan selalu punya tombol tutup. Pemilihan komponen menyorot objek yang tepat dan membuka informasi terkait.
- Kontrol kamera/orientasi ringkas di sudut bila tersedia. Slider bongkar hanya muncul ketika mode tersebut aktif. Status mode utuh/potongan/bongkar harus jelas.
- Reset mengembalikan kamera dan state tampilan ke baseline yang ditetapkan model; pertahankan pemetaan ID komponen dan kemampuan kembali ke assembly.

## HP dan desktop

- Desktop: panel menjadi overlay samping yang dapat ditutup; model tetap mendapat area dominan.
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
3. Uji panel buka/tutup, pencarian/seleksi, fokus kamera, mode yang didukung, slider bongkar, animasi/pause, dan reset berulang. Pastikan state komponen tidak bergeser setelah reset.
4. Periksa overflow, target sentuh, fokus keyboard, label panjang, safe area, dan kegagalan WebGL/aset. Jalankan pemeriksaan repo yang relevan.
5. Laporkan implementasi, pengujian, dan deployment secara terpisah. Dokumen atau mockup saja tidak membuktikan UI sudah diterapkan.
