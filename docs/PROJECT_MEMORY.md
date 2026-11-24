# Memori proyek PelautJagoMesin

## Keputusan aktif

- **UI-001 · 24 November 2026 · pilihan pemilik:** konsep **2 — Studio Gelap** adalah standar workspace mesin untuk seluruh mesin lama dan mesin baru lintas sesi. Spesifikasi: [WORKSPACE_UI.md](WORKSPACE_UI.md); referensi: [papan konsep, kuadran kanan atas](design/workspace-concepts.png). Dibaca melalui AGENTS.md.
- Workspace yang dimaksud adalah viewer mesin 3D, bukan halaman Alur/antrean agen.
- Pertahankan model, data komponen, serta batas akses publik/premium saat menyeragamkan UI.
- **UI-002 · 24 November 2026:** navigasi pelanggan disederhanakan menjadi Sistem dan Pengoperasian. Aturan ini menggantikan susunan tombol di mockup UI-001 dan berlaku untuk model lama serta baru.

- **UI-003 · 24 November 2026:** panel Sistem, indikator dan aksi kontekstual mendapat ruang terpisah dari model. Eksplor rakitan memakai seleksi asli simulator dan menampilkan bagian milik komponen yang diketuk.

- **UI-004 · 24 November 2026:** Eksplor keseluruhan menjadi mode awal, diikuti Sistem dan Pengoperasian. Ini menggantikan UI-002. Dalam Eksplor rakitan, pelanggan dapat mengurai/merapatkan komponen dan memilih nomor penunjuk yang cocok dengan daftar bagian mesin.

## Penerapan Studio Gelap · 24 November 2026

Shinko memuat `dist/assets/studio.css`, `assembly-diagram.js`, dan `studio.js` langsung. Untuk MAN L23/30H Mk3, Tanabe H-74, dan Alfa Laval MAB 206S-24, `dist/assets/workspace.js` menyertakan ketiga aset di dokumen simulator setelah respons akses berhasil. Viewer PelautSim baru dapat memakai jalur yang sama. Saat mengemas viewer mandiri, sertakan CSS, lalu muat assembly-diagram.js dan studio.js sesudah UI PelautSim siap. Untuk runtime lain, ikuti kontrak interaksi di [standar workspace](WORKSPACE_UI.md).

Untuk validasi UI-002, buka kedua mode, periksa isi panel, gunakan Stop pada simulasi, lalu tutup panel. Pada versi UI-002 pemeriksaan mencakup dua tombol mode pada desktop, HP portrait, dan landscape. Tiga viewer premium dapat diuji di iframe sandbox dengan respons akses lokal yang memuat salinan simulator dari branch main. Pengujian ini terpisah dari login akun premium produksi.

Perbandingan Shinko sebelum dan sesudah penyederhanaan menu tersedia untuk [desktop](design/studio-shinko-desktop.webp) dan [HP](design/studio-shinko-hp.webp).

Untuk UI-003, Chromium menguji ketuk mesh, pilihan rakitan, daftar bagian yang sesuai, isolasi dan kembali pada keempat mesin di 1280×800, 390×844, dan 844×390. Batas panel dan canvas diperiksa pada Sistem dan saat eksplorasi. Pada Shinko, satu baris bagian juga diuji hingga terpilih. [Perbandingan HP — Sistem sebelumnya, Sistem sekarang, dan eksplorasi rakitan](design/sistem-rakitan-hp.webp).

Untuk UI-004, [contoh rumah pompa Shinko](design/eksplor-rakitan.webp) memperlihatkan penunjuk pada mesh asli. Nomor penunjuk mengacu ke baris daftar rakitan. Nomor katalog ditampilkan terpisah. Saat pelanggan merapatkan rakitan atau meninggalkan mode detail, viewer memulihkan posisi tiap mesh. Gambar referensi pengguna menjadi acuan penyajian, sedangkan geometri dan isi daftar berasal dari model mesin masing-masing.

**UI-005 · 24 November 2026.** Pemilik menyetujui Eksplor rakitan sebagai acuan mesin lama dan baru. Pada Eksplor keseluruhan, pengujian Chromium menemukan tepi MAN L23/30H Mk3 terpotong pada 390×844 dan sorotan komponen masih aktif setelah pelanggan memilih kembali mode keseluruhan. Perbaikan menyetel kamera dari batas mesh mesin dan membersihkan pilihan melalui engine. Untuk uji ulang, proyeksikan vertex ke viewport saat awal dan setelah keluar dari rakitan, periksa sorotan dan tombol kontekstual, lalu periksa bahwa Kembali tetap memulihkan pilihan.

**UI-006 · 24 November 2026.** Tampilan awal kini mengikuti gambar pompa dari pemilik. Eksplor keseluruhan memisahkan rakitan utama sesuai pengelompokan mesin dan membingkai semuanya, termasuk pada HP tegak. Pada Shinko, kopling tetap segaris dengan poros. Lihat [contoh tampilan Shinko](design/eksplor-keseluruhan.webp). X-ray menjadi menu keempat setelah Pengoperasian dan menggunakan rumah tembus pandang pada posisi terpasang. Cek ketuk rumah pompa pada tampilan terurai, buka Eksplor rakitan, lalu pilih Kembali. Ulangi dari X-ray dan pastikan transparansi serta posisi awal pulih. Jarak pisah merupakan ilustrasi untuk belajar.

Chromium memeriksa posisi mesh, batas kanvas, empat tombol, pemulihan posisi dan transparansi saat pindah mode, serta Kembali dari rakitan pada Shinko, MAN, Tanabe dan Alfa Laval di 1280×800, 390×844 dan 844×390. Pengujian premium memakai respons akses lokal berisi salinan simulator. Pada Shinko, klik langsung rumah pompa di canvas juga diuji pada desktop dan HP tegak.

**UI-007 · 24 November 2026.** Workspace dimulai dengan mesin terpasang. Tampilan terurai pada gambar HP pemilik muncul saat pelanggan mengetuk Eksplor keseluruhan. Kembali dari detail rakitan memulihkan posisi yang terlihat sebelum detail dibuka. [Shinko di Chromium pada viewport HP, sebelum dan sesudah diketuk](design/eksplor-keseluruhan-ketuk.webp).

**UI-008 · 24 November 2026.** Gunakan tombol X-ray asli PelautSim di posisi keempat. Transparansi dapat dinyalakan atau dimatikan saat melihat mesin terpasang, mesin terurai, sistem, pengoperasian, dan detail rakitan. Pilihan tetap berlaku saat pengguna berpindah tampilan. [Shinko pada HP, X-ray mati dan menyala dalam Eksplor keseluruhan](design/xray-eksplor.webp).

**UI-009 · 24 November 2026.** Penggeser Jarak urai menggunakan posisi rakitan utama dari model. Saat baru dibuka nilainya 50%, lalu mengikuti pilihan pengguna hingga workspace ditutup. Tampilan awal, Sistem dan Pengoperasian memperlihatkan mesin terpasang. Pada Eksplor keseluruhan, cat dan logam terlihat berwarna.

Acuan cat adalah tampilan produk per seri. Warna layar merupakan perkiraan visual dan dapat berbeda menurut pencahayaan atau pengecatan unit di kapal.

- Shinko GJ memakai hijau laut muda pada rumah pompa, rumah bearing, pelindung kopling, motor bawaan dan dudukan. [Katalog GJ, halaman 23](https://www.shinkohir.co.jp/pdf/catalog2026/Centrifugal_Pumps_GJ.pdf)
- MAN L23/30H Mk. 3 memakai hijau pada permukaan blok bercat. [Lembar produk GenSet, halaman 1](https://www.man-es.com/docs/default-source/document-sync-archive/man-l23-30h-mk-3genset-eng.pdf)
- Tanabe H-74 mempertahankan hijau muda dan tutup gelap dari palet seri H. [Foto produk seri H](https://www.tanacomp.co.jp/en/product/detail/id/c3-6)
- Alfa Laval memakai biru pada rangka dan putih gading pada collecting cover. [Lembar produk MAB 206, halaman 1](https://assets.alfalaval.com/documents/p24bbda1b/alfa-laval-product-leaflet-mab-206-separator-product-leaflets-en-gb.pdf)

Chromium menguji keempat mesin pada viewport desktop, HP tegak dan HP mendatar, termasuk 0%, 25%, 50%, 73%, 100%, X-ray, serta kembali dari detail rakitan. Mesin premium diuji dengan salinan simulator pada respons akses lokal. [Contoh Shinko pada 50%](design/jarak-urai-shinko.webp)

**UI-010 · 24 November 2026.** Pemeriksaan berdampingan menemukan dek dan genset tetangga pada MAN serta ruang dan tangki udara pada Tanabe masih terlihat di eksplor. Instalasi udara Tanabe sekarang tampil di Sistem. Dokumen premium memakai pustaka 3D dan tema lokal Shinko, termasuk ketika dokumen MAN membawa lapisan tampilan admin V4. Uji regresi memeriksa respons pelanggan dan admin. Untuk pengujian browser, gunakan simulator privat di iframe sandbox dan periksa juga dengan CDN 3D diblokir. [Perbandingan Eksplor keseluruhan pada empat mesin](design/workspace-empat-mesin.webp)
