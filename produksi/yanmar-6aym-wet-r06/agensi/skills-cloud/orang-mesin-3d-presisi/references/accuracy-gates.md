# Syarat kelulusan akurasi berbasis bukti

Berlakukan untuk tiap klaim/fitur, bukan hanya satu label untuk seluruh mesin. Tidak ada skill yang menjamin akurasi absolut dari input yang tidak lengkap.

| Pemeriksaan wajib | Bukti minimum | Jika bukti kurang |
|---|---|---|
| Identitas | Mesin/varian dan revisi manual yang sesuai | Identitas UNVERIFIED; jangan memindahkan detail antarvarian sebagai fakta |
| Sumber | Lokasi halaman/figure/timestamp yang benar-benar diperiksa dan mendukung klaim | Klaim UNVERIFIED; transkrip tidak membuktikan bentuk |
| Ukuran | Unit/datum, nilai sumber dan nilai ukur model, metode serta ketelitian yang relevan | Kecocokan dimensi UNVERIFIED; jangan menebak |
| Kriteria penerimaan | Persyaratan nominal dan toleransi jika memang tersedia | Laporkan selisih nominal; penerimaan teknis di luar bukti tetap UNVERIFIED |
| Bentuk | Render sumber dan ekspor dari sudut relevan yang benar-benar dilihat | Fidelitas visual UNVERIFIED |
| Fungsi/interaksi | Pengujian perilaku yang relevan, kondisi, dan hasil | Perilaku tersebut UNVERIFIED |
| Kesegaran bukti | Bukti mengacu revisi model/aset yang sama dengan keluaran | Bukti lama tidak meluluskan perubahan baru |
| Audit ulang | Hasil perbaikan diperiksa ulang pada cek terdampak | READY_FOR_REVIEW, bukan CLOSED |

## Disiplin pengukuran
- Bedakan dimensi tertulis di manual, hasil pengukuran digital, inferensi dari foto, dan hasil ukur fisik. Jangan menukar jenis bukti.
- Pertahankan angka sumber dan unit asli, lalu normalisasi unit secara eksplisit. Periksa kesalahan radius/diameter, skala ekspor, datum, serta lokal/world transform sebelum menyalahkan bentuk.
- Cocokkan ukuran dari metadata/kode dengan geometri hasil ekspor jika klaim menyangkut aset ekspor. Nilai parameter bernama 120 belum membuktikan geometri final 120.
- Dokumentasikan resolusi/tessellation dan keterbatasan cara ukur. Jika ketidakpastian metode melebihi batas penerimaan, hasil tidak cukup untuk meluluskan fitur itu.
- Jangan menciptakan toleransi manufaktur dari epsilon numerik, tampilan layar, atau target estetika. Kriteria visual yang disepakati harus tetap terpisah dari akurasi teknik.
- Periksa konflik sumber dan angka kritis pada sumber aslinya. Dua ringkasan yang menyalin sumber salah bukan verifikasi independen.

## Menutup pekerjaan
- Tentukan scope, fitur kritis, dan seluruh pemeriksaan yang berlaku sebelum memberi ringkasan kelulusan. Jangan membuang pemeriksaan gagal dari denominator.
- Tampilkan status per kategori dan cakupan yang belum diuji. Jika ada FAIL, scope gagal; tanpa FAIL tetapi masih ada UNVERIFIED yang berlaku, scope belum terverifikasi.
- Jangan meluluskan semata karena user meminta cepat atau meminta jaminan. Tetap lakukan perbaikan yang diminta dalam scope, dan jelaskan kekurangan bukti secara spesifik tanpa menghentikan pekerjaan independen.
- Jangan mengubah status menjadi PASS lewat perubahan rules, pelonggaran toleransi, penyembunyian part, penghapusan temuan, atau screenshot dengan sudut yang menutupi cacat.
- Jangan menyebut siap manufaktur, aman dioperasikan, identik, 100% akurat, atau lolos semua perangkat dari audit visual/pembelajaran. Nyatakan hasil yang benar-benar didukung.

