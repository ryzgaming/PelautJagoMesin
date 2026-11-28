# Pelaut Jago Mesin

Website, aplikasi Alur, alat produksi, agen/skill, serta model mesin disimpan menurut tanggung jawabnya. **Branch produksi website adalah `cloudflare-store`**. Branch `main` menyimpan pratinjau lama. Penataan ini melanjutkan paket Yanmar pada PR #42.

## Mulai dari sini

| Yang ingin dikerjakan | Buka |
|---|---|
| Model, master Blender, UI dan riwayat pembuatannya | [Produksi mesin](produksi/README.md) · [Daftar model](produksi/REGISTRY.json) |
| Agen spesialis, skill aktif dan aturan kerja | [Agensi aktif](agensi/README.md) |
| Prompt dan CLI produksi GPT | [Toolkit produksi](tools/gpt-production/README.md) |
| Editor Alur: mesin, agen, workflow, pengaturan dan beranda | [Sumber aplikasi](apps/alur-workflow/src/README.md) |
| Tampilan workspace dan bukti desain | [Standar workspace](docs/workspace/README.md) |
| Deployment, layanan dan cara menjalankan produksi | [Operasional](docs/operations/README.md) |
| Tes dan pemeriksaan struktur repo | [Panduan pengujian](tests/README.md) |
| Keputusan proyek dan alasan penataan | [Memori proyek](docs/PROJECT_MEMORY.md) · [Peta repo](docs/REPOSITORY.md) |

## Susunan repo

```text
apps/alur-workflow/   Aplikasi Alur; src/features dikelompokkan menurut fitur
agensi/              Indeks agen dan skill aktif, tanpa menyalin konfigurasinya
produksi/            Paket model per mesin/revisi: model, ui-workspace, agensi
.agents/skills/      Skill kanonis yang dibaca alat
.codex/agents/       Profil agen Codex; konfigurasi di .codex/config.toml
.claude/skills/      Symlink ke skill kanonis
functions/           Adapter rute Cloudflare Pages
server/              Implementasi API commerce dan server pengujian
supabase/            Konfigurasi, Edge Function dan migrasi database
dist/               Aset/halaman website; dist/alur dihasilkan oleh build
tools/              Toolkit pembuat dan pemeriksa model
scripts/            Build, preview dan validator struktur
tests/              access, alur, commerce, viewer, integration, browser
docs/               Panduan, workspace/design dan operasional
```

## Menjalankan dan memeriksa

Gunakan Node 22+, npm dan Python 3.11+. Pasang Git LFS untuk mengambil berkas model besar; lihat [panduan pengambilan model](produksi/README.md).

```sh
npm ci
npm run check:repo
npm test
npm run test --workspace alur-workflow
npm run build
npm run dev
```

Build menghasilkan `dist/alur/` dan mempertahankan URL `/alur/`. `dist/`, `functions/` serta konfigurasi deployment tetap berada di lokasi yang diperlukan Cloudflare. Model produksi berada di luar keluaran website. Yanmar tetap draf review dan belum masuk katalog.

## Batas perubahan

Ubah tampilan Yanmar di `produksi/yanmar-6aym-wet-r06/ui-workspace/`; model dan mekanisme berada di folder `model/` yang sejajar. `agensi/` di dalam paket mesin adalah arsip bukti versi tersebut, sedangkan [agensi akar repo](agensi/README.md) menunjuk alat aktif untuk pekerjaan berikutnya. Ikuti [AGENTS.md](AGENTS.md) sebelum mengubah sumber.
