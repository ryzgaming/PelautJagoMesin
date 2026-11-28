# Pengujian

Jalankan dari akar repo setelah `npm ci`. Struktur kelompok tidak mengubah cakupan pengujian sebelumnya.

| Folder | Cakupan |
|---|---|
| `access/` | Akses admin, afiliasi, dan gerbang Alur |
| `alur/` | API pekerjaan/mesin, sumber, status, pengaturan dan kontrak database |
| `commerce/` | API commerce, Edge dan database transaksi |
| `viewer/` | Workspace premium serta efek aliran/pembakaran |
| `integration/` | Konkurensi database lewat Docker/PostgreSQL |
| `browser/` | Interaksi workspace pada browser dan viewport |

```sh
npm run check:repo
npm test
npm run test --workspace alur-workflow
python3 -m unittest discover -s apps/alur-workflow/tests -p 'test_*.py'
python3 -m unittest discover -s apps/alur-workflow/worker
python3 -m unittest discover -s tools/gpt-production/tests
npm run build
```

Tes antarmuka Alur tetap berdekatan dengan aplikasinya di `apps/alur-workflow/tests/`; tes toolkit tetap di `tools/gpt-production/tests/`. Jalur ini dipakai CI. Tes integrasi Docker dijalankan tersendiri dan memerlukan Docker, bukan bagian dari `npm test`.

Tes browser workspace memerlukan Playwright/Chromium dan fixture premium yang diizinkan. Ikuti [panduan workspace](../docs/workspace/README.md#pemeriksaan-penerimaan). Tidak tersedianya fixture tidak boleh dilaporkan sebagai tes yang lulus.

Untuk paket Yanmar: dari `produksi/yanmar-6aym-wet-r06/`, jalankan `python tools/verify.py --all` dan `node tests/model-api.mjs`. Pemeriksaan hash memerlukan aset lengkap melalui Git LFS. Validator struktur repo dapat memeriksa SHA pointer pada checkout CI yang belum mengambil payload LFS.
