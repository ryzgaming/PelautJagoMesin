# Agensi produksi Yanmar 6AYM-WET R06

Folder ini menyimpan bahan kerja yang tersedia untuk melanjutkan produksi: profil agen, instruksi, skill, perangkat QA, lampiran pemilik, referensi dan bukti historis. Model yang sedang ditinjau tetap berada di `../model`, sedangkan tampilan penggunanya berada di `../ui-workspace`.

## Isi dan asal

| Folder | Isi | Status |
|---|---|---|
| `agen/profil-asli` | 15 profil TOML dari repository | Salinan asli, bukan bukti bahwa semua profil dijalankan pada R06 |
| `agen/brief-dapat-dipakai-ulang` | Instruksi ringkas untuk tim berikutnya | Rekonstruksi dari tugas dan catatan tersedia |
| `perangkat-produksi/repo-snapshot` | Aturan proyek, tiga skill lokal, toolkit, worker dan tes efek | Snapshot berkas terpilih, struktur relatif dipertahankan |
| `perangkat-produksi/adaptasi-gpt` | Paket adaptasi GPT terdahulu, termasuk contoh Caterpillar | Historis; jangan menganggap contoh sebagai geometri atau bukti Yanmar |
| `perangkat-produksi/lampiran-pemilik` | Prompt, toolkit dan teks spesialis efek yang diberikan pemilik | Byte asli dan SHA-256 tercatat |
| `skills-cloud` | Skill cloud yang berhasil diekspor | Periksa manifest sumber di folder tersebut |
| `referensi` | Dokumen, foto, video/frame dan register sumber | Sumber teknis beserta batas kesesuaian varian |
| `validasi-pemisahan` | Pemeriksaan paket setelah dipisahkan | Berbeda dari QA mekanis historis |

`perangkat-produksi/MANIFEST-SUMBER.json` menghubungkan setiap salinan dengan path asal, SHA-256, ukuran dan jenis sumber. Aturan di snapshot bersifat arsip; beberapa path dan batas file merujuk repository lama. Gunakan batas paket berikut untuk pekerjaan baru, lalu baca aturan asli sebagai konteks teknis. Jangan menimpa arsip agar terlihat seolah aturan baru sudah berlaku pada produksi terdahulu.

## Batas pekerjaan agar UI aman diganti

- Spesialis model mengubah `model/source`, geometri dan data mesin melalui proses build model. Perubahan ID komponen, datum, hierarki, koordinat, format data atau API adalah perubahan kontrak dan harus dimigrasikan serta diuji.
- Spesialis UI mengubah `ui-workspace`. Gunakan API/adaptor publik runtime. Jangan menanamkan dimensi mesin, firing order, lintasan pipa, daftar subkomponen atau rumus gerak baru ke tombol dan panel.
- Spesialis runtime/efek/audio mengubah modul mesin terkait hanya bila tugasnya mencakup perilaku tersebut. Perubahan warna atau tata letak UI tidak mengizinkan perubahan ke model. Pertahankan ID, fase gerak, siklus hidup, dan pelepasan sumber daya.
- Agensi menyimpan masukan, instruksi, sumber, skrip, laporan dan bukti. Agen QA dapat membaca seluruh paket dan menulis laporan; ia tidak memperbaiki artefak pembuat secara diam-diam lalu mengesahkan hasilnya sendiri.
- Sebelum dan setelah perubahan UI, bandingkan hash aset model serta jalankan pemeriksaan kontrak paket dan uji alur pengguna desktop/HP. Hash geometri yang sama tidak cukup membuktikan perilaku sama: cek start, jeda, stop, eksplor rakitan, X-ray, audio dan gerak komponen.

## Produksi mesin berikutnya

1. Buat folder order baru; jangan mengganti nama Yanmar lalu memakai geometri yang sama. Tetapkan merek, tipe, varian dan cakupan hingga subkomponen. Jika nomor seri tidak tersedia, pilih basis dokumen yang dapat dibuktikan dan catat perbedaan varian.
2. Koordinator memeriksa alat nyata dan membaca prompt, aturan serta `agen/PERAN-R06.json`. Jalankan `python3 tools/gpt-production/toolkit.py preflight` dari `perangkat-produksi/repo-snapshot`. Ini pemeriksaan alat, bukan penginstal atau agen pembuat otomatis.
3. Buat job kosong dengan command di bawah. Pilih ID model GPT yang benar-benar tersedia di layanan yang digunakan. Ketersediaan ID di contoh historis bukan jaminan akses saat ini.
4. Peneliti menyiapkan register sumber, datum, dimensi dan daftar varian. Setiap angka harus mengacu dokumen/halaman/frame. Gunakan DOCUMENTED, INFERRED dan ILLUSTRATIVE sesuai bukti; jangan mengubah UNKNOWN menjadi presisi OEM.
5. Aktifkan spesialis per rakitan: blok/poros/piston, kepala/katup, timing/transmisi, injeksi, turbo/udara/gas, pendingin/penukar panas, pompa/katup pendingin, pelumasan dan starter/pengisian. Tambahkan lintas rakitan untuk kontinuitas fluida, kinematika/benturan, efek, audio dan QA. Agen harus benar-benar ditugaskan; nama file profil bukan bukti eksekusi.
6. Setiap spesialis menyerahkan daftar bagian internal, hubungan pasangan, port, gerak, sumber, ketidakpastian dan geometri/data. Injektor harus dapat dieksplor hingga komponen yang didukung sumber, bukan satu silinder berlabel. Jangan menyalin jenis injektor dari gambar yang berbeda sistemnya.
7. Integrator menggabungkan hasil dengan datum dan ID stabil. Semua poros terklasifikasi; semua pipa memiliki ujung yang terhubung atau alasan terbuka; keadaan start/run/pause/stop menggerakkan komponen sesuai fungsi. Efek memakai data rute/fase; suara mengikuti keadaan dan memerlukan interaksi pengguna untuk kebijakan audio browser.
8. QA independen mengimpor ulang ekspor final, mengukur dimensi, membandingkan enam arah dengan sumber, memeriksa rakitan, aliran, benturan dan gerak sepanjang siklus. Ia menguji UI desktop serta ukuran HP dan membedakan emulasi viewport dari perangkat nyata. Ambil sebelum/sesudah dengan kondisi identik.
9. Isi laporan dan hash dari artefak aktual. Jalankan validator, baca hasil, perbaiki temuan, lalu uji ulang bagian terdampak. Checker kontrak tidak membuktikan kesesuaian bentuk atau mesin nyata dengan sendirinya.
10. Siapkan review privat dengan daftar gap yang terbuka. Katalog memerlukan persetujuan pemilik pada revisi yang sama. Paket ini tidak memasukkan model ke katalog.

```bash
# Jalankan dari agensi/perangkat-produksi/repo-snapshot.
python3 tools/gpt-production/toolkit.py init --workspace /path/privat/order-baru --brand 'Merek' --model 'Tipe dan varian' --ai-model ID_GPT_TERSEDIA
python3 tools/gpt-production/toolkit.py check-review --workspace /path/privat/order-baru
```

Folder tujuan harus baru/kosong. Scaffold berstatus UNVERIFIED bukan model selesai. Petunjuk render, register rakitan/fluida/gerak dan worker ada dalam README toolkit dan dokumen yang ditautkannya. Untuk membangun ulang Yanmar yang sudah ada, gunakan instruksi pada `../model/source` dan `../model/tools`; proses itu berbeda dari menginisialisasi order baru.

## Tes perangkat produksi yang dapat diulang

Jalankan dari `perangkat-produksi/repo-snapshot`:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/gpt-production/tests
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s apps/alur-workflow/worker
node --test tests/flow-ribbons.test.mjs tests/combustion-glow.test.mjs
```

Pada pengemasan ini, 36 tes toolkit, 14 tes worker dan 10 tes efek lulus pada salinan paket. Ini menguji perangkat kerja dan kontrak pustaka. Hasilnya bukan pengesahan ulang seluruh geometri Yanmar, performa HP, atau 126 tes platform lengkap. `package.json`/lockfile dipertahankan sebagai rekaman lingkungan repository; snapshot ini bukan checkout seluruh situs. Jangan menjalankan deploy dari snapshot atau menganggap `npm test`/`npm run build` platform lengkap didukung oleh subset ini.

## Yang tidak dapat menjadi berkas model

Layanan GPT/Codex, alat kolaborasi, browser cloud, GitHub, pencarian web dan hosting Sites memerlukan layanan serta hak akses masing-masing. Paket tidak membawa sesi login, token, profil browser, model AI berbobot tertutup, seluruh percakapan mentah agen atau penalaran internal. Profil dan brief membantu menjalankan ulang tugas; tidak mereplikasi layanan itu secara otomatis. Blender MCP adalah opsi konfigurasi proyek yang diarsipkan, bukan keharusan untuk CLI Blender dan bukan pemasangan yang dilakukan oleh paket ini.

Semua bahan yang tersedia dan relevan diinventarisasi, tetapi klaim “seluruh riwayat percakapan” tidak dibuat. Berkas yang belum tersedia harus dicatat sebagai gap. Lisensi referensi/alat pihak ketiga tetap berlaku; lihat `perangkat-produksi/HAK-DAN-KETERBATASAN.md` dan register referensi.
