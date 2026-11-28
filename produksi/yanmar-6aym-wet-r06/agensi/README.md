# Agensi dan bahan produksi Yanmar R06

Folder ini menyimpan pembuat dan bukti produksi, terpisah dari aset model, runtime dan UI.

| Lokasi | Kegunaan |
|---|---|
| [produksi/source](produksi/source/README.md) | Generator dan input yang dapat dipakai untuk membangun ulang model |
| [produksi/tools](produksi/tools/DEPENDENSI.md) | CLI build, audit, perbandingan geometri dan catatan dependensi |
| [agen](agen/README.md) | Profil serta brief peran yang dipakai pada produksi ini |
| [referensi](referensi/README.md) | Manual, foto/frame, video dan indeks bukti; `referensi/viewer` berisi materi yang dibuka UI |
| [qa](qa/) | Hasil pemeriksaan; `qa/viewer-r06` berisi media pembanding/rekaman; `qa/struktur-folder-v2` memeriksa layout aktif |
| [arsip-asli](arsip-asli/README.md) | Berkas produksi asli R01–R06, dipulihkan melalui objek dan manifest SHA |
| [arsip-paket](arsip-paket/) | Manifest susunan paket sebelumnya dan peta migrasi ke layout-v2 |
| `perangkat-produksi`, `skills-cloud` | Snapshot toolkit, skill dan lampiran produksi yang disertakan |
| `validasi-pemisahan` | Bukti layout-v1; dipertahankan sebagai sejarah, bukan petunjuk path layout-v2 |

`PANDUAN-PRODUKSI.md` dan laporan lama adalah snapshot sebelum pemisahan ketat. Untuk lokasi kerja sekarang, gunakan README paket, panduan `produksi/source` dan API di `../runtime/`. Jangan mengganti bukti lama agar tampak berasal dari susunan terbaru.

Konfigurasi agen/skill aktif lintas mesin berada di direktori kanonis akar repo. Salinan per-model ini adalah provenance revisi R06; pembaruan global tidak ditulis ke snapshot sejarah secara otomatis.
