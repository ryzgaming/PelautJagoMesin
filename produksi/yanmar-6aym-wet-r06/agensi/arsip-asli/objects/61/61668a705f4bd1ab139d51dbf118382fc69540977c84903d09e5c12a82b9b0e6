# Integrasi viewer r06

Workspace lokal ada di `review/index.html` dan draf mandiri di
`review/yanmar-6aym-wet-gpt-r06-draft.html`. Halaman memulai mesin diam. Masuk
melalui Pengoperasian, lalu pilih Mulai. Fokus starter tersedia di baris
kontrol kedua dan melalui `?view=drives&drive=starter-pinion`. Gerak
peragaan memperlihatkan pergeseran aksial saat engkol diam, pengasutan,
pembakaran, pelepasan pinion saat idle, dan penurunan putaran saat Stop.

Suara prosedural mengikuti fase dan RPM ilustratif: 220 saat cranking
dan 650 pada idle. AudioContext dibuat pertama kali setelah tindakan
pengguna, dengan volume awal 35% dan batas 50%. Pilihan senyap disimpan
bila penyimpanan browser tersedia. Jeda, Stop selesai, tab tersembunyi
dan reset mematikan keluaran. Kecepatan audio mengikuti RPM ilustratif,
sedangkan tampilan poros diperlambat untuk pemeriksaan.

Efek rute menggunakan pustaka Orang Mesin untuk garis tengah yang
statis dan sudah mempunyai arah. Pulsa bertahap dan jalur poros bergerak
memakai sampel model yang sama. Geometri pipa memakai uji kedalaman.
Rute skematis ditampilkan sebagai skema pada X-ray atau ketika dipilih.
Pompa tetap mengalirkan air tawar pada simulasi pemanasan. Cabang bypass
dingin bersifat skematis, lalu aliran menuju penukar panas mengikuti
pembukaan termostat.

Saat bahan bakar disemprotkan, efek semprotan generik mengikuti interval
nozzle peragaan. Kemunculan nyala dibatasi pada fase firing dan idle.
Pemisahan awal suplai pompa, jeda ke nozzle dan urutan 1–4–2–6–3–5
bersumber pada catatan gerak. Rekaman maker dan sumber video generik
tersedia sebagai tautan keluar di Sumber dan detail penggerak terkait.
Semprotan memakai kerucut ilustratif. Dua kelompok yang berjumlah 12
lubang nozzle terdokumentasi secara terpisah. Semua komponen
dapat menampilkan profil fungsinya dalam inspeksi dan diagram. Fungsi
yang belum terverifikasi diberi batas di profil.

Pemeriksaan integrasi memakai GLTFLoader r128 dengan kedua GLB yang sama
seperti paket viewer. Log `viewer-starter.log` memeriksa siklus starter,
jeda/resume, stop/reset, pembukaan kembali pada fase ring yang benar,
matriks gerak dan rumah tetap. Log `viewer-offline-tour.log`,
`viewer-section.log`, dan `viewer-no-webgl.log` memeriksa paket mandiri,
tautan injektor, tur dengan reduced motion, dan fallback inventaris.
Pemeriksaan ini memakai DOM dan renderer stub. Hasil Chromium independen
dicatat terpisah oleh QA. Pratinjau Sites managed Linux gagal pada relay
port 4173. Status Katalog tetap belum disetujui.

## Potongan ruang bakar

Di Pengoperasian, buka Opsi dan pilih Potongan blok. Buka Opsi kembali
untuk memilih Fokus ruang bakar. Sudut dari atas memperlihatkan sisi
silinder 1–3. Material tembus pandang pada sisa coran, kepala dan liner
menunjukkan konteks, sementara sisi dekat piston dipotong dari mesh asli
untuk memperlihatkan bowl. Efek pada fokus ini memakai uji kedalaman.
Tangkapan posisi pembelajaran pada 32° sesudah penyalaan silinder 2 ada
di `definitive/desktop-firing-diagnostic.png`. Uji sinar Three.js r128
atas 14° dan 32° pada mesh aktual ada di
`viewer-chamber-sampling.json`; pusat nyala berada di atas bowl dan di
bawah titik sampel badan nozzle.

## Paketan

Export yang terpasang dalam viewer sama dengan file model sumber.
Hash exterior `defc58c070a871da2068b2ddd4388ff51b340a1014dfde2226f7e47946a89121`.
Hash internal `526ce37f126203eb288388dbd7922dd85749b19ddf8ef82ee5bfcf9d472ec8f5`.
Model mempunyai 1.184 komponen, 122 kelompok gerak dengan 183 target
langsung, 164 rute dan 160 port. Perbandingan sumber rute
`viewer-source-sync.json` mencatat 31 garis tengah fisik yang cocok
dengan input ekspor. Selisih titik port berada dalam ambang 0,2 mm.

Daftar berkas paket dan checksum tersimpan di
`viewer-package-sha256.txt`. Persetujuan katalog belum diberikan.
