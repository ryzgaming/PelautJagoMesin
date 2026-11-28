# Paket terpisah Yanmar 6AYM-WET — R06

Paket kerja ini memisahkan **MODEL**, **UI WORKSPACE**, dan **AGENSI PRODUKSI**. Dua GLB dan inventaris yang sudah direview pemilik dipertahankan persis; perubahan UI tidak memerlukan ekspor ulang model. Paket ini tetap bahan review privat dan belum disetujui masuk katalog.

## Tiga bagian

| Folder | Isi dan tanggung jawab |
|---|---|
| `model/` | GLB eksterior/internal, inventaris 1.184 mesh, master Blender, generator, parameter/78 resep rakitan/164 jalur, inti gerak dan lifecycle, efek aliran/pembakaran, audio sintetis, manifest/API dan alat build. |
| `ui-workspace/` | HTML, CSS, kontrol, label, panel, daftar komponen, diagram dan gambar presentasi. Studio lengkap dan contoh UI ringkas memakai inti/model yang sama. |
| `agensi/` | Profil dan brief agen, instruksi proyek/skill/prompt, toolkit dan worker, lampiran asli, manual/foto/video yang tersedia, catatan riset, QA, hasil uji pemisahan dan arsip produksi asli r01–r06. |

`tools/` berisi pembuka server dan pemeriksa checksum. `tests/` berisi pemeriksaan kontrak/model. `MANIFEST-PAKET.json` memetakan setiap berkas dalam paket ke checksum, selain manifest itu sendiri.

## Membuka model dan dua UI

Ekstrak paket, buka terminal di folder ini, lalu jalankan dengan Python 3.11+:

```sh
python tools/serve.py
```

Buka `http://localhost:8766/ui-workspace/index.html` untuk Studio, atau `http://localhost:8766/ui-workspace/minimal.html` untuk UI ringkas. File JavaScript/GLB memerlukan server HTTP, sehingga HTML tidak dibuka langsung dengan klik ganda. Browser modern dengan WebGL diperlukan. Viewer memiliki dependensi lokal dan tidak memerlukan API key atau akun AI.

Untuk review di HP pada jaringan lokal yang sama:

```sh
python tools/serve.py --bind 0.0.0.0
```

Buka alamat IP komputer dengan port 8766 dari HP, misalnya `http://192.168.1.10:8766/ui-workspace/`. IP hanya contoh; gunakan IP komputer sendiri. Server ini untuk review lokal. Untuk hosting, publikasikan **hanya** `model/assets`, `model/runtime`, `model/manifest.json`, dan `ui-workspace`; arsip agensi/manual/master tidak diperlukan oleh viewer.

## Mengganti UI tanpa mengubah model

Mulai dari `ui-workspace/minimal.html`, `minimal.css` dan `minimal.js`. Gunakan API `model/runtime/engine-session.js` dan `model/manifest.json` untuk memuat model, memberi perintah, memilih komponen dan menerima status. Dokumentasi API berada di `model/runtime/README.md`. Ubah tampilan/kontrol di folder UI. Identitas komponen, koordinat, mekanisme, efek dan audio tetap ditangani inti model. UI tidak menjadi masukan generator geometri.

Sebelum dan sesudah mengubah UI, jalankan:

```sh
python tools/verify.py
node tests/model-api.mjs
```

Pemeriksaan pertama membandingkan dua GLB dan inventaris dengan checksum baseline. Uji kedua memeriksa kontrak berkas, 1.184 ID unik dan urutan kerja starter. Untuk memastikan seluruh paket awal tidak berubah, jalankan `python tools/verify.py --all`; perubahan UI yang disengaja akan membuat audit seluruh paket mendeteksi perbedaan, sedangkan audit model tetap dapat lulus.

Perubahan fitur mekanis harus melalui revisi model dan QA baru. Jangan mengganti checksum baseline hanya agar tes lolos. Pertahankan `model/` dan `ui-workspace/` sebagai folder bersaudara saat dipindahkan; keduanya bekerja menggunakan path relatif.

## Produksi ulang dan arsip

Panduan sumber: [model/source/README.md](model/source/README.md). Blender 4.3.2 dipakai pada uji build dari folder kosong; binari Blender/Python/browser tidak dibundel. Kedua master Blender mandiri tanpa file tertaut eksternal. Generator menghasilkan salinan baru tanpa menimpa ekspor review.

```sh
python model/tools/build.py --target all --output hasil-build-01
python model/tools/audit.py hasil-build-01
```

Panduan agen: [agensi/PANDUAN-PRODUKSI.md](agensi/PANDUAN-PRODUKSI.md). Arsip revisi: [agensi/arsip-asli/README.md](agensi/arsip-asli/README.md). Semua berkas produksi yang masih tersedia pada enam folder sumber tersimpan sebagai objek SHA, dengan pemetaan nama asli dan pengecualian cache tercatat. Untuk memulihkan struktur asli:

```sh
python agensi/arsip-asli/pulihkan.py r06 --tujuan pulihan-r06
```

## Status dan batas kelengkapan

Paket menghimpun bahan yang tersedia dalam workspace ini; bukan seluruh internet atau rekaman percakapan yang tidak tersimpan. Ada profil agen asli dan brief peran yang direkonstruksi, ditandai terpisah. Profil tidak berarti agen aktif otomatis; jalankan melalui orchestrator yang sesuai. Kredensial, API key, dependency cache, sesi browser dan instruksi internal penyedia AI tidak dibundel. Snapshot toolkit adalah bagian produksi yang relevan, bukan salinan seluruh platform website.

Rujukan pihak ketiga disertakan untuk telaah privat sesuai asal yang tercatat; keberadaannya bukan pemberian hak untuk menjual ulang manual/foto/video. Lihat `agensi/referensi/THIRD-PARTY-NOTICES.md`. Video hanya mencakup bahan/frame/metadata yang memang tersedia, bukan klaim semua video telah diunduh atau ditonton penuh.

QA pemisahan tidak mengubah batas QA mekanis: nomor seri/arrangement, akurasi OEM menyeluruh, pasangan permukaan historis yang belum diklasifikasi, dan uji di HP fisik masih memerlukan verifikasi. Uji layar HP adalah emulasi browser. Uji build eksterior menghasilkan permukaan yang sama tetapi sebagian normal/urutan indeks ekspor berbeda; ekspor yang direview tetap dipertahankan byte demi byte. Efek dan suara merupakan peragaan, bukan hasil pengukuran audio/CFD mesin nyata.
