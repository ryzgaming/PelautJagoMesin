# Rekonstruksi dan pemeriksaan multi-sudut

- Buat contact sheet dari sumber yang benar-benar tersedia, dengan ID, halaman atau URL/timestamp, varian, dan jenis tampak. Gunakan aturan video-evidence.md untuk frame YouTube.
- Pisahkan tampak orthographic, perspective, section, dan exploded. Catat gambar mirrored, lens distortion, bagian tertutup, unit termodifikasi, dan skala yang tidak diketahui.
- Pilih landmark: pusat poros, bidang flange, sumbu port, batas casing, kaki/dudukan, dan bolt circle. Buat pemetaan landmark sumber ke node/koordinat model.
- Selaraskan datum dan orientasi model sebelum membandingkan. Untuk foto, cocokkan kamera secara masuk akal; jangan mengubah geometri terukur hanya agar sesuai perspektif kamera yang salah.
- Untuk proyeksi berskala tepercaya, bandingkan ukuran yang tersedia. Untuk foto perspektif, gunakan observasi bentuk dan rasio yang dapat dipertanggungjawabkan, dengan ketidakpastian; jangan mengambil ketebalan/depth tersembunyi dari satu tampak.
- Periksa siluet dari beberapa sudut sebelum detail kecil. Jika dua tampak bertentangan, cari varian, pose, waktu, atau kamera berbeda; jangan merata-ratakan bentuk.
- Gunakan overlay hanya setelah alignment/camera diketahui. Bedakan mismatch geometri dari lighting, pose, dan occlusion. Skor pixel tidak otomatis menjadi skor akurasi teknik.
- Pertahankan tabel fitur: terlihat/tidak terlihat, sumber, observasi, inferensi, keyakinan, dan pemeriksaan yang diperlukan. Jangan menaikkan keyakinan tanpa bukti baru.
- Jika hanya satu sisi terlihat, pertahankan sisi lain UNVERIFIED. Symmetry boleh dipakai sebagai asumsi eksplisit pada draft, bukan fakta hasil audit.
- Setelah perubahan, bandingkan ulang semua tampak terdampak dan dimensi yang menjadi kendala. Simpan pasangan render sebelum–sesudah pada kamera/pose yang sama, plus close-up fitur terkait.

Keluaran minimum: daftar sumber/landmark, pasangan tampak yang telah dilihat, konflik tersisa, perubahan nyata, serta bagian model yang belum dapat dipastikan. Jangan menyebut persentase kemiripan tanpa definisi metrik dan cakupan.

