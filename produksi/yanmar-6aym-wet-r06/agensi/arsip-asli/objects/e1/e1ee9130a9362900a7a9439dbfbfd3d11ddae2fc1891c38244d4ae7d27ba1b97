# Audio starting R06 — suara ilustrasi

Modul: `review/assets/engine-audio.js`, global `OrangMesinAudio.create()`.

Audio ini disintesis untuk pembelajaran dari oscillator dan noise deterministik. Tidak memuat rekaman internet dan bukan rekaman atau pengukuran akustik Yanmar 6AYM-WET. Warna suara, amplitudo, starter pitch dan lapisan turbo adalah ilustrasi. Tidak mengklaim tekanan, boost, kecepatan starter/gear ratio OEM, maupun tingkat kebisingan terkalibrasi.

## Integrasi

Buat satu instance. Awali `setMuted(true)` bila kontrol UI bersifat opt-in. Panggil `unlock()` langsung dari handler tap/click; hasilnya Promise boolean. Setelah itu `update({phase,rpm,elapsed,paused})` menerima fase `off`, `engaging`, `cranking`, `firing`, `running`, `stopping`. Kirim rpm operasi aktual, bukan rpm tampilan gerak lambat. `setVolume(0..1)`, `setMuted(bool)`, `dispose()` tersedia; `probe()` mengembalikan status untuk QA.

- OFF: semua output hening.
- ENGAGING: bunyi pendek ilustrasi solenoid/kontak starter.
- CRANKING: dengung starter + gesekan mekanis, kanal pembakaran tetap hening.
- FIRING/RUNNING: pulsa pembakaran enam silinder empat langkah, `rpm × 6 / 120` pulsa per detik, exhaust rumble dan lapisan mekanis. Lapisan turbo sangat kecil dan hanya muncul di atas 900 rpm sebagai ilustrasi, tanpa mengklaim boost.
- STOPPING: kanal pembakaran dan starter ditutup; suara mekanis mengikuti rpm yang menurun.
- PAUSE/mute/tab hidden: output master mendekati nol dengan ramp 15 ms untuk menghindari klik.

Frekuensi pulsa mengikuti rpm. Fase audio oscillator tidak dikunci sampel demi sampel ke sudut engkol visual. Ketika gerak diperlambat demi belajar, suara mengikuti rpm operasi; UI harus tetap menyebut gerak lambat dan suara ilustrasi. Tidak ada akses mikrofon, file jaringan, partikel CPU, atau oscillator baru per frame. Node kontinu dibuat sekali saat unlock; one-shot klik dibersihkan setelah berakhir; dispose memutus node dan menutup context milik modul.

## Pengujian 28 November 2026

Jalankan `python doc/audio/verify_audio.py` dari lingkungan yang memiliki Playwright/Chromium. Hasil browser WebAudio sebenarnya di `audio-verification.json`:

- Pemanggilan tanpa gesture tidak membuat AudioContext. Klik nyata Playwright membuka audio.
- Cranking menghasilkan starter dan tidak mengaktifkan kanal pembakaran.
- Pause, mute, stop dan event visibility menutup master. Pengujian visibility memakai override properti document.hidden; penghentian otomatis OS saat background di HP fisik belum diuji.
- 1.000 update tidak menambah node. Dispose menutup AudioContext dan mengosongkan node.
- OfflineAudioContext merender PCM mono 22.050 Hz, 10 detik. Peak 0,3073 (rentang -1..1), tanpa clipping. Interval sebelum start dan sesudah stop tepat hening; pause setelah ramp juga hening.
- Pada 650 rpm, peak spektrum sekitar frekuensi pulsa yang diharapkan tepat 32,5 Hz, resolusi FFT 0,5 Hz. Lihat `spectrum.json`.

Dengarkan `starting-running-stopping-illustration.wav`: 0–0,5 s hening; 0,5 s engagement; 0,8 s crank; 2,8 s firing; 3,3 s idle; 5,6–6,3 s pause; 7,5 s coast-down; 9 s off. WAV memakai renderer yang sama dengan modul, bukan file contoh terpisah. Kualitas subjektif pada speaker/headphone dan HP fisik belum dinilai oleh pengujian numerik ini.
