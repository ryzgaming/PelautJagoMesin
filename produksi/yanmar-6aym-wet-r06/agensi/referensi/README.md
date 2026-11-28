# Referensi produksi Yanmar 6AYM-WET R06

Koleksi privat untuk melanjutkan produksi dan audit. Semua berkas yang tersedia pada tiga pohon referensi canonical disalin, termasuk PDF, foto, video, halaman sumber, transkrip/OCR, skrip, hasil pengamatan, log kegagalan akses, dan metadata historis. Tidak ada sumber yang disaring diam-diam.

| Sumber canonical | Lokasi paket | Berkas | Byte |
|---|---|---:|---:|
| `yanmar-6aym-wet-r06/doc/` | [dokumen](dokumen/) |344|140.324.241|
| `yanmar-6aym-wet-r06/foto/` | [foto](foto/) |22|9.158.835|
| `yanmar-6aym-wet-r06/video/` | [video](video/) |17|20.930.652|
| **Total salinan referensi** | |**383**|**170.413.728**|

Angka tersebut menghitung salinan sumber, tanpa berkas indeks/pemeriksaan yang dibuat di folder ini. Struktur dan nama berkas di bawah setiap pohon dipertahankan. Riwayat yang menyebut R01–R05 tetap riwayat; keberadaannya tidak meluluskan R06.

## Mulai dari sini

- [MANIFEST.json](MANIFEST.json): peta setiap berkas, path canonical, jumlah byte dan SHA-256. Hash sumber sebelum/sesudah penyalinan sama dengan hash tujuan untuk seluruh383 berkas.
- [INDEKS-SUMBER.tsv](INDEKS-SUMBER.tsv): tabel277 rekaman sumber dari registri yang disalin, mencakup228 URL unik; rekaman ganda sengaja menunjuk konteks asalnya.
- [SUMBER-DAN-STATUS.json](SUMBER-DAN-STATUS.json): URL, pembuat, halaman/timestamp, batas bukti, dan status akses beserta JSON pointer ke registri asal.
- [dokumen/function-references/README.md](dokumen/function-references/README.md): hasil pencarian fungsi komponen dan temuan teknis R06. Video starter pengguna dan video Garrett diperiksa lewat frame; video lain yang hanya metadata dinyatakan demikian.
- [dokumen/sources.json](dokumen/sources.json): dokumen primer Yanmar dan konflik varian. [foto/evidence-foto.json](foto/evidence-foto.json) dan [video/evidence-video.json](video/evidence-video.json) menyimpan cakupan pengamatan historis.
- [PEMERIKSAAN-KOLEKSI.json](PEMERIKSAAN-KOLEKSI.json): pemeriksaan penyalinan dan pola kredensial yang dikenal.
- [LAMPIRAN-ASLI.json](LAMPIRAN-ASLI.json): keberadaan dan hash dua lampiran asli pengguna. Koordinator menempatkan prompt/toolkit dalam bagian agensi; keduanya tidak diduplikasi di koleksi referensi ini.
- [RUJUKAN-PATH-EKSTERNAL.json](RUJUKAN-PATH-EKSTERNAL.json): path di luar pohon referensi yang masih disebut catatan, termasuk bukti efek `/workspace/efek-review/volume-02`. Koordinator mengemas QA secara terpisah.

## Membaca status

`OBSERVED` berarti registri mencatat frame atau halaman yang dilihat; cakupannya hanya bagian yang disebut. `METADATA_ONLY` bukan menonton video. `DOCUMENTED_TEXT` berarti teks primer terindeks/terbaca, terpisah dari inspeksi visual. `UNVERIFIED` atau `SEE_ORIGINAL_REGISTRY` memerlukan pembacaan catatan asal. Normalisasi indeks tidak mengubah hasil audit atau memperbarui bukti lama.

URL eksternal tidak diperlukan untuk membuka berkas lokal yang tersedia. Referensi yang gagal diunduh tetap tercatat lewat metadata/log; paket tidak berpura-pura berisi video atau dokumen yang tidak pernah diperoleh. Path absolut historis dalam berkas sumber dipertahankan sebagai provenance; gunakan peta manifest ketika memindahkan paket ke komputer lain.

## Hak atas bahan sumber

Baca [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Penyerahan koleksi riset privat tidak memberikan hak menjual ulang PDF, foto, video, merek, atau ilustrasi pihak ketiga bersama katalog.
