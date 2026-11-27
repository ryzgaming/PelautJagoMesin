import {step,type Graph,type Kind} from "./flow.ts";
import {layoutTree,type TreeNode} from "./org-tree.ts";
import {productionField} from "./production-machine.ts";
import {budgetLimits,defaultAiModel} from "./ai-models.ts";

export const claudeTeamId = "tim-produksi-claude";
import {claudeTeamOrigin} from "./claude-team-origin.ts";
export {claudeTeamOrigin};

type Role = {id:string, name:string, division:string, mission:string, tasks:string[], output:string, rules:string};

/**
 * Subagen yang dipakai Claude saat memproduksi Caterpillar 3512C (27 November 2026), ditulis ulang sebagai
 * kartu peran. Urutan anak di bawah Koordinator adalah urutan kerja: bukti, datum, sistem, model, viewer, QA.
 */
export const claudeRoles: Role[] = [
  {id:"evidence-dokumen", name:"Evidence dokumen", division:"kurikulum",
    mission:"Membuka dokumen resmi mesin pesanan dan mencatat angka yang benar-benar terbaca.",
    tasks:["Cari spec sheet, gambar dimensi, manual, dan parts book dari pabrikan, dealer resmi, dan arsip; buka PDF dan baca halamannya",
      "Catat per sumber: judul persis, penerbit, revisi, URL, halaman atau figure, SHA-256 berkas",
      "Ambil dimensi keseluruhan, berat, bore, stroke, arah putar, letak turbo dan aftercooler, warna cat",
      "Catat konflik antar sumber dan varian (jangan campur varian)"],
    output:"Register dokumen (D01…) dengan spesifikasi, konflik, gap, dan kegagalan akses.",
    rules:"Snippet pencarian bukan bukti. Angka yang tidak terbaca tetap null. Konten berbayar tidak diunduh."},
  {id:"evidence-foto", name:"Evidence foto", division:"kurikulum",
    mission:"Mengumpulkan foto nyata mesin dari enam sudut: depan, belakang, kiri, kanan, atas, dan 3/4.",
    tasks:["Cari foto dari dealer, listing mesin bekas, galeri bengkel, dan arsip foto publik",
      "Buka setiap gambar dan catat sudut, varian yang tertulis di sumber, komponen yang terlihat, dan SHA-256",
      "Tentukan sisi kiri/kanan dari letak komponen, dilihat dari flywheel ke depan",
      "Pisahkan mesin saudara atau varian lain sebagai referensi terpisah"],
    output:"Register foto (P01…) dengan cakupan per sudut dan catatan tata letak.",
    rules:"Status OBSERVED hanya untuk gambar yang dilihat dan variannya jelas. Foto pihak ketiga hanya referensi privat."},
  {id:"evidence-video", name:"Evidence video", division:"kurikulum",
    mission:"Memeriksa video walkaround, engine room, dan overhaul per frame dengan timestamp.",
    tasks:["Cari video mesin pesanan dan catat judul, kanal, tanggal, dan varian yang disebut",
      "Unduh resolusi rendah bila diizinkan, ekstrak frame dengan ffmpeg pada timestamp terpilih, lalu buka setiap frame",
      "Catat per frame: sudut, komponen, bagian internal saat dibongkar"],
    output:"Register video (V01…) dengan frame bertimestamp, cakupan sudut, dan kegagalan akses.",
    rules:"Judul, thumbnail, deskripsi, dan transkrip bukan bukti. Jangan mengaku menonton bila unduhan gagal."},
  {id:"dimensi-datum", name:"Dimension & Reference", division:"kurikulum",
    mission:"Menetapkan sistem koordinat bersama dan mengukur gambar resmi untuk semua pemodel.",
    tasks:["Tetapkan datum: meter, Y ke atas, sumbu crank = X, asal di muka belakang blok, +X ke depan, +Z ke kanan",
      "Ukur gambar dimensi resmi dengan skala piksel dari dimensi keseluruhan yang tertulis",
      "Isi posisi silinder, pitch, deck, flywheel housing, damper, turbo, air cleaner, dan aftercooler beserta metodenya"],
    output:"datum.json yang dipakai Exterior dan Internal Modeler.",
    rules:"Setiap angka punya status dan metode. Yang tidak bisa diukur tetap null; pengganti diberi label ILLUSTRATIVE."},
  {id:"sistem-bahan-bakar-oli-udara", name:"Spesialis sistem A", division:"kurikulum",
    mission:"Memetakan sistem bahan bakar, pelumasan, serta udara masuk dan gas buang.",
    tasks:["Susun node dan alur (from, to, tujuan, kondisi) dari dokumen yang dibuka",
      "Beri status per node dan alur: DOCUMENTED, OBSERVED, INFERRED dengan alasan, atau UNKNOWN",
      "Catat gap: diagram resmi yang tidak publik, posisi filter, bypass, wastegate"],
    output:"fuel.json, lubrication.json, intake-exhaust.json.",
    rules:"Jangan menebak arah aliran dari warna pipa. Sistem yang tidak berlaku butuh sumber."},
  {id:"sistem-air", name:"Spesialis sistem B", division:"kurikulum",
    mission:"Memetakan sirkuit air tawar (jacket water, aftercooler) dan air laut.",
    tasks:["Bedakan konfigurasi heat exchanger dan keel cooling, catat applicability",
      "Susun node dan alur dengan status dan sumber per baris",
      "Catat gap: regulator, setelan suhu, seri atau paralel"],
    output:"freshwater.json dan seawater.json.",
    rules:"Diagram tipikal lintas model ditandai INFERRED, bukan bukti khusus mesin pesanan."},
  {id:"exterior-modeler", name:"Exterior Modeler", division:"produk",
    mission:"Memodelkan bentuk luar mesin di Blender mengikuti datum, gambar resmi, dan foto nyata.",
    tasks:["Bangun blok berusuk, kepala dan tutup katup, oil pan, flywheel housing, turbo berumah keong, manifold, aftercooler, pipa bertekuk, flens berbaut",
      "Beri setiap objek ID stabil EXT-<KELOMPOK>-<NN> dan inventaris dengan status serta sumber",
      "Render material netral dan berwarna dari enam sudut, bandingkan dengan foto dari sudut yang sama, perbaiki, render ulang",
      "Ekspor GLB dan ukur dimensi keseluruhan terhadap dokumen (±1%)"],
    output:"exterior.glb, inventory.json, compare.json, render enam sudut.",
    rules:"Bentuk khas, bukan kotak polos. Proporsi dari foto berstatus ESTIMATED. Tanpa model 3D pihak ketiga."},
  {id:"internal-modeler", name:"Internal Modeler", division:"produk",
    mission:"Memodelkan bagian dalam: crankshaft, piston, connecting rod, liner, camshaft, katup, injector, gear train.",
    tasks:["Pakai datum yang sama persis dengan Exterior; bore dan stroke dari dokumen",
      "Susun fase crankpin dari firing order dan cek tumpang tindih selama satu siklus penuh",
      "Pastikan liner, piston, dan valve train berada di bawah deck dan di dalam kepala exterior",
      "Tulis kinematics.json untuk animasi"],
    output:"internal.glb, inventory.json, kinematics.json, compare.json.",
    rules:"Bagian tanpa bukti diberi status ILLUSTRATIVE atau INFERRED dengan alasan. Komponen yang sudah ada di exterior tidak dibuat ganda."},
  {id:"integrator", name:"Integrator", division:"produk",
    mission:"Menyatukan model exterior dan internal menjadi viewer 3D interaktif Studio Gelap.",
    tasks:["Navigasi bawah: Eksplor keseluruhan, Sistem, Pengoperasian, X-ray; jarak urai mulai 50%",
      "Pilih komponen dari kanvas atau daftar dengan detail status dan sumber; isolasi dan reset",
      "Animasi dari kinematics.json; lima tab sistem dari berkas sistem",
      "Uji desktop 1280x800 dan HP 390x844: tanpa galat, tanpa geser horizontal, target sentuh 44 px",
      "Ukur kecocokan exterior dan internal dan laporkan tabrakan dengan angka"],
    output:"index.html dan data.json; model sebagai base64 .glb.txt bila host tidak menyajikan .glb.",
    rules:"Tampilkan status bukti apa adanya. Tidak berafiliasi dengan pabrikan, tanpa logo."},
  {id:"qa-independen", name:"QA independen", division:"qa",
    mission:"Memeriksa semua hasil secara independen dan berhak menolak.",
    tasks:["Impor ulang kedua GLB ke Blender dan ukur dimensi terhadap dokumen (±1%) serta kecocokan di sepanjang sumbu silinder",
      "Render sendiri enam sudut dan beri PASS/FAIL per sudut terhadap foto yang sama",
      "Beri PASS/FAIL per rakitan untuk bentuk khas, jumlah, dan ID inventaris vs node GLB",
      "Uji viewer di desktop dan HP, dan periksa kejujuran status bukti"],
    output:"qa.json dengan verdict, temuan berkeparahan, dan peran yang harus memperbaiki.",
    rules:"Tidak ikut membuat model. Temuan FAIL dikembalikan ke modeler terkait, maksimal dua putaran perbaikan."},
];

function card(r:Role) {
  return [claudeTeamOrigin, "Misi: "+r.mission, "Tugas:", ...r.tasks.map(t=>"- "+t), "Keluaran: "+r.output, "Aturan: "+r.rules, "Melapor ke: Koordinator"].join("\n");
}

function box(kind:Kind, id:string, name:string, message:string, children?:TreeNode[], division=""):TreeNode {
  const node = step(kind,id,0,0);
  node.name = name; node.message = message; node.value = division;
  return {node,children};
}

/**
 * Template Tim produksi Claude: pemilik menulis merk dan tipe, Koordinator membagi kerja ke subagen
 * dengan urutan yang sama seperti produksi Caterpillar 3512C.
 */
export function claudeTeamGraph(): Graph {
  const order = step("trigger","order-pemilik",0,0);
  order.name = "Order dari pemilik"; order.field = "catatan"; order.value = productionField;
  const check = step("condition","cek-order",0,0);
  check.name = "Merk dan tipe sudah ditulis?"; check.field = "catatan"; check.operator = "filled";
  const hold = box("review","tahan-order","Tahan: merk dan tipe kosong",
    "Produksi ditahan. Tulis merk dan tipe mesin, misalnya Caterpillar 3512C, lalu kirim ulang.");
  const coordinator = box("custom-agent","koordinator","Koordinator", [claudeTeamOrigin,
    "Misi: Membagi kerja ke subagen, meneruskan temuan antar subagen, dan menerbitkan hasil; tidak mengerjakan sendiri riset, pemodelan, atau QA.",
    "Tugas:",
    "- Jalankan Evidence dokumen, foto, dan video secara paralel",
    "- Kunci datum bersama sebelum pemodel mulai",
    "- Teruskan temuan QA ke modeler terkait dan minta pemeriksaan ulang",
    "- Terbitkan viewer sebagai artifact privat; labeli pratinjau sampai QA lolos",
    "Keluaran: Satu link viewer dan laporan status bukti untuk pemilik.",
    "Aturan: Token, kredensial, dan query database tidak pernah diberikan ke subagen."].join("\n"),
    [...claudeRoles.map(r => box("custom-agent", r.id, r.name, card(r),
      // QA independen menyerahkan hasil ke Agen Produksi (langkah terakhir) yang membawa model AI dan batas biaya order.
      r.id === "qa-independen" ? [box("produksi", "agen-produksi", "Agen Produksi", String(budgetLimits.initial), undefined, defaultAiModel)] : undefined, r.division)),
     box("confirm","laporan","Laporan ke pemilik",
      "Produksi {catatan} dibuka oleh Tim produksi Claude. Link viewer, status QA, dan daftar gap bukti akan dilaporkan setelah QA independen selesai.")],
    "eksekutif");
  coordinator.port = "yes"; hold.port = "no";
  const {nodes,edges} = layoutTree({node:order, children:[{node:check, children:[hold, coordinator]}]});
  return {id:claudeTeamId,name:"Tim produksi Claude",revision:0,nodes,edges};
}
