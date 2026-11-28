# Yanmar 6AYM-WET R06 — folder berdasarkan tanggung jawab

Geometri mesin tetap R06. Susunan paket diperbarui pada 29 November 2026 agar model, tampilan, kode operasi dan bahan pembuatnya benar-benar berada di folder terpisah. Model ini masih bahan review; belum disetujui masuk katalog.

| Folder | Isi yang diperbolehkan |
|---|---|
| [`model/`](model/) | **Data/model saja:** GLB, master Blender, inventaris/katalog JSON dan manifest model. Tidak ada HTML, CSS, JavaScript atau skrip pembuat. |
| [`runtime/`](runtime/README.md) | Kode mesin saat dijalankan: pemuat/render 3D, mekanisme, lifecycle, aliran, pembakaran, suara dan API. Tidak mencari tombol/panel milik UI. |
| [`ui-workspace/`](ui-workspace/README.md) | HTML/CSS, panel, tombol, kontrol, label dan diagram antarmuka. Tidak menyimpan GLB, master, BOM, generator atau laporan QA. |
| [`agensi/produksi/`](agensi/produksi/source/README.md) | Generator, input pembuat, alat build/audit dan prosedur produksi ulang. |
| [`agensi/agen/`](agensi/agen/README.md) | Profil/brief agen produksi; alat dan skill yang dipakai tersedia di subfolder agensi terkait. |
| [`agensi/referensi/`](agensi/referensi/README.md) | Manual, katalog sumber, foto/frame/video dan bahan rujukan. Bahan yang ditampilkan viewer ada di `referensi/viewer/`. |
| [`agensi/qa/`](agensi/qa/) | Bukti pemeriksaan, gambar pembanding, rekaman dan contoh audio QA. Media yang dibuka UI ada di `qa/viewer-r06/`. |
| [`agensi/arsip-asli/`](agensi/arsip-asli/README.md) | Riwayat produksi R01–R06 yang dipertahankan persis; bukan sumber aktif yang ikut ditulis ulang. |
| `tests/`, `tools/` | Pengujian paket, server lokal dan pemeriksa checksum; bukan kode model. |

Aturan pengelompokan berlaku untuk folder aktif. Arsip historis mempertahankan struktur dan nama berkas pada waktu dibuat. Manifest paket sebelum pemisahan ketat disimpan di `agensi/arsip-paket/r06-layout-v1/`; versi Git lama juga tetap tersedia. [Peta perubahan folder](agensi/arsip-paket/r06-layout-v2.json) menghubungkan lokasi lama dengan yang baru.

## Menjalankan dua UI

Dari folder paket ini, gunakan Python 3.11+:

```sh
python tools/serve.py
```

Buka `http://localhost:8766/ui-workspace/` untuk Studio atau `http://localhost:8766/ui-workspace/minimal.html` untuk UI ringkas. Kedua UI memuat model dan runtime yang sama. Browser perlu WebGL; file harus disajikan lewat HTTP, bukan klik ganda HTML.

Untuk HP dalam jaringan yang sama, gunakan `python tools/serve.py --bind 0.0.0.0` lalu buka alamat IP komputer dan port 8766 dari HP. Viewer tidak memerlukan API key AI. Jika ingin hosting, sertakan `model/assets/`, `model/manifest.json`, `runtime/`, `ui-workspace/`, `agensi/referensi/viewer/` dan `agensi/qa/viewer-r06/` sesuai rujukan UI; master, generator dan arsip besar tidak diperlukan oleh viewer. Keberhasilan emulasi HP tidak membuktikan pengujian perangkat fisik.

## Mengganti UI

Mulai dari `ui-workspace/minimal.html`, CSS dan JavaScript-nya. Gunakan [API runtime](runtime/README.md); jangan memindahkan geometri atau mekanisme ke panel UI. `model/manifest.json` hanya mendeskripsikan model. Konfigurasi pemuatan kode ada di `runtime/manifest.json`.

```sh
python tools/verify.py
node tests/model-api.mjs
```

Perintah pertama memeriksa aset sesuai checksum model; kedua memeriksa lifecycle/API. `python tools/verify.py --all` memeriksa seluruh paket terhadap manifest layout terbaru. Perubahan UI yang disengaja akan terdeteksi oleh audit seluruh paket, sedangkan aset model tetap dapat diverifikasi sendiri. Jangan mengganti checksum untuk menutupi perubahan model.

## Mengedit atau membuat ulang model

Buka `model/masters/exterior.blend` dan `model/masters/internal.blend` untuk master yang dapat diedit. Skrip pembuat, parameter dan masukan ada di **agensi/produksi**, sehingga folder model bersih dari program pembuat dan UI. Ikuti [panduan sumber](agensi/produksi/source/README.md).

```sh
python agensi/produksi/tools/build.py --target all --output hasil-build-01
python agensi/produksi/tools/audit.py hasil-build-01
```

Blender 4.3.2 digunakan pada pengujian sumber. Build membuat folder keluaran baru dan tidak menimpa model review. Ekspor ulang dapat berbeda secara biner karena urutan indeks/normal; perbandingan permukaan dan laporan generator diperlukan sebelum mengganti ekspor review.

## Bukti dan batas

Dua GLB, inventaris asli dan master Blender mempertahankan byte yang direview. Perubahan ini mengubah tata letak/pemuatan, bukan detail geometri atau status akurasi. Seluruh referensi yang tersedia, profil/brief, snapshot skill, toolkit dan riwayat tetap disertakan. Brief rekonstruksi bukan transkrip percakapan lengkap; profil tidak berarti agen berjalan otomatis.

Nomor seri/arrangement, akurasi OEM menyeluruh, temuan benturan historis yang belum diklasifikasikan dan perangkat HP fisik tetap memerlukan verifikasi. Efek/audio adalah peragaan. Hak referensi pihak ketiga mengikuti [catatan sumber](agensi/referensi/THIRD-PARTY-NOTICES.md); penyimpanan di repo bukan pemberian hak penjualan ulang.
