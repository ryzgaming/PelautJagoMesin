# Alur

Editor workflow berbahasa Indonesia untuk Cloudflare Pages. Draf dan uji lokal dapat digunakan dari browser. Simpan ke cloud memakai akun Supabase Pelaut Jago Mesin. Formulir privat pada /form?id=... menjalankan workflow milik pengguna yang masuk, termasuk ketika editor ditutup. Aksi konfirmasi menampilkan pesan pada formulir. Aksi review menyimpan catatan dalam riwayat eksekusi.

## Pengembangan

Gunakan Node 22.13+ dan jalankan `npm ci`, `npm test`, lalu `npm run build`. Untuk frontend dan Functions bersama, jalankan `npx wrangler pages dev dist` setelah build. Konfigurasi Supabase menggunakan URL proyek dan publishable key di functions/config.ts. Seluruh kueri data memakai access token pengguna dan kebijakan RLS. Skema ada di supabase/schema.sql dan sudah diterapkan pada proyek pelaut-jago-mesin.

## Cloudflare Pages

Buat proyek Pages terpisah bernama alur-workflow di akun Cloudflare yang sama. Gunakan root apps/alur-workflow, perintah build npm run build, direktori hasil dist, dan Node 22. Setelah autentikasi Wrangler, jalankan npm run deploy dari folder ini. Proyek Pages memiliki fungsi /api/flows dan /api/session. Browser mengirim kredensial melalui HTTPS, dan token sesi memakai cookie HttpOnly.

## Cloudflare Workers

Pilih **Workers & Pages**, buat Worker bernama `alur-workflow`, dan hubungkan repo `ryzgaming/PelautJagoMesin`. Di pengaturan build Worker, pilih branch produksi `chatgpt/alur-workflow` dan direktori `apps/alur-workflow`. Gunakan `npm run build:workers` untuk Build command dan `npm run deploy:workers` untuk Deploy command. Gunakan Node.js 22.16+ atau Node.js 24. Pada percobaan pertama, pastikan branch produksi sudah tersimpan sebelum memulai build.

Build mengemas Pages Functions yang sama untuk Workers dan menyimpan JavaScript server di luar direktori aset. Workers meneruskan `/api/*` ke fungsi dan menyediakan halaman `/form` melalui routing aplikasi.
