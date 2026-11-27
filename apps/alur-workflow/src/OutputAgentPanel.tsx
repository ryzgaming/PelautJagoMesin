import {Combine,FileText} from "lucide-react";

/** Panel Agent Penghimpun dan Agent Word: menjelaskan apa yang dihasilkan dan di mana menaruh langkahnya. */
export default function OutputAgentPanel({kind}:{kind:"penghimpun"|"word"}) {
  const word=kind==="word";
  return <>
    <p className="plugin-help">{word
      ?"Agent Word menyusun hasil alur menjadi dokumen Word (.docx) yang profesional: judul, ringkasan dalam tabel, aturan umum, tugas setiap agent dalam daftar bernomor, celah yang perlu ditindaklanjuti, header nama alur, dan nomor halaman. Dokumen bisa dibuka di Word, Google Docs, atau LibreOffice."
      :"Agent Penghimpun mengumpulkan hasil kerja semua agent dalam alur ini menjadi satu prompt yang tertata: tujuan, ringkasan, aturan umum, tugas per agent, celah, dan format hasil yang diminta. Prompt itu bisa disalin ke Claude atau Codex, atau diteruskan ke langkah berikutnya."}</p>
    <div className="branch-info">{word?<FileText size={16}/>:<Combine size={16}/>}<div><strong>Letakkan setelah Pembagi tugas</strong>
      <p>Langkah ini membaca tugas yang sudah dibagikan ke agent. Sambungkan dari agent terakhir atau dari Pembagi tugas, lalu jalankan Uji alur. Hasilnya muncul di Laporan pembagian tugas{word?" sebagai tombol Unduh Word":" sebagai Prompt terhimpun"}.</p></div></div>
    <p className="prompt-note">Saat bagan dikirim ke produksi, pekerja Claude/Codex juga diminta {word?"menyerahkan laporan akhir dalam bentuk dokumen Word (.docx)":"menghimpun hasil semua peran menjadi satu prompt tertata"}.</p>
  </>;
}
