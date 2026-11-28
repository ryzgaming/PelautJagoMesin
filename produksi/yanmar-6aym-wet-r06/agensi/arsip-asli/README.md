# Riwayat produksi asli r01–r06

Folder ini menyimpan seluruh berkas yang masih tersedia dari enam folder produksi asli, dengan deduplikasi SHA-256. Satu isi berkas disimpan sekali di `objects/<dua karakter SHA>/<SHA>`; `revisions/rXX.json` mencatat nama, ukuran, izin asli dan checksum setiap path. Deduplikasi menghemat ruang tanpa membuang revisi. Berkas cache Python/dependensi yang dikecualikan dicatat satu per satu di manifest revisi.

Pulihkan revisi lengkap ke folder **baru** (Python 3.10+):

```sh
python agensi/arsip-asli/pulihkan.py r06 --tujuan ./pulihan-r06
python agensi/arsip-asli/pulihkan.py r01 --verify
```

Pemulihan memeriksa isi setiap objek dan menolak folder tujuan yang tidak kosong. Izin berkas dicatat sebagai metadata; jalankan skrip pulihan dengan Python. Berkas historis dapat berisi path `/workspace` dan konfigurasi lama; untuk produksi portabel gunakan `model/source` dan `model/tools`, bukan mengedit arsip ini.

`job.json` asli r06 masih berlabel r05; dipertahankan untuk keutuhan bukti. Status revisi aktif ditentukan oleh `production-progress.json` dan manifest paket r06. QA historis menyimpan temuan dan kegagalan pada waktunya, bukan klaim bahwa semuanya sudah lulus.
