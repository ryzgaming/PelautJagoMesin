# Perilaku komponen Yanmar 6AYM-WET pada R06

Saat sakelar start diaktifkan, solenoid menggeser pinion. Starter lalu memutar flywheel, poros engkol, nok dan pompa-pompa mekanis. Ketika mesin menyala, pinion yang masih bertaut mengikuti flywheel melalui kopling satu arah sementara motor starter melambat. Pinion kemudian ditarik. Saat stop, rack bergerak ke pemutusan bahan bakar. Putaran sisa masih menggerakkan cam, piston dan pompa. Turbo dan filter oli sentrifugal memiliki pelambatan tersendiri.

## Cakupan model tinjau

Ada 1.184 mesh pada dua GLB terpasang. Setiap ID mempunyai uraian fungsi pada saat start, beroperasi, berhenti dan diam di `model/motion/functions.json`. Sebanyak 183 mesh menerima gerak langsung dari 122 kelompok kontrol. Selanjutnya 434 mesh mengikuti hierarki penggerak induk, termasuk perakitan poros, piston dan mekanisme katup. Jumlah ini menghitung mesh model; identitas seri unit, jumlah BOM komplit seluruh varian, serta reproduksi toleransi untuk pembuatan belum ditetapkan.

| Peran dalam model | Mesh |
|---|---:|
| Tetap, termasuk dudukan, gasket, rumah, saluran dan media filter | 562 |
| Pengikut poros, batang atau nok | 363 |
| Rotasi | 124 |
| Berubah bentuk, termasuk pegas, sabuk dan impeler fleksibel | 80 |
| Bersyarat, termasuk suhu, putaran, perintah bahan bakar atau tekanan | 55 |

Tujuh entri tersisa dari audit antara sekarang terurai menjadi muka diam dan muka berputar untuk dua seal pompa, pressure cap dengan katup tekan/balik, dua bushing turbo yang mengambang dan dua piston ring seal turbo yang tertahan pada insert tetap. Untuk pressure cap, gunakan pengujian tekanan terpisah. Dari posisi seimbang, contoh +120 kPa menekan pegas dan mengangkat katup 3 mm. Contoh −4 kPa membuka katup balik 1,2 mm. Manual memberi tekanan uji pembukaan 93–123 kPa. Titik model 108 kPa, langkah serta beda tekanan untuk vakum merupakan ilustrasi.

## Data yang mengatur gerak

| Sistem | Yang diperagakan dan dasarnya |
|---|---|
| Sistem bahan bakar | Urutan 1–4–2–6–3–5, interval nok 60° pada poros pompa, rack maksimum saat start dan pemutusan saat stop dari D01 PDF 115–116. Pengatur bahan bakar menggeser rack, menggerakkan enam pinion dan memutar enam plunger dalam barrel tetap; plunger tetap mengikuti langkah nok. Diameter plunger 16 mm dan heliks kanan 36,906° mengikuti manual. Kedalaman/lebar alur, lebar gigi rack, backlash dan fase awal bersifat rekonstruksi. |
| Nosel | D01 PDF 149–151 memberi awal pengiriman bahan bakar 16±0,5° sebelum TMA, tekanan buka 31±0,5 MPa dan angkat jarum 0,50±0,01 mm. Delapan lubang 0,30 mm dan empat lubang 0,22 mm dibor pada setiap tip. Contoh durasi semburan −12° sampai TMA merupakan pendekatan untuk menunjukkan adanya tunda dari awal pengiriman. |
| Pendingin | Tiga termostat mulai buka di 71 °C dan tiga di 76,5 °C. Angkat penuh 8 mm pada 85 dan 90 °C, sesuai D01 PDF 168. Ketika dingin, pompa memasok jaket dan bypass yang kembali ke pompa. Aliran cabang penukar meningkat setelah katup bergerak. Jalur bypass pada coran tertutup bersifat skematis. Waktu pemanasan 32 detik dan temperatur tujuan 88 °C pada demo merupakan estimasi yang dipercepat. |
| Pompa oli dan air | Pada acuan 1.900 rpm, model menghasilkan 1.688,89 rpm untuk pompa oli, 2.533,33 rpm untuk pompa air tawar dan 1.572,41 rpm untuk pompa air laut. D01 PDF 157 dan 163–164 memberi angka bulat 1.689, 2.533 dan 1.572. Jumlah gigi serta fase tiap pasang yang menghasilkan rasio tersebut merupakan rekonstruksi. |
| Impeler fleksibel | Sepuluh sudu menyempit di area nok tetap pada rumah dan mengembang kembali menuju isap. Tiap sudu memakai morph target tersendiri. Perubahan tegangan karet, gaya kontak dan rugi kebocoran memerlukan data material serta ukuran unit. |
| Turbo dan filter sentrifugal | Roda turbin dan kompresor berada pada poros yang sama. Tanggapan turbo mengikuti pembakaran dengan jeda; filter mengikuti pembentukan tekanan oli dengan jeda tersendiri. Dua bushing turbo digerakkan kira-kira setengah putaran rotor untuk memperagakan bantalan mengambang. Kecepatan aktual bushing dan rotor TD13M belum diukur. |
| Kelistrikan dan starter | Rotor alternator terikat ke poros dan puli, sabuk ke penggerak, sikat dan stator ke rumah. Starter mempunyai pinion lepas, roller kopling, pembawa planet dan ring tetap. Arah, lepasnya kopling dan jalur torsi mengikuti prinsip DENSO. Jumlah roller, gigi reduksi, langkah masuk dan waktu pergantian fase direkonstruksi. |

## Pemeriksaan geometri dan waktu

- `qa/r06/check_function_response.cjs` memaksa urutan start, cranking, pembakaran, idle, cut-off dan putaran sisa. Pemeriksaan memisahkan kecepatan motor starter dari pinion saat flywheel mengambil alih. Sesudah 165 detik operasi contoh, suhu mencapai 87,68 °C, angkatan termostat A 8 mm dan B 6,62 mm.
- `qa/r06/verify_driven_gears.py` mengimpor kedua GLB. Delapan pasangan roda penggerak diukur pada 33 pose per pasangan; uji juga memeriksa rasio tiga pompa terhadap data manual.
- `qa/r06/check_function_geometry.py` menguji impeler air laut pada 181 posisi. Tidak ada segitiga sudu yang menembus nok atau rumah. Jarak vertex terdekat yang dicuplik terhadap cam 0,636–1,542 mm; model visual ini tidak memprediksi efisiensi volumetris. Pada enam termostat, mating katup dan seat bersentuhan saat tertutup dan terpisah saat terbuka. Masing-masing diberi 17 pose sepanjang 8 mm. Kedua seal pompa diperiksa pada 48 posisi.
- Dua alur pada sleeve flinger menampung ring seal yang ditahan insert. Uji putar 96 posisi pada GLB akhir menghasilkan nol perpotongan dengan insert atau kedua ring. Kedua journal bushing juga bebas dari perpotongan dengan rumah pada 96 posisi. Lima segmen bor dari inlet oli pada rumah sampai dua alur bantalan lolos uji raycast di `qa/r06/turbo-oil-drills.json`.
- `doc/fuel-function-specialist/` memuat audit geometri ekspor bagi enam rack/pinion, alur plunger, 72 lubang nosel dan render pembanding. Enam pasang rack/pinion melalui 501 posisi tanpa tumpang tindih profil. Jarak flank terkecil yang dicuplik sebesar 0,152 mm.
- `doc/function-references/` menyimpan sumber per subsistem beserta status akses dan detik yang sungguh dilihat. Di antaranya video contoh starter pengguna dan video turbo OEM Garrett. Pada komponen lain, bukti utama berasal dari manual dan parts catalogue. Model tekanan hidrolik, CFD, kelistrikan, defleksi material, torsi, pembebanan bearing dan uji performa terhadap mesin nyata masih di luar validasi model.

Sumber penampang turbo Yanmar D01 PDF 170–171 dan D05 Fig. 32 dilengkapi uraian dua film oli dan ring seal dari Garrett. Putaran bushing, ukuran lokal seat serta kondisi bocor masih memerlukan pengukuran TD13M(1). [Bantalan turbo Garrett](https://www.garrettmotion.com/knowledge-center-category/turbo-replacement/turbocharger-bearing-systems/) · [Seal turbo Garrett](https://www.garrettmotion.com/knowledge-center-category/turbo-replacement/the-turbocharger-oil-and-gas-sealing-system/)

Untuk meregenerasi register pada model ekspor yang sama, jalankan dua perintah ini secara berurutan dari akar proyek.

```sh
python model/motion/build_motion.py
python model/motion/build_functions.py
```
