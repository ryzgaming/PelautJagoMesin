# Aturan kerja paket Yanmar R06 terpisah

## Batas pekerjaan

- Untuk tugas mengganti UI, kerjakan `ui-workspace/`. Pakai API yang didokumentasikan di `model/runtime/README.md`. Jangan menyalin mekanisme mesin, geometri, register fungsi atau efek ke UI baru.
- `model/` menyimpan bentuk, data, generator dan perilaku mesin. Ubah bagian ini hanya untuk tugas yang memang meminta perubahan model atau mekanisme. Buat keluaran generator di folder staging baru; jangan menimpa ekspor yang direview.
- `agensi/` menyimpan bukti produksi. Pertahankan arsip asli dan hasil audit terdahulu. Temuan baru memperoleh laporan/revisi sendiri.
- Saat diperlukan, gunakan spesialis dengan tugas dan batas file yang jelas; pemilik telah mengizinkan pembentukan agen spesialis. Profil tersimpan bukan bukti agen sudah dijalankan.

## Pemeriksaan perubahan UI

1. Baca README paket dan kontrak runtime.
2. Jalankan `python tools/verify.py` sebelum dan sesudah perubahan.
3. Jalankan `node tests/model-api.mjs` dan pemeriksaan browser yang sesuai perubahan.
4. Periksa desktop dan viewport HP; sebutkan jika hanya emulasi.
5. Pastikan 1.184 ID komponen, gerak, starter, aliran dan suara tetap memakai inti model yang sama. Jangan mengganti checksum baseline untuk menyembunyikan perubahan.

Buat ringkasan apa yang berubah, hasil pemeriksaan dan batasnya. Model ini masih draf review privat. Jangan masukkan ke katalog tanpa instruksi pemilik. Kecocokan hash dan kelulusan UI tidak menyatakan akurasi OEM atau menutup temuan QA mekanis historis.
