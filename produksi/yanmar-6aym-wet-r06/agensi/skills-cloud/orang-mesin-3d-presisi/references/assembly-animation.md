# Assembly dan animasi mekanisme

- Buat assembly tree, part ID, parent, transform terpasang, origin/pivot, axis lokal/world, joint type, limits, serta sumber yang mendukungnya. Bedakan engineering assembly dari pengelompokan untuk rendering.
- Simpan pose terpasang sebagai baseline tetap. Hitung exploded offset dan gerak dari baseline; jangan menambah offset ke posisi hasil frame sebelumnya yang menyebabkan drift.
- Pertahankan pivot poros pada pusat dan sumbu mekanis yang benar. Verifikasi rotasi lokal/world serta parent transform pada model sumber dan ekspor.
- Modelkan hubungan gerak berdasarkan bukti: rasio gear, phase crank, translasi piston, dan valve timing hanya jika tersedia. Parameter demonstrasi yang diasumsikan harus diberi label.
- Pisahkan animasi pembelajaran, simulasi kinematik, dan simulasi fisik. Panah aliran atau part bergerak tidak membuktikan debit, tekanan, temperatur, CFD, gaya, atau ketahanan.
- Buat state yang jelas: assembled, exploded, isolated, cutaway, dan animating sesuai fitur. Tentukan kombinasi yang diperbolehkan serta transisi/reset yang tidak meninggalkan part pada posisi salah.
- Untuk prosedur bongkar-pasang, buat dependency langkah dan tunjukkan fastener/jalur akses yang relevan dari manual. Jangan menganggap exploded direction adalah lintasan pelepasan nyata.
- Periksa benturan pada pose dan lintasan yang diuji; gunakan ukuran clearance geometri bila tersedia. Catat sampling, metode, dan keterbatasan. Jangan menyebut bebas benturan kontinu dari beberapa frame.
- Uji play/pause, scrubbing, kecepatan, reset, pengulangan explode/reset, isolate selama state lain, reload aset, dan frame rate berbeda. Gunakan delta-time/clock sesuai engine, bukan gerak yang bergantung jumlah frame.
- Tampilkan label fase/komponen yang membantu pemahaman. Sediakan pause dan pengurangan gerak; jangan menggerakkan kamera tanpa kontrol pengguna.

Keluaran: tabel joint/transform, daftar state/transisi, sumber mekanisme, cek pose/lintasan, hasil reset berulang, dan perbedaan demonstrasi versus validasi fisik.

