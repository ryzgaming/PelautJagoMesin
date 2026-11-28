# Spesialis rakitan mesin

Koordinator menjalankan langkah ini untuk produksi mesin dan revisi bagian mesin. Para spesialis membaca sendiri katalog suku cadang, potongan, manual, foto bongkar dan sumber varian yang ditentukan; kirim locator dan batas bukti kepada modeler. Untuk mesin dengan arsitektur berbeda, tentukan cakupan dari unit pesanan terlebih dahulu.

1. Jalankan `init` untuk order baru. Di `model/assembly-plan.json`, isi keputusan tiap domain: `active`, `not_applicable` beserta alasan berbasis konfigurasi, atau `unknown` sambil mencari bukti. Misalnya gearbox kapal bisa berada di luar pesanan engine-only, walaupun timing gear mesin ada. Tambahkan domain khusus sesuai kebutuhan (misalnya separator bowl, kompresor atau reversing gear) beserta `title` dan instruksi riset tertulis; isi `profile` bila tersedia. Catat identitas produk dan batas varian untuk setiap sumber.
2. Jalankan `python3 tools/gpt-production/toolkit.py specialist-briefs --workspace <folder>`. Hasilnya daftar **penugasan untuk dikirim**. Koordinator benar-benar mengaktifkan profil Codex sesuai `profile` dan model pesanan. Pada runtime yang menerima teks, teruskan `developer_instructions` dari TOML yang dikirim worker atau dari `.codex/agents/`. Untuk domain tambahan gunakan pekerja khusus dengan brief yang ditulis untuk domain itu. Jadwalkan bergelombang; maksimal dua spesialis sistem sekaligus dan patuhi slot sesi. Profil menentukan kompetensi. Subagen sistem lama yang sesuai dapat mengerjakan riset spesialis sekaligus jika cakupan teknis dan identitas peran cocok. Pertahankan 13 peran dasar dan ID checkpoint SQL yang sudah digunakan. Domain berbagi satu rakitan menunjuk satu pemilik; pihak lain cukup merujuk ID rakitan dan mendefinisikan port perbatasannya.
3. Di domain aktif, isi `research_evidence` dengan path laporan riset spesialis yang akan diikat hash oleh QA. Sebelum pemodelan, spesialis mendaftarkan rakitan yang dimiliki berikut **bagian yang seharusnya ada** menurut sumber. Bandingkan dengan daftar parts dan figure, termasuk bagian yang baru terlihat setelah tutup atau shell dibuka. Tetapkan ID harapan yang stabil, lokasi pada unit, bentuk yang diketahui, dan relasi cover. Kunci hash rencana sebelum menyerahkan ke modeler pada checkpoint evidence. Penemuan baru harus mengubah rencana secara terlacak dan diperiksa pada audit berikutnya. Untuk revisi lokal, tandai rakitan lain yang dikecualikan dan alasannya. Audit parsial berlabel draf; untuk kesiapan model penuh, bawa bukti cakupan lainnya pada revisi yang sama.
4. Exterior dan Internal Modeler membagi kepemilikan geometri dengan spesialis. Beri bagian yang harus dapat diperiksa sendiri ID GLB dan inventaris yang konsisten. Bagian dapat berada pada GLB eksterior atau internal. Referensi prinsip umum berguna untuk mencari sumber; hanya bagian yang terbukti sesuai varian yang boleh diberi label terdokumentasi. Catat bagian hilang/parsial bila bukti atau waktu belum cukup, termasuk detail yang menyatu dengan shell.
5. QA independen memeriksa kembali rencana terhadap sumber, mencari komponen yang diabaikan oleh rencana, lalu memetakan tiap harapan ke inventaris, node mesh pada GLB akhir serta tampilan viewer. Untuk bagian dalam, pilih rakitan lalu buka shell dengan X-ray/isolasi/urai; pilih bagian dalam, lihat ID dan sumber, putar pandangan, rapatkan kembali. Uji rakitan bertingkat sampai fitur dalam terlihat dan dapat dipilih. Catat bukti dari browser pada viewport yang dipakai. Periksa juga data viewer benar-benar memuat mesh pada hash yang diaudit. Temuan tidak dapat diselesaikan hanya dengan menambah ID.

## Kontrak berkas

Fragmen berikut memberi contoh struktur. Label, varian, geometri dan daftar komponen aktual ditulis dari sumber pesanan. Sumber privat tidak dimasukkan ke katalog.

```json
{
  "id": "ASM-AIR-COOLER",
  "domain": "pendingin_penukar_panas",
  "owner_agent_id": "ID_SUBAGEN_AKTUAL",
  "parts": [
    {
      "id": "EXP-AC-SHELL", "name": "Rumah pendingin udara",
      "location": "Rakitan pendingin udara, sisi yang ditandai pada datum",
      "shape": {"basis": "OBSERVED", "description": "Isi profil coran, bibir cover dan port yang terlihat pada gambar unit"},
      "layer": "outer", "feature": "housing", "covers": [],
      "source_refs": [{"path": "doc/sources.json", "locator": "ID sumber, katalog dan figure unit aktual"}]
    },
    {
      "id": "EXP-AC-CORE", "name": "Elemen pemindah panas",
      "location": "Di balik rumah pendingin udara", "layer": "inner",
      "shape": {"basis": "UNKNOWN", "description": "Tipe bundle dan pola aliran masih perlu potongan varian ini"},
      "feature": "heat_transfer_element", "covers": ["EXP-AC-SHELL"],
      "source_refs": [{"path": "doc/sources.json", "locator": "ID sumber, figure, nomor posisi atau potongan"}]
    }
  ]
}
```

Masukkan setiap rakitan dalam `assemblies` pada rencana. Kolom `shape` memisahkan uraian geometri dari dasar buktinya (DOCUMENTED, OBSERVED, ESTIMATED, INFERRED atau UNKNOWN). Gunakan UNKNOWN dan tulis fitur yang belum terbukti jika sumber hanya memastikan keberadaannya. Tiap cooler fisik memiliki elemen penukar panas sendiri. Bentuk, jumlah tabung, bahan dan ukurannya tetap terpisah dari keberadaan elemen. Jika arsitektur belum jelas, pertahankan ketidakpastian. Setiap entri sumber memuat path bukti privat relatif ke folder order dan locator spesifik; QA mengikat hash bukti di `qa/review.json.artifacts`.

QA membuat `qa/assembly-inspection.json` berisi `revision`, `qa_agent_id`, `plan_sha256`, `model_sha256` (kunci `exterior` dan `internal`), serta objek `parts` dengan kunci ID harapan. Untuk setiap ID isi `status`, `reason`, `mesh_ids`. Status:

- `modeled` bila fitur dapat diidentifikasi pada geometri final. Untuk bagian dalam sertakan `viewer_evidence` berupa path bukti browser yang hash-nya masuk laporan, serta `viewer_check` berisi `action` (xray, isolate, explode, section atau open-cover), `selected_mesh_id` dan `opened_covers` (ID harapan penutup yang dibuka pada pemeriksaan). Bukti bertanggal/revisi mencakup penampakan nyata; tes DOM atau parsing GLB saja belum cukup.
- `partial` jika sebagian bentuk ada, termasuk bila detail yang diminta menyatu dengan satu mesh dan tidak dapat dipilih.
- `missing` bila bagian yang diketahui tidak ada di hasil.
- `unverified` jika bukti bentuk atau pengujian belum tersedia.
- `not_applicable` jika konfigurasi membuktikan bagian tidak berlaku; jelaskan varian dan locator.

`check-review` menggunakan kontrak tambahan ini untuk pekerjaan baru (job schema 2) dan order lama yang memilih menambahkan rencana. Untuk migrasi manual order lama buat rencana memakai struktur di atas, pertahankan histori dan tandai bila rencana dibuat sesudah modeling. Order schema 1 tanpa rencana tetap dapat dilanjutkan menurut kontrak lama. Hash, pencocokan ID dan keputusan domain adalah pemeriksaan struktural. Pengetahuan teknik, kebenaran isi gambar, bentuk nyata dan klik viewer diperiksa independen. Status QA yang terbuka tetap terlihat pada draf privat.

## Telusuri seluruh BOM sampai komponen servis terakhir

Agen dokumen membuka indeks katalog varian yang tepat, lalu merekam seluruh keluarga/figure dalam `doc/bom-source-index.json`, termasuk yang dikecualikan serta alasan penerapannya. Untuk tiap figure aktif salin seluruh nomor posisi dari tabel suku cadang, termasuk baris bertingkat, subfigure, seal, spacer, washer, pin dan baut yang memang didaftar. Beri ID baris lokal unik saat nomor posisi dipakai ulang. Catat ID figure dari daftar isi sebagai daftar terpisah `toc_family_ids` sebelum spesialis mentranskrip tabel figure. QA independen memeriksa ulang indeks/halaman tiap figure terhadap sumber asli, lalu mengisi `verified_by` dan `scope_status`. Bila katalog tidak lengkap, terpotong atau applicability belum jelas, status tetap `unverified`. Jangan menyebut cakupan seluruh mesin lengkap hanya karena semua bagian pada contoh rakitan sudah diperiksa.

```json
{
  "revision": "r01", "verified_by": "ID_QA_AKTUAL", "scope_status": "unverified",
  "toc_ref": {"path": "doc/sources.json", "locator": "Indeks lengkap varian dan revisi katalog"},
  "toc_family_ids": ["FIG-EXAMPLE"],
  "families": {
    "FIG-EXAMPLE": {"applicability": "active", "source_ref": {"path": "doc/sources.json", "locator": "Halaman tabel figure"}, "line_ids": ["1", "2a"]}
  }
}
```

Pada setiap part rencana, isi `parent_id` (null pada tingkat teratas), `bom_lines` contoh `[{"family":"FIG-EXAMPLE","id":"2a"}]`. ID harapan dan hubungan induk-anak menelusuri semua tingkat, termasuk subassembly. Bagian tambahan yang terbukti dari sumber servis lain dapat memakai `additional_service_ref` dengan path bukti dan locator. Tiap daun wajib memiliki `terminal: {kind, reason, source_ref}`. Gunakan `physical_service_part` untuk part fisik terakhir dan `supplied_as_assembly` hanya bila sumber menyatakan unit dijual atau diservis utuh; tetap masukkan bagian dalam yang diketahui dari potongan/parts book lain. Dokumen yang tidak tersedia belum membuktikan bahwa suatu unit merupakan daun. Bila rujukan terminal belum tersedia, pertahankan baris itu sebagai gap dan catat `missing`, `partial` atau `unverified`. Ketika tabel OEM menjelaskan satu part bernomor dipasang beberapa kali, rekonsiliasi jumlah/posisi pemasangan di inventaris bersama spesialis. Koordinator/QA membuka indeks sumber dan memeriksa jumlah baris serta kuantitas. Checker hanya dapat membandingkan daftar yang dimasukkan terhadap manifest dan mencari referensi yang putus; kebenaran transkripsi bergantung pada pemeriksaan sumber.
