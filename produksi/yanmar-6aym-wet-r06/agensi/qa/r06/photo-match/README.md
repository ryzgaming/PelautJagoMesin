# Pembandingan foto P07 dan P08

Bukti privat dari galeri AAM Equipment untuk Yanmar 6AYM-WET H 555 kW pada 1840 rpm. Dua sudut memperlihatkan sisi kiri operasi, yaitu −Z pada GLB Y-up dan +Y setelah impor Blender. Ujung cooler dan guard damper terletak di kiri gambar pada kedua foto. Pada P08, permukaan depan cooler tampak terbuka dan ujung damper terproyeksi lebih besar, sehingga kamera ditempatkan di kuadran depan-kiri. Posisi cooler depan, alternator/guard, badan pompa, pasangan filter, dan kaki ujung flywheel menjadi patokan orientasi.

P07 memakai kamera perspektif mendekati tegak lurus sisi operasi. P08 beralih sekitar 28° ke depan dan sekitar 13° ke atas dalam simulasi kamera. Angka merupakan pengaturan Blender untuk mencocokkan orientasi secara visual karena parameter kamera asli tidak diketahui. Framing yang berbeda, sudut foto, cahaya gudang, dan kedalaman fitur membatasi perbandingan skala. Render r01 dan r02 memakai pengaturan kamera dan lampu identik. Panel dibesarkan dengan rasio piksel tetap. Pallet dan penutup pengiriman menutupi sump serta sebagian koneksi sumber. Logo/label pada foto membantu orientasi dan tidak diperlukan sebagai detail model.

| Landmark | Foto | Pembandingan r01 |
|---|---|---|
| Pompa mekanis dan governor di sisi operasi | Massa utama bertingkat dengan sambungan atas yang terpisah. Governor di ujung depan pompa dengan linkage dan pegas terlihat pada zoom. | Selubung dominan berupa satu volume memanjang dengan enam tonjolan seragam. Tuas dan antarmuka tampak sederhana. |
| Pipa tekanan tinggi di atas pompa | Enam posisi outlet dapat dibedakan. Lengkungan pertama berbeda di masing-masing posisi. Segmen lanjut masuk area bayangan dan terlindung intake. | Bagian atas outlet hadir, tetapi bentuk fitting dan arah/lekukan jalur awal kurang tegas. |
| Filter bahan bakar dekat flywheel | Dua tabung gantung terlihat bersama kepala filter/union di atas dan lengkungan selang di bawah jalur injeksi. | Dua tabung hadir, kepala dan selang penghubung sangat sederhana. |
| Intake manifold atas | Housing memanjang dengan rusuk besar dua baris, garis sambungan, bevel, dan bentuk ujung berbeda. | Rusuk kecil menyatu dengan punggung housing dan kurang mencerminkan kedalaman grid/casting pada foto. |
| Cooler, guard, pipa ujung, cover blok, dan sump | Muka cooler depan asimetris dan cap menyatu casting besar; pipa ujung belakang pendek dengan flange. Perimeter cover blok terlihat. Pallet menutupi sebagian sump. | Siluet dasar searah, dengan cap generik, jalur pipa ujung belakang lebih menonjol, dan bentuk cover lebih rata. Sump tidak dapat diaudit dengan dua foto ini. |

Sumber asli dan hash foto terdaftar di [evidence-foto.json](../../foto/evidence-foto.json). Pengaturan kamera dan hash GLB tertera dalam `r01-cameras.json` dan `r02-cameras.json`. Lampu studio dan material render memungkinkan inspeksi bentuk. Panel ini mendukung pemeriksaan visual kualitatif.

## Hasil visual setelah r02 dibekukan

Kedua panel tiga kolom telah diperiksa pada render GLB r02 dengan SHA-256 `7f4eab14803a9b0ee1671b346985f31f70c6248e9a41f6d51104257118106ed5`.

- Siluet dan pembagian volume pompa injeksi lebih dekat pada P07 dan P08. Pelat bawah bertingkat, kepala fitting terpisah, linkage beserta pegas governor, dan dua tutup filter memberi perbedaan yang jelas dari r01. Rute bagian pertama pipa tekanan tinggi lebih beragam. Relief coran kecil, detail mur/union, dan posisi atau lekuk selang utama masih berbeda dari foto. Tepi selang tertentu tertutup di foto.
- Intake manifold sekarang menunjukkan dua bidang berusuk dan seam tengah yang lebih terbaca. Ketebalan dan jarak rusuk serta profil ujung masih berbeda. Front cooler, jalur pipa dekat flywheel, dan cover inspeksi blok masih memperlihatkan selisih bentuk yang terlihat pada kedua sudut.
- Pemotretan sedikit lebih miring dan proyeksi permukaan depan berbeda pada P08. Penilaian dibatasi pada orientasi dan hubungan antarfitur yang terlihat. Foto berskala, nameplate, ketelitian geometri kecil, ukuran, serta cakupan area tertutup masih belum terverifikasi.

Panel tiga kolom dengan pembesaran tersedia dalam [P07](P07-comparison.jpg) dan [P08](P08-comparison.jpg).
