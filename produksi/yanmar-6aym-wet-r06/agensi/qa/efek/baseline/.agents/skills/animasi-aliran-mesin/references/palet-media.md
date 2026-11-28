# Palet media aliran

Keluarga warna mengikuti warna utama penandaan pipa kapal **ISO 14726** agar akrab bagi pelaut,
lalu dicerahkan supaya terbaca di latar graphite. Nilai ada di `MEDIA` pada `scripts/flow-ribbons.js`
dan dapat diganti per viewer lewat opsi `palette`.

| Kunci | Media | ISO 14726 | Warna layar | Kecepatan relatif | Gaya |
|---|---|---|---|---|---|
| `fresh_water` | Air tawar pendingin (jacket/HT/LT) | Biru (fresh water) | `#3aa8ff` | 1.0 | cairan + gelembung |
| `sea_water` | Air laut | Hijau (sea water) | `#2fd88f` | 1.0 | cairan + gelembung |
| `lube_oil` | Oli pelumas | Oranye (oils other than fuels) | `#ffb02e` | 0.55 | cairan kental, badan tebal |
| `fuel` | Bahan bakar (HFO/MDO/MGO) | Cokelat (fuel) | `#c8743a` | 0.8 | cairan |
| `charge_air` | Udara masuk/bilas | Abu muda (non-flammable gas) | `#b9dcf2` | 2.4 | gas bercahaya |
| `start_air` | Udara start | Abu (non-flammable gas) | `#c9ced6` | 3.0 | gas bercahaya |
| `exhaust` | Gas buang | Hitam–abu (waste media) | `#ff6a3d` | 2.8 | gas panas (pengecualian: rona panas karena hitam tidak terlihat) |
| `unknown` | Media belum dipetakan | — | `#9aa5ad` | 0.8 | muncul di `flow.warnings` |

Kecepatan adalah skala visual pada rpm terpasang (`ratedRpm`), bukan kecepatan aliran sebenarnya.
Bila viewer menampilkan legenda, sebut "warna mengikuti keluarga warna ISO 14726".

Kata kunci pemetaan otomatis dari `scope.circuits[].medium`: sea/laut/raw → air laut; lub/oli/pelumas →
oli; fuel/bahan bakar/HFO/MDO/MGO/solar → bahan bakar; starting air/udara start → udara start;
exhaust/gas buang → gas buang; charge/scavenge/intake/udara masuk/bilas → udara; fresh/jacket/
coolant/cooling/tawar/HT/LT → air tawar. Nama lain wajib dipetakan eksplisit lewat opsi `medium`.
