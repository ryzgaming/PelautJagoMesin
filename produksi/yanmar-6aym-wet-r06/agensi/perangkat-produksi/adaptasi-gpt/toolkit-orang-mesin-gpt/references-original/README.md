# Toolkit produksi mesin 3D Orang Mesin (dari produksi Caterpillar 3512C)

Skrip yang benar-benar dipakai subagen saat membuat Caterpillar 3512C HD marine (lolos QA independen putaran 2, 28 November 2026), beserta data contohnya. Pakai bersama `PROMPT-PRODUKSI-MESIN-3D.md`.

## Isi

| Folder | Isi |
|---|---|
| `skrip-exterior/` | `build.py` (membangun seluruh eksterior 3512C di Blender: blok berusuk, kepala, tutup katup, turbo berumah keong, manifold, aftercooler, heat exchanger dan turbo kanan terpecah per bagian), `render.py` (render 6 sudut netral dan berwarna, Cycles + Freestyle), `overlay.py` (menumpuk render di atas gambar dimensi resmi untuk mengukur selisih), `check_explode.py` (cek tumpang tindih saat urai), `render_explode.py` |
| `skrip-internal/` | `build_internal.py` (crankshaft, piston, rod, liner, cam, valve train, injector, gear train, pompa oli dari bore/stroke/firing order), `check_render.py`, `ext_clash.py` (tabrakan internal vs eksterior sepanjang satu siklus), `finalize.py` |
| `skrip-qa/` | Skrip QA independen: `measure.py` (dimensi vs dokumen ±1%), `clash.py`, `axis.py` (ukur sepanjang sumbu silinder V60: deck, liner, piston TDC, rocker), `outside.py`, `liner.py`, `closeup.py`, `camx.py`, `make_qa2.py` (menulis qa.json) |
| `contoh-3512c/` | `datum.json`, inventaris eksterior dan internal, `kinematics.json`, `compare-exterior.json`, `systems/*.json` (5 sistem), `assemblies/*.json` (Eksplor Rangkaian), `qa.json`, register dokumen dan foto |

## Cara pakai

1. Siapkan Blender sebagai modul Python:

```bash
python3 -m venv venv && venv/bin/pip install bpy
```

2. Skrip memakai folder kerja `/tmp/claude-0/c3512` secara tetap. Buat folder kerjamu, lalu tautkan:

```bash
mkdir -p /tmp/claude-0 && ln -s "$PWD/kerja" /tmp/claude-0/c3512
```

3. Susun folder kerja seperti ini: `doc/` (PDF dan gambar dimensi), `foto/`, `model/{datum.json, systems/, exterior/, internal/}`, `qa/`.
4. Jalankan skrip dengan Python venv, misalnya `venv/bin/python skrip-exterior/build.py`.

## Penting

- `build.py` dan `build_internal.py` khusus 3512C. Untuk mesin lain, pakai sebagai contoh pola (helper bentuk, penamaan ID, inventaris, ekspor), bukan untuk dijalankan apa adanya.
- Skrip render, overlay, cek tabrakan, dan QA bisa dipakai ulang dengan mengganti nama objek dan datum.
- Data contoh berisi status bukti per baris. Jangan menyalin angka 3512C ke mesin lain.
- Foto dan PDF pihak ketiga tidak disertakan; daftar URL-nya ada di register.
