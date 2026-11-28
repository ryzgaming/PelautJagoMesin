# UI Workspace

Buka folder paket melalui server HTTP, lalu masuk ke
[Studio](./index.html) atau [panel ringkas](./minimal.html). Dari akar
paket dapat dijalankan `python3 -m http.server 8080 --bind 127.0.0.1`,
lalu buka `http://127.0.0.1:8080/ui-workspace/`. Modul browser memakai
HTTP untuk membaca manifest dan model.

- `index.html`, `studio.js`, dan `assets/studio.css` berisi antarmuka
  Studio Gelap dan lembar rakitan. Jalur `?view=operation`,
  `?view=drives&drive=starter-pinion`, dan
  `?part=INT-FUELINJ-61&view=section` masih dapat dibuka.
- `minimal.html`, `minimal.js`, dan `minimal.css` menunjukkan
  antarmuka pengganti. Halaman mengimpor sesi model sendiri dan memakai
  perintah publik yang sama.
- `presentation.js` mengatur tautan perbandingan, rekaman browser dan
  laporan. Bahan QA dan diagram referensi berada di `../agensi/`. Folder `assets/` UI hanya menyimpan gaya Studio dan kode antarmuka diagram.
- Runtime dan algoritme simulasi berada di `../runtime/`. Inventaris, daftar suku cadang, manifest model, dan kedua GLB berada di `../model/`.
  Lihat [kontrak runtime](../runtime/README.md) saat membuat
  antarmuka baru. Aset model dapat diverifikasi kembali dari akar
  paket dengan `node tests/model-api.mjs`.
