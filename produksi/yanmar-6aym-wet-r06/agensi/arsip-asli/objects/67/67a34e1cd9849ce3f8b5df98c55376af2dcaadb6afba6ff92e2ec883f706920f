# Film operasi R05

Film dibangun dari GLB mesin rilis, registri jalur fluida, serta state aktual viewer. `viewer_poses.mjs` membuka kedua GLB dengan GLTFLoader yang digunakan aplikasi, lalu mencatat matriks dunia setiap node setelah pemanggilan kinematika pada setiap frame. Render native menggunakan Mesa/EGL dan geometri dari kedua GLB. Rute yang tersembunyi dan warna pembakaran merupakan ilustrasi pembelajaran. Nilai putaran film diperlambat; animasi turbo dan arah yang belum didokumentasikan mengikuti status pada registri penggerak.

Kamera setiap adegan penggerak terkunci. Titik jingga mengikuti satu vertex mesh pada poros, rotor atau tanda sabuk. Titik hijau kelabu mengikuti satu vertex pada bagian diam. Garis jingga pendek menunjukkan posisi terdahulu dari vertex yang sama. `check_drives.py` mengukur posisi dunia/layar kedua vertex, radius putaran terhadap sumbu, dan perubahan piksel model pada video terdekode setelah semua titik dan jejak berwarna disisihkan. Keluaran privat menyertakan urutan tiga frame per penggerak dan daftar nilai aktual. Perbandingan ini memeriksa gerak yang ditampilkan. Kelayakan toleransi, kecepatan operasi nyata dan keausan memerlukan data teknik tersendiri.

Diperlukan Python (NumPy, SciPy, Pillow, ModernGL, glcontext), DejaVu Sans, Node, Mesa/EGL, FFmpeg serta FFprobe. Jalankan di folder ini setelah kedua GLB dan `review/assets/data.json` disiapkan oleh build viewer.

```sh
python3 render_drives.py --preview
python3 render_drives.py
python3 check_drives.py
```

Berkas penayangan adalah `review/assets/film/yanmar-6aym-r05.mp4` dan `yanmar-6aym-r05.jpg`. Hash sumber, viewer, manifest dan video berada pada `render.json`. Hasil dekode berada pada `decoded-qa.json`, `decoded-storyboard.jpg`, dan `decoded-phases.jpg`.

Sembilan kamera tetap mengikuti starter, gear timing, sabuk, alternator, turbocharger, kedua pompa pendingin, pompa injeksi, dan pompa oli. Gerak pembakaran dan lintasan enam media juga terlihat dalam tur. Fase starter menggunakan langkah waktu setara 1,45 radian engkol per detik film, kemudian operasi menggunakan 3,10 radian per detik film. Penggerak turbo menggunakan laju visual dari registri. Pada adegan air tawar, potongan render membuang sebagian selubung depan impeler sehingga sudu asli pada mesh terlihat.

`shaft_sections.py` mencari lingkaran penampang pada delapan mesh poros, armature, atau hub. Pusat lingkaran diambil dari median penampang yang seporos, lalu dibandingkan dengan pivot registri. Sampel transform memastikan pusat tersebut tetap pada sumbu saat poros berputar, termasuk ketika penanda permukaan berpindah. Selisih ini mengukur kesesuaian geometri digital, bukan toleransi pabrikan.

Waktu putar film 28,75 detik pada 24 frame/detik. Lembar bukti publik `yanmar-6aym-r05-phases.jpg` menyertakan sembilan penggerak dengan tiga waktu pemutaran per baris, diambil langsung dari MP4. Batas regresi pusat poros 0,5 mm dan simpangan lateral 1 mm digunakan untuk mendeteksi kesalahan registrasi visual seperti impeler yang mengorbit rumahnya. Nilai selisih aktual terdapat di `mesh-axis-check.json`.
