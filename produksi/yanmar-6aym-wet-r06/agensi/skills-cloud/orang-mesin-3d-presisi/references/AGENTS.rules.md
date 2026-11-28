# Rules Codex — Orang Mesin 3D

Bagian siap digabungkan ke AGENTS.md repo tujuan. Pertahankan aturan yang sudah ada; jangan mengubah aturan branch, direktori terlarang, atau perintah pengujian tanpa kebutuhan tugas. Aturan ini mengatur pekerjaan 3D dan audit; tidak menyatakan bahwa audit telah dijalankan.

## Sumber dan ketelitian
- Baca manual book, parts catalog, gambar teknik, dan dokumentasi proyek sebelum membuat detail mesin. Cocokkan model, varian, revisi, dan serial range yang relevan.
- Catat sumber setiap part dan ukuran dengan halaman/figure atau URL serta timestamp video. Verifikasi angka penting pada gambar PDF; jangan hanya mengandalkan OCR.
- Bedakan DOCUMENTED, OBSERVED, ESTIMATED, dan UNKNOWN. Jangan mengarang ukuran, material, jumlah, toleransi, atau komponen tersembunyi.
- Gunakan gambar teknik untuk dimensi, katalog untuk identitas/jumlah, manual untuk mekanisme/prosedur, serta foto/video yang cocok untuk bentuk yang terlihat. Laporkan konflik sumber.
- Pisahkan pengamatan video dari transkrip/narasi/thumbnail. Jika hanya transkrip yang bisa dibaca, tandai audit visual video UNVERIFIED. Jangan mengaku menonton bagian yang belum diakses.
- Catat URL YouTube, timestamp, ciri varian, dan fitur yang terlihat. Jangan mengambil ukuran absolut dari video tanpa skala terverifikasi; labeli estimasi dan ketidakpastiannya.

## Pemodelan
- Tetapkan unit, sumbu, origin, datum, pose terpasang, dan transform lokal/world. Parameterkan dimensi penting.
- Pertahankan ID stabil dan relasi node ke part number serta assembly hierarchy.
- Buat detail fastener, seal, bearing, internal, lubang, dan sambungan sesuai bukti dan kebutuhan pembelajaran. Labeli simplifikasi dan detail hipotetis.
- Pisahkan exploded offset dari transform assembly. Jangan menganggap exploded view manual berskala.
- Pertahankan model master detail; buat LOD/aset HP sebagai turunan yang terdokumentasi. Jangan menghapus part penting atau label pembelajaran demi performa.

## Audit dan penyelesaian
- Ukur geometri model dan hasil ekspor. Periksa dimensi, jumlah, posisi, sambungan, orientasi, clearance, benturan, unit, dan kehilangan detail saat ekspor.
- Render lalu lihat beberapa sudut, potongan, exploded view, serta close-up penting. Proses render sukses bukan bukti gambar sudah diaudit.
- Jangan menetapkan ambang toleransi atau skor kemiripan tanpa dasar. Jika toleransi tidak tersedia, laporkan selisih nominal dan status penerimaan yang belum dapat dipastikan.
- Periksa interaksi sentuh, seleksi part, label, isolate, explode/reset, dan cutaway sesuai fitur proyek. Pisahkan emulasi viewport dari pengujian HP nyata; jangan mengklaim FPS tanpa pengukuran.
- Buat temuan dengan ID, part/node, sumber halaman/timestamp, kondisi model, dampak, perbaikan, dan hasil audit ulang. Gunakan penomoran/lokasi laporan yang sudah ditetapkan proyek.
- PASS hanya untuk cek yang benar-benar lulus; FAIL untuk ketidaksesuaian terbukti; UNVERIFIED untuk bukti/alat yang kurang; N/A harus beralasan. Ada FAIL berarti scope gagal; tanpa FAIL tetapi ada UNVERIFIED berarti scope belum terverifikasi.
- Ulangi cek terdampak sesudah perubahan dan jalankan build/test wajib proyek. Pisahkan status geometri, visual, fungsi, interaksi, dan performa.
- Jangan mengklaim 100% akurat, identik, siap manufaktur, atau diuji tanpa bukti. Nyatakan cakupan dan sisa ketidakpastian.
- Lanjutkan pekerjaan independen yang bisa diselesaikan; minta data tambahan secara spesifik hanya untuk bagian yang membutuhkannya.


## Kualitas bentuk dan referensi multi-sudut
- Perbaiki varian/unit, siluet, proporsi, dan antarmuka sebelum menambah ornamen. Gunakan bentuk casing, rib, flange, fillet, serta fastener yang didukung referensi.
- Cocokkan datum, pose, dan kamera pada beberapa tampak. Jangan mengubah ukuran terdokumentasi untuk menyesuaikan foto dengan perspektif yang belum dikalibrasi.
- Periksa topology, normals, self-intersection, lubang tak disengaja, dan hasil triangulasi/ekspor. Jangan menutup port/cutaway yang memang disengaja atau menyamarkan geometri salah dengan shading.

## Material dan pencahayaan
- Pisahkan bahan teknik dari tampilan visual. Gunakan material PBR, skala texture, UV, color space, dan channel packing yang sesuai engine serta format ekspor.
- Gunakan lighting netral untuk audit dan preset presentasi untuk penampilan. Hindari pantulan, shadow, bloom, karat, atau kotoran yang menyembunyikan detail pembelajaran.
- Catat sumber/lisensi texture dan HDRI. Uji material pada viewer target, bukan hanya di aplikasi authoring.

## Assembly, gerak, dan pembelajaran
- Definisikan pivot, joint, axis, limit, hierarchy, dan baseline transform. Hitung exploded offset dari baseline agar reset berulang tidak menggeser part.
- Bedakan demonstrasi animasi dari simulasi fisik. Catat sumber rasio, timing, lintasan bongkar, dan asumsi; jangan mengklaim validitas aliran/gaya dari animasi.
- Uji play/pause, scrubbing, reset, isolate, cutaway, serta kombinasi state yang didukung. Pertahankan identitas part setelah optimasi atau pergantian LOD.
- Buat komponen kecil mudah dipilih melalui area hit atau daftar pencarian; jangan memperbesar geometri part untuk kemudahan tap. Pastikan label/panel terbaca pada HP.
- Sertakan fungsi part dan sumber dalam materi, dengan istilah Indonesia/teknis yang konsisten. Periksa alur tugas belajar yang konkret serta loading/error state.

## Optimasi dan bukti sebelum–sesudah
- Ukur baseline pada kondisi yang tercatat sebelum optimasi: aset, perangkat/browser/viewport, waktu muat, frame time, draw calls, dan memori bila tersedia.
- Gunakan instancing/LOD/baking/kompresi sesuai bottleneck. Pertahankan master detail, siluet, lubang, interfaces, ID part, seleksi, serta kemampuan bongkar-pasang.
- Jangan menganggap tes headless/desktop membuktikan performa HP; jangan menjanjikan FPS tanpa pengukuran pada kondisi yang dinyatakan.
- Untuk perubahan geometri/visual, simpan dan lihat render sebelum–sesudah dengan kamera, pose, viewport, exposure, dan lighting yang sama. Jika lighting yang berubah, catat variabel tersebut. Jika baseline tidak tersedia, nyatakan keterbatasannya.
- Tinjau render netral dan presentasi dari beberapa sudut serta close-up. Lulus build, validator format, atau skor image diff saja tidak meluluskan mutu visual.
- Jangan meluluskan optimasi yang menghilangkan detail penting, merusak pemilihan part, atau mengubah informasi pembelajaran meskipun ukuran file/FPS membaik.


## Daftar revisi dan notifikasi
- Perbarui tracker revisi yang sudah ada setelah audit/perbaikan; jika belum ada, gunakan docs/audit/REVISI.md. Catat repo/branch, mesin/varian, revisi model, waktu, ID temuan, part, aturan/modul skill, bukti, tindakan, dan status.
- Pisahkan status pekerjaan OPEN/IN_PROGRESS/BLOCKED/READY_FOR_REVIEW/CLOSED dari hasil audit PASS/FAIL/UNVERIFIED/N/A. Perubahan kode bukan bukti revisi selesai; tutup hanya setelah retest yang relevan lulus pada revisi model terbaru.
- Jangan mengarang temuan, deadline, atau penanggung jawab. Belum diaudit harus ditulis NOT_AUDITED, bukan semua lulus.
- Untuk notifikasi dot/otomasi, gunakan tracker yang dapat diakses dan scope proyek yang telah dipastikan. Skill tidak otomatis memantau Codex PC atau mengirim notifikasi di latar belakang.
- Notifikasi memuat ID/part, aturan terkait, masalah/bukti yang kurang, prioritas, tindakan berikutnya, serta tautan sumber. Bedakan belum diperbaiki dari menunggu pemeriksaan ulang; hindari pemberitahuan berulang yang identik.
- Jika sumber tidak tersedia, laporkan pemantauan terhalang. Jangan mengaku notifikasi aktif sebelum layanan berhasil mengaktifkannya, dan jangan memantau repo lain berdasarkan dugaan.


## Memori proyek lintas sesi
- Di awal sesi, baca AGENTS.md, handoff/memori proyek, tracker revisi, dan keputusan/pelajaran relevan. Jika belum ada mekanisme memori, gunakan docs/PROJECT_MEMORY.md sebagai indeks ringkas setelah repo tujuan tersedia.
- Cocokkan ingatan dengan kondisi file, varian mesin, revisi manual/model, serta perubahan pengguna terbaru. Tandai asumsi/konflik dan buka kembali sumber jika berubah; jangan memakai ingatan sebagai bukti audit yang belum dilakukan.
- Simpan keputusan dengan alasan/sumber, kesalahan yang terbukti, perbaikan, hasil retest, dan cek agar kesalahan tidak terulang. Batasi penerapan lesson sesuai alat, versi, dan jenis mesin yang terbukti.
- Setelah milestone dan sebelum handoff, perbarui catatan perubahan, bukti pengujian, revisi terbuka, keterbatasan, serta langkah berikutnya. Bedakan implementasi selesai dari verifikasi selesai.
- Pertahankan riwayat keputusan yang diganti dan link ke bukti; jangan menghapus perubahan pengguna atau mengarang status untuk merapikan catatan. Jangan menyimpan token, kredensial, atau rahasia.
- Simpan memori pada proyek/penyimpanan persisten yang tersedia. File scratch, ingatan percakapan, atau skill sendiri tidak menjamin kontinuitas di Codex lokal maupun dot; laporkan bila rute penyimpanan belum tersedia.


## Syarat kelulusan akurasi
- Tiap klaim akurasi harus menyebut fitur/scope, varian, revisi model, sumber spesifik, metode ukur/pemeriksaan, dan hasil. Kekurangan atau konflik bukti tetap UNVERIFIED.
- Ukur geometri hasil ekspor untuk klaim tentang aset ekspor; nilai parameter dalam kode saja tidak membuktikan ukuran keluaran. Catat unit/datum dan ketelitian metode.
- Bukti dari revisi lama tidak meluluskan perubahan baru. Periksa ulang cek terdampak dan jangan menutup revisi sebelum bukti retest tersedia.
- Jangan mengubah toleransi, menghapus temuan, atau menyembunyikan bagian untuk memperoleh PASS. Render bagus, test kode lulus, dan skill terpasang tidak membuktikan ketepatan teknik.
- Nyatakan batas cakupan; jangan menjanjikan akurasi absolut dari manual/video yang tidak lengkap atau belum diperiksa.


## Ketepatan ingatan antar-sesi
- Untuk setiap fakta penting, simpan nilai/unit, sumber spesifik, varian, revisi model/sumber, tanggal dan metode verifikasi, serta status kesegaran CURRENT/STALE/CONFLICT/UNVERIFIED.
- Bila revisi model atau sumber berubah, tandai fakta dan hasil cek terdampak STALE sampai diperiksa ulang. Fakta lama tidak otomatis benar pada model baru.
- Pertahankan atribusi informasi yang hanya dilaporkan pengguna/agent lain; jangan mengubahnya menjadi klaim pengukuran langsung. ESTIMATED tetap estimasi meskipun diulang di banyak sesi.
- Simpan riwayat fakta yang diganti dan konflik antarsumber. Dalam ringkasan, jangan hilangkan unit, varian, pengecualian, sumber, atau status belum terverifikasi.
- Gunakan ingatan sebagai indeks bukti, bukan pengganti bukti. Jika konteks/file tidak tersedia, pulihkan dari sumber yang tepat dan nyatakan ketidakpastian; jangan menebak demi terlihat ingat.

