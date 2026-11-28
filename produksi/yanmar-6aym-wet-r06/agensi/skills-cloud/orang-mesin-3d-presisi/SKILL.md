---
name: orang-mesin-3d-presisi
description: Buat, perbaiki, dan audit model 3D permesinan kapal untuk Orang Mesin di Codex dengan ketelitian berbasis manual book, parts catalog, gambar teknik, foto, dan video YouTube. Gunakan saat pengguna meminta bentuk realistis sampai baut, dimensi presisi, komponen internal, exploded view, workspace interaktif untuk HP, audit kesesuaian sumber, hard-surface modeling, referensi multi-sudut, material PBR dan lighting, animasi assembly, UX pembelajaran, optimasi Three.js/GLB, rules AGENTS.md, atau pelacakan revisi dan persiapan notifikasi temuan yang belum selesai, serta memori proyek dan peningkatan konsistensi lintas sesi.
---

# Orang Mesin — 3D Presisi

Kerjakan perubahan nyata di proyek yang diberikan pengguna. Gunakan bahasa Indonesia yang jelas untuk komunikasi; pertahankan istilah teknis asli dan part number. Utamakan ketepatan pembelajaran, keterlacakan bukti, dan interaksi pada HP. Batasi perubahan pada tugas yang diminta; audit saja tidak berarti izin mengubah geometri.

## Syarat klaim akurasi

Terapkan `references/accuracy-gates.md` sebelum melaporkan akurasi atau menyatakan pekerjaan selesai. Setiap klaim harus dibatasi pada fitur, revisi model, sumber, dan metode yang diperiksa. Bila data kurang, lanjutkan pekerjaan yang dapat diverifikasi tetapi pertahankan bagian itu UNVERIFIED. Jangan menyamakan kelengkapan checklist, validitas kode, atau keberhasilan instalasi skill dengan kebenaran desain.

## Pilih modul kualitas sesuai pekerjaan

Gunakan panduan ini sebagai satu paket; baca hanya modul yang diperlukan tahap aktif. Keenam modul adalah instruksi khusus Orang Mesin, bukan pernyataan bahwa paket pihak ketiga atau aplikasi 3D sudah dipasang. Pastikan versi/API alat dari proyek atau dokumentasi resmi sebelum menulis kode yang bergantung versi.

| Pekerjaan | Panduan wajib | Bukti keluaran |
|---|---|---|
| Bentuk casing, flange, lubang, fastener | `references/hard-surface.md` | Dimensi, topology, dan close-up |
| Mencocokkan foto/manual/frame YouTube | `references/multiview-reference.md` | Landmark, sudut, konflik, dan ketidakpastian |
| Material, tekstur, pencahayaan | `references/material-lighting.md` | Swatch dan render dengan kondisi tercatat |
| Assembly, gerakan, bongkar-pasang | `references/assembly-animation.md` | Pivot, transform, state, dan cek lintasan |
| Workspace belajar di HP | `references/learning-interaction.md` | Alur sentuh dan hasil cek tugas belajar |
| Optimasi/ekspor dan regresi visual | `references/performance-visual-qa.md` | Baseline dan perbandingan sebelum–sesudah |

Urutkan perbaikan: kesesuaian varian/unit → proporsi/siluet/antarmuka → detail yang terbukti → material/pencahayaan → interaksi/animasi → optimasi dan regresi. Rencanakan batas performa sejak awal dan ukur secara bertahap. Jangan menunda pemeriksaan sampai model selesai.

Tentukan kriteria penerimaan per tugas dan bukti yang tersedia. Untuk setiap perubahan visual/geometri, simpan serta lihat render sebelum–sesudah dengan kamera, pose, viewport, exposure, dan pencahayaan yang sama; untuk perubahan pencahayaan, catat variabel yang sengaja berubah. Tinjau model dalam material netral selain render presentasi. Jika baseline tidak dapat dibuat, nyatakan perbandingan belum tersedia dan jangan mengarang bukti lama.

## Memori proyek lintas sesi

Baca `references/session-memory.md` saat memulai, melanjutkan, atau menutup pekerjaan proyek. Gunakan catatan proyek yang sudah ada; jika belum ada dan repo tujuan tersedia, buat indeks ringkas docs/PROJECT_MEMORY.md beserta catatan keputusan/pelajaran yang diperlukan. Baca AGENTS.md lebih dahulu. Verifikasi ingatan terhadap sumber, varian, revisi model, dan kondisi file terbaru sebelum menggunakannya sebagai fakta.

Simpan keputusan, bukti, kesalahan yang berhasil diperbaiki, pemeriksaan pencegah pengulangan, revisi terbuka, dan langkah berikutnya setelah pekerjaan bermakna. Jangan menganggap catatan lama sebagai bukti bahwa pemeriksaan baru sudah dilakukan. Pembaruan memori proyek tidak melatih ulang model, tidak menjamin ingatan lintas semua percakapan, dan tidak memberi akses otomatis ke repo lokal atau dot.

## 1. Tetapkan konteks dan kemampuan

- Baca AGENTS.md serta panduan audit/build proyek sebelum mengedit. Pertahankan perubahan pengguna dan larangan khusus folder/branch. Jangan menerapkan aturan repo lama pada repo lain tanpa bukti.
- Temukan sumber model, aset hasil ekspor, teknologi, perintah build/test, dan referensi yang sudah tersedia. Catat model mesin, varian, serial range jika relevan, dan revisi dokumen. Jangan menyamakan mesin dengan nama keluarga serupa.
- Periksa alat yang benar-benar tersedia untuk membaca PDF, melihat gambar/frame, mengukur mesh/CAD, menjalankan renderer, dan melihat aplikasi. Pilih alat yang cocok dengan proyek; jangan memigrasikan stack ke CadQuery/Blender hanya karena skill ini digunakan.
- Jika kemampuan kurang, lanjutkan pemeriksaan yang bisa dikerjakan; jelaskan bagian yang terhalang. Jangan mengaku menonton video, membaca halaman, mengukur geometri, atau menguji HP jika belum dilakukan.
- Gunakan referensi rules di `references/AGENTS.rules.md` saat pengguna meminta rules proyek. Salin bagian relevan ke AGENTS.md hanya di repo tujuan yang diketahui, gabungkan dengan aturan yang ada, dan jangan menimpanya. Jika repo tujuan belum diketahui, sediakan teks siap ditempel, bukan mengaku rules telah aktif di repo pengguna.

## 2. Susun bukti sebelum membentuk geometri

- Buat register sumber dengan ID, judul, pembuat, model/varian, revisi, lokasi file/URL, halaman cetak dan indeks PDF bila berbeda, figure/table atau timestamp, dan batas bukti.
- Pilih sumber sesuai klaim: gambar teknik berdimensi untuk ukuran, parts catalog untuk identitas/jumlah komponen, manual untuk prosedur dan mekanisme. Gunakan foto/video mesin yang cocok untuk bentuk nyata, rute pipa, sambungan, posisi, dan urutan bongkar-pasang yang terlihat.
- Periksa halaman PDF secara visual pada angka/diagram penting. Verifikasi OCR, simbol diameter/radius, desimal, satuan, dan leader line; jangan menganggap teks hasil ekstraksi sudah benar.
- Jika sumber bertentangan, catat konflik dan cari perbedaan varian/revisi/sudut pandang. Jangan merata-ratakan nilai atau diam-diam memilih yang cocok dengan model.
- Buat daftar komponen: ID stabil, part number, nama, jumlah, material jika disebut, sumber, objek/node model, dan status bukti. Periksa apakah kuantitas berlaku per subassembly atau seluruh mesin; bedakan kit, alternatif, dan serial-specific parts.
- Buat tabel dimensi: fitur, nilai/satuan sumber, datum, nilai model, cara ukur, selisih, toleransi beserta sumber, dan status. Jangan mengarang toleransi manufaktur. Tanpa toleransi, laporkan selisih numerik dan pisahkan kecocokan nominal dari penerimaan teknis.
- Labeli bukti `DOCUMENTED`, `OBSERVED`, `ESTIMATED`, atau `UNKNOWN`. Estimasi harus memuat metode dan ketidakpastian; jangan menaikkannya menjadi fakta hanya karena render terlihat meyakinkan.

## 3. Gunakan referensi video secara jujur

- Saat ada YouTube atau video lain, baca `references/video-evidence.md`. Catat URL, judul/channel bila terverifikasi, timestamp/rentang, varian mesin, serta fitur yang benar-benar diamati.
- Pisahkan bukti frame dari ucapan narator, subtitle, deskripsi, dan thumbnail. Transkrip saja tidak membuktikan bentuk, jumlah baut tersembunyi, ukuran, atau arah gerak.
- Gunakan frame beberapa sudut untuk menambah observasi. Perspektif, distorsi lensa, occlusion, potongan edit, dan modifikasi unit membatasi kesimpulan.
- Jangan menjadikan video bukti ukuran absolut tanpa skala terverifikasi pada bidang yang relevan. Jangan menyalin detail varian lain sebagai fakta.
- Jika video tidak dapat diakses, gunakan sumber lain untuk pekerjaan independen dan minta hanya cuplikan/timestamp yang diperlukan. Tandai bukti visual video UNVERIFIED; jangan membuat klaim menonton seluruh video.

## 4. Bangun atau perbaiki model yang dapat diaudit

- Tetapkan satuan, skala, sumbu, origin, datum, koordinat lokal/world, serta pose terpasang. Bedakan diameter/radius, radial/diametral clearance, panjang keseluruhan/panjang kerja, dan ukuran nominal/aktual.
- Parameterkan dimensi yang diketahui. Gunakan nama/node ID stabil dan pemetaan ke part number. Pertahankan tiap komponen yang perlu dipilih, dijelaskan, atau dibongkar secara terpisah.
- Modelkan envelope, datum, dan antarmuka terlebih dahulu; lanjutkan komponen utama, internal, pipa, fastener, seal, bearing, fillet/chamfer sesuai bukti. Jangan mengisi detail yang tak diketahui dengan bentuk spekulatif tanpa label.
- Pertahankan assembly hierarchy dan transform terpasang. Simpan exploded offset terpisah. Exploded view manual biasanya skematis; jangan menggunakannya sebagai skala atau jarak assembly.
- Gunakan model master detail sebagai acuan dan buat aset display/LOD secara terpisah jika dibutuhkan. Catat penyederhanaan seperti ulir visual atau detail yang disembunyikan; pertahankan fitur yang dibutuhkan pembelajaran.
- Jangan menganggap bahan dari warna/tekstur. Pisahkan material teknis terdokumentasi dari material rendering.

## 5. Audit numerik dan visual

- Ukur geometri sumber dan hasil ekspor sesuai format yang tersedia; periksa unit/transform setelah ekspor dan reimport. Catat metode dan keterbatasan ketelitian mesh. Jangan mengklaim presisi CAD dari mesh kasar atau screenshot.
- Periksa dimensi penting, jumlah/posisi lubang dan baut, pusat poros, sambungan, orientasi, clearance, benturan, komponen hilang/duplikat, dan body terputus. Bedakan kontak wajar dari penetrasi tidak semestinya. Bounding box saja tidak membuktikan bentuk atau clearance internal.
- Render dan lihat tampak depan, belakang, kiri, kanan, atas, bawah bila relevan, isometrik, potongan, exploded view, dan close-up sambungan. Bandingkan datum, pose, dan kamera dengan referensi; jangan memberi skor persentase kemiripan tanpa metode terdefinisi.
- Periksa normals, clipping, z-fighting, lubang mesh, pemetaan label, hierarchy, pivot, arah rotasi, posisi cutaway, dan reset assembly. Jangan mengklaim validasi visual jika renderer hanya sukses tanpa gambar dilihat.
- Untuk mekanisme, jelaskan asumsi dan ukur keadaan yang diperiksa. Animasi yang bergerak bukan bukti fungsi fisik; sampling beberapa pose bukan bukti bebas benturan sepanjang lintasan.
- Setelah perbaikan, ulangi pemeriksaan yang terdampak, ekspor, dan render yang relevan. Jalankan test/build proyek yang wajib dan tes perilaku penting, tanpa tes kosmetik yang sekadar meniru implementasi.

## 6. Pertahankan pengalaman belajar pada HP

- Untuk workspace interaktif, periksa sentuhan orbit/zoom/pan, seleksi komponen kecil, label terbaca, isolate/show all, explode/reset, cutaway, dan informasi komponen sesuai fitur yang ada/diminta.
- Optimalkan instancing, LOD, texture size, draw calls, dan loading sesuai pengukuran. Jangan menghapus komponen penting tanpa pencatatan. Pertahankan ID dan penjelasan part pada setiap LOD.
- Catat perangkat/browser/viewport, aset, waktu muat, dan performa yang benar-benar diukur. Pisahkan emulasi viewport dari pengujian perangkat HP nyata. Jangan menjanjikan FPS tanpa pengujian.
- Pisahkan akurasi geometri, fidelitas visual, interaksi, kinerja, dan kelengkapan materi. Nilai bagus di satu kategori tidak meluluskan kategori lain.

## 7. Catat revisi dan siapkan pemantauan

Jika ada temuan atau permintaan pengingat, baca `references/revision-tracking.md`. Pertahankan status pekerjaan terpisah dari hasil audit. Tutup revisi hanya setelah bukti audit ulang yang relevan lulus. Catat aturan/modul yang mendasari temuan, kebutuhan bukti, dan revisi model yang diperiksa.

Skill adalah instruksi saat agent berjalan; ia tidak otomatis berjalan di latar belakang atau memberi akses ke file Codex lokal/dot. Untuk permintaan notifikasi, gunakan kemampuan penjadwalan yang benar-benar tersedia dan verifikasi sumber audit yang dapat diakses. Bila repo/file tujuan atau tujuan notifikasi belum diketahui, selesaikan tracker/rules yang dapat dibuat lalu minta informasi spesifik yang hilang. Jangan mengaktifkan pemantauan pada repo lama berdasarkan dugaan atau menyebut notifikasi aktif sebelum layanan mengonfirmasi.

## 8. Laporkan hasil yang dapat ditelusuri

Gunakan `references/audit-format.md` untuk format bukti dan laporan. Ikuti lokasi/penomoran temuan proyek yang sudah ada. Jika belum ada, gunakan docs/audit/ dengan sumber, tabel komponen/dimensi, temuan, dan daftar pemeriksaan.

- PASS: persyaratan tertentu diperiksa dengan bukti memadai dan memenuhi kriteria yang dinyatakan.
- FAIL: bukti menunjukkan ketidaksesuaian terhadap persyaratan yang jelas.
- UNVERIFIED: bukti, akses, ukuran, atau pengujian belum memadai. Kekurangan bukti sendiri bukan bukti bentuk salah.
- N/A: pemeriksaan tidak berlaku dengan alasan tercatat; jangan menggunakannya untuk menutupi data hilang.
- Agregasi scope wajib: ada FAIL → FAIL; tanpa FAIL tetapi ada UNVERIFIED → UNVERIFIED; PASS hanya bila semua pemeriksaan yang berlaku lulus. Tampilkan cakupan agar sampel komponen tidak dianggap seluruh mesin.
- Tiap temuan berisi ID, objek/part, klaim, sumber halaman/timestamp, kondisi dan ukuran model, bukti gambar bila tersedia, dampak pembelajaran, tindakan, dan hasil audit ulang.
- Akhiri dengan perubahan yang benar-benar dibuat, hasil pemeriksaan, batas bukti, dan kebutuhan paling spesifik yang masih tersisa. Jangan menyebut model identik, 100% akurat, siap manufaktur, atau diuji bila tidak ada bukti yang mendukung.

## Transfer ke lingkungan Codex lain

Jika pengguna meminta file skill untuk lingkungan lain, gunakan salinan mandiri `assets/portable-SKILL.md`; seluruh modul sudah disertakan. Salinan itu merupakan ekspor untuk dibaca dan dipasang di proyek tujuan, bukan bukti bahwa pemasangan di lingkungan tujuan telah dilakukan. Bila isi panduan berubah, perbarui ekspor dan periksa frontmatter serta tautan internal sebelum mengirimkannya.

