# Kontrak runtime Yanmar r06

Paket memakai aset model terkunci yang tercantum di [manifest](../model/manifest.json).
Kedua GLB dan inventaris JSON sama byte demi byte dengan draf r06. Semua
1.184 ID komponen dipertahankan. Runtime membaca aset relatif terhadap
manifest. Metadata inventaris disalin ke sesi sebelum handle Three.js
dipasang untuk pemilihan. Penyuntingan scene selama inspeksi hanya berlaku
dalam memori sesi.

## Dua lapisan

- `powertrain.js` menangani urutan start, kait pinion, fase poros, jeda,
  putaran ilustratif dan reset. Bisa diimpor di Node atau browser tanpa
  DOM, WebGL atau mediator Studio. `step(dt)` menerima detik yang sudah
  berlalu. Penggerak ikut menerima sampel dari `mechanics.tick()` bila
  driver fisik disuntikkan.
- `engine-session.js` memiliki scene dan binding GLTF, penggerak, aliran,
  pembakaran, input orbit, dan audio. Panggil `createEngineSession({host})`
  dengan elemen wadah kanvas. Aplikasi memasang elemen, kontrol, panel,
  bahasa, dan penyimpanan preferensi.

## Contoh integrasi

Host berisi pustaka lokal yang tercantum dalam [manifest runtime](manifest.json).
Muat lima skrip tersebut sebelum impor berikut. Lihat
[panel ringkas](../ui-workspace/minimal.html) untuk contoh yang berjalan.

```js
import {createEngineSession} from '../runtime/engine-session.js';

const model = createEngineSession({host: document.querySelector('#viewer')});
model.subscribe(({type, state}) => {
  if (type === 'change' || type === 'ready') {
    document.querySelector('#status').textContent = state.phase;
  }
});
await model.load();
model.setMode('operation');
document.querySelector('#start').addEventListener('click', () => model.start());
document.querySelector('#stop').addEventListener('click', () => model.stop());
```

| Panggilan | Efek |
| --- | --- |
| `load()` | Memuat manifest, inventaris dan kedua GLB. Pemanggil paralel memakai tugas yang sama. |
| `start(), pause(), resume(), stop(), reset()` | Mengendalikan satu siklus mesin. Reset memulihkan putaran dan mekanisme ke pose awal. Mulai memohon akses audio dari tindakan pengguna. |
| `setMode(mode)` | Memilih pose dasar `home`, `overview`, `systems`, `operation`, atau `drives`. |
| `setOverviewSpread(amount)` | Mengatur posisi urai dari 0 hingga 1 pada mode overview. |
| `select(id), inventory()` | Memilih ID stabil, termasuk alias yang ada pada manifest inventaris, dan mengambil daftar nama serta ID. |
| `selectDrive(id), setXray(enabled)` | Memfokuskan mekanisme dan mengatur keterlihatan rumah. `starter-pinion` membuka fokus starter. |
| `setFlow(key), setBlockSection(enabled), setChamberFocus(enabled)` | Memilih aliran, membuka potongan blok, dan memfokuskan ruang bakar. Potongan memerlukan mode operasi atau sistem yang terpasang. |
| `setCapTest(pressure)` | Memeragakan preset tutup pendingin saat mesin mati. `null` memulihkan posisi normal. |
| `setMuted(muted), setVolume(volume), unlockAudio()` | Mengatur suara peragaan. Volume berada dalam 0 hingga 0,5. Unlock memerlukan tindakan pengguna di browser. |
| `snapshot(), subscribe(listener)` | Membaca keadaan saja dan menerima peristiwa. Pendaftaran mengembalikan fungsi untuk berhenti menerima peristiwa. |
| `dispose()` | Menghentikan loop, kamera dan audio serta melepaskan kanvas. Pakai sesi baru untuk pemasangan kembali. |

Peristiwa `inventory` tersedia sebelum WebGL dimulai. `ready`
menyertakan `detail.partial` bila hanya satu GLB berhasil dimuat.
`change` menandai perubahan kendali atau fase, `select` menyertakan ID
terpilih, dan `context-lost` / `context-restored` melaporkan keadaan
WebGL. Untuk telemetri per frame, baca `snapshot()` dari loop antarmuka.
`audio-error` memungkinkan antarmuka menampilkan instruksi untuk mencoba
lagi. `load()` dapat ditangkap untuk tetap menyajikan inventaris saat
perangkat tidak dapat membuka WebGL.

Opsi factory menerima `manifestURL`, `deps`, fungsi preferensi tampilan,
`muted`, dan `volume`. Jalur aset dibaca relatif terhadap URL manifest.
API `workspace` adalah jembatan internal untuk lembar rakitan Studio
yang menggunakan kamera dan node Three.js secara langsung. Panel ringkas
memakai perintah publik dan berdiri tanpa jembatan tersebut.

Jalankan `node tests/model-api.mjs` dari akar paket untuk menguji checksum,
ID dan siklus start/stop murni. Uji browser opsional ada di
[tests/browser.mjs](../tests/browser.mjs).
