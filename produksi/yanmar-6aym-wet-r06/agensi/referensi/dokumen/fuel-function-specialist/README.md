# Pemeriksaan fungsi injeksi R06

Spesialis: `/root/fuel_function_specialist`. Pemeriksaan diarahkan pada pompa injeksi, governor, rack/pinion, plunger, delivery valve, jarum dan pegas nozzle. Tidak memvalidasi seluruh geometri mesin atau simulasi hidraulik.

## Sumber yang benar-benar dilihat

- D01 PDF 115 / cetak 111, tabel YPE-1615 untuk 6AYM-WET: urutan 1-4-2-6-3-5; plunger Ø16mm; heliks kanan 36,906°. Ukuran alur, datum sudut, dan hubungan volume penyaluran tidak lengkap.
- D01 PDF 116 / cetak 112, diagram governor dan uraian: rack maksimum saat starting, pemberat membuka dan rack mengurangi penyaluran saat idle, stop memindahkan rack ke posisi stop mengatasi gaya governor.
- D01 PDF 150 / cetak 146, TP2 untuk 6AYM-WET/WGT: bukaan 31±0,5MPa, lift 0,5±0,01mm; lubang 8×Ø0,30mm dan 4×Ø0,22mm; sudut semprotan 160°/90°.
- Gambar sumber tersimpan di `../function-references/yanmar-D01-p{115,116,150}.png`.

## Pemeriksaan dan koreksi

1. Pembacaan langsung GLB membuktikan jarum, spring holder, spring, body dan retaining nut merupakan ID terpisah pada enam injektor. Body/nut tetap; needle+holder aksial; spring memendek pada dudukan atas.
2. Pengukuran numerik `roller_clearance` pada 720 sudut memperlihatkan puncak nok silinder 1..6 pada 0,240,480,120,600,360°. Urutan sesuai 1-4-2-6-3-5.
3. R06 memisahkan pinion 330..335 dari barrel 41..46. Group plunger 35..40 dipisah dari tappet 23..28 dan dudukan 270..275 agar hanya plunger menggabungkan lift dan twist. Ditemukan cabang renderer `reciprocate` semula mengabaikan sudut twist; integrator diberi koreksi agar `action` diputar pada sumbuY setelah translasi.
4. Semburan shader semula -12..+18° tidak sesuai jarum lama -14..0°. Integrator dan pemilik gerak diberi temuan untuk memakai timing bersama. Revisi akhir memakai awal pompa -16° dan nozzle -12°,akhir0°; delay 4° dan akhir injeksi masih ilustratif, bukan hasil ukur line pressure/unit.
5. Jarum lama 0,25mm berbeda dari tabel TP2. Pemilik gerak menaikkan ke 0,50mm dan mencatat sumber; pressure threshold adalah data manual, tidak mengklaim pressure solver.
6. Plunger sebelumnya silinder halus sehingga perubahan sudut metering tidak terlihat. Ditambahkan alur heliks dan spill dangkal yang hanya mengurangi material di dalam envelope lama. Diameter 16mm dan sudut 36,906° bersumber; lebar 2,3mm, kedalaman sekitar 0,9mm, panjang, penempatan aksial/sudut tetap ESTIMATED. ID tidak berubah. Ini petunjuk kerja metering, bukan manufaktur OEM.
7. Nozzle generator sudah memotong 8+4 lubang pada dimensi dan sudut manual. Tidak perlu mengganti body. Audit R03 historis menunjukkan 12 ray terbuka; kelulusan pada GLB akhir harus diikat ke hash baru, bukan dianggap otomatis dari bukti lama.

## Batas

Dosis solar tidak dihitung dari tekanan, defleksi pipa, temperatur atau groove port timing. Springs/cam/rack dipakai untuk pembelajaran dengan parameter terukur dari model dan estimasi berlabel. Rendering semprotan belum dengan sendirinya membuktikan distribusi 12 jet, atomisasi fisik atau kesesuaian spray chamber. Validasi suara bukan bagian audit ini.

## Hasil akhir pada ekspor R06

- Eksterior SHA-256 `4c551e34e16228b85d08f22c4b49886154b4c0fd0e57f4d5190ebb8ea550dd21`: enam plunger tetap berada dalam bounds versi sebelumnya; masing-masing mengurangi sekitar 58,57 mm³ material, dengan nol edge nonmanifold setelah penggabungan vertex pada resolusi 0,1 µm. Ini bukan pembuktian lengkap bebas self-intersection.
- Enam pasangan rack/pinion diperiksa memakai proyeksi segitiga GLB aktual pada 501 posisi per pasangan. Tidak ada irisan proyeksi. Celah sampel terendah 0,15170 mm; setelah dikurangi batas gerak relatif tak tersampel dan margin numerik, batas bawah celah kontinu 0,13040 mm. Berlaku untuk hukum rack 0–5 mm dan pinion travel/17,5 mm. Matriks browser aktual diperiksa QA terpisah.
- Internal SHA-256 `526ce37f126203eb288388dbd7922dd85749b19ddf8ef82ee5bfcf9d472ec8f5`: ray centerline 72/72 lubang pada enam nozzle terbuka. Pemeriksaan ini tidak membuktikan toleransi diameter, debit, atau atomisasi.
- Render netral plunger sebelum/sesudah dan keadaan twist dibuka serta ditinjau. `plunger-comparison.png` memakai kamera dan cahaya sama. Alur penakar kini terlihat dan berputar. Lebar/kedalaman/datum tetap ESTIMATED.
