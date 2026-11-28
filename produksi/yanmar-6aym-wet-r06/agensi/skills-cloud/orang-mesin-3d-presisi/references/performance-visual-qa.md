# Optimasi, ekspor, dan regresi visual

## Baseline
- Catat stack/version, format, aset, ukuran transfer, node/instance count, triangles, material/texture count, draw calls dan memory counters bila tersedia, waktu muat, waktu frame, serta perangkat/browser/viewport.
- Bedakan cold/warm load dan profil jaringan. Lakukan beberapa pengukuran pada kondisi yang sama; catat durasi dan statistik yang digunakan. Angka headless/software renderer tidak mewakili GPU HP.
- Nyatakan target performa sebagai target proyek sampai terukur. Jangan memakai batas draw call/triangle universal atau menjanjikan FPS sebelum mengetahui perangkat dan scene.

## Optimasi terarah
- Profilkan bottleneck CPU, GPU, transfer, decode, texture memory, dan event handlers sebelum perubahan. Optimalkan satu kelompok masalah lalu ukur kembali.
- Untuk baut/part berulang, pertimbangkan instancing dengan mapping instance ID → part ID, transform, label, dan selection. Geometry merging tidak boleh menghilangkan kemampuan isolate/disassembly yang dibutuhkan.
- Buat LOD dari master yang dipertahankan; lindungi siluet, lubang/port, interfaces, part IDs, dan area close-up pembelajaran. Baking menggantikan detail surface yang sesuai, bukan rongga atau geometri fungsional.
- Sesuaikan texture size/compression, mipmapping, antialiasing, device pixel ratio, shadows, transparansi, dan post-processing berdasarkan hasil ukur. Uji decoder dan fallback yang diperlukan pada viewer target.
- Pada Three.js/R3F bila dipakai: periksa resource disposal dan ownership, hindari alokasi/perubahan React state per frame yang tidak perlu, gunakan render-on-demand untuk tampilan statis bila cocok, dan jangan memutus animasi/controls. Verifikasi API pada versi proyek.
- Hindari dispose resource bersama yang masih dipakai instance/scene lain. Uji mount/unmount, pergantian mesin, dan load ulang untuk kebocoran memori.

## Pemeriksaan ekspor
- Uji reimport/viewer target untuk unit, axis, hierarchy, pivot, part IDs, animation tracks, material/color space, normals, UVs, dan extension/decoder. Ekspor sukses bukan bukti portable.
- Jalankan validator format bila tersedia, tetapi tetap periksa bentuk/semantik. File valid tidak membuktikan jumlah part atau ukuran benar.

## Before/after visual
- Bekukan kamera, pose, viewport/resolusi, exposure, pencahayaan, environment, animasi waktu, dan versi aset untuk pasangan sebelum–sesudah. Catat parameter yang sengaja berubah.
- Lihat render netral dan presentasi: tampak utama, isometrik, potongan/exploded yang relevan, close-up baut/sambungan/internal. Jangan menilai hanya thumbnail atau hanya image diff otomatis.
- Periksa siluet, hilangnya lubang/rib/fastener, bevel, shading, normal, seams, z-fighting, clipping, label, dan state reset. Catat ketidaksesuaian dengan part ID dan gambar yang benar-benar dilihat.
- Ambang image diff harus terdefinisi dan menangani antialiasing/non-determinism; jangan mengubah skor pixel menjadi persen ketepatan teknik.
- Jika ada regresi pada bentuk atau interaksi pembelajaran, perbaiki/undur perubahan yang menyebabkannya atau nyatakan FAIL. Performa meningkat tidak menghapus kegagalan fidelitas.

Keluaran: tabel sebelum–sesudah per metrik dengan kondisi uji, pasangan render yang ditinjau, perubahan ukuran aset, hasil tes perilaku, dan status terpisah geometri/visual/interaksi/performa. Tidak ada HP nyata → performa HP UNVERIFIED meskipun desktop lulus.

