"""Build retrospective r02 component coverage and viewer summaries in Bahasa Indonesia."""
import json
from pathlib import Path

out = Path(__file__).resolve().parent
baseline = out.parents[2] / 'yanmar-6aym-wet-r02'
read = lambda p: json.loads(p.read_text())
mesh = read(out/'r02-mesh-audit.json')
known = set().union(*(model['mesh_nodes'] for model in mesh['models'].values()))
rows, objects = {}, {}
def fig(v):
    return 'D05-MIRROR · katalog 0CG10-M34300 April 2014 · fig. '+v+' (kolom A 6AYM-WET; pilihan dan serial harus dicocokkan)'
def page(v): return 'D01 · service manual 0B6AY-EN0010 · halaman PDF '+v
def feature(name, state, *ids):
    assert all(i in known for i in ids), (name,ids)
    return {'name':name,'status':state,'mesh_ids':list(ids)}
def add(key, owner, summary, gap, refs, *features):
    rows[key]={'status':'PARTIAL','specialist':owner,'summary':summary,'open':gap,'source_refs':refs,'expected':list(features)}
def obj(key, owner, summary, gap, refs):
    assert key in known
    objects[key]={'status':'PARTIAL','specialist':owner,'summary':summary,'open':gap,'source_refs':refs}
add('RAK-BLOCK','Blok & bantalan utama','Blok menaungi crankshaft, liner, connecting rod dan bantalan dalam GLB internal.','Jaket air dan galeri oli dalam coran belum ditelusuri sebagai rongga aktual. Saluran fluida skematis.',[fig('1–2'),page('15, 63, 157, 163')],feature('Crankshaft dan liner','modeled','INT-CRANK-01','INT-LINER-11'),feature('Jaket air dan galeri blok','unverified'))
add('RAK-HEADS','Cylinder head & valvetrain','Rocker, katup, pegas, guide dan bridge dimodelkan di dalam kepala. Bonnet dapat dipisahkan.','Passage air pendingin dan penampang port pada kepala belum terverifikasi. Gasket bonnet belum dipisah.',[fig('22–24'),page('90–92, 163')],feature('Katup, rocker dan guide','modeled','INT-VALVE-103','INT-VALVE-130'),feature('Gasket bonnet','missing'),feature('Jalur dalam casting','unverified'))
add('RAK-OILPAN','Pelumasan & bak oli','Carter dan drain plug dimodelkan, pickup dan rumah saringan berada di kelompok pompa oli.','Varian sump standar/dangkal dan gasket sump pada unit belum dicocokkan. Detail screen intake belum dikonfirmasi.',[fig('8–11, 41'),page('157–158')],feature('Carter dan plug','modeled','EXT-OILPAN-01','EXT-OILPAN-02'),feature('Pickup dan rumah saringan','modeled','INT-OILPUMP-10','INT-OILPUMP-11'),feature('Gasket sump','missing'))
add('RAK-FLYWHEEL','Crankshaft & flywheel','Flywheel serta housing terpisah. Bentuk ring gear merupakan bagian dari mesh flywheel.','Ring gear tidak terpilih tersendiri. Gasket housing dan seal crankshaft belum dipisah.',[fig('5–7, 38'),page('112–113')],feature('Flywheel/housing','modeled','EXT-FLYWHEEL-01','EXT-FLYWHEEL-02'),feature('Ring gear','partial','EXT-FLYWHEEL-02'),feature('Gasket housing','missing'))
add('RAK-FRONT','Timing & damper','Rumah depan, guard dan damper terpisah; gear penggerak depan berada pada INT-TIMING.','Isi damper dan gasket penutup belum direkonstruksi; profil gigi masih perkiraan.',[fig('4, 28–29, 40'),page('111–113')],feature('Gear penggerak depan','modeled','INT-TIMING-08','INT-TIMING-09'),feature('Isi damper','unverified'),feature('Gasket cover','missing'))
add('RAK-ELECTRIC','Starter & pengisian','Starter/solenoid dan alternator/pulley masing-masing disajikan sebagai satu unit eksternal.','Rotor/armature, stator/yoke, sikat dan bantalan belum tersedia secara terpisah. Tipe kelistrikan dan vendor unit belum pasti.',[fig('105–109'),page('13–14')],feature('Starter dan alternator eksternal','modeled','EXT-ELECTRIC-01','EXT-ELECTRIC-02'),feature('Armature dan sikat starter','missing'),feature('Rotor dan stator alternator','missing'))
add('RAK-INTAKE','Pendingin udara pengisian & intake','R02 hanya memisah manifold, cooler utuh, siku, air cleaner dan duct.','Pada r02, core cooler, kedua tutup dan seal belum dapat dipilih. Isi pembersih udara serta passage manifold belum diverifikasi.',[fig('25, 31–32, 35–37'),page('37–38, 163, 170')],feature('Housing air cooler','partial','EXT-INTAKE-02'),feature('Core assy cooler','missing'),feature('Dua tutup cooler','partial','EXT-INTAKE-02'),feature('O-ring core','missing'),feature('Elemen air cleaner','unverified'))
add('RAK-EXHAUST','Turbocharger & manifold gas buang','Rumah turbin, rumah kompresor dan rumah tengah ditampilkan.','Roda kompresor/turbin, poros serta bantalan belum dapat dieksplorasi. Jaket air manifold tidak mewakili passage coran yang terverifikasi.',[fig('27, 31–34'),page('163, 170–171')],feature('Tiga housing turbo','modeled','EXT-EXHAUST-02','EXT-EXHAUST-03','EXT-EXHAUST-04'),feature('Rotor dan bantalan','missing'),feature('Passage jaket manifold','unverified'))
add('RAK-COOLING','Heat exchanger, pompa air & termostat','Yang terlihat adalah tangki/cooler depan, dua pompa, termostat dalam rumah rail dan selang.','Core heat exchanger, impeller kedua pompa, seal dan elemen termostat belum memiliki node tersendiri.',[fig('54–55, 57–58'),page('163–168')],feature('Unit pendinginan eksternal','modeled','EXT-COOLING-01','EXT-COOLING-03','EXT-COOLING-04','EXT-COOLING-07'),feature('Core coolant heat exchanger','missing'),feature('Dua tipe impeller','missing'),feature('Elemen termostat','missing'))
add('RAK-FUEL','Pompa injeksi, governor & filter bahan bakar','Pada r02 fitting, pipa tekanan tinggi, kepala filter, canister, pelat dan linkage luar tersedia.','Mekanisme plunger/cam, governor di balik housing, mekanisme feed pump, dan elemen cartridge filter belum tersedia pada r02.',[fig('74–79, 82–83, 88'),page('114–115, 145, 150, 155')],feature('Fitting dan pipa delivery','modeled','EXT-FUEL-13','EXT-FUEL-03'),feature('Cam dan plunger pompa','missing'),feature('Pemberat governor','missing'),feature('Elemen filter','missing'))
add('RAK-LUBE','Oil cooler & filtrasi oli','Rumah cooler, dua canister dan filter bypass terlihat; pompa oli terpisah di INT-OILPUMP.','Core oil cooler, elemen filter, bagian putar bypass dan katup tekanan belum tersedia sebagai objek tersendiri.',[fig('41–43, 45–47'),page('157–162')],feature('Rumah dan filter eksternal','modeled','EXT-LUBE-05','EXT-LUBE-02','EXT-LUBE-04'),feature('Core assy oil cooler','missing'),feature('Spindle/rotor bypass','missing'),feature('Katup kontrol tekanan','missing'))
add('INT-CRANK','Crankshaft & flywheel','Journal, crankpin, cheek serta counterweight tersedia.','Bentuk drilling internal, sumbat, fase fisik dan material tiap revisi belum terverifikasi.',[fig('38'),'D05 fig.38 · HTML BOM dan gambar crankshaft',page('104–106')],feature('Journal dan nose','modeled','INT-CRANK-01','INT-CRANK-09'),feature('Drilling internal','unverified'))
add('INT-MAIN','Blok & bantalan utama','Belahan main bearing, cap dan bolt direpresentasikan per journal.','Thrust bearing dan rincian lubang/alur oli belum dipetakan ke unit dan posisi katalog.',[fig('1'),page('104–106')],feature('Belahan bearing dan cap','modeled','INT-MAIN-11','INT-MAIN-12','INT-MAIN-13'),feature('Thrust bearing','unverified'))
add('INT-PISTON','Piston, ring & liner','Bowl, skirt, pin, ring dan circlip tersedia sebagai geometri pembelajaran.','Jalur semprotan pendingin internal dan geometri OEM di balik crown belum terverifikasi.',[fig('39'),'D05 fig.39 · HTML BOM dan gambar piston/rod',page('96–99, 162')],feature('Piston, pin, ring','modeled','INT-PISTON-11','INT-PISTON-12','INT-PISTON-13'),feature('Permukaan terselubung crown','unverified'))
add('INT-ROD','Connecting rod & bantalan','Big-end cap, shells, pin bush dan pengikat dapat dikenali.','Jalur oli dan profil penampang serta panjang pusat-ke-pusat per serial belum terverifikasi.',[fig('39'),'D05 fig.39 · HTML BOM dan gambar piston/rod',page('100–103')],feature('Cap, shell dan bush','modeled','INT-ROD-12','INT-ROD-13','INT-ROD-16'),feature('Drilling/penampang rod','unverified'))
add('INT-LINER','Liner & seal','Enam liner basah dengan flange dan tiga ring model per silinder.','Identitas material, penampang dan letak setiap packing/gasket OEM belum direkonsiliasi dengan seal model.',[fig('2'),page('63')],feature('Liner dan seal','partial','INT-LINER-11','INT-LINER-12','INT-LINER-13','INT-LINER-14'))
add('INT-CAM','Cam & pengikut','Camshaft, follower, tappet dan push rod direpresentasikan.','Bearing camshaft terpisah dan kurva lift serta timing OEM tidak terbukti.',[fig('15, 28, 30'),page('111–113')],feature('Tappet dan push rod','modeled','INT-CAM-16','INT-CAM-18'),feature('Bearing camshaft terpisah','missing'),feature('Profil lift OEM','unverified'))
add('INT-VALVE','Cylinder head & valvetrain','Rocker, guide, bridge, pegas dan katup tiap silinder tersedia.','Pengunci retainer dan seluruh pasak/plug belum direkonsiliasi dengan BOM. Timing dan clearance OEM belum diketahui.',[fig('22–24, 30'),page('90–94')],feature('Rocker, bridge dan katup','modeled','INT-VALVE-103','INT-VALVE-105','INT-VALVE-130'),feature('Rincian pengunci/plug','unverified'))
add('INT-FUELINJ','Nozel & injector','Enam nozzle/holder dan enam union tersedia sebagai unit luar.','Pegas, holder pegas, nozzle needle dan shim/adjuster belum dipisah.',[fig('79'),page('150–152')],feature('Holder dan union','modeled','INT-FUELINJ-11','INT-FUELINJ-12'),feature('Mekanisme pegas dan nozzle','missing'))
add('INT-TIMING','Gear train & idler','Gear penggerak, idler dan hub direpresentasikan.','Konstruksi bush, bracket dan retainers belum direkonsiliasi. Profil gigi, rasio aksesori serta timing fisik belum terverifikasi.',[fig('4, 28–29, 38, 80'),page('111–113')],feature('Gear dan hub idler','modeled','INT-TIMING-02','INT-TIMING-11'),feature('Bush dan bracket idler','unverified'))
add('INT-OILPUMP','Pompa oli & strainer','Poros, bodi, sepasang rotor, cover dan pickup direpresentasikan.','Katup pengaman, pegas dan retainer belum dimodelkan; profil rotor dan kehalusan screen masih perkiraan.',[fig('41, 43'),page('157–158')],feature('Poros, rotor, pickup','modeled','INT-OILPUMP-01','INT-OILPUMP-03','INT-OILPUMP-10'),feature('Safety valve + spring','missing'))
for key,owner,desc,gap,locator in [
 ('EXT-INTAKE-02','Pendingin udara pengisian','R02 menampilkan rumah, tutup dan baut sebagai satu mesh luar.','Inti pendingin udara serta seal belum ada sebagai geometri r02.','37'),
 ('EXT-COOLING-01','Heat exchanger air tawar','Tangki/rumah pendingin dan kedua tutup merupakan satu mesh luar.','Core cooler, seal dan gasket tutup belum ditampilkan sebagai bagian terpilih.','57'),
 ('EXT-COOLING-03','Pompa air tawar','Tersedia rumah pompa dengan cover dan port.','Impeller sentrifugal, shaft, bantalan dan mechanical seal belum tersedia.','54'),
 ('EXT-COOLING-04','Pompa air laut','Tersedia rumah pompa dengan cover dan port.','Impeller karet, shaft dan mechanical seal belum tersedia.','55'),
 ('EXT-COOLING-07','Termostat','Tersedia rumah termostat dan sambungan water rail.','Elemen termostat dan gasket belum dapat dilepas. Rating cartridge unit ini belum dikunci.','58'),
 ('EXT-LUBE-02','Filtrasi oli','Canister filter oli dimodelkan sebagai bentuk luar.','Elemen penyaring belum tersedia sebagai bagian dalam terpilih.','45–46'),
 ('EXT-LUBE-03','Filtrasi oli','Canister filter oli dimodelkan sebagai bentuk luar.','Elemen penyaring belum tersedia sebagai bagian dalam terpilih.','45–46'),
 ('EXT-LUBE-04','Filtrasi oli sentrifugal','Tersedia bentuk luar rumah filter bypass.','Spindle serta komponen putar filter belum dapat dilepas.','47'),
 ('EXT-LUBE-05','Oil cooler','Tersedia bentuk luar rumah cooler oli.','Core assy dan O-ring belum dapat ditampilkan.','42'),
 ('EXT-EXHAUST-02','Turbocharger','Volute sisi turbin terlihat.','Rotor, shaft serta bantalan turbo belum tersedia sebagai objek terpisah.','31–32'),
 ('EXT-EXHAUST-03','Turbocharger','Volute sisi kompresor dan cincin inlet terlihat.','Compressor wheel belum tersedia sebagai objek terpisah.','31–32'),
 ('EXT-EXHAUST-04','Turbocharger','Rumah tengah dan sambungan pelumas dimodelkan.','Bantalan dan spindle belum tersedia sebagai objek terpisah.','31–32'),
 ('EXT-FUEL-01','Injeksi bahan bakar','R02 menampilkan coran pompa, fitting, pelat dan pipa.','Cam dan plunger pompa belum terwakili di dalam rumah r02.','74'),
 ('EXT-FUEL-02','Governor','Tuas governor dan pegas luar direpresentasikan.','Pemberat dan mekanisme di dalam governor belum ditampilkan.','77'),
 ('EXT-FUEL-10','Filtrasi bahan bakar','Filter bahan bakar ditampilkan sebagai canister.','Cartridge/elemen dan seal belum dapat dipilih.','82–83'),
 ('EXT-FUEL-11','Filtrasi bahan bakar','Filter bahan bakar ditampilkan sebagai canister.','Cartridge/elemen dan seal belum dapat dipilih.','82–83'),
 ('EXT-FUEL-12','Pompa suplai bahan bakar','Pompa feed/priming dan selang tersedia pada permukaan mesin.','Piston, pegas dan katup dalam feed pump belum dapat dilepas.','75'),
 ('EXT-ELECTRIC-01','Alternator','Rumah alternator dan pulley tergabung.','Rotor, stator dan penyearah belum dipisah. Kapasitas terpasang belum terverifikasi.','107–109'),
 ('EXT-ELECTRIC-02','Starter','Tersedia starter dan solenoid dalam satu objek.','Armature serta sikat belum terpisah. Varian starter unit harus dicocokkan sebelum memodelkan isinya.','105–106'),
]:
    obj(key,owner,desc,gap,[fig(locator)])
for name in ('INT-FUELINJ-11','INT-FUELINJ-21','INT-FUELINJ-31','INT-FUELINJ-41','INT-FUELINJ-51','INT-FUELINJ-61'):
    obj(name,'Nozel & injector','Holder dan nozzle luar tersedia.','Isi nozzle dan pegas belum dapat dilepas.',[fig('79'),page('150–152')])

systems={}
for name, recipes, desc in [
    ('freshwater',['RAK-COOLING','RAK-LUBE','RAK-BLOCK','RAK-EXHAUST'],'Jaket blok, inti penukar panas dan bagian dalam pompa/termostat belum direpresentasikan lengkap.'),
    ('seawater',['RAK-COOLING','RAK-INTAKE'],'Aliran secara skematik menunjukkan dua penukar panas berbeda; isi pompa dan kedua core masih terbuka pada r02.'),
    ('lubrication',['RAK-OILPAN','INT-OILPUMP','RAK-LUBE','INT-MAIN','INT-ROD','INT-CAM','INT-VALVE','RAK-EXHAUST'],'Pompa, pickup, dan bantalan terwakili sebagian. Relief valve, galeri dalam blok, core cooler serta elemen filter masih terbuka.'),
    ('fuel',['RAK-FUEL','INT-FUELINJ'],'Pompa, filter dan nozzle merupakan unit campuran. Jalur yang tergambar pada skema tidak membuktikan isi rumah pompa atau filter.'),
    ('intake-exhaust',['RAK-INTAKE','RAK-EXHAUST','RAK-HEADS','INT-VALVE'],'Pipa dan katup sebagian terwakili, sedangkan pasangan roda turbo, isi cooler r02, dan saluran coran belum dapat ditelusuri lengkap.')]:
    system=read(baseline/f'model/systems/{name}.json')
    systems[name]={'assembly_keys':recipes,'summary':desc,'source_refs':list(dict.fromkeys(n['source_refs'][0] for n in system['nodes'] if n.get('source_refs'))),'scope':'Engine-only. Diagram dan port simbolik tidak membuktikan geometri internal; peralatan kapal di luar mesin dinilai terpisah.'}
for key, entry in rows.items():
    recipe=read(baseline/f'model/assemblies/{key}.json')
    ids=set(o for part in recipe.get('bagian',recipe['acuan']) for o in part['object_ids'])
    assert ids <= known,(key,ids-known)
    entry['recipe_mesh_ids']=sorted(ids)
assert set(rows) == {f.stem for f in (baseline/'model/assemblies').glob('*.json')}
assert set(systems) == {f.stem for f in (baseline/'model/systems').glob('*.json')}
d={'schema_version':1,'revision':'r02','scope':'Audit retrospektif subset komponen internal yang diharapkan, bukan rekonsiliasi setiap baris katalog. Catatan hanya berlaku untuk hash r02. Versi viewer berikutnya perlu mengganti catatan yang telah ditangani berdasarkan pemeriksaan revisinya.','model_sha256':{k:v['sha256'] for k,v in mesh['models'].items()},'method':['Periksa position/index accessor GLB setiap mesh dan hubungan recipe, lalu lihat konstruksi Blender tiap casing.','Rujukan D05-MIRROR memakai teks tabel katalog, bukan pengukuran gambar. D05 fig.38/39 juga memiliki diagram tersendiri. D01 manual keluarga dan foto tidak menetapkan varian/vendor komponen tiap nomor seri.','Status missing berarti subkomponen yang dirujuk belum ditemukan sebagai geometri terpisah pada hash yang diaudit. Status modeled hanya menyatakan representasi; ketepatan OEM tetap mengikuti status bukti tiap dimensi.'],'by_assembly':rows,'by_object':objects,'systems':systems}
(out/'baseline-r02.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
report=['# Cakupan bagian dalam Yanmar 6AYM-WET H 555 kW sebelum r03','',d['scope'],'','Kami mencocokkan bagian yang disebut dalam tabel suku cadang dengan objek hasil ekspor. Kedua GLB r02 memuat 83 dan 506 mesh. Pada r02, kedua penukar panas memakai pembentuk coran padat yang sama; detail tutup dan baut bergabung dengan coran. Tidak ada node core. Hal yang sama tidak boleh disimpulkan dari jumlah objek atau transparansi casing saja.','','| Rakitan | Spesialis | Bentuk yang tersedia | Pekerjaan terbuka |','|---|---|---|---|']
for k,x in rows.items():report.append('| '+' | '.join((k,x['specialist'],x['summary'],x['open']))+' |')
report+=['','Daftar lima sistem, sumber per rakitan dan objek per fitur tercatat di [manifest](baseline-r02.json). Hash GLB, jumlah triangle dan uji irisan permukaan terpilih ada di [audit mesh](r02-mesh-audit.json).','', 'Prioritas sesudah air cooler adalah dua pompa air beserta core heat exchanger depan, rotor turbo/center housing, core oil cooler dan isi filter. Setiap prioritas memiliki rujukan tabel yang memungkinkan penelitian lebih rinci; gelar spesialis mengidentifikasi tanggung jawab pekerjaan lanjutan, bukan klaim bahwa tiap bagian sudah diteliti oleh agen terpisah pada r02.']
(out/'README.md').write_text('\n'.join(report)+'\n')
print(len(rows),'assemblies,',len(objects),'object-specific notices,',len(systems),'systems')
