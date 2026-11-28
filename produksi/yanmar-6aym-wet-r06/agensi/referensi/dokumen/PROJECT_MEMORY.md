# Yanmar R06 — fungsi starting dan efek, 28 November 2026

Pemilik meminta efek lebih kuat, suara starting, serta setiap komponen menjalankan fungsinya. Pemilik secara eksplisit mengizinkan koordinator langsung menugaskan spesialis tambahan bila perlu. Kerja memakai subagen nyata: integrasi, mekanisme/jalur, efek, audio, referensi, sistem bahan bakar dan QA independen. Ini keputusan kerja saat sesi berjalan, bukan automasi latar belakang.

Sumber master privat: `/workspace/private-production/yanmar-6aym-wet-r06`. Hasil web berada di `dist/gpt-r06`. Situs tetap owner-only; tidak ada penambahan katalog atau izin penjualan.

1.184 mesh model memiliki profil fungsi. Angka tersebut bukan BOM pabrikan terverifikasi. 122 kelompok, 183 target langsung dan 434 pengikut pada register tambahan; mekanisme legacy diperiksa terpisah.124 rotating,562 fixed, 363 follower, 80 deforming, 55 conditional.164 rute termasuk bypass dingin skematis berlabel; 31 centerline fisik dicocokkan dengan sumber model.

Keputusan implementasi:
- Start → engaging → cranking → firing → running; Stop menurunkan rpm dan menghentikan pembakaran. Pinion melepas pada saat handover. Pose dihitung dari bind, bukan penambahan offset berulang.
- Suara sintetis mengikuti rpm operasi, dibuat setelah klik Mulai. Default 35%, mute tersimpan. Gerak visual diperlambat dan diberi label. Audio bukan rekaman Yanmar dan tidak phase-locked sampel demi sampel ke gerak lambat.
- Fokus starter harus dari sisi pemasangan Z positif; sudut lawan terhalang flywheel. Jangan memulihkan kamera baseline yang salah untuk 'menyamakan' bukti.
- Fokus ruang bakar menggunakan potongan lokal kepala/liner/piston, kamera atas, posisi asli; jangan memindahkan nyala keluar bowl agar terlihat. Foto32° lebih informatif daripada hanya dekatTMA.
- Pompa oli rasio 8/9 direkonsiliasi dengan manual 1.689 rpm pada crank 1.900 rpm. Tooth count 40/45 dan profil gigi merupakan representasi model, bukan klaim seluruh ukuran OEM.
- Plunger beralur dan berputar bersama rack; needle lift 0,5 mm; nozzle model sudah 12 lubang. Filamen shader tidak sama dengan perhitungan atomisasi 12 jet.
- Termostat dan bypass dingin bersyarat suhu ilustratif. Cap bench hanya peragaan tekanan. Rasio putaran bushing turbo, spring travel dan respons dinamis yang tidak bersumber tetap estimasi.

Pelajaran QA:
- Screen kosong setelah resize dapat terjadi pada SwiftShader; resize framebuffer hanya saat ukuran berubah dan langsung render/reframe.
- Uji material/rute/pivot secara nyata melalui entry normal, bukan hanya variabel state. Lihat gambar. Node api visible tidak membuktikan api terlihat di balik casting.
- Daftar bagian fixed lama menjadi stale ketika EXT-EXHAUST-22 diubah menjadi floating bush aktif; pilih saksi fixed sesuai register final dan pertahankan toleransi. Bukti kegagalan uji lama disimpan, bukan dianggap kerusakan model.
- Lakukan pemeriksaan mesh kontak baru: rack-pinions, thermostatframe, mechanicalsealwall dan flinger seal grooves. Kontak yang dimaksud bukan alasan mengabaikan penetrasi.
- Geometri global/OEM dan HP fisik tetap UNVERIFIED meskipun uji fungsi tertentu lulus.696 pasangan historis r05 yang belum diselesaikan tidak ditutup otomatis oleh subset r06.

Efek bersama berada pada PR #41 branch gemini/efek-poles-01, commit a9d6e277a729ee77352e551ac6049a4e69d1ca4f; belum di-merge.126 tes proyek + 10 kontrak lulus. Artefak efek `/workspace/efek-review/volume-02`.

Bukti master: `qa/r06/definitive`, `doc/function-specialist`, `doc/function-references`, `doc/fuel-function-specialist`, `doc/audio`. Manual/video diakses dengan tingkat bukti tercatat; mayoritas kandidat YouTube hanya metadata. Dua video dilihat sebagai frame: starter pengguna dan Garrett OEM.

Preview Sites relay 4173 gagal pada lingkungan ini. Browser pengujian proyek memakai Chromium SwiftShader; keberhasilan publikasi diverifikasi oleh Sites native API, bukan klaim QA pada HP fisik.

QA akhir lulus untuk cakupan fungsi dan pasangan terarah yang tercantum. Status gabungan tetap UNVERIFIED sesuai batas geometri historis dan perangkat fisik. Publikasi privat berhasil; identitas versi dan URL tercatat di ../production-progress.json.
