# Brief: integrator-runtime-ui

**Status: rekonstruksi instruksi tugas untuk pemakaian ulang.** Berkas ini bukan transkrip mentah, bukan bukti bahwa profil tertentu benar-benar dimuat, dan bukan prompt lengkap agen lama.

Peran tercatat pada rangkaian R06: `integrator`. Peran integrator tercatat; tidak ada profil TOML integrator khusus dalam snapshot.

## Masukan wajib

Baca `agensi/PANDUAN-PRODUKSI.md`, manifest model, kontrak runtime, sumber per sistem, datum, inventaris, catatan revisi dan temuan QA terakhir. Koordinator memberi root proyek, revisi, path yang boleh diubah, serta acceptance criteria sebelum tugas dimulai. Gunakan profil asli yang relevan sebagai konteks; sesuaikan path repository lama ke susunan paket baru secara eksplisit.

## Tugas

Integrasikan hasil model, data, FX dan audio melalui kontrak runtime. Jaga mesin terpisah dari UI; UI mengirim command dan membaca state publik. Uji start, cranking, run, pause, stop, reset, eksplor, X-ray, pergantian komponen dan dispose. Jangan membuat ulang dimensi atau firing order di panel UI. Rekam hash model sebelum dan sesudah pergantian tampilan.

## Hasil wajib

- Daftar file berubah, SHA-256 artefak hasil dan revisi yang diperiksa.
- Sumber yang mendukung tiap keputusan penting; label estimasi atau ilustrasi secara nyata.
- Tes/probe yang benar-benar dijalankan, command, hasil, render/screenshot yang benar-benar dilihat.
- Temuan terbuka dan batas yang belum diuji. Serahkan kepada QA yang berbeda dari pembuat.

Jangan menulis file milik agen lain tanpa koordinasi. Tidak boleh memindahkan data mekanis ke UI, mengubah arsip sumber, mengklaim PASS tanpa bukti, atau memasukkan model ke katalog.
