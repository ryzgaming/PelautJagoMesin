# Instruksi adopsi untuk AI produksi mesin berikutnya

Gunakan dokumen ini sebagai pintu masuk lintas penyedia AI. Tujuannya adalah menerapkan disiplin produksi, kelengkapan eksplorasi dan keterlacakan bukti pada mesin yang dipesan. Hasil tetap bergantung pada referensi, alat dan QA yang benar-benar tersedia; mengikuti prompt bukan jaminan ketelitian OEM. Yanmar R06 adalah contoh implementasi yang masih mencatat batas QA, bukan standar dimensi semua mesin.

## 1. Prompt yang ditempel ke AI baru

Ganti identitas mesin; kolom lain boleh tetap “belum diketahui”.

```text
Kerjakan produksi model 3D edukasi mesin menggunakan repo
https://github.com/ryzgaming/PelautJagoMesin.

Baca dan terapkan agensi/ADOPSI-AI.md beserta berkas kanonis yang dirujuknya.
Gunakan branch yang benar-benar memuat dokumen itu; jangan menganggap main
sebagai sumber produksi terkini. Verifikasi commit dan kemampuan alat dahulu.

Mesin: [MEREK DAN TIPE MESIN].
Varian/nomor seri: belum diketahui; teliti sumber dan catat varian acuan.
Cakupan: unit lengkap dengan seluruh rakitan serta subkomponen internalnya.
Tujuan: model interaktif yang siap saya review; belum untuk katalog.
Referensi tambahan: cari sendiri bila belum saya berikan.

Adopsi proses dan arsitektur Yanmar R06, bukan bentuk atau parameter Yanmar.
Aktifkan subagen spesialis nyata sesuai jenis mesin dan QA yang independen.
Telusuri setiap komponen katalog hingga bagian terminal; cocokkan inventaris,
mesh ekspor, hubungan rakitan, rute fluida dan fungsi geraknya.
Semua komponen harus melakukan fungsi yang benar dalam kondisi yang relevan;
komponen diam harus tetap diam. Internal, gerak, aliran, starter dan suara
berlaku sesuai sistem yang memang ada pada mesin ini.

Pisahkan model / runtime / ui-workspace / agensi. Simpan sumber pembuat, master, data,
referensi, keputusan, versi alat, checksum dan bukti QA. Bekerja sampai hasil
terverifikasi atau ada hambatan bukti/alat yang spesifik. Jangan mengisi gap
dengan bentuk rekaan yang dipresentasikan sebagai OEM, jangan meluluskan QA
sendiri, dan jangan menyebut draf belum terverifikasi sebagai siap review.

Sediakan viewer yang dapat saya buka pada desktop dan HP, bukti perbandingan,
daftar temuan terbuka dan cara melanjutkan. Gunakan tujuan penyimpanan/hosting
yang sudah disetujui untuk order ini; jika belum ada, siapkan paket lebih dulu.
Jangan memasukkan hasil ke katalog atau menganggap publikasi order lama
sebagai izin menerbitkan seluruh aset order baru.
```

Saat dokumen ini dibuat, paket dan penataan tersedia di branch `feat/yanmar-r06-paket-terpisah` melalui PR #42; target produksi adalah `cloudflare-store`. Periksa status merge terbaru, lalu gunakan commit yang memuat berkas ini. Branch `main` masih merupakan pratinjau historis. Jangan bergantung pada ingatan percakapan sebelumnya.

## 2. Pulihkan konteks dan buktikan kemampuan

Baca dalam urutan berikut, lalu buka modul yang relevan—jangan berhenti pada daftar tautan:

1. [Aturan proyek](../AGENTS.md), [peta repo](../docs/REPOSITORY.md), dan [memori proyek](../docs/PROJECT_MEMORY.md).
2. [Agensi aktif](README.md), [registri profil/skill](registri.json), serta [daftar model](../produksi/REGISTRY.json).
3. [Prompt produksi GPT](../tools/gpt-production/PROMPT-GPT.md), [toolkit](../tools/gpt-production/README.md), [peran](../tools/gpt-production/docs/ROLE-PROMPTS.md), [spesialis rakitan](../tools/gpt-production/docs/SPECIALISTS.md), [fluida](../tools/gpt-production/docs/FLOW-ROUTING.md), dan [gerak/benturan](../tools/gpt-production/docs/MOTION-QA.md).
4. Skill aktif yang sesuai di `.agents/skills/`; profil di `.codex/agents/` dan alias Claude di `.claude/skills/` adalah lokasi kanonis. Baca isinya jika runtime tidak melakukan penemuan otomatis.
5. Skill `orang-mesin-3d-presisi` bila tersedia. Jika tidak, baca [ekspor mandirinya](../produksi/yanmar-6aym-wet-r06/agensi/skills-cloud/orang-mesin-3d-presisi/assets/portable-SKILL.md) sebagai snapshot panduan yang disertakan, bukan bukti skill sudah terpasang.
6. [Sumber/build Yanmar](../produksi/yanmar-6aym-wet-r06/agensi/produksi/source/README.md), [kontrak runtime](../produksi/yanmar-6aym-wet-r06/runtime/README.md), [contoh UI pengganti](../produksi/yanmar-6aym-wet-r06/ui-workspace/minimal.js), dan [QA pemisahan](../produksi/yanmar-6aym-wet-r06/agensi/validasi-pemisahan/LAPORAN.md) sebagai contoh arsitektur dan bukti.

Catat commit, branch, perubahan lokal yang sudah ada, versi Python/Blender/viewer, ketersediaan subagen, pembacaan PDF, akses sumber, kemampuan melihat gambar/render, browser dan lokasi hasil. Pastikan GLB/Blend/PDF yang dibutuhkan adalah berkas nyata setelah Git LFS diambil, bukan pointer teks. Uji satu render kecil serta ekspor/impor sederhana sebelum produksi besar.

```sh
python3 tools/gpt-production/toolkit.py preflight
npm run check:repo
```

`preflight` tidak memasang alat atau membuktikan kemampuan visual/subagen. `check:repo` memeriksa repo, bukan mesin baru. Untuk job baru, gunakan `toolkit.py init --help`, nama merek/tipe dan ID model AI yang benar-benar digunakan; tujuan harus baru/kosong. Jangan menyalin ID GPT ke pekerjaan Claude/Gemini atau mengarang nama tool. Sesuaikan pemanggilan alat dengan runtime, tetapi pertahankan bukti dan gerbang kualitas. Jangan menjalankan installer yang belum diperiksa.

Jika tidak ada subagen nyata atau kemampuan QA visual, lanjutkan pekerjaan riset/persiapan yang dapat diverifikasi dan catat hambatannya. Jangan berpura-pura menjadi beberapa agen melalui judul percakapan. Persyaratan multi-agen dan QA independen belum terpenuhi sampai benar-benar dijalankan.

## 3. Definisikan mesin sebelum memilih mekanisme

Buat brief mesin berisi identitas/varian, batas unit (termasuk/tanpa motor, transmisi, skid atau aksesori), datum/satuan, fungsi, sumber, serta kriteria penerimaan. Bila nomor seri tidak diketahui, cari dokumentasi yang cocok, pilih varian acuan dengan alasan dan tandai identitas unit nyata belum terkonfirmasi. Jangan mencampur varian untuk mengisi kekosongan. Tanyakan hanya informasi yang memengaruhi pilihan penting dan tidak bisa diperoleh dari sumber; lanjutkan bagian independen.

Susun matriks sistem dan rakitan: `active`, `not_applicable` atau `unknown`, disertai alasan/sumber dan spesialis penanggung jawab. Contoh pemetaan, bukan daftar bagian wajib:

| Jenis mesin | Contoh spesialis/bukti yang dibutuhkan |
|---|---|
| Diesel/gas engine | Blok/poros/piston, kepala/katup, injeksi sesuai tipe, turbo, pelumasan, pendinginan, starting |
| Pompa | Impeller/rotor, volute/diffuser, shaft, bearing, mechanical seal, kopling dan jalur fluida |
| Kompresor | Mekanisme sesuai tipe, suction/discharge, katup, unloader, seal, pelumasan dan penggerak |
| Separator/purifier | Bowl/disc stack, spindle, drive, jalur cairan, sealing/discharge dan interlock |
| Gearbox/motor/penukar panas | Gear/bearing/lube; rotor/stator/elektrik; atau dua sirkuit fluida dan inti penukar panas, sesuai unit |

Jangan mewarisi jumlah silinder, firing order, orientasi flywheel, rasio cam 1:2, sistem starter atau lima sirkuit diesel dari contoh. Angka 1.184 mesh model/78 rakitan Yanmar bukan target mesin lain. Foto injektor piezo hanya menunjukkan tingkat detail yang diminta; bukan bukti mesin target memakai injektor piezo.

Prompt/CLI lama mempunyai kontrak berorientasi engine. Petakan sistem yang relevan secara eksplisit dan catat N/A yang beralasan. Jangan membuat komponen/GLB palsu atau mengirim ID checkpoint SQL yang tidak dikenal demi lolos. Bila skema tidak mendukung mesin target, siapkan adaptasi kontrak dan tes pada revisi alat tersendiri sebelum menggunakannya; jangan diam-diam menonaktifkan checker.

## 4. Jalankan agensi yang nyata

Koordinator mengelola brief, sumber bersama, datum, kepemilikan file dan serah-terima. Jalankan peran berikut sesuai alat dan batas slot; beberapa gelombang diperbolehkan:

- Peneliti dokumen, foto, video dan pengukuran/datum, dengan hasil bukti masing-masing.
- Spesialis setiap sistem/rakitan utama dan bagian dalamnya. Tambah spesialis baru bila profil yang tersedia tidak mencakup teknologi mesin target.
- Pemodel eksterior dan internal terpisah, memakai datum serta antarmuka yang sama.
- Spesialis lintas rakitan: jalur fluida, kinematika/benturan, efek visual dan audio/lifecycle bila berlaku.
- Integrator model/runtime/UI dan pemeriksa independen yang tidak membuat bagian yang dinilainya.

Brief setiap agen memuat ID tugas, ruang lingkup, versi sumber/model, lokasi output, pemilik antarmuka, bagian yang wajib ada, kriteria dan bukti penerimaan. Simpan identitas eksekusi nyata, file hasil, checksum, temuan dan serah-terima. Nama profil, daftar peran atau laporan yang disusun koordinator bukan bukti eksekusi independen. Bagi kepemilikan agar flywheel, baut, port atau komponen bersama tidak dibuat dua kali. Kredensial tetap di koordinator.

## 5. Bangun bukti dan cakupan seluruh komponen

- Susun register manual/parts catalog/GA, foto nyata dan video: penerbit, revisi, URL, halaman/figure/timestamp, varian, SHA dan apa yang benar-benar diamati. Buka halaman, frame dan gambar; judul atau transkrip tidak membuktikan geometri.
- Telusuri indeks parts catalog → seluruh figure → posisi/subposisi → komponen terminal dan kuantitasnya. Rekonsiliasi part alternatif, kit dan komponen berulang. Buat daftar bagian yang diharapkan **sebelum** pemodelan agar bagian hilang tetap terlihat dalam audit.
- Untuk setiap bagian, hubungkan identitas sumber → inventaris → ID node/mesh → rakitan induk → fungsi → akses di viewer. Sertakan seal, washer, shim, pegas, pin, baut, bearing, core, saluran dan komponen kecil yang termasuk unit.
- Rumah luar atau satu silinder berlabel “injektor/pompa” tidak menggantikan isi rakitan. Ketiadaan dokumen bukan alasan menetapkan rakitan sebagai komponen terminal. Tandai rincian yang belum terbukti dan teliti lebih lanjut.
- Bedakan nomor posisi model dari nomor OEM. Pisahkan tingkat bukti DOCUMENTED/OBSERVED/ESTIMATED/UNKNOWN dari status pekerjaan dan audit. Ikuti pemetaan label INFERRED/ILLUSTRATIVE yang didukung kontrak.
- Bila detail disederhanakan untuk LOD, simpan master dan catat bagian yang disederhanakan; jangan menghapusnya diam-diam. Jangan mengarang toleransi/material/ukuran untuk menyatakan seluruh bagian lengkap.

## 6. Modelkan dan pisahkan hasil

Mulai dari skala, siluet, volume, datum, poros dan antarmuka; lanjutkan bentuk khas, interior, sambungan dan detail. Gunakan kode/parameter yang dapat diproduksi ulang serta master yang bisa diedit. Bandingkan render netral dengan sumber yang tepat sebelum menutupi kesalahan bentuk dengan material atau efek.

Paket akhir mesin baru mengikuti batas berikut; nama subfolder dapat mengikuti kontrak yang telah diuji:

```text
produksi/<mesin-varian-revisi>/
  model/          GLB, master Blender, data/inventaris dan manifest model
  runtime/        pemuat/render 3D, mekanisme, efek/audio, API dan konfigurasinya
  ui-workspace/   HTML/CSS, panel, kontrol, label dan aset presentasi
  agensi/         generator/input/build, snapshot alat/prompt/profil, referensi,
                  keputusan, laporan agen, QA dan riwayat revisi
```

Folder kerja awal toolkit dapat tetap memakai `doc/`, `model/`, `qa/`, `review/` sesuai kontraknya. Pengemasan akhir tidak boleh merusak path atau hash yang diaudit; lakukan pemetaan, verifier dan audit ulang yang relevan sesudah pemisahan. Jangan memodifikasi arsip Yanmar untuk menyimpan mesin baru.

Batas folder bersifat wajib: `model/` tidak berisi HTML/CSS/JavaScript atau generator; UI tidak berisi GLB/Blend/BOM/PDF atau laporan QA. Kode operasi berada di `runtime/`, generator di `agensi/produksi/`, sumber di `agensi/referensi/`, dan bukti pemeriksaan di `agensi/qa/`. Arsip historis mempertahankan susunan aslinya sebagai bukti.

UI memanggil API runtime, tidak menyimpan ulang fisika atau konstanta mesin dalam tombol/panel. Jangan menyalin `engine-session.js` Yanmar beserta ID, kamera, fase dan parameter khususnya lalu mengganti judul saja. Ekstrak/pakai bagian yang dapat digunakan ulang dan buat konfigurasi/adaptor khusus mesin target. Jika menyatakan UI dapat diganti, buktikan dengan UI kedua yang memakai aset dan mekanisme sama serta menghasilkan pose yang sama pada waktu simulasi sama.

## 7. Pastikan isi, jalur dan fungsi benar-benar bekerja

**Internal dan eksplorasi:** buka penutup, isolasi, X-ray/potongan dan urai dari mesin → rakitan → subrakitan → bagian terminal. Pilih bagian terdalam dari kanvas/daftar. Pastikan nomor penunjuk, nama, jumlah, sumber dan mesh cocok. Reset harus memulihkan posisi semula; animasi urai tidak otomatis menjadi prosedur servis resmi.

**Jalur fluida:** modelkan port, fitting, lumen pipa, galeri cor, katup, bypass dan saluran internal sebagai rangkaian yang saling terhubung. Periksa sambungan ujung, kebocoran visual, penampang, arah dan kondisi buka/tutup. Dua sisi penukar panas tidak boleh bercampur. Partikel harus mengikuti jalur dalam saluran yang dimaksud, bukan melintas keluar rumah atau berhenti pada celah. Bedakan jalur geometris terbukti dari skema/ilustrasi; warna tidak menentukan arah aliran.

**Kinematika dan benturan:** setiap bagian mempunyai kategori diam, berputar, translasi, follower, deformasi atau gerak bersyarat dengan alasan. Istilah klasifikasi ini harus dipetakan ke schema register aktif atau adaptor yang diuji; jangan menambah enum secara sembarangan. Petakan poros, rotor, impeller, gear, belt dan pengikat ke penggeraknya; jangan memutar housing bersama rotor atau meninggalkan poros aktif diam. Periksa transform dunia aktual pada hasil ekspor/viewer. Periksa kandidat benturan statis dan selama siklus, termasuk pasangan dalam rakitan yang sama. Klasifikasikan kontak wajar, clearance, penetrasi dan yang belum diverifikasi. Bounding box hanya penyaring awal; menyembunyikan mesh atau mengabaikan pasangan tidak memperbaiki benturan. Laporkan batas sampling.

**Starting dan operasi:** bila mesin memiliki starter, teliti solenoid/aktuator, engagement, pinion/penggerak, cranking, pelepasan dan kondisi mesin hidup sesuai jenisnya. Mesin lain menggunakan urutan pengoperasian yang memang berlaku. Sinkronkan start, run, pause/resume, stop dan reset; interlock atau kegagalan simulasi mengikuti sumber/cakupan, bukan direka untuk terlihat kompleks.

**Efek dan audio:** gunakan pustaka skill bersama, data rute dan fase mesin. Pemolesan efek ditangani spesialis sesuai aturan repo. Pembakaran hanya pada mesin yang memilikinya; jangan menggunakan api untuk semua mesin. Suara mengikuti state dan perubahan putaran, memiliki kontrol volume/mute, dan menghormati aktivasi audio oleh pengguna. Uji stop/reset/dispose agar suara atau loop tidak terus berjalan. Tandai audio sintetis/gerak yang diperlambat sebagai ilustrasi; itu bukan rekaman atau pengukuran mesin asli.

## 8. QA independen terhadap ekspor final

Tetapkan kriteria sebelum modeling. Pemeriksa harus membuka hasil sendiri, bukan menyalin angka modeler:

1. Impor ulang GLB final, ukur datum/unit/dimensi, cocokkan jumlah/ID, antarmuka dan komponen internal terhadap cakupan serta sumber.
2. Render enam arah yang didefinisikan untuk mesin tersebut, potongan dan close-up penting. Lihat hasilnya dan bandingkan dengan foto/frame nyata yang sepadan. Sudut tanpa referensi tetap gap. Gunakan kamera/pose/pencahayaan sama untuk bukti sebelum–sesudah.
3. Cocokkan seluruh register komponen, rute dan gerak dengan node ekspor; lakukan pemeriksaan numerik menyeluruh yang memungkinkan, disertai pemeriksaan visual terarah. Laporkan dengan jelas mana yang diperiksa satu per satu dan mana yang hanya disampel.
4. Jalankan viewer melalui entry normal pada desktop dan viewport HP, termasuk pemilihan internal, urai/rapat, reset, operasi, efek, audio dan kondisi aset/WebGL gagal. Catat ukuran layar, browser, renderer, performa dan error. Emulasi HP tidak sama dengan perangkat fisik.
5. Ikat laporan pada hash/revisi yang sama dengan viewer yang dikirim. Perbaikan setelah audit membatalkan hasil yang terdampak. Kembalikan temuan ke spesialis yang bertanggung jawab, lalu periksa ulang hasil perbaikannya.

PASS hanya untuk cakupan yang benar-benar memenuhi bukti. Ada FAIL → audit FAIL; tidak ada FAIL tetapi masih ada pemeriksaan berlaku yang belum terbukti → UNVERIFIED. N/A harus disertai alasan teknis. `check-review` toolkit hanya memeriksa kontrak, bukan kebenaran bentuk atau kemampuan visual agen.

Ikuti batas putaran/anggaran kontrak aktif (prompt lama membatasi dua putaran per batch). Bila belum tuntas, simpan checkpoint dan draf dengan temuan; jangan memberi PASS karena batas tercapai. Lanjutkan batch yang diizinkan saat hambatan teratasi. Durasi lama/cepat dan banyaknya agen bukan bukti kualitas. Jangan mengklaim QA masih berjalan sesudah prosesnya berhenti.

## 9. Serahkan hasil yang bisa dilanjutkan

Simpan master, generator, input, inventory/BOM, sumber dan locator, datum, rute, register gerak, resep rakitan, versi alat/dependensi, perintah build, ekspor, manifest SHA, laporan spesialis, gambar pembanding, hasil QA dan temuan terbuka. Catat keputusan teknis beserta alasannya; jangan mengarang transkrip yang tidak tersimpan. Berkas hasil harus dapat ditemukan di tujuan order, bukan hanya disebut dalam chat.

Sebelum memberi label “siap review”, tuntaskan gerbang yang berlaku, verifikasi link viewer/akses pemilik, serta periksa kembali hash yang dikirim. Bila pemilik ingin melihat pekerjaan yang belum lulus, sajikan **draf**, status FAIL/UNVERIFIED dan kekurangan konkret. Sertakan perbandingan desktop/HP dan cara melanjutkan dari checkpoint. Bila hosting belum tersedia, serahkan paket yang bisa dijalankan dan nyatakan batasnya; jangan mengaku telah menyediakan link online.

Pengarsipan, penerbitan review, dan persetujuan katalog adalah tindakan terpisah. Ikuti izin tujuan untuk order tersebut. Katalog/penjualan memerlukan persetujuan pemilik atas revisi/hash yang sama dan hak penggunaan materi; rujukan pihak ketiga tidak otomatis menjadi aset jual. Tambahkan model baru ke indeks sumber sesuai statusnya, bukan otomatis ke katalog website.

Perbarui memori proyek dan daftar revisi: apa yang selesai, bukti yang masih berlaku, temuan, file/commit, langkah berikut dan batas alat. Beri laporan singkat kepada pemilik: identitas mesin/varian, hasil QA menurut cakupan, link hasil, serta pekerjaan yang masih terbuka.
