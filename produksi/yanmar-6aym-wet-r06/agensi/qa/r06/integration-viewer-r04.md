# Integrasi viewer r04

Masuk melalui Pengoperasian atau `?view=operation`. Dock Mulai, Jeda, Ulang, pemilih aliran, Rute dan Potongan blok berada di luar panel bukti. `?view=tour` membuka tahap pertama dalam keadaan jeda. Tur dapat dihentikan, dilanjutkan, dilewati, diulang, atau ditutup. Dalam preferensi reduced motion, pemilihan tur membuka pose pertama dalam keadaan jeda dan perpindahan kamera memakai pose tetap.

Rute pipa yang dimodelkan memakai garis utuh dan uji kedalaman. Mesh pipa terpilih dibuat tembus cahaya. Rute skematis memakai garis putus-putus, tersedia saat X-ray, Potongan blok, atau saat rute dipilih secara eksplisit. Panel Rute menunjukkan status arah dan status geometri secara terpisah, sumber, batas suplai atau buang, dan Batas pemetaan r04. Air tawar menunjukkan kondisi mesin hangat dengan termostat terbuka.

Gerak memakai satu jam simulasi yang mengendalikan poros engkol, poros nok, gerak katup ilustratif, piston, ring gear dan partikel. Pulsa per silinder berjalan di sepanjang segmen penyambung yang memiliki ID port sama pada kategori fluida, silinder dan kejadian yang sama. Urutan pembakaran 1–4–2–6–3–5 digunakan untuk sorotan edukatif. Sudut kejadian, bukaan katup dan kecepatan partikel adalah ilustrasi. Galeri minyak bertanda crank berputar dengan engkol. Jejak pembuangan batang mengikuti ujung bergerak dan berakhir pada sump tetap. 
   
Tur memperlihatkan katup dan piston, aliran udara, pelumas bawah dan pembakaran dengan kamera bertahap. Pada tahap urai dan rapat kembali, waktu engkol dan aliran ditahan. Gaya tur mengikuti struktur visual video referensi. Data mekanis dan arah aliran mengikuti sumber Yanmar dan batas per rute.

## Pemeriksaan

- `node tools/check.mjs --require-flow --require-flow-model` memeriksa GLB aktual, inventaris, ID jalur, pusat port, mesh fisik dan keenam kategori. `qa/integration-fit.json` mencatat hash dan daftar hitungan.
- `node tools/state-check.mjs --require-flow --require-moving-oil --view=operation --flow-evidence` memeriksa transisi operasi, kontur rute, pulsa antarport, kedalaman garis model, potongan, gerak oli dan urutan sorotan. Varian tur, reduced motion, tautan injektor/katup, offline, dan kegagalan WebGL tersedia di log `qa/state-r04-*.log`.
- `qa/flow-render/` memuat posisi partikel dan kamera dari logika viewer, serta render diagnostik Blender untuk bahan bakar dan pelumas dengan GLB yang cocok dengan hash pose. Render diagnostik menampilkan geometri mesin pada pose impor dan posisi aliran tangkapan. Pengujian WebGL browser dan gestur HP masih **UNVERIFIED**. Preview r04 gagal menunggu relay port 4173, dan CUA gagal dengan “the gaas-browser node_repl sandbox cannot be disabled”. Preview dihentikan.

## Paket beku

Exterior `e860291eac958af9bba6566891d6462e47d1c7694921c424dc702695fb02e887`, internal `4b69ad9975928cfa80be62ddc7c6a1c5caa241900bd3aef299081c1e6406ae05`, graf `0830845dd4b9903bb19d329b8839e6c69a937821cfc4485c434fbe521d8f2225`. Paket memuat 1.061 ID model, 66 resep rakitan, 55 rakitan anak, 163 rute, 160 port dan 12 jalur oli bergerak. Pemeriksaan `qa/r04/source-sync-viewer-final.json` mencocokkan 29 centerline fisik terhadap input pembentukan mesh dan mencatat nol selisih ujung di atas 0,2 mm terhadap port model.

Tautan `?part=EXT-INTAKE-05&view=exploded` membuka Fig. 36 dan 41 item model yang dapat dipilih. Tautan lama `?part=EXT-COOLING-07` membuka pipa pompa–cooler `EXT-COOLING-302`. Tautan injektor dan katup r03 tetap lulus. Pemilih bagian, rute, tur reduced-motion, transparansi pipa terpilih, fase injektor, cutaway, fallback GLB sebagian, HTML offline dan fallback film tanpa WebGL diuji menggunakan GLTFLoader aktual dan renderer/DOM tiruan.

Paket hosted mencantumkan tautan film dan perbandingan sambungan injektor. Paket satu HTML menyertakan GLB dan pelat injektor. Putar film terpisah bila perangkat membuka berkas lokal dan WebGL tidak tersedia. R04 berstatus **DRAF — QA BELUM LENGKAP**.

Manifest final ada di `qa/integration-package-r04-sha256.txt`. Film H.264 576 × 864 berdurasi 19,75 detik. Catatan render film mencocokkan hash kedua GLB dan graf beku. Render diagnostik Blender mencakup contoh pelumas dalam bidang potret di `qa/flow-render/lubrication-portrait.png`.
