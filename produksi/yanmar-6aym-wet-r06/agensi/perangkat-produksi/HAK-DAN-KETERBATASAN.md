# Hak, ketergantungan dan batas arsip

Salinan ini disiapkan untuk pemilik proyek. Pencantuman dalam paket tidak memberikan lisensi baru untuk menjual atau menerbitkan ulang semua materi sumber.

- Three.js r128 disertakan untuk menjalankan tes efek; lisensi MIT aslinya ada di `repo-snapshot/dist/assets/THREE-LICENSE.txt`. Header pustaka dipertahankan.
- Blender 4.3.2 digunakan sebagai alat eksternal; binari Blender tidak disertakan. Blender memiliki ketentuan lisensinya sendiri (GPL). Karya ekspor harus dinilai terpisah dari lisensi aplikasi.
- Python, Node.js, Chromium, FFmpeg, Playwright, NumPy dan Pillow dicatat dalam `LINGKUNGAN.json`; paket ini tidak menyertakan binari/runtime tersebut. Dependensi yang tidak ditemukan tidak dinyatakan telah dipasang.
- `mcp-for-blender`/`uvx` disebut dalam konfigurasi asli sebagai integrasi opsional. Servernya tidak disalin, dipasang atau dijalankan oleh proses pengemasan ini. Jangan mengeksekusi installer jarak jauh hanya untuk membuka model yang sudah diekspor.
- Prompt, profil agen dan sumber proyek disalin dengan header aslinya. Tidak ditemukan lisensi keseluruhan yang memberi hak publik baru atas materi privat proyek; tanyakan pemilik sebelum distribusi di luar cakupan hak yang dimiliki.
- Toolkit asli dan adaptasi GPT memuat contoh Caterpillar 3512C serta skrip historis. NOTICE asli dipertahankan. Geometri, ukuran, hash dan PASS dalam contoh itu bukan bukti Yanmar dan bukan validator generik.
- Dokumen/foto/video Yanmar atau sumber pihak ketiga mengikuti catatan hak dan URL asal di folder referensi. Merek Yanmar, Caterpillar dan nama produk digunakan sebagai identifikasi sumber.

Tidak ada kredensial, `.git`, `.env`, profil browser, `node_modules` atau cache Python yang sengaja dikumpulkan. `.codex/config.toml` adalah konfigurasi proyek yang tidak mengandung kredensial pada pemeriksaan pengemasan; disalin tanpa perubahan. Placeholder token dalam tes sintetis adalah fixture, bukan rahasia akun. Manifest menjelaskan salinan asli dan dokumen baru secara terpisah.
