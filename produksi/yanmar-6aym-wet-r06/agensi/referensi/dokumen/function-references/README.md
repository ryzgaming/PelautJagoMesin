# Referensi fungsi R06 — 28 November 2026

Dua video telah diperiksa melalui frame asli: contoh starter pengguna dan video OEM Garrett. Sembilan halaman manual Yanmar dan dua halaman DENSO dilihat langsung. Video YouTube lainnya berupa metadata/kandidat; bukan bukti frame yang sudah ditonton. Semua video analogi tidak menetapkan dimensi/varian Yanmar.

## Temuan yang harus ditindaklanjuti

- **FN-OIL-RATIO:** manual Yanmar PDF157 / cetak153: pompa oli 1689 rpm pada engine 1900 rpm. README r05 ±32/28 konflik. Spesialis kinematika telah diberi tahu untuk memeriksa dan memperbaiki driver aktual.
- **FN-GOVERNOR:** manualPDF116/cetak112 menjelaskan rack maksimum saat start, weights terbuka saat idle, rack fuel cutoff saat stop. Gerak bersyarat perlu ditampilkan.
- **FN-MEDIA:** dua jalur cairan cooler tidak bercampur; filter paper dan casing tetap. Turbo tidak sinkron rasio tetap crank; kedua roda turbonya terikat satu poros.

## Sumber per fungsi

|Fungsi|Kata kunci pencarian|Arah implementasi & batas|
|---|---|---|
|starter|starter solenoid pinion pre-engaged overrunning clutch|Engage axial; drive flywheel saat cranking; tarik pinion saat engine catches. Housing/stator tetap. Langkah26mm,10gigi,rasio18/72 existingmodel masih rekonstruksi. Sumber: USER-START, DENSO-MAN, DENSO-VID|
|crank_piston_rod_cam_valves|four stroke diesel crankshaft connecting rod cam valve rocker working|Crank memutar cam; piston translasi dan rod berayun; valve via cam/pushrod/rocker; spring kompresi mengikuti valve. Timing ideal/clearance masih ikuti register lama sampai sumber exact dibuktikan. Sumber: FOURSTROKE-VID, YM-SERVICE|
|injection_pump|inline injection pump cam plunger barrel delivery valve working|Cam mendorong tappet/plunger; spring return; delivery valve conditional. Urutan1-4-2-6-3-5; interval60deg pada pump. D01 PDF115: WET YPE1615; PDF149 FID 16 ±0.5° BTDC adalah timing pompa, bukan otomatis awal spray atau nyala. Jangan gunakan rotary VE/common rail. Sumber: PUMP-VID, YM-SERVICE|
|governor_stop|mechanical inline injection pump governor weights rack starting stopping|Start weights closed dan rack maksimum; idle weights membuka; Stop rack ke posisi fuel cutoff terlepas gaya governor. D01 PDF116 fungsi terdokumentasi; transienttime/lift model tetap illustrative. Sumber: PUMP-VID, YM-SERVICE|
|injector|mechanical diesel injector nozzle needle spring working|Body tetap; nozzle WET TP2: needle lift 0.5 ±0.01 mm, opening 31 ±0.5 MPa; spring menutup. Delapan hole 0.30 mm dan empat hole 0.22 mm, sudut spray 160°/90° (D01 PDF150–151). Video belum terverifikasi; manual PDF150–151 diperiksa langsung. Jangan menyisipkan piezo. Azimuth dan hydraulic delay belum diketahui. Sumber: INJECTOR-VID, YM-SERVICE|
|feed_pump|diesel fuel feed pump double action piston four check valves cam|Piston double acting digerakkan cam; empat checkvalve berganti menurut chamber pressure; manual priming tidak berputar saat engine run. D01 PDF145 menyatakan four checkvalves; pressurelimit dapat membatasi piston. Modelgerakperiodik bukan physicalpressure solver. Sumber: YM-SERVICE|
|oil_pump_relief|external gear lubricating oil pump relief valve working|Gear pumping membawa oli melalui cooler/filter→gallery→bearing/rocker/piston/turbo/injectionpump → sump. Relief conditional, bukan openclose tiap putaran. KONFLIK r05 ratio32/28 vs manual1689rpm@1900. Piping diberi tindakan koreksi; sumber tabel PDF157. Sumber: YM-SERVICE, OILGEAR-VID|
|coolant_pump|centrifugal jacket cooling water pump impeller working|Impeller/shaft putar dalam casing tetap; coolantpump→oilcooler → jacket/head→exhaustmanifold→thermostat→tank/HX→pump. Rasio/arah dari registerYanmar; aliran bukan CFD. Sumber: YM-SERVICE, GRUNDFOS-VID, GRUNDFOS-DOC|
|seawater_pump|flexible impeller seawater pump vane eccentric cam working|Rotor bergerak dan vane lentur terhadap cam tetap; seawaterpump→aircooler → heat exchanger→sea. D01 PDF163 shaft1572@crank1900. Deformation approximate tidak boleh disebut material simulation. Sumber: YM-SERVICE, JABSCO-VID, JABSCO-DOC|
|alternator_belt|alternator rotor stator belt pulley working|Pulley/belt/rotor bergerak; stator, rectifier dan casing tetap. Rotor berputar di stator; keluaran lewat penyearah. Rasio puliYanmar dari existingreconstruction, jangan genericcar ratio. Sumber: DENSO-MAN, DENSO-VID|
|turbo_aircooler|turbocharger turbine compressor shaft intercooler working|Exhaust memutar turbine+compressor commonshaft; udara menujuaircooler laluengine; casingdiam. RPM dan spoollag ilustratif; 280000rpmGarrett dilarang dipindah. Sumber: GARRETT-VID, GARRETT-DOC, YM-SERVICE|
|filters_coolers|oil filter shell tube heat exchanger fluid function|Filtermedia/tubes/baffles tetap; tampilkan aliran dua medium terpisah dan perpindahan panas secara indikatif. Centrifugal bypassfilter rotor berbeda dari mainpaperfilter. Jangan menggerakkan seluruh filter/cooler agar terlihat bekerja. Tekanan/suhu angka belum solver. Sumber: OILFILTER-VID, OILFILTER-DOC, COOLER-VID, COOLER-DOC, YM-SERVICE|

## Sumber dan tingkat akses

- **USER-START** [Contoh starter dari pemilik](https://pin.it/1xWNBjn2J) — pembuat belum terverifikasi; `sampled_frames_viewed`. Kompilasi split-screen animasi+bench. Pembuat, mesin, gigi, rasio, ukuran dan timing real tidak teridentifikasi. Bukan bukti geometri OEM.
- **DENSO-MAN** [Starters & Alternators Technical Manual, edition 2 October 2016](https://assets.denso-am.eu/production/attachments/Starter-Alternator-Manual-English.pdf) — DENSO Europe; `pdf_pages_viewed`. Desain generik beberapa tipe; bukan starter exact 6AYM.
- **DENSO-VID** [Discover DENSO Starters & Alternators](https://www.youtube.com/watch?v=3nhbKIToMB4) — DENSO Aftermarket Europe; `metadata_only`. Video produk OEM; frame tidak dilihat. Mekanisme memakai DENSO-MAN, bukan klaim menonton video.
- **GARRETT-VID** [How a Turbocharger Works](https://www.garrettmotion.com/news/video-center/video/how-a-turbocharger-works/) — Garrett Motion; `sampled_frames_viewed`. Animasi automotive generik. 280000RPM pada40s bukan RPM Yanmar dan tidak boleh ditransfer.
- **GARRETT-DOC** [Turbocharger knowledge base](https://www.garrettmotion.com/turbo-replacement/turbo-diagnosis/knowledge-base/) — Garrett Motion; `web_text`. Tidak memvalidasi speed/lag/unit Yanmar.
- **JABSCO-VID** [How a Jabsco Flexible Impeller Pump Works](https://www.youtube.com/watch?v=ECv1VwW6RTo) — Jabsco Flojet Rule; `metadata_only`. Deskripsi mengonfirmasi demonstrasi aktual; video gagal fetch, tanpa timestamp pengamatan.
- **JABSCO-DOC** [Engine Cooling Flexible Impeller Pumps — Principle of Operation](https://www.xylem.com/siteassets/brand/jabsco/resources/manual/user-guide---engine-cooling-flexible-impeller-pumps.pdf) — Xylem/Jabsco; `indexed_primary_text`. Unduhan langsung403; paragraf operasi terbaca via websearch. Bukan ukuran pompa Yanmar.
- **GRUNDFOS-VID** [The Fundamentals of Centrifugal Pumps - Part 1](https://www.youtube.com/watch?v=_bVukK4ZD0I) — Grundfos; `metadata_only`. Tidak ditonton; analogi fungsi, bukan geometri/jumlah sudu/rasio pompa Yanmar.
- **GRUNDFOS-DOC** [Centrifugal pump theory](https://www.grundfos.com/content/dam/global/page-assets/learn/ecademy/pdfs/us-course-102L-module-3-centrifugal-pump-theory.pdf) — Grundfos Holding A/S; `indexed_primary_text`. Peta head-flow Yanmar tidak tersedia.
- **PUMP-VID** [The Governor Operation in a Mechanical In-Line Fuel Injection Pump / CLIP](https://www.youtube.com/watch?v=gQpCCeq9HIQ) — Mr Lopez; `metadata_only`. Non-OEM, frame tidak dilihat. Referensi implementasi tetap YM-SERVICE PDF115–116.
- **INJECTOR-VID** [Video on working of diesel fuel Injector and how nozzle spray (judul tautan kurikulum)](https://www.youtube.com/watch?v=P5-yxENaLDU) — pembuat belum terverifikasi; `curriculum_link_only`. Judul asli/channel/frame belum terverifikasi; tidak dijadikan bukti teknis. Tolak transfer piezo/commonrail ke injector mekanis Yanmar.
- **FOURSTROKE-VID** [How Four Stroke Engines Work (How It Works - 4 Stroke)](https://www.youtube.com/watch?v=nx9Fos8ZQbc) — saVRee; `indexed_metadata`. Frame belum dilihat; fase/urutan Yanmar memakai manualexisting.
- **OILGEAR-VID** [Bosch Rexroth: External gear pump - CKD - Conversion of a Basic Pump to a Primary Pump](https://www.youtube.com/watch?v=0wykeiH4KwI) — Bosch Rexroth (judul terindeks; channel belum diperiksa); `metadata_only`. Video assembly bukan bukti debit/putaran Yanmar. Rasio harus YM-SERVICE PDF157.
- **OILFILTER-VID** [MANN-FILTER Oil Filters](https://www.youtube.com/watch?v=AajTItBn148) — MANN-FILTER (brand dalam judul; channel belum diperiksa); `metadata_only`. Tidak ditonton, bypass pressure/flowdirection Yanmar ditentukan diagrammanual.
- **OILFILTER-DOC** [Engine oil filters](https://www.mann-filter.com/in-en/parts/oil-filter.html) — MANN-FILTER; `indexed_primary_text`. Jenis elemen dan valve berbeda antarproduk.
- **COOLER-VID** [How Does a Shell and Tube Heat Exchanger Work? | 3D Animation](https://www.youtube.com/watch?v=OyQ3SaU4KKU) — saVRee; `metadata_only`. Frame belum dilihat. Bukan OEM Yanmar; jumlah tube dan pass tidak dipindah.
- **COOLER-DOC** [Shell-and-tube heat exchanger](https://www.alfalaval.com/products/heat-transfer/tubular-heat-exchangers/shell-and-tube-heat-exchanger/) — Alfa Laval; `indexed_primary_text`. Tidak menetapkan konfigurasi cooler 6AYM.
- **YM-SERVICE** [Service Manual 6AYM-WGT / 6AYM-WET / 6AYM-WST, 0B6AY-EN0010](https://dealer.yanmar.com.au/bulletins/SERVICE/6AYM-W_Service_manual.pdf) — YANMAR; `pdf_pages_viewed`. Kolom WET dipilih. Gambar keluarga tidak menetapkan serial/clearance/cam law lengkap.
- **YM-OPERATION** [Operation Manual 6AYM-WGT / WET / WST](https://www.yanmar.com/media/global/com/product/marinecommercial/propulsionEngine-HighSpeed/operationmanual/6AYM-WST_WET_WGT_OPM_0A6AY-G00401.pdf) — YANMAR; `existing_project_source`. Tidak dibuka ulang pada tugas referensi ini; tidak mengklaim inspeksi baru.

## Bukti yang benar-benar dilihat

- [Starter 0–7 s](starter-observed.jpg): translasi pinion dan flywheel; split-screen animasi/bench. Delapan frame sampel, bukan ukur timing OEM.
- [Garrett 30–80 s](garrett-observed.jpg): exhaust/turbine, shaft, compressor, aircooler dan cylinder. Nilai 280.000 RPM di video adalah ilustrasi otomotif, bukan Yanmar.
- DENSO PDF10 (engagement/disengagement) dan43 (rotor/stator).
- Yanmar D01 PDF115/116/145/148/149/150/151/157/163: pompa/governor/feed/oli/pendingin.

Registry JSON memuat SHA-256 media/dokumen. UI disediakan `browser-sources.json` berisi tautan asli dan batas akses; file video asli tetap bukti privat.

Tambahan spesifik injektor: D01 PDF150–151 / cetak146–147 memperlihatkan nozzle WET TP2 dengan dua kelompok lubang (8 ×0,30 mm dan4 ×0,22 mm), sudut160°/90°, valve lift0,5 ±0,01 mm dan opening31 ±0,5 MPa. D01 PDF149 mencatat FID pompa16 ±0,5° sebelum TDC; itu tidak otomatis sama dengan onset semburan atau awal pembakaran.
