import {step,type Graph,type Kind} from "../workflow/flow.ts";
import {layoutTree,type TreeNode} from "../agents/org-tree.ts";

export const productionId = "produksi-mesin-3d";
export const productionField = "Merk dan tipe mesin";

const evidence = " Setiap angka diberi status DOCUMENTED / OBSERVED / ESTIMATED / UNKNOWN beserta sumber dan halamannya.";

function box(kind:Kind, id:string, name:string, message:string, children?:TreeNode[]):TreeNode {
  const node = step(kind,id,0,0);
  node.name = name; node.message = message;
  return {node,children};
}

/**
 * Template produksi desain 3D untuk satu mesin. Pemilik cukup menulis merk dan tipe;
 * pekerjaan dibagi seperti perusahaan: Direktur Produksi → kepala divisi → staf.
 */
export function productionGraph(): Graph {
  const order = step("trigger","order-pemilik",0,0);
  order.name = "Order dari pemilik"; order.field = "catatan"; order.value = productionField;
  const check = step("condition","cek-order",0,0);
  check.name = "Merk dan tipe sudah ditulis?"; check.field = "catatan"; check.operator = "filled";
  const hold = box("review","tahan-order","Tahan: merk dan tipe kosong",
    "Produksi ditahan. Tulis merk dan tipe mesin, misalnya Caterpillar 3512C, lalu kirim ulang.");

  const teknik = box("agen-chief-marine-engineer","kepala-teknik","Kepala Teknik Mesin",
    "Pimpin tim teknik untuk {catatan}. Tetapkan dulu varian yang dibuat: bila tipe ini punya beberapa varian (misalnya propulsi atau genset, rating, atau ukuran langkah berbeda), pilih satu yang dokumennya paling lengkap, tulis alasannya, dan laporkan ke Direktur untuk dikonfirmasi pemilik. Tetapkan sistem yang wajib dimodelkan dan tingkat detail per komponen. Angka dari varian lain dilarang dipakai.", [
    box("agen-oem-documentation","dokumentasi-oem","Dokumentasi OEM",
      "Cari sumber resmi {catatan}: halaman produk pabrikan, spec sheet, gambar instalasi atau general arrangement, parts manual, dan manual operasi. Untuk bentuk luar, kumpulkan rekaman POV/vlog dan foto mesin nyata (bukan animasi 3D), lalu catat di dist/referensi.html beserta tingkat kecocokannya. Catat nomor dokumen, revisi, dan halaman, serta daftarkan semua varian yang ditemukan."+evidence),
    box("agen-parts-inventory","inventaris","Inventaris komponen",
      "Susun daftar komponen dan hierarki rakitan {catatan} dari dokumen OEM, lengkap dengan jumlah dan nomor part bila ada, untuk Eksplor rakitan. Jumlah komponen wajib bersumber; yang belum pasti ditandai UNKNOWN."),
    box("agen-dimension-reference","dimensi","Dimensi acuan",
      "Kunci dimensi utama {catatan} dari dokumen varian terpilih: panjang, lebar, tinggi, berat, ukuran silinder atau impeler, posisi poros, flens, dan sambungan. Bandingkan antarsumber. Bila angka bertentangan, catat keduanya beserta sumbernya dan tandai UNKNOWN sampai terpecahkan. Angka UNKNOWN tidak boleh dipakai sebagai skala model."),
    box("agen-diesel-specialist","spesialis-diesel","Spesialis mesin diesel",
      "Bila {catatan} adalah mesin pembakaran, petakan aliran bahan bakar, udara masuk, dan gas buang, termasuk turbocharger, aftercooler, injeksi, dan urutan penyalaan dari dokumen. Bila bukan bidangmu, tulis \"tidak berlaku\" beserta alasannya."+evidence),
    box("agen-pump-compressor-specialist","spesialis-pompa","Spesialis pompa & kompresor",
      "Petakan sirkuit pelumasan dan semua pompa atau kompresor pada {catatan}: jenis, penggerak, arah aliran, serta titik masuk dan keluar. Bila {catatan} sendiri pompa atau kompresor, petakan juga cara kerja utamanya (impeler atau rotor, rumah, seal, bantalan)."+evidence),
    box("agen-separator-hx-specialist","spesialis-pendingin","Spesialis separator & pendingin",
      "Petakan sistem pendinginan {catatan} (air tawar, air laut, keel cooler, heat exchanger, thermostat) beserta nilai suhu dari dokumen. Bila {catatan} adalah separator atau heat exchanger, petakan cara kerja utamanya. Bagian yang termasuk instalasi kapal, bukan mesin, ditandai terpisah."+evidence),
    box("agen-component-writer","penulis-materi","Penulis materi",
      "Tulis penjelasan setiap komponen dan sistem {catatan} dalam Bahasa Indonesia untuk pelajar teknik kapal: fungsi, posisi, aliran yang lewat, dan kerusakan umum. Hanya pakai fakta DOCUMENTED atau OBSERVED; data ESTIMATED diberi label jelas."),
  ]);

  const keuangan = box("agen-cfo","kepala-keuangan","Kepala Keuangan & Legal",
    "Awasi biaya dan risiko hukum produksi {catatan}. Pastikan pemeriksaan Legal & IP selesai sebelum model dipublikasikan, dan catat biaya alat atau sumber berbayar yang dipakai.", [
    box("agen-legal-ip","legal","Legal & IP",
      "Periksa aturan penggunaan nama, logo, dan warna khas pabrikan {catatan} menurut dokumen pabrikan. Laporkan risikonya ke Direktur untuk diputuskan pemilik; jangan memutuskan sendiri. Pastikan tidak ada gambar atau teks manual yang disalin ke produk."),
  ]);

  const produk = box("agen-cto","kepala-produk","Kepala Produk & Teknologi",
    "Pimpin pembuatan model dan workspace {catatan}. Pemodelan baru boleh mulai setelah Gerbang 1 (bukti dikunci) dan Gerbang 2 (aliran sistem lolos audit) ditandatangani Kepala QA.", [
    box("agen-modeling-3d","pemodel","Pemodel 3D",
      "Modelkan {catatan} skala 1:1 milimeter dari dimensi yang dikunci. Bentuk mengikuti rekaman POV/vlog dan foto mesin nyata, bukan animasi 3D. Cocokkan dulu siluet, proporsi, posisi poros, pipa, dan sambungan dari tampak depan, samping, atas, dan perspektif dengan material netral. Setelah itu baru detail, material, dan warna cat sesuai foto produk. Detail tanpa sumber ditandai ESTIMATED, dan nama bagian mengikuti inventaris."),
    box("agen-assembly-kinematics","perakitan","Perakitan & gerak",
      "Rangkai hierarki rakitan dan gerak {catatan} sesuai dokumen: poros, piston atau impeler atau rotor, katup, dan rasio gerak. Pastikan tidak ada tabrakan saat bergerak dan setiap rakitan utama bisa diurai untuk Eksplor rakitan."),
    box("agen-simulator","simulasi","Simulasi",
      "Buat simulasi Sistem dan Pengoperasian {catatan}: animasi aliran per sistem dan kontrol operasi yang memang ada pada mesin aslinya. Gerak harus konsisten dengan hasil perakitan."),
    box("agen-frontend-ui","workspace","Workspace pelajar",
      "Pasang {catatan} dengan standar Studio Gelap (docs/workspace/README.md): kanvas penuh, tema graphite dengan aksen teal, navigasi bawah Eksplor keseluruhan, Sistem, Pengoperasian, X-ray, Jarak urai mulai 50%, dan Eksplor rakitan memakai assembly-diagram.js. Uji di 1280×800, 390×844, dan 844×390, lalu bandingkan dengan Shinko."),
    box("agen-production-pipeline","pipeline","Pipeline produksi",
      "Gabungkan model, data aliran, teks, dan metadata bukti {catatan} menjadi satu paket mesin. Setiap komponen membawa status bukti dan sumbernya, dan ukuran file layak dibuka di HP."),
    box("agen-devops-release","rilis","Rilis",
      "Tanyakan ke pemilik lewat Direktur apakah {catatan} masuk katalog publik atau premium. Untuk premium, sumber tetap di premium-source/ dan tidak disalin ke dist/ sebelum pemeriksaan akses server siap. Rilis lewat PR setelah Kepala QA dan Kepala Teknik Mesin menyetujui, cek pratinjau Cloudflare, dan siapkan rollback."),
  ]);

  const qa = box("agen-qa-lead","kepala-qa","Kepala QA & Akurasi",
    "Jaga 4 gerbang mutu {catatan} dan tanda tangani masing-masing: Gerbang 1 bukti dikunci, Gerbang 2 aliran sistem lolos audit, Gerbang 3 geometri dan visual lolos, Gerbang 4 integrasi lolos tes. Satu butir definition of done gagal berarti kembali ke tim yang bertanggung jawab, bukan dirilis dengan catatan.", [
    box("agen-accuracy-reviewer","auditor","Auditor akurasi",
      "Audit setiap angka {catatan} terhadap sumber dan halamannya di setiap gerbang: tidak ada angka dari varian lain, semua status bukti terisi, dan konflik data tercatat. Di akhir, telusuri ulang 10 angka utama di produk jadi ke dokumen sumber."),
    box("agen-geometry-qa","qa-geometri","QA geometri",
      "Ukur ulang model {catatan} terhadap dimensi acuan dengan toleransi ±1% untuk dimensi utama. Cek skala, normal, mesh tumpang-tindih, dan nama komponen. Laporkan setiap selisih beserta nilainya."),
    box("agen-visual-qa","qa-visual","QA visual",
      "Periksa tampilan {catatan} di desktop dan HP: label terbaca, warna cat sesuai foto produk, material logam dan karet terlihat, X-ray jelas, dan penanda estimasi tetap tampil. Bandingkan langsung dengan Shinko dan lampirkan tangkapan layar."),
    box("agen-automated-testing","tes-otomatis","Tes otomatis",
      "Jalankan tes otomatis {catatan}: halaman termuat tanpa error konsol, semua komponen di inventaris ada di model, setiap sistem punya animasi, Eksplor rakitan berjalan (ketuk, diagram bernomor, rapatkan, kembali), dan waktu muat di HP wajar."),
    box("agen-content-qa","qa-konten","QA konten",
      "Baca semua teks pelajar {catatan}: istilah teknis konsisten, Bahasa Indonesia jelas, tidak ada klaim tanpa sumber, dan label ESTIMATED terlihat."),
  ]);

  const direktur = box("agen-orchestrator","direktur","Direktur Produksi",
    "Buka work order produksi desain 3D untuk {catatan} dan bagi tugas ke kepala divisi sesuai bagan ini. Jaga urutan mutu: Gerbang 1 bukti dikunci, Gerbang 2 aliran sistem lolos audit, Gerbang 3 geometri lolos QA, Gerbang 4 integrasi lolos tes, lalu rilis. Tidak ada tahap yang mulai sebelum gerbang sebelumnya ditandatangani Kepala QA. Catat semua keputusan di log proyek.", [
    teknik, keuangan, produk, qa,
    box("agen-memory-knowledge","arsip","Arsip pengetahuan",
      "Catat pelajaran dari produksi {catatan}: sumber terbaik, konflik data, keputusan varian, dan waktu per tahap, supaya mesin berikutnya dari target 50 desain lebih cepat dan teliti."),
    box("confirm","laporan","Laporan ke pemilik",
      "Work order {catatan} sudah dibuka dan dibagi ke 4 divisi. Varian yang dipilih, risiko merek, dan keputusan katalog publik atau premium akan dilaporkan untuk kamu setujui."),
  ]);
  direktur.port = "yes"; hold.port = "no";

  const {nodes,edges} = layoutTree({node:order, children:[{node:check, children:[hold, direktur]}]});
  return {id:productionId,name:"Produksi mesin 3D",revision:0,nodes,edges};
}
