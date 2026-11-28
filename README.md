# Pelaut Jago Mesin — Cloudflare storefront

Prepared from Sites version 7, commit 6eede2205ca2b38d50295ebc84ef4294cb77261e.

## Sumber model Yanmar R06

[Paket produksi Yanmar 6AYM-WET R06](produksi/README.md) berisi tiga folder terpisah: **model**, **ui-workspace**, dan **agensi**. Seluruh sumber serta arsip tersedia di repo melalui Git/Git LFS. Paket berada di luar website/katalog.

## Cloudflare Pages setup

- Repository: ryzgaming/PelautJagoMesin
- Production branch: cloudflare-store
- Project name: pelautjagomesin (subject to availability)
- Framework preset: None
- Root directory: leave blank (repository root)
- Build command: npm run build
- Build output directory: dist
- Environment variables: none required for this static frontend

The backend already runs at Supabase Edge Function commerce. Do not upload service-role or payment keys into frontend files.

## Before opening customer accounts/payments

The commerce Edge CORS allowlist includes https://pelautjagomesin.pages.dev and the existing ChatGPT Site origin. Preview deployment origins are not enabled automatically. Authentication and entitlement checks still apply to both storefronts.

Update Supabase Auth redirect settings for the confirmed URL; complete SMTP/email confirmation testing. Checkout remains closed until Midtrans configuration and payment tests are complete.

Store Sandbox credentials only in Supabase Edge Function Secrets: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_SIGNATURE_KEY` (the Midtrans Signature Secret Key). Since October 2026, the notification signature key is separate from newly generated Server Keys. Webhook signatures use the Signature Secret Key; requests to Midtrans use the Server Key. A valid signature is followed by a server-to-server status check before access is granted. Missing credentials keep checkout unavailable. Leave `CHECKOUT_ENABLED=false` until setup and sandbox validation are complete, and `MIDTRANS_ENV=sandbox` throughout testing.

Configure the Midtrans Sandbox payment notification URL as `https://vkljhkzbuomcwqnsiope.supabase.co/functions/v1/commerce/webhook`. No real-money test is required. Do not change catalog prices to create a test transaction; use an explicitly isolated sandbox test flow.

Only Shinko GJ Simulator is public. MAN, Tanabe, and Alfa Laval HTML files under dist are catalog pages, not premium simulators. Premium source files are not included in this branch and are served from private Supabase Storage only after authorization.

The old main branch and its public history are unchanged. They still contain old downloadable model files; this release does not make those historical copies private.

## Alur workflow

Only verified administrators may open Alur from the Admin control room at `/alur/`. From the repository root, run `npm ci` and `npm run build` to generate the editor and form alongside the existing storefront in `dist`. Cloudflare Pages bundles `functions/alur/api` for Alur login, cloud workflows and execution history. For a local Pages preview, run `npx wrangler pages dev dist` after building. Alur uses the same Supabase account credentials as the storefront with its own scoped session cookies.

## Validation

npm run build checks frontend syntax and premium source exclusion, then builds Alur.
npm test runs API, origin, and database authorization tests after installing locked development dependencies.

### Pembuatan mesin otomatis

Buka [Agen Mesin](https://pelautjagomesin.pages.dev/alur/?mode=agen) dengan akun pemilik, isi **merek** dan **nama atau model mesin**, lalu kirim. Untuk mengoreksi simulator yang sudah tersedia, pilih **Revisi mesin** dengan model asal dari katalog, isi **Tugas revisi untuk agen**, lalu pilih **Kirim revisi**. Setiap agen menerima tautan model dan tugas yang sama. Setiap permintaan memulai sesi produksi privat. Pengiriman ulang permintaan yang sama memakai ID yang sama agar tidak membuat pekerjaan ganda. Setelah sesi selesai, pengajuan baru untuk mesin yang sama membuat revisi baru.

Alur mencari kandidat dokumen awal saat permintaan masuk. Worker cloud terjadwal memeriksa antrean setiap 10 menit, mengambil pekerjaan, memeriksa varian dan sumber, lalu mengoordinasikan agen bukti, lima spesialis sistem, dua pembuat model, integrator, dan QA. Bila rujukan belum mendukung bentuk mesin, sesi menunjukkan bukti yang masih dibutuhkan. Setelah QA, tautan review privat tersedia pada sesi.

Memori kerja tiap peran tersimpan sebagai catatan per sesi dan per revisi. Catatan mencakup temuan, rujukan, keputusan, dan pertanyaan terbuka. Sebelum memulai kembali atau merevisi mesin, worker membaca catatan sesi dan riwayat mesin di akun yang sama. Data yang masih berupa estimasi perlu diperiksa kembali sebelum dipakai untuk bentuk atau ukuran. Panduan worker dan pemulihan sesi tersedia di [runbook produksi](apps/alur-workflow/worker/README.md).

### Mode proyek lokal

Buka [panel Agen mesin](https://pelautjagomesin.pages.dev/alur/?mode=agen). Pilih **Proyek lokal** untuk menghubungkan satu akun Alur dengan proyek lokal pada komputer pekerja. Komputer itu membutuhkan Python, Codex CLI yang sudah login, Blender, paket produksi Orang Mesin, dan job yang sudah diinisialisasi dengan sumber untuk model yang dipilih. Paket produksi dan skrip pekerja bisa diakses dari panel.

1. Siapkan manual, parts catalog, diagram sistem dan foto di folder sumber mesin. Gunakan perintah `production.py init` dari README toolkit untuk membuat job baru.
2. Jalankan perintah runner yang ditampilkan panel di komputer pekerja. Pilih kode proyek singkat, misalnya `yanmar-6aym-wet`, dan masuk dengan akun Alur yang akan dipakai pada HP. Biarkan runner aktif saat ada pekerjaan.
   Contoh setelah mengunduh `runner.py` dan mengekstrak toolkit:

   ```bash
   python3 runner.py --toolkit ./orang-mesin-production --project ./jobs/yanmar-6aym-wet --project-key yanmar-6aym-wet
   ```

3. Dari HP atau desktop, buka **Agen mesin**, masuk, lalu antrekan produksi memakai kode proyek yang sama. Kode menentukan folder yang sudah dipilih di komputer pekerja. Status antre berarti pekerjaan masih menunggu runner.
4. Ikuti tahap bukti, lima spesialis alur, model luar dan internal, integrasi, lalu QA. Sesudah selesai, buka hasil review pada komputer pekerja. Pemilik memeriksa hasil sebelum membuat keputusan katalog.

Browser menyimpan permintaan melalui Pages Functions dan kebijakan akses akun di Supabase. Runner mengambil pekerjaan dengan koneksi keluar dan memanggil scheduler toolkit dengan opsi `--system-flows`. Dashboard menerima status peran dan hasil akhir pekerjaan. Berkas sumber, log rinci, dan model hasil produksi berada di komputer pekerja.

Untuk instalasi baru, jalankan skema commerce terlebih dahulu, kemudian `apps/alur-workflow/supabase/admin-access.sql`, lalu skema Alur. Fitur afiliasi menggunakan `supabase/migrations/202611240001_affiliates.sql`. Nominal ditetapkan di Admin → Komisi afiliasi.

Skema antrean tersedia di [agent-jobs.sql](apps/alur-workflow/supabase/agent-jobs.sql). Untuk instalasi baru, terapkan skema pada proyek Supabase yang dipakai Alur, lalu gunakan skrip build Cloudflare Pages yang sudah ada.
