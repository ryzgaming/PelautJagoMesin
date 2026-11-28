# Sumber model Yanmar 6AYM-WET R06

Untuk mengedit bentuk dari akar paket, buka salah satu master di [model/masters/exterior.blend](../../../model/masters/exterior.blend) atau [model/masters/internal.blend](../../../model/masters/internal.blend). Kedua master memakai titik acuan yang sama dan satuan meter. Mereka dapat dibuka terpisah. Hasil pemeriksaan Blender 4.3.2 pada masing-masing master menunjukkan tidak memiliki pustaka, tekstur, atau berkas lain yang ditautkan secara eksternal.

| Isi | Lokasi di folder sumber |
|---|---|
| Generator casting, pipa, pompa, perangkat listrik serta pengikat | `model/exterior/` dan `model/exterior/specialists/` |
| Generator poros engkol, timing, valvetrain dan nosel | `model/internal/` |
| Datum, orientasi dan daftar ukuran beserta dasar sumber | `model/datum.json`, `model/dimension-report.json` |
| Resep eksplorasi dan urutan lepas 78 rakitan | `model/assemblies/` |
| Lima skema fungsi, 164 lintasan tiga dimensi dan batas bukti | `model/systems/`, `model/flow/` |
| Penggerak, controller, register fungsi, inventaris poros, profil pinion dan fungsi lifecycle | `model/motion/` |
| Manual dan dua tabel katalog yang dibaca generator | `doc/D01-service.pdf`, `qa/catalog/figures/` |
| Gambar dan HTML Fig. 79 untuk generator injektor | `model/internal/evidence/` |
| Parameter kinematika dasar yang dibaca generator gerak | `inputs/base-viewer-kinematics.json` |
| Kemajuan produksi R06 dan status katalog | `production-progress.json` |
| Script pemeriksaan termostat, gear, jalur oli, impeler dan fase | `qa/r06/` |

R06 tersedia untuk pemeriksaan pemilik. Nomor seri/arrangement unit belum terkonfirmasi. File asli `job.json` masih memuat label R05. Gunakan `production-progress.json` untuk status R06.

## Membangun salinan baru

Jalankan dari folder teratas pengiriman, yaitu folder yang berisi `model/`, `runtime/`, `ui-workspace/` dan `agensi/`. Perintah berikut diuji dengan Python 3.12.14 dan Blender 4.3.2 pada Linux x86-64. Python 3.11+ dibutuhkan oleh utilitas build untuk menghitung hash secara streaming. Blender harus menyediakan eksportir glTF bawaan, modul `bpy`, `bmesh` dan `mathutils`. Build normal menggunakan pustaka standar Python dan modul bawaan Blender. Internet tidak diperlukan.

```sh
python agensi/produksi/tools/build.py --target all --output hasil-build-01
python agensi/produksi/tools/audit.py hasil-build-01
```

Gunakan folder tujuan baru untuk setiap build. Jika opsi `--output` dihilangkan, utilitas membuat folder sementara unik dan mencetak lokasinya. Jika Blender tidak tersedia di PATH, tambahkan `--blender "/path/ke/blender"` pada kedua perintah. Hasil dapat ditemukan di `hasil-build-01/project/model/{internal,exterior}/`, parameter terbitan berada di `hasil-build-01/project/model/{flow,motion,assemblies}/`, dan ringkasan tertulis pada `hasil-build-01/result.json`.

Untuk memeriksa checksum kedua GLB review atau hanya meregenerasi data parameter tanpa Blender, jalankan salah satu perintah berikut.

```sh
python agensi/produksi/tools/build.py --target check
python agensi/produksi/tools/build.py --target metadata
```

`--target geometry` menjalankan pembentukan rute dan kedua generator Blender. `--target all` meneruskan sampai register gerak dan fungsi terbentuk dengan mengimpor ulang ID node hasil ekspor. `--target metadata` membaca dua GLB review di `model/assets/`. `--target check` juga menguji checksum, kecocokan ID mesh dengan inventaris, dan cakupan fungsi. Untuk membandingkan permukaan dasar dua GLB, jalankan perintah ini.

```sh
python agensi/produksi/tools/compare_geometry.py model/assets/exterior.glb hasil-build-01/project/model/exterior/exterior.glb
```

Generator opsional `model/motion/make_pinion_profile.py` memakai NumPy dan Shapely 2.x untuk membentuk kembali profil gigi starter dari awal. Profil hasil yang dipakai rilis sudah disertakan di `pinion-profile.json`. Pustaka tersebut hanya diperlukan jika profil ini akan dirancang ulang.

## Hasil uji pengemasan

Uji build penuh dimulai di folder kosong. Utilitas menyalin sumber dan bahan rujukan ke sana. Kedua master `.blend` yang diserahkan terpisah di `model/masters/`. Kedua master kerja dan kedua GLB lalu dibentuk ulang oleh generator. Sebanyak 78 resep ditulis ulang, 705 mesh internal dan 479 mesh eksterior kembali terdaftar, serta 164 rute terbentuk. SHA-256 GLB internal cocok dengan berkas review. Untuk eksterior, deskripsi JSON glTF serta seluruh koordinat vertex dan permukaan segitiga berorientasi per primitive cocok. Urutan indeks dan sebagian nilai normal hasil ekspor berbeda, sehingga hash biner eksterior hasil build juga berbeda.

Ketika generator data memakai GLB review yang disertakan, keempat berkas rute, register penggerak, register fungsi dan inventaris poros sama secara byte dengan sumber terbitan R06. Hasil pengecekan fisik terpilih terhadap GLB hasil regenerasi disertakan di `../tools/verification/`. Model tetap berstatus review. Validasi geometri yang dicakup oleh uji tersebut belum menetapkan kecocokan toleransi manufaktur terhadap mesin nyata.

## Asal berkas dan pemisahan

`../tools/source-inventory.csv` memetakan berkas sumber operasional ke path produksi asli dan checksum. Satu perubahan pada salinan generator `build_motion.py` memindahkan pembacaan parameter dari bundel website ke `inputs/base-viewer-kinematics.json`. Isinya merupakan objek `kinematics.viewer` yang dipisahkan dari `review/assets/data.json` R06. Ini memungkinkan pembuatan model tanpa memasang UI. Semua script pembentuk geometri eksterior dan internal tetap sama dengan sumber produksi.

`../tools/original-model-index.csv` memetakan setiap berkas dalam folder `model/` historis R06, termasuk master checkpoint air cooler, kandidat lama, render perbandingan, cache dan catatan audit. Folder `../../arsip-asli/` menyediakan arsip dan utilitas pemulihan versi sumber. Foto, dokumen, video, asal sumber serta status peninjauannya dihimpun di `../../referensi/`. Ekspor review yang dipertahankan secara byte terdapat di `../../../model/assets/`; kode interaksi antarmuka dan komponennya tersedia di `../../../ui-workspace/` dan inti pemutaran ada di `../../../runtime/`.
