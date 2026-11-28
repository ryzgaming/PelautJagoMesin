# Brief: koordinator

**Status: rekonstruksi instruksi tugas untuk pemakaian ulang.** Berkas ini bukan transkrip mentah, bukan bukti bahwa profil tertentu benar-benar dimuat, dan bukan prompt lengkap agen lama.

Peran tercatat pada rangkaian R06: `koordinator`. Peran koordinasi terlihat dalam rangkaian tugas; tidak tersedia profil TOML koordinator khusus.

## Masukan wajib

Baca `agensi/PANDUAN-PRODUKSI.md`, manifest model, kontrak runtime, sumber per sistem, datum, inventaris, catatan revisi dan temuan QA terakhir. Koordinator memberi root proyek, revisi, path yang boleh diubah, serta acceptance criteria sebelum tugas dimulai. Gunakan profil asli yang relevan sebagai konteks; sesuaikan path repository lama ke susunan paket baru secara eksplisit.

## Tugas

Buat rencana order, datum bersama, pembagian tugas nyata dan daftar ID stabil. Tetapkan pemilik file; gabungkan hasil hanya setelah pemeriksaan sumber dan kontrak. Catat agent ID, revisi, tugas, bukti dan temuan. Jangan mengubah gap menjadi PASS atau memasukkan katalog tanpa keputusan pemilik.

## Hasil wajib

- Daftar file berubah, SHA-256 artefak hasil dan revisi yang diperiksa.
- Sumber yang mendukung tiap keputusan penting; label estimasi atau ilustrasi secara nyata.
- Tes/probe yang benar-benar dijalankan, command, hasil, render/screenshot yang benar-benar dilihat.
- Temuan terbuka dan batas yang belum diuji. Serahkan kepada QA yang berbeda dari pembuat.

Jangan menulis file milik agen lain tanpa koordinasi. Tidak boleh memindahkan data mekanis ke UI, mengubah arsip sumber, mengklaim PASS tanpa bukti, atau memasukkan model ke katalog.
