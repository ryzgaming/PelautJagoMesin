# Sumber aplikasi Alur

| Folder | Tanggung jawab |
| --- | --- |
| [`features/agents/`](features/agents/) | Studio agen, struktur tim, HRD, dan router prompt. |
| [`features/machines/`](features/machines/) | Pengajuan mesin, status produksi, dan review hasil. |
| [`features/workflow/`](features/workflow/) | Editor graf, formulir, dan pelaksanaan alur. |
| [`features/settings/`](features/settings/) | Pengaturan dan kapasitas worker. |
| [`features/home/`](features/home/) | Beranda, ringkasan aktivitas, dan progres tahap. |

`main.tsx` dan `App.tsx` adalah entry aplikasi dan perakit layar.
`api.ts`, `paths.ts`, `ai-models.ts`, serta `style.css` dipakai lintas
fitur. `mcp.worker.ts` adalah entry worker browser. Implementasi API Alur
di [`../functions/api/`](../functions/api/) juga memakai modul domain
workflow dan mesin.
