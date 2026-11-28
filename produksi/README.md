# Produksi mesin — sumber, workspace dan agensi

Lihat [daftar seluruh lokasi model](REGISTRY.json) untuk paket produksi, simulator publik, halaman premium, serta pratinjau historis. Indeks ini tidak menambahkan produk ke katalog.

## Yanmar 6AYM-WET R06

Paket lengkap berada di [yanmar-6aym-wet-r06](yanmar-6aym-wet-r06/), dengan tiga batas kerja:

| Folder | Isi |
|---|---|
| [model](yanmar-6aym-wet-r06/model/) | GLB yang direview, master Blender, generator dan input, mekanisme, aliran/pembakaran, suara, manifest dan API. |
| [ui-workspace](yanmar-6aym-wet-r06/ui-workspace/) | Studio lengkap dan contoh UI ringkas yang memakai model/API sama. Ubah tampilan di sini. |
| [agensi](yanmar-6aym-wet-r06/agensi/) | Profil/brief agen, skill, prompt, toolkit, manual/foto/video yang tersedia, QA dan arsip produksi asli R01–R06. |

Seluruh 4.478 berkas paket pengiriman disimpan di tree repo, termasuk payload arsip historis. File besar memakai Git LFS; tidak ada payload yang hanya merujuk `/workspace` atau ZIP lokal yang tidak bisa diunduh. Path lama di catatan historis adalah bukti asal, bukan dependensi viewer. Checksum asli ada di [MANIFEST-PAKET.json](yanmar-6aym-wet-r06/MANIFEST-PAKET.json).

Pemilik pada 28 November 2026 secara eksplisit memilih penyimpanan paket di **repo PelautJagoMesin publik**. Catatan lama yang menyebut review privat dipertahankan sebagai bukti sejarah. Publikasi sumber ini tidak memasukkan Yanmar ke katalog dan tidak memberikan hak baru atas materi pihak ketiga. Lihat atribusi/batas sumber dalam paket. Folder ini berada di luar `dist/` dan tidak menjadi halaman katalog/deployment website.

## Mengambil semua berkas

Pasang Git LFS, kemudian clone branch yang memuat paket. Selama PR belum digabung, gunakan:

```sh
git lfs install
git clone --branch feat/yanmar-r06-paket-terpisah https://github.com/ryzgaming/PelautJagoMesin.git
cd PelautJagoMesin
git lfs pull --include="produksi/**"
cd produksi/yanmar-6aym-wet-r06
python tools/verify.py --all
node tests/model-api.mjs
python tools/serve.py
```

Setelah PR digabung, branch produksi adalah `cloudflare-store`; `main` masih berisi pratinjau website lama. Gunakan Git LFS agar file GLB/Blend/PDF benar-benar terunduh, bukan hanya file pointer. Jika GitHub Download ZIP berisi pointer LFS, gunakan alur clone di atas.

Buka `http://localhost:8766/ui-workspace/` untuk Studio atau `http://localhost:8766/ui-workspace/minimal.html` untuk UI pengganti. [Panduan lengkap](yanmar-6aym-wet-r06/README.md) menjelaskan produksi ulang dari sumber dan pemulihan arsip.

## Mengganti UI

Ikuti [kontrak runtime](yanmar-6aym-wet-r06/model/runtime/README.md) dan [aturan paket](yanmar-6aym-wet-r06/AGENTS.md). Seluruh geometri, ID, mekanisme, efek dan audio berada di `model/`; tampilan/panel/kontrol berada di `ui-workspace/`. Jalankan verifikasi model sebelum dan sesudah perubahan. Salinan master dan skrip build membuat hasil baru, bukan menimpa model yang direview.

[Audit pemisahan](yanmar-6aym-wet-r06/agensi/validasi-pemisahan/LAPORAN.md) mencakup dua UI × desktop/emulasi HP dan sampel matriks seluruh 1.184 komponen. Validasi ini tidak menyatakan toleransi OEM, pengujian HP fisik atau semua benturan mekanis telah selesai. Brief peran rekonstruksi dibedakan dari profil asli; paket tidak mengklaim menyertakan transkrip percakapan yang tidak tersimpan.
