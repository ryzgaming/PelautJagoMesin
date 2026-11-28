# Agen produksi

`profil-asli` berisi 15 profil TOML utuh dari commit `a9d6e277a729ee77352e551ac6049a4e69d1ca4f` repository produksi. Duplikatnya ada di `.codex/agents` snapshot agar susunan proyek asal tetap terbaca. Tidak ada profil yang dipasang ke konfigurasi global pengguna.

`PERAN-R06.json` memetakan peran yang tercatat pada pengerjaan R06 dengan profil yang dapat dipakai ulang. Kecocokan profil menunjukkan spesialisasi terdekat, bukan bukti bahwa file profil itu persis dipakai saat agen lama dimulai. `brief-dapat-dipakai-ulang` adalah **rekonstruksi instruksi tugas**, bukan transkrip mentah atau salinan prompt percakapan lengkap.

Untuk memakai paket ini, koordinator harus benar-benar menjalankan agen sesuai kemampuan layanan yang tersedia, memberikan jalur file yang baru, membatasi kepemilikan file, dan menyimpan bukti tugas serta hasilnya. Memiliki banyak file agen tanpa eksekusi atau tanpa QA independen tidak menaikkan mutu model.

Lihat [panduan produksi](../PANDUAN-PRODUKSI.md) untuk pembagian model/UI/agensi. Panduan terbaru mengatur lokasi paket baru; aturan dan profil asli tetap diarsipkan utuh meskipun menyebut path repository lama.
