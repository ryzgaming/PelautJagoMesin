# Batas kerja paket Yanmar R06

Baca README paket sebelum menyunting. Aturan pengelompokan pemilik berlaku pada folder aktif:

- `model/`: GLB, master Blender, JSON inventaris/katalog/manifest dan dokumentasi model saja. Tidak boleh menaruh HTML, CSS, JavaScript, generator Python, efek, audio, screenshot QA atau panel di sini.
- `runtime/`: API pemuatan/render 3D, mekanisme, lifecycle, efek dan audio. Boleh menerima wadah kanvas eksplisit; tidak boleh bergantung pada selector tombol/panel atau mengimpor UI.
- `ui-workspace/`: HTML/CSS, kontrol, panel dan diagram presentasi; memakai API runtime dan membaca model melalui manifest. Tidak membuat geometri, menggandakan mekanisme, menyimpan master, BOM, PDF sumber atau laporan QA.
- `agensi/produksi/`: generator/input pembuat dan alat build/audit. Master hasil yang direview ada di `model/masters`.
- `agensi/referensi/`: sumber teknik/visual; `agensi/qa/`: hasil pemeriksaan/rekaman; `agensi/agen` dan snapshot skill/toolkit: bukti pembuatnya.
- `agensi/arsip-asli` dan `agensi/arsip-paket`: sejarah. Pertahankan isi dan checksum, jangan memperbarui temuan lama seolah berasal dari revisi baru.
- `tools/` dan `tests/`: operasional paket dan verifikasi.

Untuk perubahan UI, kerjakan UI dan kontrak yang relevan; jangan mengubah aset model. Untuk perubahan mekanisme, gunakan runtime. Untuk perubahan bentuk, gunakan master/generator dengan keluaran staging baru. Catat perubahan kontrak jika membutuhkan lebih dari satu lapisan.

Sebelum dan sesudah perubahan jalankan verifier model serta pengujian yang sesuai. Dari akar repo, `npm run check:repo` juga memeriksa batas folder. `python tools/verify.py --all` memakai manifest layout terbaru dan akan menandai perubahan file apa pun; jangan mengganti baseline untuk menyembunyikan perubahan yang tidak diminta. Paket tetap draf review; keputusan katalog milik pemilik.
