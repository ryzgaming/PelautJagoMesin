# Rubrik Evaluasi Visual CGI — Orang Mesin (Studio Gelap)

Gunakan daftar periksa ini setiap kali menilai `sheet.png` hasil `lab.html` atau viewer mesin di latar graphite Studio Gelap (`#12171c` / `#0b0e11`).

## 1. Penilaian Karakter Media Fluida (ISO 14726)

| Media | Keluarga Warna | Karakter Optik yang Diinginkan | Tanda Gagal (Harus Diperbaiki) |
|---|---|---|---|
| `fresh_water` | Biru | Bening, inti biru dalam, kilau tepi segar, garis arus + gelembung halus bergerak lincah | Terlihat buram seperti plastik solid atau terlalu putih pucat |
| `sea_water` | Hijau-toska | Jelas berbeda dari air tawar, segar, bergelembung aktif | Terlalu mirip biru air tawar atau terlalu neon hijau stabilo |
| `lube_oil` | Oranye-amber | Terasa kental & berat, inti amber gelap, pantulan tepi hangat, aliran paling lambat | Bergerak terlalu cepat atau tampak encer seperti air berwarna oranye |
| `fuel` | Cokelat-tembaga | Padat, hangat, mengalir tegas di pipa berdiameter lebih kecil | Hilang kontrasnya di latar gelap atau tertukar dengan oli |
| `charge_air` / `start_air` | Biru-abu terang / perak | Ringan, tembus pandang, pita arus gas halus tanpa badan cair tebal | Tampak seperti pipa padat berwarna abu-abu |
| `exhaust` | Oranye-merah panas | Berpendar cepat, gradasi panas (terang ke merah bara), jelas berbeda dari oli | Tertukar dengan oli pelumas atau membuat seluruh area kepala silinder silau |

## 2. Penilaian Pembakaran Ruang Bakar

| Aspek | Kriteria Lolos | Tanda Gagal (Harus Diperbaiki) |
|---|---|---|
| **Semburan injektor** | Muncul sesaat sebelum TMA sebagai kabut halus mengerucut dari ujung nozzle, tepi lembut tanpa garis kotak | Terlihat seperti kerucut kertas padat atau garis putus-putus kotak kasar |
| **Urutan nyala** | Nyala bergantian jelas antar silinder mengikuti `firingOrder` (di lab: 1-3-4-2); mudah dibaca pada gerak lambat | Semua silinder tampak menyala bersamaan atau padam terlalu cepat sehingga tidak terbaca di 8 frame |
| **Bentuk & volume api** | Inti putih-kuning singkat saat puncak nyala, tubuh oranye-merah ber-turbulensi, menyusut menjadi bara merah saat piston turun | Tampak seperti bola oranye mulus, menembus keluar dinding bore, atau terpisah dari ruang di atas mahkota piston |
| **Interaksi X-ray** | Api dan aliran internal terbaca kontras di balik rumah mesin semi-transparan tanpa memutihkan seluruh layar | Additive blending menumpuk hingga area silinder meledak putih (*clipped*) |

## 3. Penilaian Layar HP & Keterbacaan

- Pada viewport HP (`390x844`), aliran tetap terbaca meski ukuran layar sempit, tanpa garis terlalu tipis yang hilang oleh aliasing.
- Badge `"Gerak lambat · XX rpm tampilan"` dan legenda tetap terbaca, tidak bertabrakan dengan tombol bawah.
- Rute dengan status estimasi (`demo.html` jalur seawater) tetap jelas tampak putus-putus dan lebih redup.
- `window.__fps` di `lab.html` tetap stabil (target >= 50 fps desktop, >= 30 fps HP) dan `report.json` bebas error konsol.
