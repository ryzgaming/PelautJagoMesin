# Interaksi belajar mesin di HP

## Alur inti
- Pilih satu tugas belajar yang konkret per perubahan, misalnya menemukan mechanical seal, mengidentifikasi jalur pelumasan, atau membongkar cover. Jangan menambah semua fitur sekaligus tanpa scope.
- Pertahankan alur lihat mesin → pilih komponen → baca fungsi/bukti → isolate/cutaway/explode bila perlu → kembali ke assembly. Kurangi kontrol permanen yang menghalangi model.
- Sediakan orbit/pinch/pan dengan petunjuk singkat, reset kamera, dan cara memilih melalui daftar/search sebagai alternatif untuk part kecil. Hindari konflik scroll halaman dan gesture canvas.
- Pertahankan node/instance ID ke data part agar tap, hover, isolate, dan label merujuk objek yang sama. Jika memilih instance, jangan menyorot semua instance material/geometry itu.
- Perluas area hit sentuh secara wajar atau bantu dengan focus/list; jangan memperbesar baut fisik untuk membuatnya mudah ditekan. Target kontrol awal sekitar 44 CSS px dapat dipakai sebagai sasaran UX, bukan dimensi komponen atau bukti kepatuhan standar.
- Prioritaskan label terpilih, hindari saling tumpang tindih, dan gunakan leader line bila membantu. Panel informasi tidak boleh menutup seluruh objek pada portrait kecil; dukung orientasi landscape sesuai kebutuhan.

## Materi dan aksesibilitas
- Tampilkan nama Indonesia dan istilah teknis/part number, fungsi, hubungan ke sistem, serta sumber. Jangan membuat klaim maintenance atau diagnosis spesifik tanpa manual yang cocok.
- Bedakan tampilan terpasang, potongan, dan exploded secara jelas. Beri konteks bahwa jarak exploded bersifat ilustrasi.
- Gunakan tugas interaktif dan feedback yang menjelaskan alasan, bukan hanya skor. Jika quiz diminta, turunkan jawaban dari materi yang sudah diverifikasi.
- Dukung fokus keyboard untuk kontrol web, label kontrol, kontras yang terbaca, pause/reduced motion, dan alternatif selain warna. Periksa sesuai fitur yang tersedia; jangan mengklaim aksesibilitas lengkap dari checklist singkat.
- Jangan membuat klaim offline hanya karena halaman pernah terbuka: jika offline diminta, uji aset/data/font yang dibutuhkan tanpa jaringan dan dokumentasikan batasnya.

## Pengujian
Catat viewport/browser dan apakah perangkat nyata atau emulasi. Periksa portrait/landscape, panel buka/tutup, label panjang bilingual, loading/error state, seleksi part kecil, isolate/show all, cutaway, explode/reset, serta persistensi mapping sesudah LOD. Laporkan tugas yang berhasil/gagal dan hambatan nyata; jangan menyamakan kesan seperti game dengan efektifitas belajar yang belum diuji pengguna.

