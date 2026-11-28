# Material PBR dan pencahayaan

## Material
- Pisahkan spesifikasi bahan teknik dari appearance. Kuning pada foto tidak membuktikan kuningan; cat menutupi substrate; metadata material teknik memerlukan sumber.
- Buat kelompok tampilan sesuai referensi: besi cor, logam machined, painted metal, karet, plastik, kaca, dan cairan bila relevan. Labeli preset artistik yang tidak terukur.
- Atur roughness, metalness, base color, dan normal sesuai model shader yang digunakan. Cat/karet adalah lapisan nonlogam meski substrate logam. Jangan membuat seluruh mesin metalness tinggi dan mirror-like.
- Periksa color space per jenis texture sesuai engine/exporter: data roughness/metalness/normal berbeda dari warna. Catat channel packing dan konvensi tangent normal. Jangan menebak API dari versi lain.
- Tetapkan skala tekstur terhadap unit fisik. Periksa UV stretch/seams, arah machined marks, texel density yang dibutuhkan close-up, dan baking cage tanpa artefak.
- Gunakan wear, karat, oli, dan debu hanya bila referensi/kebutuhan mendukung. Jangan menutupi lubang, sambungan, nameplate, atau geometri salah dengan grunge.
- Sertakan asal/lisensi aset texture/HDRI yang dipakai. Jangan menganggap semua aset yang dapat diunduh boleh didistribusikan.

## Pencahayaan dan pemeriksaan
- Mulai dengan pencahayaan netral yang menampakkan bentuk dan detail internal; kemudian buat preset presentasi bila dibutuhkan. Hindari highlight terbakar, shadow terlalu gelap, bloom berlebihan, dan warna dramatis yang menyamarkan part.
- Simpan kamera, environment, lights, exposure, tone mapping, color management, dan viewport untuk perbandingan berulang. Catat variabel yang sengaja diubah.
- Render swatch dan close-up pada kondisi terang/gelap yang relevan. Periksa readability label, perbedaan antarpart, dan pemisahan permukaan karet/metal/cat.
- Periksa material pada viewer target setelah ekspor GLB/glTF jika dipakai. Shader authoring tidak selalu portabel; gunakan fitur target yang didukung, bake bila tepat, dan catat perubahan.
- Ukur biaya shadow, texture, transparency, dan post-processing. Sediakan tingkat kualitas yang tetap menjaga keterbacaan di HP; jangan mengklaim warna atau material fisik akurat dari satu render.

Keluaran: daftar material appearance beserta bukti/asumsi, konfigurasi render, before/after yang dilihat, hasil viewer target, dan batas ketelitian/performa.

