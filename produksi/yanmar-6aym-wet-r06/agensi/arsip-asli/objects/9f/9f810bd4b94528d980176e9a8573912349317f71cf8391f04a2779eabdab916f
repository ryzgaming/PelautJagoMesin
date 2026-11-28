# Integrasi viewer r05

Pengoperasian → Penggerak atau `?view=drives` membuka pemilih mekanisme di dock, mesin pada pose terpasang, dan kamera fokus pada komponen yang dipilih. Mulai, Jeda, Ulang, Fokus, Starter, kembali ke Operasi, dan X-ray dapat digunakan tanpa panel Rincian. Rincian menampilkan status bukti dan sumber. Kecepatan pengamatan dan siklus starter adalah ilustrasi.

Runtime memakai GLB asli dan matriks posisi awal. Setiap gerak tambahan mengikuti poros, pivot, rasio, lintasan atau profil di `model/motion/drivetrain.json`. Matriks yang dihitung dalam koordinat dunia dikonversi kembali ke koordinat induk node. Waktu engkol berulang untuk pembakaran, sementara fase gerak roda gigi pecahan diakumulasi agar tetap kontinu. Komponen yang dikendalikan oleh mekanisme lama dan manifes baru diperiksa untuk kepemilikan ganda.

Operasi dan Tur memakai gerak yang sama. Ulang mengembalikan matriks awal. Jeda mempertahankan posisi. Saat merakit atau membongkar, mesin berhenti. X-ray penggerak menampilkan rumah terkait; poros, roda gigi dan bagian terpasang tetap dapat diperiksa. Film r05 ditautkan pada paket hosted dan diberikan terpisah dari HTML offline. Film lama tetap tersedia pada rilis r04.

## Verifikasi

`node tools/check.mjs --require-drives --require-flow --require-flow-model` memeriksa node GLB, poros/pivot, daftar rumah, indeks rute, kepemilikan, serta keterhubungan data. `node tools/state-check.mjs --require-drives --require-flow --require-moving-oil --view=drives` menguji alur pemilihan, matriks dunia, Jeda, Starter dan Ulang dengan GLTFLoader aktual serta DOM/renderer tiruan. Hasil browser, bukti render dan hash paket dicatat setelah model beku.

Pratinjau terkelola r05 gagal menunggu relay port 4173. CUA mengembalikan “the gaas-browser node_repl sandbox cannot be disabled”. Pengujian visual WebGL dan gestur pada browser tetap **UNVERIFIED**.

## Paket model

Eksterior `3edb9db0135c2714e913c2f8a5b120c1f747dec10927024acba17cd4e09a8302`, interior `46a8854081530e81d2a2af56dc936dbcd22e6b296343029510638e8d120252fa`, dan manifes gerak `4b8d55ff94dc8e470b4510dfa2cdf6c9de9fed816c8bf2db5aa04ddc514f5deb`. Paket mengikat 83 kelompok gerak pada 141 node tambahan dan mempertahankan gerak 434 mesh dari model sebelumnya. Inventaris total memuat 1.146 ID dan daftar katalog diperbarui untuk 127 figur serta 2.379 posisi.

Kelompok gerak mencakup roda gigi timing, pompa oli, impeler dan poros pompa air tawar dan air laut, poros perantara dan rotor alternator, penanda lintasan sabuk, turbo, filter oli sentrifugal, nok pompa bahan bakar, pemberat governor, tappet, plunger, pegas dan katup delivery, jarum dan pegas injektor, serta starter. Mode Starter memperagakan armature, carrier, planet, pinion, solenoid dan tuas. Rumah yang dinyatakan tetap, dudukan idler dan ring planetary tetap diam saat diuji. Pose awal katup yang diberi fase dalam GLB dipulihkan saat Ulang.

Tautan langsung antara lain `?view=drives&drive=starter-pinion`, `?view=drives&drive=alternator-belt-travel`, `?view=operation` dan `?view=tour`. Tautan lama `INT-TIMING-09` dan `INT-TIMING-06` memilih roda gigi pompa air tawar dan air laut pada ID yang dipertahankan. Geometri gigi pada antarmuka timing–pompa tetap memerlukan verifikasi unit aktual. Rute dan penampang injektor serta urai Fig. 36 tetap tersedia.

Pemeriksaan pada GLTFLoader aktual mencakup matriks dunia terhadap pivot, fase, rumah diam, langkah starter, kontinuitas rasio pecahan melewati 720°, kestabilan Jeda, dan pemulihan matriks. Uji potret menggunakan proyeksi frustum Three.js dan kanvas tiruan. Pengujian WebGL browser dan gestur nyata masih belum terverifikasi.

Saat mode Starter dipilih pada sudut engkol yang sudah berubah, viewer menyesuaikan fase pinion ke ring flywheel model 180 gigi dengan perubahan paling banyak setengah pitch. Pinion bergerak masuk setelah Mulai dan kembali ke posisi duduk saat Idle. Pengujian runtime mencakup pindah Idle–Starter berulang dari sudut yang berlainan.
