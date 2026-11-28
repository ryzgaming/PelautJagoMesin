# Audit independen penataan repositori

Penataan lokal lulus terhadap baseline `e526ec06accd34f98b634e762588b59520ff68c5`. Diff staging mengenali 80 perpindahan dan tidak memuat penghapusan tanpa pasangan. Modul Alur dikelompokkan menurut fitur, tes menurut domain, dan panduan UI beserta aset desain berada di satu direktori. Semua 11 gambar desain mempertahankan byte aslinya. [Peta perpindahan](../reorganisasi-path.json)

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run check:repo` | Lulus untuk tautan lokal, peta perpindahan, registri aktif, jalur penemuan agen dan skill, serta integritas aset r06 |
| `npm test` | 126 lulus |
| `npm run test --workspace alur-workflow` | 91 lulus |
| Suite Python runner, worker, dan toolkit | 9, 14, dan 36 lulus |
| `npm run build` | Lulus di salinan terisolasi, termasuk TypeScript, Vite dan penyiapan keluaran Pages |
| `git diff --cached --check` | Lulus |

Pada salinan uji, penambahan tautan lokal yang rusak di luar blok kode, pemutusan symlink Claude, dan perubahan SHA pada pointer GLB masing-masing terdeteksi. Baris mirip tautan di blok kode berpagar, termasuk yang berada di dalam kutipan, diabaikan. Validator juga berjalan pada salinan yang memuat pointer Git LFS untuk aset r06.

## Aset dan rute yang diperiksa

Diff terhadap baseline kosong pada paket `produksi/yanmar-6aym-wet-r06/`, `dist/`, `functions/`, `.claude/`, dan konfigurasi Wrangler. Ketiga symlink Claude masih mengarah ke direktori skill yang dapat ditemukan. Registri agensi memetakan profil dan skill asli tanpa menyalin profil ke jalur penemuan lain. Status Yanmar sebagai paket review, Shinko sebagai simulator publik, dan ketiga halaman katalog premium tetap tercatat sesuai baseline. [Registri agensi](../../agensi/registri.json) · [Registri model](../../produksi/REGISTRY.json)

Kedua pointer GLB pada index mempertahankan SHA-256 Yanmar r06. Eksterior memakai `defc58c070a871da2068b2ddd4388ff51b340a1014dfde2226f7e47946a89121` dan internal memakai `526ce37f126203eb288388dbd7922dd85749b19ddf8ef82ee5bfcf9d472ec8f5`. [Manifest paket](../../produksi/yanmar-6aym-wet-r06/model/manifest.json)

## Batas verifikasi

Status PR 42 sebelum penataan dilaporkan lulus untuk workflow verifikasi dan Pages, sementara Cloudflare Workers Builds sudah gagal pada baseline. Pemeriksaan lokal ini tidak menjalankan deploy atau menguji ulang layanan Workers. Tes balapan PostgreSQL opsional, perangkat fisik, dan pengukuran OEM berada di luar cakupan audit penataan repo. Status geometri terdahulu tetap tercatat dalam paket Yanmar. [QA r06](../../produksi/yanmar-6aym-wet-r06/agensi/qa/r06/r06/QA.md)
