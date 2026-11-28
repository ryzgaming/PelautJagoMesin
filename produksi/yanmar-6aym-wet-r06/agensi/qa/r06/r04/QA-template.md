# Audit independen r04 · Sambungan dan aliran

**UNVERIFIED secara keseluruhan.** Angka berlaku pada GLB dan manifest yang dicatat dalam laporan mesin, serta pada cakupan sampel yang disebutkan. Arah demonstrasi merujuk prinsip sirkuit Yanmar. Diameter, debit, timing katup, tekanan, dan pemasangan fisik per nomor seri di luar validasi ini.

## Pipa dan antarmuka

- **Pipa tekanan tinggi.** Pada r03 enam pipa menyentuh area head tetapi berhenti sebelum holder. Jarak vertex–permukaan yang disampel 220,89–222,49 mm. R04 menyambungkan tiap pipa ke port lateral holder dengan tube fisik, sambungan dan lubang dinding kepala. Render silinder 3 memakai kamera, skala dan daftar bagian yang sama. [Perbandingan r03/r04](perbandingan-injektor.jpg)
- **Perbaikan clearance.** Iterasi pertama r04 membuat collar menyentuh intake bridge pada 8,5–9,0 mm lift ilustratif. Collar dipindah keluar dari ruang lintasan bridge. Cek shell, valve dan pasangan pipa dapat ditelusuri per ID pada laporan mesin. [Sampel awal](candidate-sweep/routes-check.json)
- **Media terpisah.** Intake, exhaust, air tawar, air laut dan pelumas mengikuti daftar port dan hubungan sumber masing-masing. Jalur fisik diprobe dekat dinding dan pada sambungan port. Casting yang tidak diukur, jalur return/overflow/leak-off yang sumbernya belum menentukan terminal, alur thermostat dingin, diameter internal dan kemungkinan pilihan instalasi tetap dibatasi. Saluran skematis dibedakan pada workspace, termasuk di dalam cooler dan galeri tertutup. [Cooling Water System](D01-163.png) · [Lubricating Oil System](D01-157.png) · [Fuel oil system](D01-114.png)

## Alur belajar

- Enam pilihan medium, Mulai/Jeda/Lanjut/Ulang, enam tahap tur otomatis sampai rakitan rapat kembali, dan kembali ke keadaan terpasang diperiksa menggunakan GLTFLoader nyata, DOM dan renderer tiruan. Pada setiap silinder, pulsa terbukti mengunjungi empat bagian jalur injeksi dalam urutan yang sama pada sampel diskret; tidak ditemukan langkah ganda/hilang di antara port. Uji ini mengukur logika dan geometri, sedangkan tampilan browser aktual memerlukan WebGL. 
- Film potret berasal dari GLB dan rute r04. Potongan dan alur yang tidak terlihat pada unit nyata diberi konteks ilustrasi. Film adalah hasil render/encode terpisah. Uji decode dan gambar per tahap tidak mengesahkan gesture, performa atau hasil WebGL viewer HP.
