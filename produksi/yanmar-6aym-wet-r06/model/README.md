# Model dan data Yanmar R06

Folder ini hanya menyimpan aset model dan data:

- `assets/exterior.glb`, `assets/internal.glb`: mesh review.
- `assets/data.json`: inventaris, metadata rakitan, parameter mekanis dan bukti sumber.
- `assets/daftar-yanmar.json`: data katalog bagian, dengan batas kecocokan varian yang dicatat.
- `masters/exterior.blend`, `masters/internal.blend`: master yang dapat diedit.
- `manifest.json`: identitas, unit, lokasi aset dan checksum model.

HTML/CSS/panel berada di [UI](../ui-workspace/README.md). Kode pemuat/render, gerak, efek dan audio berada di [runtime](../runtime/README.md). Generator dan input pembuat berada di [agensi produksi](../agensi/produksi/source/README.md). Model tidak mengimpor UI dan tidak menjalankan skrip.

Pertahankan ID komponen dan satuan meter. Perubahan bentuk memerlukan revisi dan QA baru. Jangan memakai perubahan tata letak folder sebagai alasan mengganti aset review.
