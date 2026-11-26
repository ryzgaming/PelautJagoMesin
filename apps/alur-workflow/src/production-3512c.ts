import {step,type Edge,type Graph,type Kind,type Step} from "./flow.ts";

export const production3512cId = "produksi-cat-3512c";

// Data acuan dari halaman produk resmi Cat 3512C Commercial Propulsion (IMO II), dicek 26 Nov 2026:
// https://www.cat.com/en_US/products/new/power-systems/marine-power-systems/commercial-propulsion-engines/18404461.html
// Semua angka di bawah tetap harus dikunci ulang oleh agent dokumentasi terhadap spec sheet / gambar resmi.
export const reference3512c = {
  source: "https://www.cat.com/en_US/products/new/power-systems/marine-power-systems/commercial-propulsion-engines/18404461.html",
  variant: "3512C propulsi standar, IMO II (bukan HD, bukan genset)",
  facts: [
    "V12, diesel 4-tak, twin turbocharged aftercooled (TTA)",
    "Bore 170 mm, stroke 190 mm, displacement 51,8 L",
    "Rentang putaran 1200–1800 rpm, daya 1281–2552 bhp tergantung rating",
    "Panjang maks 2590 mm, lebar 2037 mm, tinggi 1904 mm",
    "Dual A6 ECU, electronic unit injector, fuel transfer pump, duplex fuel filter",
    "Jacket water pump sentrifugal digerakkan gear, auxiliary fresh water pump, aftercooler sirkuit terpisah, keel cooling",
    "Thermostat terbuka penuh 92 °C, pompa oli tipe gear, crankcase breather di atas",
    "Flywheel housing SAE No. 00, 183 gigi; rail dudukan 203 × 203 mm atau front trunnion",
  ],
  conflicts: [
    "Berat kering maksimum tertulis 7411 kg di satu halaman Cat dan 8104 kg di halaman lain",
    "\"Length - Engine 111.1 in / 222.2 mm\" tidak konsisten (111,1 in ≈ 2822 mm) dan beda dengan panjang maks 2590 mm",
    "Varian HD dan well service memakai stroke 215 mm dan flywheel SAE No. 0 / 151 gigi: jangan tercampur",
  ],
};

type Spec = [kind:Kind, id:string, name:string, message:string];

const evidence = "Setiap angka diberi status DOCUMENTED / OBSERVED / ESTIMATED / UNKNOWN beserta sumber dan halaman.";

const stages: {title:string, steps:Spec[]}[] = [
  {title:"Bukti & inventaris", steps:[
    ["agen-orchestrator","b-orchestrator","Buka work order 3512C",
      "Buka work order produksi 3D untuk {catatan}. Tetapkan target: 1 model 3D interaktif yang bisa dibongkar per sistem. Kunci varian di awal: 3512C propulsi standar IMO II, bore 170 mm, stroke 190 mm, 51,8 L. Varian HD (stroke 215 mm, 58,6 L) dan genset dilarang dipakai sebagai sumber angka. Bagikan tugas ke setiap agent sesuai urutan alur ini dan catat semua keputusan di log proyek."],
    ["agen-chief-marine-engineer","b-chief","Tetapkan ruang lingkup",
      "Tetapkan daftar sistem yang wajib ada untuk {catatan}: blok & crank train, kepala silinder & valve train, bahan bakar (EUI), air tawar (jacket water + aftercooler sirkuit terpisah), air laut / keel cooling, pelumasan, udara masuk & gas buang (twin turbo, aftercooler), flywheel & dudukan. Tentukan tingkat detail per komponen (luar saja, potongan, atau lengkap) dan apa yang sengaja tidak dimodelkan. "+evidence],
    ["agen-legal-ip","b-legal","Cek hak pakai merek",
      "Periksa batas penggunaan nama Caterpillar, logo CAT, dan warna kuning khas Caterpillar pada model {catatan}. Spec sheet resmi menyebut merek dan trade dress itu tidak boleh dipakai tanpa izin, sedangkan standar workspace meminta warna cat sesuai foto produk. Jangan memutuskan sendiri: laporkan risikonya ke pemilik lewat Orchestrator. Pastikan tidak ada gambar atau teks manual yang disalin ke produk."],
    ["agen-oem-documentation","b-oem","Kumpulkan dokumen OEM",
      "Kumpulkan sumber resmi untuk {catatan}: halaman produk Cat 3512C IMO II, spec sheet propulsi, gambar instalasi (TMI atau dealer bila ada), parts manual, Systems Operation. Untuk bentuk luar, kumpulkan rekaman POV/vlog dan foto mesin 3512C nyata (bukan animasi 3D) lalu catat di dist/referensi.html beserta tingkat kecocokannya. Catat nomor dokumen, revisi, dan bagian yang dipakai. Yang belum didapat ditandai UNKNOWN, bukan diisi dari varian lain. "+evidence],
    ["agen-parts-inventory","b-parts","Susun inventaris komponen",
      "Susun daftar komponen dan hierarki rakitan {catatan} dari dokumen OEM: blok, crankshaft, connecting rod, piston, liner, kepala silinder, camshaft, rocker & katup, unit injector, turbocharger, aftercooler, pompa air, pompa oli, oil cooler, thermostat, filter, flywheel, damper, rail dudukan. Jumlah tiap komponen (katup per silinder, turbo, camshaft) wajib bersumber. Sertakan nomor part bila ada untuk Eksplor rakitan. "+evidence],
    ["agen-dimension-reference","b-dimensi","Kunci dimensi acuan",
      "Kunci dimensi acuan {catatan}: bore 170 mm, stroke 190 mm, panjang maks 2590 mm, lebar 2037 mm, tinggi 1904 mm, flywheel housing SAE No. 00 (183 gigi), rail 203 × 203 mm. Selesaikan konflik yang sudah ditemukan: berat kering maks 7411 kg vs 8104 kg, dan \"Length - Engine 111.1 in / 222.2 mm\" yang tidak konsisten. Konflik yang belum terpecahkan tetap UNKNOWN dan tidak boleh dipakai sebagai skala model."],
    ["agen-accuracy-reviewer","b-akurasi","Audit bukti",
      "Audit hasil tahap bukti untuk {catatan}: cocokkan setiap angka dengan sumber dan halamannya, pastikan tidak ada angka dari varian HD, genset, atau well service, dan cek semua status bukti terisi. Tolak bila ada dimensi utama tanpa sumber. Tulis daftar temuan dengan tingkat keparahan."],
    ["review","g1-bukti","Gerbang 1 · Kunci bukti",
      "Gerbang 1: varian, dokumen, inventaris komponen, dan dimensi acuan 3512C dikunci. Tahap aliran sistem baru boleh mulai bila semua dimensi utama DOCUMENTED."],
  ]},
  {title:"Aliran sistem", steps:[
    ["agen-diesel-specialist","s-fuel","Aliran bahan bakar",
      "Petakan aliran bahan bakar {catatan} dari dokumen: tangki → fuel transfer pump → duplex fuel filter → galeri → electronic unit injector tiap silinder → return. Jelaskan peran dual A6 ECU dalam mengatur injeksi. Tandai posisi komponen di mesin dan arah aliran. "+evidence],
    ["agen-separator-hx-specialist","s-freshwater","Sirkuit air tawar",
      "Petakan sirkuit air tawar {catatan}: jacket water pump sentrifugal (digerakkan gear) → blok & kepala silinder → thermostat (terbuka penuh 92 °C) → keel cooler atau heat exchanger. Pisahkan sirkuit aftercooler yang dilayani auxiliary fresh water pump. Catat arah aliran dan titik masuk/keluar. "+evidence],
    ["agen-separator-hx-specialist","s-seawater","Air laut & keel cooling",
      "Tentukan batas sisi air laut untuk {catatan}. Keel cooling adalah standar, sedangkan heat exchanger pelat dan seawater fuel cooler adalah opsi. Putuskan konfigurasi yang dimodelkan, tandai bagian yang berada di luar mesin (instalasi kapal), dan jangan mengarang pompa air laut bila tidak ada di dokumen varian ini."],
    ["agen-pump-compressor-specialist","s-lube","Sirkuit pelumasan",
      "Petakan sirkuit pelumasan {catatan}: sump → pompa oli tipe gear → oil cooler → filter → galeri utama → bantalan crankshaft, camshaft, turbocharger → kembali ke sump. Sertakan crankcase breather di atas mesin dan pilihan sump pan. "+evidence],
    ["agen-diesel-specialist","s-airgas","Udara masuk & gas buang",
      "Petakan jalur udara dan gas {catatan}: air cleaner Powercore → kompresor twin turbocharger → aftercooler sirkuit terpisah → intake manifold → silinder → exhaust manifold → turbin → keluaran gas buang. Jelaskan urutan kerja 4-tak dan pengapian kompresi. Urutan penyalaan (firing order) wajib bersumber dokumen. "+evidence],
    ["agen-component-writer","s-writer","Tulis penjelasan komponen",
      "Tulis penjelasan singkat untuk setiap komponen dan sistem {catatan} dalam Bahasa Indonesia untuk pelajar teknik kapal: fungsi, posisi, aliran yang lewat, dan kerusakan umum. Hanya pakai fakta berstatus DOCUMENTED atau OBSERVED; yang ESTIMATED diberi label jelas."],
    ["agen-accuracy-reviewer","s-akurasi","Audit aliran sistem",
      "Audit kelima aliran sistem {catatan}: arah aliran, urutan komponen, dan nilai (misalnya 92 °C thermostat) harus cocok dengan dokumen. Pastikan tidak ada komponen yang muncul di dua sistem secara bertentangan dan teks pelajar sama dengan data teknis."],
    ["review","g2-sistem","Gerbang 2 · Aliran sistem",
      "Gerbang 2: lima aliran (bahan bakar, air tawar, air laut, pelumasan, udara & gas) dan teks komponen 3512C lolos audit. Pemodelan 3D baru boleh mulai setelah ini."],
  ]},
  {title:"Model 3D", steps:[
    ["agen-modeling-3d","m-exterior","Model eksterior",
      "Modelkan bentuk luar {catatan} skala 1:1 milimeter dari dimensi yang sudah dikunci. Bentuk mengikuti rekaman POV/vlog dan foto mesin nyata, bukan animasi 3D. Cocokkan dulu siluet, proporsi, posisi poros, pipa, dan sambungan dari tampak depan, samping, atas, dan perspektif dengan material netral. Setelah itu baru detail, material, dan warna cat sesuai foto produk (soal logo ikut keputusan pemilik). Detail tanpa sumber diberi tanda ESTIMATED."],
    ["agen-modeling-3d","m-internal","Model internal",
      "Modelkan komponen internal {catatan} sesuai inventaris: crankshaft, connecting rod, piston (bore 170 mm), liner, camshaft, rocker, katup, unit injector, pompa air, pompa oli. Ikuti hierarki rakitan dan beri nama komponen persis seperti di inventaris supaya bisa dicari dan dibongkar per sistem."],
    ["agen-assembly-kinematics","m-kinematika","Kinematika rakitan",
      "Rangkai gerak {catatan}: putaran crankshaft menggerakkan 12 piston dengan langkah 190 mm, camshaft dan valve train mengikuti rasio 4-tak, dan injeksi sesuai urutan penyalaan bersumber. Pastikan tidak ada tabrakan antarbagian saat berputar dan pasang titik bongkar per sistem."],
    ["agen-geometry-qa","m-geometri","QA geometri",
      "Ukur ulang model {catatan} terhadap dimensi acuan: bore, stroke, panjang, lebar, tinggi, dan jarak antarsilinder bila bersumber. Toleransi dimensi utama ±1%. Cek normal, skala, tumpang-tindih mesh, dan nama komponen. Laporkan setiap selisih beserta nilainya."],
    ["agen-visual-qa","m-visual","QA visual",
      "Periksa tampilan {catatan} di desktop dan HP: label terbaca, warna cat sesuai foto produk dengan material logam dan karet yang terlihat, potongan memperlihatkan aliran dengan jelas, dan penanda estimasi tetap tampil. Bandingkan langsung dengan Shinko. Lampirkan tangkapan layar tampak depan, samping, atas, dan X-ray."],
    ["review","g3-model","Gerbang 3 · Geometri",
      "Gerbang 3: model eksterior dan internal 3512C lolos QA geometri (±1% dimensi utama) dan QA visual. Integrasi baru boleh mulai setelah ini."],
  ]},
  {title:"Integrasi", steps:[
    ["agen-production-pipeline","i-pipeline","Rakit paket mesin",
      "Gabungkan model, data aliran, teks komponen, dan metadata bukti {catatan} menjadi satu paket mesin di pipeline produksi. Pastikan setiap komponen membawa status bukti dan sumbernya, dan ukuran file layak dibuka di HP."],
    ["agen-simulator","i-simulator","Simulasi interaktif",
      "Buat interaksi pembelajaran {catatan}: putar crankshaft dan lihat piston serta katup bergerak, nyalakan animasi aliran per sistem (bahan bakar, air tawar, pelumasan, udara & gas), dan mode bongkar per komponen. Gerak harus konsisten dengan kinematika yang sudah dicek."],
    ["agen-frontend-ui","i-ui","Halaman pelajar",
      "Pasang {catatan} dengan standar Studio Gelap (docs/WORKSPACE_UI.md): kanvas penuh, tema graphite dengan aksen teal, navigasi bawah Eksplor keseluruhan, Sistem, Pengoperasian, X-ray. Jarak urai mulai 50%. Eksplor rakitan memakai assembly-diagram.js bersama. Uji ketuk komponen → diagram bernomor → rapatkan → kembali di 1280×800, 390×844, dan 844×390."],
    ["agen-automated-testing","i-tes","Tes otomatis",
      "Jalankan tes otomatis untuk {catatan}: halaman termuat tanpa error konsol, semua komponen di inventaris ada di model, setiap sistem punya animasi, dan waktu muat di jaringan HP wajar. Lampirkan hasil tes."],
    ["review","g4-integrasi","Gerbang 4 · Integrasi",
      "Gerbang 4: paket 3512C berjalan di halaman pelajar, semua tes otomatis lolos, dan interaksi berjalan di HP."],
  ]},
  {title:"Pemeriksaan & rilis", steps:[
    ["agen-content-qa","r-konten","QA konten",
      "Baca semua teks pelajar {catatan}: istilah teknis konsisten, Bahasa Indonesia jelas, tidak ada klaim tanpa sumber, dan label ESTIMATED terlihat pada data perkiraan."],
    ["agen-accuracy-reviewer","r-akurasi","Audit akhir",
      "Audit akhir {catatan}: telusuri ulang 10 angka utama di produk jadi ke dokumen sumber, pastikan varian tetap propulsi standar IMO II, dan semua konflik data sudah diselesaikan atau ditampilkan sebagai UNKNOWN."],
    ["agen-qa-lead","r-qa-lead","Definition of done",
      "Periksa definition of done untuk {catatan} butir demi butir. Semua gerbang 1–4 harus tercatat lolos. Satu butir gagal berarti kembali ke tahap yang bertanggung jawab, bukan dirilis dengan catatan."],
    ["agen-chief-marine-engineer","r-chief","Tanda tangan teknis",
      "Beri persetujuan teknis akhir untuk {catatan}: aliran sistem, gerak mesin, dan penjelasan sudah benar secara marine engineering dan layak diajarkan ke pelajar."],
    ["agen-devops-release","r-rilis","Rilis ke situs",
      "Tanyakan ke pemilik apakah {catatan} masuk katalog publik atau premium. Untuk premium, sumber tetap di premium-source/ dan tidak disalin ke dist/ sebelum pemeriksaan akses server siap. Rilis lewat PR, cek pratinjau Cloudflare, dan siapkan langkah rollback."],
    ["agen-memory-knowledge","r-memori","Simpan pelajaran",
      "Catat pelajaran dari produksi {catatan}: sumber yang paling berguna, konflik data yang ditemukan, dan waktu per tahap, supaya mesin berikutnya dari target 50 desain lebih cepat dan teliti."],
    ["confirm","r-selesai","Mesin siap dirilis",
      "Produksi 3D {catatan} selesai: lolos 4 gerbang mutu, audit akhir, dan tanda tangan Chief Marine Engineer."],
  ]},
];

const columnGap = 262, rowGap = 150, firstColumn = 320, top = 40;

export function production3512cGraph(): Graph {
  const start = step("trigger","order-3512c",40,top); start.name = "Order produksi CAT 3512C";
  const check = step("condition","cek-varian",firstColumn,top); check.name = "Varian ditulis di catatan?"; check.field = "catatan"; check.operator = "filled";
  const hold = step("review","tahan-varian",firstColumn+columnGap,top); hold.name = "Tahan: varian belum jelas";
  hold.message = "Produksi ditahan. Tulis varian di catatan, misalnya \"Caterpillar 3512C propulsi standar IMO II\", lalu jalankan ulang.";
  const nodes: Step[] = [start,check,hold];
  const chain: Step[] = [];
  stages.forEach((stage,row) => stage.steps.forEach(([kind,id,name,message],column) => {
    const node = step(kind,id,firstColumn+column*columnGap,top+(row+1)*rowGap);
    node.name = name; node.message = message;
    nodes.push(node); chain.push(node);
  }));
  const edges: Edge[] = [
    {from:start.id,port:"out",to:check.id},
    {from:check.id,port:"yes",to:chain[0].id},
    {from:check.id,port:"no",to:hold.id},
    ...chain.slice(1).map((node,i) => ({from:chain[i].id,port:"out" as const,to:node.id})),
  ];
  return {id:production3512cId,name:"Produksi CAT 3512C",revision:0,nodes,edges};
}

export const production3512cStages = stages.map(s => ({title:s.title, count:s.steps.length}));
