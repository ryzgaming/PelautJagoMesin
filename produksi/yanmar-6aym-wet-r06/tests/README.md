# Menjalankan pemeriksaan ulang

Viewer hanya memerlukan browser dan server HTTP. Node/Playwright digunakan untuk pengujian pengembangan, bukan untuk membuka model.

Uji tanpa dependency tambahan:

```sh
python tools/verify.py
node tests/model-api.mjs
```

Uji browser opsional dengan Node 22+:

```sh
npm install
npx playwright install chromium
python tools/serve.py
```

Di terminal kedua (contoh Bash):

```sh
PACKAGE_URL=http://127.0.0.1:8766/ npm run test:browser
```

`CHROMIUM_EXECUTABLE` bisa menunjuk binari Chromium yang sudah terpasang. Uji dalam paket dijalankan dengan Node 24.22.3, Playwright 1.62.1, Chromium 156.0.8078.79 dan software renderer SwiftShader. Uji dapat lebih lambat pada komputer tanpa GPU. Tidak ada API AI atau kredensial yang diperlukan.

Audit independen dan bukti empat kombinasi UI/viewport berada di `agensi/validasi-pemisahan`. Skrip pengujian pose deterministik menyuntikkan observer melalui intersepsi response hanya pada sesi QA; observer tidak ditulis ke runtime yang digunakan pemilik. Dua UI dibandingkan pada clock simulasi yang sama. Artefak kegagalan kandidat lama diberi label historis dan dipisahkan dari laporan akhir.
