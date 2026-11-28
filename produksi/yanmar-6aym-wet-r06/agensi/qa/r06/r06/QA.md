# QA independen r06

**Draf untuk inspeksi pemilik.** Chromium WebGL menguji Pengoperasian → Mulai, pinion masuk, starter memutar, pembakaran mulai, mesin hidup, dan berhenti. Jeda/pelanjutan, mute, reset, dan pembukaan ulang berjalan pada viewport 1280 × 800 dan HP 390 × 844 DPR 2. Pengujian ini memakai SwiftShader dan emulasi viewport HP.

Audio dibuka oleh tindakan Mulai. Analiser WebAudio mengukur sinyal saat starter, transisi pembakaran, dan mesin berjalan. Jeda, mute, dan posisi berhenti meredam sinyal pada pengujian. Bunyi merupakan sintesis ilustratif. Pembacaan berasal dari keluaran graf audio browser.

Registri model berisi 1184 mesh. Uji terarah mengamati 122 kelompok, 183 sasaran langsung, dan 77 akar gerak lama. Empat belas saksi statis tetap diam dan reset mengembalikan matriks ke pose awal.

Impor ulang Blender menjalankan 54,367 kueri pada pasangan terarah. Rangkaian gear starter dan pembawa, gear oli 40:45, rack/pinion, selubung seal, dan termostat dicek hanya pada sampel yang tertera. Status pasangan keras di cakupan ini **PASS**. Pemeriksaan r05 terhadap 696 persinggungan yang belum diklasifikasikan tetap terbuka.

Pada 30°C, partikel dan pita simulasi mengalir melalui bypass skematis. Pada 86,4°C, penanda beralih ke penukar panas. Uji tutup pendingin pada +120 kPa mengangkat disk 3 mm dalam model dan menekan pegas. Pada −4 kPa, katup balik bergerak 1,2 mm. Nilai gerak dan waktu pemanasan adalah ilustrasi.

Pada Fokus ruang bakar, potongan piston dan liner memperlihatkan mangkuk piston dan kepala katup. Sorot ilustratif terlihat di silinder 2 pada pose diagnostik 32° setelah TMA pembakaran. Pemeriksaan selama putaran awal starter mendapati nol mesh nyala.

## Bukti

- [Desktop sebelum dan sesudah](perbandingan-desktop.png)
- [HP sebelum dan sesudah](perbandingan-hp.png)
- [Fokus ruang bakar desktop](definitive/desktop-firing-diagnostic.png)
- [Fokus ruang bakar HP](definitive/hp-firing-diagnostic.png)
- [Rekaman browser](rekaman-start-browser.mp4) — waktu dipadatkan, tanpa trek audio
- [Data hasil QA](qa.json)
- [Jejak kontak Blender](definitive/contacts.json)
