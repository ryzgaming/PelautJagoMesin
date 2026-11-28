# Brief: qa-independen

**Status: rekonstruksi instruksi tugas untuk pemakaian ulang.** Berkas ini bukan transkrip mentah, bukan bukti bahwa profil tertentu benar-benar dimuat, dan bukan prompt lengkap agen lama.

Peran tercatat pada rangkaian R06: `qa`. Peran QA independen tercatat; profil terdekat qa_visual_viewer.

## Masukan wajib

Baca `agensi/PANDUAN-PRODUKSI.md`, manifest model, kontrak runtime, sumber per sistem, datum, inventaris, catatan revisi dan temuan QA terakhir. Koordinator memberi root proyek, revisi, path yang boleh diubah, serta acceptance criteria sebelum tugas dimulai. Gunakan profil asli yang relevan sebagai konteks; sesuaikan path repository lama ke susunan paket baru secara eksplisit.

## Tugas

Periksa hasil akhir pembuat dari ekspor yang akan dikirim. Impor ulang kedua GLB, ukur bounds/dimensi, tinjau enam sudut, subrakitan dan sumber. Uji gerak sepanjang siklus dan tiap keadaan, jalur fluida, benturan serta fungsi UI desktop/viewport HP. Bedakan emulasi dari perangkat fisik dan frame capture dari video. Simpan bukti, hash, kegagalan, gap dan keputusan independen; jangan memperbaiki model diam-diam lalu menilai karya sendiri.

## Hasil wajib

- Daftar file berubah, SHA-256 artefak hasil dan revisi yang diperiksa.
- Sumber yang mendukung tiap keputusan penting; label estimasi atau ilustrasi secara nyata.
- Tes/probe yang benar-benar dijalankan, command, hasil, render/screenshot yang benar-benar dilihat.
- Temuan terbuka dan batas yang belum diuji. Serahkan kepada QA yang berbeda dari pembuat.

Jangan menulis file milik agen lain tanpa koordinasi. Tidak boleh memindahkan data mekanis ke UI, mengubah arsip sumber, mengklaim PASS tanpa bukti, atau memasukkan model ke katalog.
