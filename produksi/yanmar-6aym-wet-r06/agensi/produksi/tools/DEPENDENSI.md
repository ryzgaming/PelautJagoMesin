# Peta dependensi build R06

| Tahap | Masukan yang dibaca | Hasil |
|---|---|---|
| Geometri lintasan | Datum, konfigurasi sudut pompa air, kurva pipa pada `exterior/build.py`, lima skema sistem | `water-lube.json`, `fuel-gas.json`, `routes.json`, `source-coverage.json` |
| Blender internal | Datum, `mechanical_service.py`, `injector.py`, `gear_train.py`, `water_drive_spec.py`, manual D01, HTML/SVG katalog Fig. 79 | Internal GLB/Blend, inventaris, kinematika, resep internal dan register nosel |
| Blender eksterior | Datum dan lintasan terbitan, seluruh 14 modul `exterior/specialists/`, helper `charge_duct.py` dan `piping_ports.py`, kinematika internal dan helper geometri gear, modul penggerak sabuk/starter/pompa/nok/rack/impeler, profil pinion tersimpan, Fig. 106/109 | Eksterior GLB/Blend, inventaris dan resep rakitan |
| Pembentukan gerak | Dua GLB, kedua inventaris, kinematika internal, geometri sabuk/pompa/penggerak, file parameter dasar `inputs/base-viewer-kinematics.json` | `drivetrain.json` dan `shaft-inventory.json` |
| Pembentukan fungsi | Dua GLB dan inventaris, register gerak/poros dan lintasan | `functions.json` |
| Audit mandiri | GLB hasil tahap sebelumnya, kinematika, profil impeler dan penggerak | Register hasil gear, impeler/termostat dan bores oli di tahap staging |

Master akhir terdapat di `model/masters/` dari akar paket. Aset review dan data komponennya tersedia di `model/assets/`. Rakitan kerja dibentuk ulang dalam staging dari bahan produksi berikut.

Jalur-jalur di atas mengacu ke `../source/model/`; dokumen, tabel katalog, input dan generator audit berada satu tingkat di atasnya dalam `../source/`. Cabang R06 tidak mengimpor generator dari checkout R01–R05 ketika build berjalan. Nilai datum, kode yang diwarisi, kinematika dasar dan profil gigi yang telah terbit tersimpan dalam paket ini. `source-inventory.csv` membedakan generator, masukan, master, hasil data, referensi dan utilitas audit historis. Script audit lama pada `source/model/motion` dan `source/model/flow` menyebut struktur QA R04/R05. Gunakan pemulihan arsip untuk memutar ulang audit historis beserta hasil historisnya. Untuk pengujian R06 tersedia `audit.py`.

Dasar gambar berasal dari D01–D06, GA01 dan foto/video yang dicantumkan di inventaris sumber. D01, dua cuplikan D05 106/109 dalam format JSON serta Fig. 79 dalam HTML/SVG merupakan file referensi yang diperlukan generator pada waktu build. Sisanya merupakan bukti desain dan tersedia di folder agensi/referensi sebagai bahan telaah.
