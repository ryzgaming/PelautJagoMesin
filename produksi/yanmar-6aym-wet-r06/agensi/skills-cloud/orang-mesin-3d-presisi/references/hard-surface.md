# Hard-surface untuk mesin kapal

## Persiapan dan konstruksi
- Identifikasi stack yang sudah dipakai: CAD parametrik, Blender, atau mesh prosedural web. Pertahankan sumber yang dapat diedit. Jangan mengganti stack hanya untuk mengikuti contoh alat.
- Bekukan identitas varian, unit, origin, datum, dan dimensi envelope yang diketahui. Buat baseline render netral serta tabel fitur yang perlu ditingkatkan sebelum perubahan.
- Pecah bentuk menjadi fitur mekanis: casting utama, bidang mesin, flange, boss, rib, lubang, slot, fillet/chamfer, port, dan fastener. Kaitkan tiap fitur dengan sumber dan part ID; primitives boleh menjadi awal, bukan bukti bentuk akhir akurat.
- Bentuk siluet dan antarmuka terlebih dahulu. Gunakan revolve/extrude/sweep/boolean/array sesuai bentuk dan alat; jangan memaksakan satu metode untuk seluruh benda.
- Pertahankan diameter lubang, bolt circle, jarak pusat, bidang dudukan, dan bentuk penampang saat menambah detail. Jangan mengubah antarmuka agar render terlihat lebih rapi.
- Gunakan radius bevel/fillet berdasarkan bukti. Jika hanya untuk menangkap highlight, labeli sebagai simplifikasi visual; jangan mengaku radius manufaktur terverifikasi.
- Pisahkan part yang perlu dipilih atau dibongkar. Gunakan duplikasi/instancing untuk benda yang sama dengan pemetaan ID per instance. Detail ulir boleh dibake untuk tampilan jauh; jangan menggantikan geometri ulir yang diperlukan pada pelajaran close-up tanpa alternatif.

## Topology dan shading
- Periksa transform/skala sebelum modifier atau ekspor. Jika transform dibake, pertahankan posisi world, pivot, hierarchy, dan mapping komponen melalui pemeriksaan sebelum–sesudah.
- Periksa face degenerat, face internal tak disengaja, normal terbalik, self-intersection, celah, dan vertex/part duplikat. Bedakan opening yang disengaja dari cacat mesh; jangan menutup port atau cutaway demi lolos tes watertight.
- Jangan menjadikan all-quads sebagai syarat universal untuk mesh statis. Gunakan topology yang menjaga siluet, shading, modifier, serta triangulasi ekspor. Periksa area boolean, pole, dan kurva untuk pinching.
- Periksa smooth/flat shading dan normal hasil ekspor. Normal map atau weighted normals tidak boleh menyembunyikan silhouette salah atau permukaan bocor.
- Setelah perubahan, lihat front/side/top/isometric dan close-up sambungan dalam material netral; ukur ulang fitur penting. Lihat render aset ekspor, bukan hanya sumber authoring.

## Keluaran
Catat fitur yang berubah, sumber, dimensi sebelum–sesudah, simplifikasi, tangkapan yang dilihat, dan hasil ekspor. Beri PASS hanya pada fitur yang diperiksa; material yang cantik tidak meluluskan geometri.

