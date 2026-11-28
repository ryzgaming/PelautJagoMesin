# Peta repository

Penataan 28 November 2026 memisahkan sumber aplikasi, alat aktif, hasil model dan bukti historis. [Daftar perpindahan](reorganisasi-path.json) mencatat lokasi lama dan penggantinya. Pemindahan tidak mengubah bentuk model, izin akses, harga, alur pembayaran atau katalog.

## Aplikasi dan layanan

- `apps/alur-workflow/src/features/`: fitur `machines`, `agents`, `workflow`, `settings`, dan `home`. Entry point, API client, jalur aplikasi, model AI bersama dan worker MCP tetap di akar `src/`.
- `apps/alur-workflow/functions/`: implementasi API Alur; `functions/alur/`: adapter Cloudflare Pages di lokasi yang diwajibkan deployment. Kedua folder memiliki tugas berbeda.
- `apps/alur-workflow/worker/`: pelaksana produksi server; `apps/alur-workflow/public/runner.py`: runner yang diunduh pengguna. Keduanya bukan duplikat yang boleh dihapus.
- `server/api.mjs`: API untuk server preview dan pengujian; `server/edge.mjs`: implementasi commerce yang dipanggil Edge Function.
- `supabase/`: konfigurasi, Edge Function dan migrasi global. SQL khusus Alur tetap dekat aplikasi di `apps/alur-workflow/supabase/`. Nomor migrasi tidak diubah.
- `dist/`: halaman dan aset storefront yang memang dikelola langsung pada proyek ini. Hanya `dist/alur/` yang dihasilkan build dan diabaikan Git. `dist` bukan folder sampah yang boleh dihapus seluruhnya. URL publik tetap sama.

## Model dan agensi

- [Daftar model](../produksi/REGISTRY.json) membedakan paket lengkap Yanmar, simulator Shinko, halaman katalog premium, dan pratinjau historis branch main. Tidak semua halaman katalog mempunyai master model di branch ini.
- `produksi/<mesin-revisi>/model/`: master Blender, GLB, data dan manifest saja.
- `produksi/<mesin-revisi>/runtime/`: kode gerak, pemuat/render 3D, efek, audio dan API.
- `produksi/<mesin-revisi>/agensi/produksi/`: generator, input pembuat dan alat build/audit.
- `produksi/<mesin-revisi>/ui-workspace/`: antarmuka pengganti yang menggunakan API model.
- `produksi/<mesin-revisi>/agensi/`: bukti alat, referensi, QA dan riwayat pada revisi tersebut; dipertahankan agar dapat diaudit.
- [Agensi akar repo](../agensi/README.md): indeks alat aktif untuk pekerjaan berikutnya. Profil di `.codex/agents`, skill di `.agents/skills`, dan alias Claude di `.claude/skills`. Lokasi khusus ini dipertahankan agar penemuan otomatis tetap berfungsi.
- `tools/gpt-production/`: entry point Python, prompt utama, input spesialis, `docs/` untuk panduan, dan `tests/` untuk kontrak produksi. Worker memuat panduan dari lokasi yang sama.

Sumber aktif tidak diduplikasi untuk membuat folder terlihat seragam. Arsip lama tidak diperbarui bersamaan dengan profil aktif. Geometri, inventaris dan master Yanmar tetap sesuai checksum yang direview. Layout-v2 memisahkan model, runtime, UI dan produksi; manifest layout-v1 disimpan sebagai sejarah, sementara manifest paket aktif mencatat lokasi terkini.

## Tes, dokumen dan operasi

[Test root](../tests/README.md) dikelompokkan menjadi access, Alur, commerce, viewer, integration dan browser. Tes aplikasi/worker/toolkit tetap dekat sumbernya. `npm test` mencakup seluruh tes root yang sebelumnya berada dalam satu folder.

[Standar workspace](workspace/README.md) dan screenshot desain kini satu folder. [Operasional](operations/README.md) memuat panduan deployment/produksi yang sebelumnya memenuhi README akar. [Memori proyek](PROJECT_MEMORY.md) tetap menjadi catatan keputusan lintas sesi.

`npm run check:repo` memeriksa tautan dokumen aktif, penemuan skill/agen, registri, entry point dan checksum model Yanmar. Pemeriksaan berjalan di CI dan memahami pointer Git LFS. Arsip historis per-model dikecualikan dari pembaruan tautan aktif; untuk audit seluruh arsip gunakan verifier paket.

## Aturan penambahan berikutnya

1. Tempatkan fitur Alur di kelompok fungsinya; ekspor/impor menunjuk sumber kanonis, bukan salinan.
2. Tambah model/revisi sebagai paket tersendiri dan daftarkan lokasinya; jangan menimpa hasil yang telah direview.
3. Tambah profil/skill di folder autodiscovery, lalu perbarui registri agensi dan alias Claude jika perlu.
4. Setelah pemindahan, perbarui import, URL worker, fixture, prompt, runbook dan perintah CI; jalankan validator serta tes yang terdampak.
5. Simpan keluaran sementara, cache, node_modules, kredensial dan hasil build Alur di luar daftar tracked files.
