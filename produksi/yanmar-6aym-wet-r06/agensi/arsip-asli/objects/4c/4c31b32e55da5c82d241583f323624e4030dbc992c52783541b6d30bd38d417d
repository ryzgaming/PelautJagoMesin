# Film inspeksi Yanmar 6AYM-WET

Film vertikal ini dirender secara lokal dari GLB eksterior dan internal, definisi gerak di `model/internal/kinematics.json`, serta garis pusat dan arah di `model/flow/routes.json`. Klip referensi hanya digunakan untuk meninjau cara menampilkan mesin transparan, pergerakan piston, aliran dan penguraian rakitan.

Satu siklus empat langkah menempuh 720° putaran poros engkol. Urutan silinder dan geometri torak-batang memakai data model. Laju putaran sengaja diperlambat. Sorotan gas panas, jendela injeksi, laju sorotan fluida, ukuran pita warna dan offset penguraian memberi petunjuk visual. Sorotan bukan pengukuran pembakaran, debit, tekanan atau temperatur. Rute tersembunyi memakai geometri skematis dari registri. Mesin dijeda selama penguraian dan pemasangan kembali. Enam pembakaran ditinjau dari posisi piston yang diproyeksikan ke frame video hasil dekode.

Jalankan dari mesin Linux dengan EGL/Mesa, FFmpeg dan FFprobe, font DejaVu Sans, serta pustaka Python di bawah ini.

```sh
python3 -m pip install numpy scipy Pillow moderngl glcontext
python3 render_film.py --preview
python3 render_film.py
python3 check_film.py
```

Keluaran untuk viewer adalah `review/assets/film/yanmar-6aym-r04.mp4` dan `yanmar-6aym-r04.jpg`. `render.json` mencatat hash kedua GLB dan registri. `decoded-qa.json`, `decoded-storyboard.jpg`, dan `decoded-combustion.jpg` menggunakan hasil dekode MP4. Keluaran sumber QA tetap di direktori ini.

Pada 4,73–6,25 detik, kamera mengikuti duct dari kompresor ke air cooler dan memperlihatkan dua expansion joint berflensa. Ketiga ruas duct, dua joint, gasket dan fastener diambil dari mesh r04 yang mengacu pada D05 Fig. 36. Sorotan biru mengikuti pusat bore. Garis putus-putus pada tahap aliran lain menunjukkan bagian skematis. Jalur oli pada poros ikut berputar dengan poros engkol, sedangkan ujung drainase yang mencapai karter menetap; peralihan itu menggunakan bobot tiap titik dari registri aliran.
