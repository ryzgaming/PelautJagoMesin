# Riwayat poros dan mekanisme 6AYM-WET · R05

Catatan ini menyimpan keadaan sebelum revisi R06. Untuk hasil yang berlaku di model R06, termasuk koreksi rasio pompa oli menjadi 8/9, termostat, gerakan governor dan impeler lentur, baca [audit fungsi R06](../function-specialist/README.md).

Orientasi model memakai koordinat glTF dalam meter. +X mengarah ke depan. Pada konvensi waktu viewer, crank dan flywheel berputar −1 radian terhadap sumbu +X untuk setiap radian siklus. Semua rasio di bawah memakai konvensi yang sama.

| Penggerak | Putaran atau langkah model | Dasar dan batas |
|---|---|---|
| Timing belakang dan depan | Perbandingan gigi terpasang pada masing-masing pasangan, cam −½ dan poros pompa injeksi +½ | D01 PDF 112, 115–116. Gigi yang digabung pada poros, coupling atau hub punya satu pengendali. Jumlah gigi per roda timing diestimasi. |
| Air tawar | +4/3. Menghasilkan 2.533,33 rpm pada 1.900 rpm crank | Tabel D01 PDF 163–164 memberi 2.533 rpm. Relasi gigi cam 48 terhadap pompa 18 menghasilkan rasio tersebut. Bentuk gigi dan fase diestimasi. |
| Air laut | −24/29. Menghasilkan 1.572,41 rpm pada 1.900 rpm crank | Tabel D01 PDF 163–164 memberi 1.572 rpm. Roda poros injeksi 48 terhadap pompa 29 merupakan rekonstruksi. Impeler ditampilkan berputar dengan sudu lentur yang telah dibentuk. Deformasi sesaat belum disimulasikan. |
| Oli utama | +32/28 dan −32/28 pada dua roda pompa | Roda yang bertaut berlawanan putar. D01 PDF 157–159 dan D05 Fig.43–44. Profil model edukatif. |
| Governor, feed dan enam plunger | Nok +½. Roller dan tappet mengikuti kontak kontur lokal. Langkah feed 4,8 mm pada eksentrik model | D01 PDF 115–116, 145–147 dan D05 Fig.74–77. Enam nok mengacu urutan 1–4–2–6–3–5. Fase feed, lift jarum dan katup berdasarkan pendekatan edukasi. |
| Alternator | Gear dan poros perantara +1½. Puli poros/rotor memakai jari-jari pitch 63/53 mm pada model | D05 Fig.107, 109 menunjukkan gear pada poros perantara serta sabuk/puli. Sabuk tunggal A28, opsi alternator 600 W. Diameter pitch dan nomor seri belum diukur. |
| Starter | Pinion dan carrier +18, sun +72 pada fase start. Tiga planet berorbit dan berputar −54 relatif carrier. Pinion bergerak −26 mm saat masuk | D01 PDF 113 mendukung flywheel berdiameter 630 mm dengan 180 gigi. D05 Fig.106 untuk contoh starter earth-float. Model memakai 10 gigi pinion, 12 gigi sun/planet dan 36 gigi ring. Rasio dan langkah starter adalah rekonstruksi. |
| Turbo dan filter sentrifugal | Dua rotor bebas dengan kecepatan visual ilustratif | D01 PDF 160 dan 170–171, D05 Fig.32 dan 47. Kedua roda turbo terikat pada satu poros. Rotor saringan diputar jet oli mengelilingi spindle tetap. RPM unit belum diukur. |

Lihat `model/motion/shaft-inventory.json` untuk penanggung gerak setiap mesh. Pengatur beban/governor berada pada kondisi tunak. Floating bearing turbo, bearing utuh pada alternator, starter dan pompa air laut, putaran lokal bola bearing, slip sabuk, perubahan bentuk sudu dan respons tekanan transient belum diukur atau diselesaikan secara fisik.

Untuk membangun kembali pengendali dari GLB keluaran, jalankan `python model/motion/build_motion.py` dari akar model. Periksa `pending_meshes` dan kecocokan SHA-256 dengan ekspor yang ditinjau. Uji gear starter menggunakan `model/motion/audit_drives.py` melalui Blender dan pemeriksaan housing memakai `model/motion/audit_enclosures.py`.

Periksa seluruh rakitan starter dan rumah aksesori setelah setiap ekspor. Jalankan dari akar model.

```bash
blender -b -t 2 --python-exit-code 1 -P model/motion/audit_drives.py -- "$PWD" "$PWD/qa/r05/drivetrain/starter-final.json"
blender -b -t 2 --python-exit-code 1 -P model/motion/audit_starter_flanks.py -- "$PWD" "$PWD/qa/r05/drivetrain/flank-gap.json"
blender -b -t 2 --python-exit-code 1 -P model/motion/audit_enclosures.py -- "$PWD" "$PWD/qa/r05/drivetrain/enclosures-final.json"
python model/motion/check_drive_release.py
```

Pemeriksaan terakhir mengembalikan status gagal bila bukti berasal dari GLB lama, target gerak hilang atau ganda, collar starter menyentuh flywheel, carrier mengenai ring diam, atau komponen bergerak memotong rumah pada pasangan yang diuji. Hasil bertanda SHA-256 ada di `qa/r05/drivetrain/release.json`. Pemeriksaan dijalankan pada sudut diskret.
