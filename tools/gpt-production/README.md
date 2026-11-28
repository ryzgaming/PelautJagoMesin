# Toolkit produksi GPT/Codex

Adaptasi prompt dan toolkit yang dilampirkan pemilik pada 28 November 2026. Mulai dengan [PROMPT-GPT.md](PROMPT-GPT.md); instruksi rinci ada di [ROLE-PROMPTS.md](ROLE-PROMPTS.md). Ini perangkat kerja untuk agen, bukan generator otomatis semua mesin dan bukan pemasangan Blender.

Untuk paket unduhan mandiri, buka folder `toolkit-orang-mesin-gpt` dan jalankan `python3 toolkit.py preflight`; hilangkan awalan `tools/gpt-production/` pada command di bawah. Integrasi antrean membutuhkan checkout repository yang memuat `hosted_worker.py`; paket mandiri tidak membuat koneksi/automasi sendiri.

Profil agen Codex ada di `.codex/agents/` pada root repository dan root paket unduhan mandiri. Buka Codex dari root tersebut agar profil tersedia di tingkat proyek. Untuk memakai paket di proyek lain, salin ketiga file TOML ke `.codex/agents/` proyek tujuan. Nama, pemetaan peran, dan cara menjalankan pada runtime yang menerima prompt teks tersedia di [instruksi peran](ROLE-PROMPTS.md#agen-proyek-untuk-kemiripan-dan-viewer).

Untuk perpipaan, lorong cor dan animasi fluida, aktifkan agen lintas rakitan `spesialis_jalur_fluida` sesuai [petunjuk registrasi dan uji rute](FLOW-ROUTING.md). Tampilan aliran dan gerak mesin memakai skill [animasi-aliran-mesin](../../.agents/skills/animasi-aliran-mesin/SKILL.md) dan [blender-animasi-mesin](../../.agents/skills/blender-animasi-mesin/SKILL.md); Blender MCP dikonfigurasi di `.codex/config.toml`.

Pada produksi dan revisi model mesin, koordinator juga [menugaskan spesialis tiap rakitan](SPECIALISTS.md) sebelum memodelkan. Gunakan daftar dari `specialist-briefs`, teruskan subkomponen yang diharapkan kepada modeler, dan periksa komponen tersembunyi hingga dapat dipilih melalui viewer.

## Jalankan dari root repository

```bash
python3 tools/gpt-production/toolkit.py preflight
python3 tools/gpt-production/toolkit.py init --workspace /workspace/private-production/order-001 --brand Yanmar --model '6AYM-WET' --ai-model gpt-6.2-sol
```

Folder tujuan harus baru/kosong. `init` membuat job, datum, inventaris dan laporan QA kosong berstatus UNVERIFIED. Tidak menyalin ukuran atau geometry Caterpillar. Pilih ID GPT yang benar-benar tersedia di runtime. Gunakan folder privat di luar repository; jangan commit PDF, foto, kredensial, konteks antrean atau hasil model premium.

`preflight` memeriksa executable dan ketersediaan modul, tanpa memasang paket. Subagen, kemampuan melihat gambar, akses web, browser, ketersediaan model, dan render kecil harus diuji agen. Blender dan bpy adalah alternatif. Catat versi terpasang; jangan menganggap versi 5.3 atau wheel bpy tersedia. Sistem yang melarang browser automation lain harus memakai kontrol browser yang disediakan. Kemampuan yang tidak tersedia tetap dicatat sebagai gap.

Setelah modeler menyiapkan GLB, renderer generik dapat dijalankan di lingkungan Blender yang kompatibel:

```bash
blender --background --python-exit-code 1 --python tools/gpt-production/render_six.py -- --input /workspace/private-production/order-001/model/exterior/exterior.glb --output /workspace/private-production/order-001/qa/exterior-r01 --samples 16
```

Alternatif bila `bpy` sudah terpasang: jalankan skrip yang sama menggunakan Python venv, dengan argumen sesudah `--`. Renderer mengimpor GLB, membingkai bounds, dan menghasilkan 12 PNG (enam sudut × netral/warna) serta pengaturan render. Front +X, right -Y, up +Z di Blender; sesuaikan ekspor/datum jika mesin memakai konvensi lain. Hasil harus benar-benar dibuka dan dibandingkan. Pengukuran internal memerlukan skrip khusus varian. Uji smoke berhasil pada Blender 4.3.2/Cycles CPU, 96×72, 1 sampel: 12 PNG dari GLB balok sintetis; enam render netral benar-benar dilihat. Denoising dimatikan karena build ini tidak memiliki OpenImageDenoise. Ini hanya uji renderer, bukan audit mesin atau bukti performa HP.

## Kontrak review

QA independen mengisi `qa/review.json` dari hasil yang diperiksa. Jalankan:

```bash
python3 tools/gpt-production/toolkit.py check-review --workspace /workspace/private-production/order-001
```

Exit 0 hanya jika kontrak siap untuk review privat; exit 2 bila belum. Checker tidak membuat PASS otomatis, tidak mengukur mesh, tidak menjalankan subagen dan tidak menyatakan perangkat HP nyata telah diuji. Jalankan juga `hosted_worker.py manifest` untuk struktur GLB/artefak. Keputusan akhirnya tetap QA berbasis bukti dan review pemilik.

- `revision` harus sama dengan `job.json`.
- `artifacts`: daftar `{path, sha256}` dari file aktual relatif ke folder kerja. Sertakan GLB exterior/internal, `review/index.html`, datum, kedua inventaris, register sumber, bukti pengukuran, render dan referensi. Path keluar folder, file hilang, hash lama atau duplikat ditolak. Untuk mesin yang memang tidak memiliki internal terpisah, kembangkan kontrak secara eksplisit sebelum produksi; jangan membuat GLB palsu demi lolos.
- `roles`: satu `{role, agent_id, state:"completed", revision, evidence:[path]}` per peran dari `toolkit.py`. Bukti aktivitas agen dicatat koordinator dari tool nyata; string ID saja bukan pembuktian independen. Tiga evidence dan datum diringkas pada checkpoint SQL evidence. Lima spesialis sistem tetap terpisah.
- `checks`: identity, dimensions, export, interfaces, inventory, kinematics, collisions, viewer_desktop, viewer_mobile. Setiap pemeriksaan `{status, reason, evidence:[path]}`. N/A perlu alasan nyata. Cakupan ditetapkan sebelum modeling.
- `views`: depan, belakang, kiri, kanan, atas, tiga_perempat, masing-masing `{status, render:path, reference:path, real_reference_inspected:boolean, reason}`. Seluruh render harus ada; minimal empat sudut memakai foto/frame nyata yang dilihat. PASS sudut memerlukan referensi. Foto dari varian lain bukan pengesahan.
- `findings`: temuan `{id, severity, state, ...}`. Temuan terbuka menghalangi PASS keseluruhan. `qa_agent_id` harus terpisah dari setiap pembuat; `verdict` dari QA wajib PASS sebelum kesiapan review.
- Laporan yang memuat FAIL menghasilkan FAIL. Gap menghasilkan UNVERIFIED, bukan PASS. Lolos checker tidak berarti siap manufaktur atau persetujuan katalog. Hash yang berubah memerlukan audit ulang.

Tidak ada perubahan schema SQL diperlukan untuk adaptasi toolkit ini. INFERRED/ILLUSTRATIVE dipertahankan pada berkas lokal, dipetakan UNKNOWN beserta label asli/alasan pada kontrak checkpoint database yang lebih sempit.

## Contoh Caterpillar dan batas adopsi

Paket unduhan menyertakan contoh asli sebagai referensi privat, dengan skrip bernama `.py.reference` agar tidak terjalankan otomatis. `build.py` dan `build_internal.py` berisi geometri 3512C, path tetap dan parameter khusus. `make_qa2.py` adalah penyusun laporan historis dengan angka, hash dan PASS tertulis langsung. Itu bukan pemeriksa generik. Jangan sekadar mengganti merek/model lalu menjalankannya.

Adaptasi generik mengambil pola peran, datum, inventaris, render, audit dan viewer. Mesin baru tetap memerlukan kode modeling yang ditulis subagen dari sumber yang sesuai. Klaim “lolos QA” dalam lampiran adalah laporan sumber, belum kami validasi ulang dari GLB/foto asli. Beberapa catatannya UNVERIFIED; tidak dipromosikan menjadi PASS dalam toolkit ini.

## Uji perangkat kerja

```bash
python3 -m unittest discover -s tools/gpt-production/tests
python3 -m unittest discover -s apps/alur-workflow/worker
```

Publikasi review melalui Sites privat atau hosting lain yang akses pemiliknya telah diperiksa. Cloudflare branch preview tidak otomatis privat. Katalog penjualan hanya setelah persetujuan pemilik pada revisi yang sama; paket ini tidak membuat automasi, memulai order, atau menerbitkan model.
