// The editor and the Pages function share this catalog and its execution rules.
export const fieldLabels = { nama: "Nama", email: "Email", catatan: "Catatan", hasil: "Hasil robot terakhir" };
export type Field = keyof typeof fieldLabels;
export type RunFields = Record<Field, string>;
export type Group = "Teks" | "Daftar" | "Pemeriksaan" | "Angka" | "Satuan mesin" | "Robot laporan";
type Parameter = { label: string; initial: string };
type Action = (input: string, value: string) => string;
type Plugin = {
  id: `robot-${string}`; name: string; group: Group; help: string; field: Field;
  parameter?: Parameter; template?: string;
  transform?: Action; check?: (input: string, value: string) => boolean;
};

const catalog: Plugin[] = [];
function action(group: Group, id: string, name: string, help: string, transform: Action, field: Field = "catatan", parameter?: Parameter) {
  catalog.push({ id: `robot-${id}`, name, group, help, field, parameter, transform });
}
function check(id: string, name: string, help: string, test: NonNullable<Plugin["check"]>, field: Field = "catatan", parameter?: Parameter) {
  catalog.push({ id: `robot-${id}`, name, group: "Pemeriksaan", help, field, parameter, check: test });
}
function numeric(s: string) {
  const v = s.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v) || !Number.isFinite(Number(v))) throw Error("Isi satu angka tanpa satuan atau pemisah ribuan.");
  return Number(v);
}
function decimal(n: number) {
  if (!Number.isFinite(n)) throw Error("Hasil perhitungan di luar jangkauan.");
  return String(Number(n.toPrecision(12)));
}
const lines = (s: string) => s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const words = (s: string) => s.trim().split(/\s+/u).filter(Boolean);
const fold = (s: string) => s.trim().toLocaleLowerCase("id-ID");
const letters = (s: string) => Array.from(s);
const param = (label: string, initial: string) => ({label, initial});

action("Teks", "trim", "Pangkas spasi tepi", "Hapus spasi awal dan akhir.", s => s.trim());
action("Teks", "spaces", "Rapikan spasi", "Satukan spasi dan jeda baris menjadi satu spasi.", s => words(s).join(" "));
action("Teks", "upper", "Huruf kapital", "Ubah seluruh teks menjadi huruf besar.", s => s.toLocaleUpperCase("id-ID"));
action("Teks", "lower", "Huruf kecil", "Ubah seluruh teks menjadi huruf kecil.", fold);
action("Teks", "title", "Kapital awal kata", "Rapikan kapitalisasi setiap kata pada nama.", s => fold(s).replace(/(^|[\s-])(\p{L})/gu, (_, gap, ch) => gap + ch.toUpperCase()), "nama");
action("Teks", "initials", "Ambil inisial", "Ambil huruf awal dari setiap kata pada nama.", s => words(s).map(x => letters(x)[0].toUpperCase()).join(""), "nama");
action("Teks", "slug", "Buat slug", "Buat pengenal huruf kecil dengan pemisah tanda hubung.", s => fold(s).normalize("NFKD").replace(/\p{M}/gu,"").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,""));
action("Teks", "prefix", "Tambahkan awalan", "Letakkan teks tetap sebelum isi kolom.", (s,v) => v+s, "catatan", param("Awalan","Unit "));
action("Teks", "suffix", "Tambahkan akhiran", "Letakkan teks tetap sesudah isi kolom.", (s,v) => s+v, "catatan", param("Akhiran"," WIB"));
action("Teks", "first-word", "Ambil kata pertama", "Ambil kata pertama dari isian.", s => words(s)[0] || "");
action("Teks", "last-word", "Ambil kata terakhir", "Ambil kata terakhir dari isian.", s => words(s).at(-1) || "");
action("Teks", "count-words", "Hitung kata", "Hitung kata yang dipisahkan spasi atau jeda baris.", s => String(words(s).length));
action("Teks", "count-chars", "Hitung karakter", "Hitung karakter termasuk spasi dan tanda baca.", s => String(letters(s).length));
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
function emailParts(s: string) {
  if (!emailOk(s)) throw Error("Isi alamat email yang lengkap.");
  return s.trim().split("@");
}
action("Teks", "domain", "Ambil domain email", "Ambil bagian alamat sesudah @.", s => emailParts(s)[1].toLowerCase(), "email");
action("Teks", "mailbox", "Ambil nama kotak surat", "Ambil bagian alamat sebelum @.", s => emailParts(s)[0], "email");
action("Teks", "mask-email", "Samarkan email", "Tampilkan inisial pengguna dan domain alamat.", s => { const [user, host] = emailParts(s); return letters(user)[0]+"***@"+host; }, "email");

action("Daftar", "clean-lines", "Rapikan baris", "Buang baris kosong dan spasi tepi.", s => lines(s).join("\n"));
action("Daftar", "unique", "Hapus baris duplikat", "Pertahankan kemunculan pertama setiap baris.", s => [...new Set(lines(s))].join("\n"));
action("Daftar", "sort-lines", "Urutkan baris A–Z", "Urutkan teks per baris menurut abjad Indonesia.", s => lines(s).sort((a,b) => a.localeCompare(b,"id")).join("\n"));
action("Daftar", "reverse-lines", "Balik urutan baris", "Baca daftar dari baris terakhir.", s => lines(s).reverse().join("\n"));
action("Daftar", "number-lines", "Nomori daftar", "Beri nomor pada setiap baris terisi.", s => lines(s).map((v,i) => (i+1)+". "+v).join("\n"));
action("Daftar", "checklist", "Buat daftar periksa", "Ubah setiap baris menjadi butir cek.", s => lines(s).map(v => "☐ "+v).join("\n"));
action("Daftar", "join", "Gabungkan baris", "Satukan daftar dengan pemisah pilihan.", (s,v) => lines(s).join(v), "catatan", param("Pemisah",", "));
action("Daftar", "split", "Pecah menjadi baris", "Ubah teks berpemisah menjadi satu butir per baris.", (s,v) => s.split(v).map(x => x.trim()).filter(Boolean).join("\n"), "catatan", param("Pemisah",","));
action("Daftar", "count-lines", "Hitung butir", "Hitung baris yang berisi teks.", s => String(lines(s).length));
action("Daftar", "filter-lines", "Saring baris", "Simpan baris yang memuat kata kunci.", (s,v) => lines(s).filter(x => fold(x).includes(fold(v))).join("\n"), "catatan", param("Kata kunci","pompa"));

check("email-valid","Periksa format email","Cabang Ya untuk alamat dengan pengguna dan domain.",emailOk,"email");
check("contains","Memuat teks","Cari potongan teks tanpa membedakan kapital.",(s,v) => fold(s).includes(fold(v)),"catatan",param("Teks yang dicari","pompa"));
check("starts","Diawali teks","Periksa awalan isian.",(s,v) => fold(s).startsWith(fold(v)),"catatan",param("Awalan","ME"));
check("ends","Diakhiri teks","Periksa akhiran isian.",(s,v) => fold(s).endsWith(fold(v)),"catatan",param("Akhiran","selesai"));
check("matches-line","Cocok dengan pilihan","Cocokkan isian dengan salah satu pilihan per baris.",(s,v) => lines(v).some(x => fold(x)===fold(s)),"catatan",param("Pilihan (satu per baris)","pagi\nsiang\nmalam"));
check("multiline","Berisi beberapa baris","Cabang Ya bila ada dua baris terisi atau lebih.",s => lines(s).length>1);
check("integer","Bilangan bulat","Periksa apakah isian terdiri dari angka bulat bertanda atau tanpa tanda.",s => /^[+-]?\d+$/.test(s.trim()));
check("min-length","Panjang minimum","Periksa jumlah karakter setelah spasi tepi dibuang.",(s,v) => letters(s.trim()).length>=numeric(v),"catatan",param("Minimum karakter","5"));
check("greater","Di atas ambang","Bandingkan angka dengan batas atas pilihan.",(s,v) => numeric(s)>numeric(v),"catatan",param("Ambang","100"));
check("less","Di bawah ambang","Bandingkan angka dengan batas bawah pilihan.",(s,v) => numeric(s)<numeric(v),"catatan",param("Ambang","10"));

for (const [id,name,description,op] of [
  ["add","Tambah angka","Tambahkan nilai tetap.",(a,b)=>a+b],
  ["subtract","Kurangi angka","Kurangi masukan dengan nilai tetap.",(a,b)=>a-b],
  ["multiply","Kalikan angka","Kalikan masukan dengan faktor.",(a,b)=>a*b],
  ["divide","Bagi angka","Bagi masukan dengan pembagi.",(a,b)=>{if(b===0) throw Error("Pembagi harus selain nol.");return a/b;}],
] as [string,string,string,(a:number,b:number)=>number][]) {
  action("Angka",id,name,description,(s,v)=>decimal(op(numeric(s),numeric(v))),"catatan",param("Nilai tetap","2"));
}
action("Angka","round","Bulatkan angka","Bulatkan ke bilangan bulat terdekat.",s=>decimal(Math.round(numeric(s))));
action("Angka","absolute","Nilai absolut","Ambil besar angka tanpa tanda negatif.",s=>decimal(Math.abs(numeric(s))));
for (const [id,name,op] of [
  ["total","Jumlahkan daftar angka",(ns)=>ns.reduce((a,b)=>a+b,0)],
  ["average","Rata-rata daftar angka",(ns)=>ns.reduce((a,b)=>a+b,0)/ns.length],
  ["min","Angka terkecil",(ns)=>Math.min(...ns)],
  ["max","Angka terbesar",(ns)=>Math.max(...ns)],
  ["range","Rentang pembacaan",(ns)=>Math.max(...ns)-Math.min(...ns)],
] as [string,string,(ns:number[])=>number][]) {
  action("Angka",id,name,"Gunakan satu angka per baris.",s=>{
    const ns=lines(s).map(numeric);
    if (!ns.length) throw Error("Isi setidaknya satu angka.");
    return decimal(op(ns));
  });
}

// Each pair registers both directions. Results stay numeric for downstream checks.
for (const [id, left, right, scale, offset = 0] of [
  ["bar-kpa","bar","kPa",100], ["bar-psi","bar","psi",14.503773773],
  ["mpa-bar","MPa","bar",10], ["kpa-pa","kPa","Pa",1000],
  ["c-f","°C","°F",1.8,32], ["c-k","°C","K",1,273.15],
  ["m3-l","m³","L",1000], ["l-ml","L","mL",1000], ["m3h-lmin","m³/jam","L/menit",1000/60],
  ["lmin-ls","L/menit","L/detik",1/60], ["ls-m3h","L/detik","m³/jam",3.6],
  ["kw-w","kW","W",1000], ["mw-kw","MW","kW",1000], ["kwh-mj","kWh","MJ",3.6],
  ["rpm-hz","rpm","putaran/detik",1/60], ["knot-kmh","knot","km/jam",1.852],
  ["nm-km","mil laut","km",1.852], ["inch-mm","inci","mm",25.4], ["mm-m","mm","m",0.001],
  ["kg-g","kg","g",1000], ["ton-kg","ton metrik","kg",1000], ["hour-min","jam","menit",60],
] as [string,string,string,number,number?][]) {
  action("Satuan mesin",id,left+" ke "+right,"Masukan dalam "+left+". Hasil berupa angka dalam "+right+".",s=>decimal(numeric(s)*scale+offset));
  action("Satuan mesin",id+"-balik",right+" ke "+left,"Masukan dalam "+right+". Hasil berupa angka dalam "+left+".",s=>decimal((numeric(s)-offset)/scale));
}

for (const [id,name,template] of [
  ["watch","Robot serah terima jaga","Serah terima jaga\nPetugas: {nama}\nCatatan jaga: {catatan}"],
  ["inspection","Robot laporan inspeksi","Inspeksi oleh {nama}\nTemuan: {catatan}\nHasil olahan: {hasil}"],
  ["maintenance","Robot catatan perawatan","Catatan perawatan\nPelaksana: {nama}\nPekerjaan: {catatan}"],
  ["spares","Robot permintaan suku cadang","Permintaan suku cadang\nPemohon: {nama}\nRincian: {catatan}\nKontak: {email}"],
  ["anomaly","Robot temuan anomali","Laporan anomali\nPengamat: {nama}\nGejala: {catatan}\nPembacaan: {hasil}"],
  ["lubrication","Robot catatan pelumasan","Log pelumasan\nPetugas: {nama}\nTitik dan jumlah: {catatan}"],
  ["inventory","Robot rekap inventaris","Rekap inventaris oleh {nama}\nDaftar barang:\n{catatan}\nHasil rekap: {hasil}"],
  ["reading","Robot log pembacaan","Log pembacaan\nPetugas: {nama}\nNilai masukan: {catatan}\nNilai olahan: {hasil}"],
  ["follow-up","Robot memo tindak lanjut","Tindak lanjut untuk {nama}\nPekerjaan: {catatan}\nKontak: {email}"],
  ["summary","Robot rangkuman formulir","Nama: {nama}\nEmail: {email}\nCatatan: {catatan}\nHasil terakhir: {hasil}"],
]) {
  catalog.push({id:`robot-${id}`,name,group:"Robot laporan",help:"Susun draf dari data formulir dan hasil langkah sebelumnya.",field:"catatan",template});
}

export const plugins: readonly Plugin[] = catalog;
export const pluginById = new Map<string,Plugin>(catalog.map(p => [p.id,p]));
export function renderMessage(template: string, fields: RunFields) {
  let length = template.length;
  return template.replace(/\{(nama|email|catatan|hasil)\}/g, (token, key: Field) => {
    const value = fields[key];
    length += value.length - token.length;
    if (length > 8000) throw Error("Isi pesan melebihi 8.000 karakter.");
    return value;
  });
}
