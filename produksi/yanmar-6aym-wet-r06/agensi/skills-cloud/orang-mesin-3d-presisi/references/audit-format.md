# Format audit

Gunakan tabel Markdown/CSV sesuai skala proyek. Jangan mengisi contoh dengan data rekaan seolah-olah hasil mesin pengguna. Pertahankan ID/format proyek jika sudah tersedia.

## Register sumber
| Source ID | Dokumen/URL/file | Mesin/varian | Revisi | Halaman cetak/PDF atau timestamp | Jenis bukti | Cakupan dan batas akses |
|---|---|---|---|---|---|---|

## Komponen
| Part ID/number | Nama | Parent assembly | Jumlah dan basis hitung | Material sumber | Node model | Sumber spesifik | Bukti | Status |
|---|---|---|---|---|---|---|---|---|

## Dimensi
| Part/fitur | Datum/pose | Nilai sumber dan unit | Nilai model dan unit | Metode ukur | Selisih | Toleransi dan sumber | Bukti | Status |
|---|---|---|---|---|---|---|---|---|

Samakan unit sebelum menghitung selisih. Bedakan unit source/model dan jangan kehilangan nilai asli. Gunakan selisih absolut; persentase hanya bila nilai referensi bukan nol dan metrik itu bermakna. Jangan memakai toleransi numerik perhitungan sebagai toleransi desain/manufaktur. Jika hanya nominal tersedia, laporkan kecocokan nominal terpisah dari penerimaan teknis yang belum ditetapkan.

## Temuan
| ID | Part/node/fitur | Persyaratan | Bukti sumber | Kondisi model dan cara cek | Status/severitas | Dampak pembelajaran | Perbaikan | Bukti audit ulang |
|---|---|---|---|---|---|---|---|---|

Gunakan FAIL hanya dengan bukti pertentangan; catat data hilang sebagai UNVERIFIED. Catat gambar yang benar-benar dilihat dan file hasil pengukuran yang benar-benar dibuat. Jangan mengarang nomor halaman atau tautan sumber.

## Ringkasan cakupan
Catat tanggal, versi model/revisi kode, scope mesin dan komponen, alat/metode, jumlah pemeriksaan PASS/FAIL/UNVERIFIED/N/A, kategori, dan pengecualian. Jangan menghitung persentase akurasi dari jumlah tes lulus. Tulis hasil build/test yang dijalankan dan tandai yang tidak dijalankan. Bedakan validasi geometri, visual, assembly, interaksi, performa, serta pembelajaran.

