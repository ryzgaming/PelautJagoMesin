# Alat produksi

[Toolkit GPT](gpt-production/README.md) adalah CLI aktif yang digunakan worker dan agen. README, prompt utama serta entry point Python berada di akar toolkit; panduan sistem/peran berada di `gpt-production/docs/`; tesnya di `gpt-production/tests/`.

Generator dan master yang khusus untuk satu model ada di `produksi/<model-revisi>/model/`. Arsip toolkit yang dipakai pada revisi mesin terdahulu berada di `produksi/<model-revisi>/agensi/`; arsip itu tidak menjadi salinan aktif kedua.

Skill dan agen aktif terdaftar di [agensi](../agensi/README.md). Build/preview website dan validator repo berada di [scripts](../scripts/).
