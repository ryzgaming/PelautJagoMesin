# Audit independen r05

**Status menyeluruh UNVERIFIED.** Area filter yang dilaporkan lulus uji lokal pada pose rakit. Pada r04, filter udara turbo menembus manifold gas buang dengan 741 pasangan segitiga berpotongan. R05 mengukur jarak antarmuka minimum sebesar 5.35 mm pada mesh. Kamera dan pencahayaan sama pada kedua gambar. Jarak fisik pada mesin belum terukur. [Lihat perbandingan](perbandingan-filter.jpg)

Uji ulang Blender mencakup 1146 mesh. Mode idle disapu dalam 181 pose dan starter dalam 61 pose. Matriks posisi berasal dari GLTFLoader dan fungsi pose aktual viewer. Uji ini menghitung pasangan segitiga yang berpotongan pada setiap sampel dan melewatkan komponen yang bergerak sebagai satu unit kaku. Starter juga diperiksa terpisah pada 97 pose rapat di 24° awal crank.

Pada gabungan sampel ada 802 pasangan permukaan berpotongan: 106 pasangan pemasangan yang telah diklasifikasi, 0 cacat terkonfirmasi, dan 696 pasangan belum diputuskan satu per satu. Dari yang belum diputuskan, 53 pasangan mengalami gerak relatif dan 643 hanya terdeteksi pada konfigurasi rakit. Jumlah pasangan segitiga tidak menunjukkan kedalaman penetrasi. Deteksi permukaan ini belum membuktikan ketiadaan benturan kontinu atau volume tertanam seluruhnya.

Arah crank dilihat dari flywheel, urutan pengapian 1–4–2–6–3–5, dan stroke 180 mm merujuk D01 PDF 13. Arah hubungan gear diperiksa terhadap D01 PDF 112. D01 PDF 163–164 mencantumkan pompa air laut 1.572 rpm dan pompa air tawar 2.533 rpm pada crank 1.900 rpm. Titik pusat, jumlah gigi, clearance, profil gerak dan fase yang belum tersedia pada gambar teknik tetap estimasi; rotasi turbo dan rotor oli memakai laju ilustratif.

Uji matriks mengukur 63 target rotasi murni dan 78 target lainnya. Perangkat riil dan WebGL belum terverifikasi karena managed preview gagal membuka relay dan browser tidak dapat diinisialisasi. Film dan uji matriks bukan pengganti pemeriksaan perangkat.

## Cacat terkonfirmasi yang tersisa

Tidak ada pada pasangan yang selesai diklasifikasi. Pasangan belum diklasifikasi tetap terbuka.

## Bukti

- [sweep-comparison.json](tenth/sweep-comparison.json)
- [sweep-classified.json](tenth/sweep-classified.json)
- [running-pivots.json](tenth/running-pivots.json)
- [starting-pivots.json](tenth/starting-pivots.json)
- [filter-clearance.json](tenth/filter-clearance.json)
- [routes-check.json](tenth/routes-check.json)
- [intake-r05.json](tenth/intake-r05.json)
- [concentric.json](tenth/concentric.json)
- [starter-fine-sweep.json](tenth/starter-fine-sweep.json)
- [viewer-state.log](tenth/viewer-state.log)
- [viewer-operation.log](tenth/viewer-operation.log)
