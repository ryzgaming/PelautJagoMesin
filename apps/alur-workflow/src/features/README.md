# Fitur Alur

- `agents/` menyimpan pengelolaan tim, struktur peran, HRD, dan router prompt.
- `machines/` menyimpan pengajuan mesin, status produksi, dan review.
- `workflow/` menyimpan editor, canvas, formulir, dan pelaksanaan grafik.
- `settings/` menyimpan pengaturan dan status kapasitas worker.
- `home/` menyimpan ringkasan aktivitas dan dashboard awal.

Entry aplikasi, worker MCP, klien API, jalur aplikasi, konfigurasi model AI
bersama, dan gaya dasar tetap di `src/`. Modul workflow dan produksi juga
dipakai oleh implementasi API Alur.
