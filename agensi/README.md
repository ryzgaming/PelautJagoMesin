# Agensi aktif

Folder ini adalah pintu masuk tim pembuat mesin dan perangkat kerjanya. [Registri JSON](registri.json) mencatat lokasi kanonis semua profil dan skill; tidak membuat salinan instruksi baru. Baca [aturan proyek](../AGENTS.md), lalu [prompt produksi](../tools/gpt-production/PROMPT-GPT.md).

Untuk memakai sistem ini dengan AI berikutnya atau mesin lain, mulai dari **[instruksi adopsi AI](ADOPSI-AI.md)**. Dokumen tersebut menyediakan prompt siap ditempel, pemetaan jenis mesin, dan gerbang bukti/QA.

## Letak sumber aktif

| Lokasi | Tanggung jawab |
|---|---|
| `.codex/agents/` | Profil spesialis Codex, tetap pada lokasi penemuan profil proyek |
| `.codex/config.toml` | Konfigurasi proyek, termasuk Blender MCP opsional |
| `.agents/skills/` | Skill bersama dan skrip pendukung kanonis |
| `.claude/skills/` | Symlink ke skill kanonis yang sama untuk penemuan skill Claude |
| `tools/gpt-production/` | Prompt utama, panduan masuk dan CLI Python |
| `tools/gpt-production/docs/` | Kontrak peran, rakitan, fluida dan kinematika |
| `apps/alur-workflow/worker/` | Integrasi antrean, memori dan penyerahan hasil produksi |

## Profil agen

Profil menentukan tugas yang dapat diberikan. Agen tetap harus benar-benar dijalankan dan menyerahkan bukti; keberadaan profil bukan bukti produksi atau QA. QA berbeda dari pembuat.

| Profil | Tanggung jawab |
|---|---|
| [pemodel_eksterior](../.codex/agents/pemodel_eksterior.toml) | Pemodel eksterior mekanis yang mengerjakan bentuk coran, antarmuka dan subkomponen berdasarkan gambar dan foto varian yang dipilih. |
| [qa_visual_viewer](../.codex/agents/qa_visual_viewer.toml) | Pemeriksa independen kemiripan model dan hasil interaksi viewer pada revisi GLB yang benar-benar dikirim. |
| [referensi_visual](../.codex/agents/referensi_visual.toml) | Agen foto yang menentukan sudut kamera pembanding dan penanda bentuk yang bisa dinilai dari sumber nyata. |
| [spesialis_blok_poros_piston](../.codex/agents/spesialis_blok_poros_piston.toml) | Spesialis Blok, poros engkol, liner dan piston untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_efek_visual](../.codex/agents/spesialis_efek_visual.toml) | Spesialis look-dev dan shader WebGL/three.js r128 untuk memoles efek visual aliran fluida kapal dan pembakaran ruang bakar pada pustaka bersama Orang Mesin. |
| [spesialis_injeksi_bahan_bakar](../.codex/agents/spesialis_injeksi_bahan_bakar.toml) | Spesialis Pompa injeksi, governor dan injektor untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_jalur_fluida](../.codex/agents/spesialis_jalur_fluida.toml) | Merekonstruksi sambungan port, jalur pipa dan lorong cor serta gerak fluida dalam posisi mesin terpasang. |
| [spesialis_kepala_katup](../.codex/agents/spesialis_kepala_katup.toml) | Spesialis Cylinder head dan mekanisme katup untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_kinematika_benturan](../.codex/agents/spesialis_kinematika_benturan.toml) | Menelusuri rantai penggerak dan memeriksa interferensi pada posisi terpasang selama seluruh siklus operasi. |
| [spesialis_pelumasan_pompa](../.codex/agents/spesialis_pelumasan_pompa.toml) | Spesialis Pelumasan, pompa oli dan filter untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_pendingin_penukar_panas](../.codex/agents/spesialis_pendingin_penukar_panas.toml) | Spesialis Air cooler dan penukar panas untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_pendingin_pompa_katup](../.codex/agents/spesialis_pendingin_pompa_katup.toml) | Spesialis Pompa dan katup air tawar serta air laut untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_starter_pengisian](../.codex/agents/spesialis_starter_pengisian.toml) | Spesialis Starter, pengisian dan aksesori elektrik untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_transmisi_timing](../.codex/agents/spesialis_transmisi_timing.toml) | Spesialis Penggerak timing dan transmisi yang termasuk pesanan untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |
| [spesialis_turbo_udara_gas](../.codex/agents/spesialis_turbo_udara_gas.toml) | Spesialis Turbo, udara masuk dan gas buang untuk bukti bentuk, identitas subkomponen dan kelengkapan internal. |

## Skill bersama

| Skill | Tanggung jawab |
|---|---|
| [animasi-aliran-mesin](../.agents/skills/animasi-aliran-mesin/SKILL.md) | Pustaka dan QA animasi fluida serta pembakaran; rute dan timing mengikuti data mesin. |
| [blender-animasi-mesin](../.agents/skills/blender-animasi-mesin/SKILL.md) | Rig mekanisme Blender serta render strip untuk memeriksa gerak. |
| [lookdev-efek-mesin](../.agents/skills/lookdev-efek-mesin/SKILL.md) | Poles shader dan gaya efek bersama dengan bukti sebelum/sesudah. |

Jangan mengubah symlink Claude menjadi salinan: pembaruan harus tetap berasal dari satu skill kanonis. Pada checkout yang tidak mendukung symlink, agen dapat membaca SKILL.md di `.agents/skills/` langsung; konfigurasi lingkungan harus diperiksa sebelum mengandalkan penemuan otomatis.

## Alur dan batas tanggung jawab

Koordinator menyiapkan job, sumber dan pembagian rakitan. Peneliti menyiapkan bukti; spesialis memeriksa komponen sampai bagian internal serta antarmuka antar-sistem; pembuat menghasilkan geometri dan data; integrator menghubungkan runtime dengan UI; QA memeriksa hasil ekspor secara independen. Efek mengikuti rute dan fase mesin, bukan mengubah data demi tampilan. Detailnya ada di [peran](../tools/gpt-production/docs/ROLE-PROMPTS.md), [spesialis rakitan](../tools/gpt-production/docs/SPECIALISTS.md), [jalur fluida](../tools/gpt-production/docs/FLOW-ROUTING.md) dan [gerak/benturan](../tools/gpt-production/docs/MOTION-QA.md).

Perangkat aktif dipakai untuk order baru. Hasil per mesin berada di `produksi/<mesin>/`: model, UI workspace dan arsip agensi revisi tersebut. **`produksi/*/agensi` adalah sejarah produksi beku**, bukan sumber aktif yang harus disinkronkan setiap kali profil atau toolkit berubah. Jangan mengganti prompt, hash, lokasi historis atau hasil QA di dalam arsip. Peningkatan aktif berlaku pada produksi berikutnya; perubahan model memerlukan revisi dan QA baru. Lihat [indeks produksi](../produksi/README.md).

Untuk paket model yang sudah dipisahkan, agen UI hanya mengubah UI dan memakai kontrak runtime. Agen model menangani geometri/data di `model/`; perubahan gerak, efek atau audio ditugaskan ke `runtime/` tersendiri, dan generator berada di `agensi/produksi/`. Catat perubahan kontrak dan audit independen. Keputusan katalog tetap milik pemilik.

## Pemeriksaan setelah perubahan agensi

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/gpt-production/tests
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s apps/alur-workflow/worker
node --test tests/viewer/flow-ribbons.test.mjs tests/viewer/combustion-glow.test.mjs
```

Tes toolkit/worker memeriksa kontrak perangkat kerja; tes efek memeriksa pustaka. Ini tidak menggantikan pemeriksaan geometri dan viewer dari setiap mesin. `production-guide.json` menggunakan kunci `docs/<nama>.md` sesuai lokasi relatif dokumen baru. Worker tetap menyertakan `PROMPT-GPT.md`, `README.md`, `specialists.json`, profil dan skill pada kuncinya; konteks baru membawa hash panduan baru. Packet lama adalah snapshot revisi lama dan tidak ditulis ulang.
