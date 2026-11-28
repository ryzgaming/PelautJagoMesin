"""Map every exported mesh to its installed job and behavior throughout an engine cycle."""
from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import json
import re
from build_motion import glb_tree

ROOT=Path(__file__).resolve().parents[2]
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
profiles={}
def profile(key,label,category,description,starting,running,stopping,off='Tetap pada posisi terpasang.',status='DOCUMENTED_FUNCTION'):
    profiles[key]=dict(label=label,category=category,function=description,starting=starting,running=running,stopping=stopping,off=off,status=status)

profile('case','Rumah dan dudukan tetap','fixed','Menyangga atau melindungi komponen pada koordinat terpasang.','Tetap saat starter memutar isi rakitan.','Tetap pada blok atau dudukannya.','Tetap saat poros melambat.')
profile('fastener','Pengikat terpasang','fixed','Menjaga posisi sambungan.','Menahan sambungan.','Mempertahankan jepitan.','Jepitan tetap terpasang.')
profile('seal','Seal dan gasket','fixed','Memisahkan fluida atau menutup sambungan.','Terpasang saat tekanan mulai terbentuk.','Menjaga batas antarruang.','Terpasang saat beda tekanan menurun.')
profile('bearing','Tumpuan tetap','fixed','Membimbing poros atau batang yang bergerak relatif terhadap tumpuan.','Bagian bergerak mulai meluncur atau menggelinding.','Membatasi gerak radial atau aksial.','Tetap hingga gerak relatif berhenti.')
profile('route','Saluran fluida tetap','fixed','Menentukan batas saluran. Lihat sirkuit fluida untuk arah dan sambungan.','Aliran mulai menurut sumber isap, pompa atau gerak piston.','Fluida bergerak melalui saluran pada sirkuit aktif.','Debit turun menurut penggeraknya.')
profile('filter','Media saringan','fixed','Menahan partikel pada media saat fluida melaluinya.','Menerima fluida saat penggerak sirkuit bekerja.','Partikel pada aliran disaring.','Aliran berkurang saat pompa atau isap berhenti.')
profile('exchanger','Permukaan penukar panas','fixed','Memisahkan dua sirkuit dan memungkinkan perpindahan panas melalui dinding.','Aliran sirkuit mengikuti pompa dan posisi termostat.','Energi berpindah melalui dinding inti.','Aliran berkurang, massa penukar tetap hangat sementara.')
profile('rotor','Poros atau penggerak berputar','rotating','Meneruskan putaran melalui hubungan mekanis pada model.','Mulai mengikuti poros engkol ketika starter memutar mesin.','Berputar dengan arah dan rasio penggeraknya.','Melambat bersama poros engkol.','Berhenti pada fase terakhir.')
profile('follower','Bagian pengikut mekanis','follower','Mengikuti mekanisme induk sesuai fase engkol atau nok.','Melangkah atau berayun saat putaran dimulai.','Mengulang langkah dan arah sesuai mekanisme.','Tetap bergerak selama poros engkol masih meluncur.','Diam pada fase terakhir.')
profile('spring','Pegas siklik','deforming','Memendek dan memanjang pada dua dudukan sesuai gerak penggerak.','Mengikuti langkah awal penggerak.','Menyimpan dan melepas gaya pada setiap langkah.','Mengikuti langkah yang melambat.','Tetap pada panjang terpasang untuk fase akhir.')
profile('wet_impeller','Sudu lentur pompa air laut','deforming','Hub berputar bersama poros. Setiap sudu melentur saat melintasi cam tetap dan kembali di luar sektor itu.','Sel impeler mulai memindah air saat crank berputar.','Sepuluh bentuk sudu berubah bergantian dalam ruang pompa model.','Frekuensi pemindahan turun mengikuti putaran.','Sudu di sektor cam tetap tertekuk.','ILLUSTRATIVE_GEOMETRY')
profile('fuel_meter','Penakaran dan pengatur rack','conditional','Rack menggeser pinion dan selongsong untuk mengatur sudut plunger.','Rack bergerak ke posisi start dan dosis besar.','Pengatur mengurangi setelan penyaluran menuju idle.','Rack ditarik ke posisi tanpa penyaluran, walau nok masih berputar.','Rack di posisi stop.','ILLUSTRATIVE_TRAVEL')
profile('plunger','Plunger penakar','follower','Terangkat oleh tappet dan berputar menurut setelan rack.','Terangkat mengikuti nok, dengan setelan start.','Setiap elemen bergerak aksial dan menakar menurut sudut heliks.','Gerak aksial berlanjut sementara putaran tersisa, penyaluran terputus.','Diam pada fase akhir.','ILLUSTRATIVE_PROFILE')
profile('governor','Regulator mekanis','conditional','Menyeimbangkan gaya pemberat yang berputar dan gaya pegas governor.','Pemberat mendekat saat diam lalu mulai membuka ketika putaran naik.','Pemberat, shifter dan linkage mencapai posisi seimbang pada idle.','Gaya sentrifugal menurun. Perintah stop mengesampingkan pengatur untuk memutus solar.','Pemberat kembali ke posisi rendah.','ILLUSTRATIVE_TRAVEL')
profile('governor_spring','Pegas governor','deforming','Menyeimbangkan gaya pemberat melalui shifter.','Panjang berubah saat putaran terbentuk.','Memegang setelan keseimbangan idle.','Kembali ketika putaran turun.','Pada panjang dasar model.','ILLUSTRATIVE_TRAVEL')
profile('injection','Katup penyaluran bertekanan','conditional','Terbuka dalam pulsa penyaluran saat bahan bakar diizinkan.','Mulai berpulsa ketika plunger menghasilkan tekanan.','Denyut per silinder mengikuti urutan 1–4–2–6–3–5.','Kembali ke dudukan saat suplai diputus.','Menutup.','ILLUSTRATIVE_PRESSURE')
profile('injection_spring','Pegas katup injeksi','deforming','Menekan jarum atau katup delivery kembali ke dudukan.','Berubah panjang bila katup mendapat pulsa.','Mengikuti tiap angkatan singkat.','Kembali ke panjang tertutup saat pulsa tiada.','Menahan katup tertutup.','ILLUSTRATIVE_PRESSURE')
profile('thermostat','Katup peka suhu','conditional','Kapsul bergerak sesuai suhu coolant. Enam unit terbagi dalam dua ambang.','Pada awal dingin, katup utama tertutup.','Tipe A mulai 71 °C, penuh 85 °C. Tipe B mulai 76,5 °C, penuh 90 °C. Angkatan model penuh 8 mm.','Posisi masih mengikuti suhu tersisa saat pompa berhenti.','Posisi sesuai suhu terakhir; ketika dingin katup menutup.','DOCUMENTED_THRESHOLDS')
profile('thermo_spring','Pegas termostat','deforming','Pegas mengembalikan kapsul dan katup pada dudukan.','Panjang dingin saat katup tertutup.','Memendek sesuai derajat pembukaan akibat suhu.','Memanjang kembali mengikuti pendinginan.','Menahan katup pada suhu tersisa.','DOCUMENTED_THRESHOLDS')
profile('starter_motor','Penggerak starter','conditional','Motor memutar reduksi dan memberi torsi awal.','Berputar saat solenoid memasukkan pinion dan arus utama tersambung.','Setelah mesin mengambil alih, putaran sisa hilang.','Tidak diaktifkan oleh perintah stop.','Diam.','ILLUSTRATIVE_TIMING')
profile('starter_pinion','Pinion dan roda bebas','conditional','Meneruskan torsi start dan dapat melampaui putaran motor melalui kopling searah.','Maju, berpaut pada ring gear lalu memutar flywheel.','Saat mesin mengambil alih, pinion melampaui motor, mundur dan berhenti.','Terlepas dari flywheel.','Mundur.','ILLUSTRATIVE_TIMING')
profile('starter_shift','Solenoid dan garpu','conditional','Menarik plunger dan menggeser pinion secara aksial melalui garpu.','Maju sebelum torsi starter bekerja.','Lepas dan kembali setelah mesin menyala.','Tetap pada posisi bebas.','Mundur.','ILLUSTRATIVE_TIMING')
profile('turbo','Rotor turbo bebas','rotating','Gas buang memutar turbin dan kompresor pada satu poros.','Putaran terdorong setelah gas panas tersedia.','Putaran naik secara bertahap mengikuti energi gas buang ilustratif.','Tetap berputar sementara karena inersia, lalu melambat.','Berhenti setelah putaran sisa.','ILLUSTRATIVE_FREE_SPEED')
profile('centrifuge','Rotor sentrifugal oli','rotating','Jet oli memutar rotor relatif terhadap spindle yang tetap.','Berputar bertahap saat pasokan oli bertekanan terbentuk.','Berputar oleh reaksi jet oli dan memisahkan kontaminan.','Aliran berhenti, rotor meluncur lalu diam.','Diam setelah inersia habis.','ILLUSTRATIVE_FREE_SPEED')
profile('belt','Sabuk berjalan','follower','Sabuk menyalurkan torsi antara dua puli. Batas loop tetap, perjalanan material terlihat dari tanda sabuk.','Berjalan saat puli mulai berputar.','Tanda mengikuti panjang loop secara kontinu.','Gerak menurun bersama puli.','Berhenti pada posisi terakhir.')
profile('electric','Komponen listrik tetap','fixed','Merupakan bagian rangkaian listrik atau magnet.','Keadaan listrik terkait starter atau pembentukan tegangan.','Fungsi listrik mengikuti rangkaian yang aktif.','Arus kerja atau pembangkitan berkurang.','Terpasang, tanpa gerak mekanis.')
profile('starter_coil','Medan elektromagnet starter','fixed','Kumparan tetap menghasilkan gaya magnet atau memasok arus armature melalui sikat.','Mendapat arus selama pengasutan.','Arus starter diputus ketika mesin hidup.','Tidak mendapat perintah pengasutan.','Tidak diberi arus.')
profile('service','Komponen dioperasikan secara manual','conditional','Hanya bekerja saat operator melaksanakan intervensi tersendiri.','Tetap pada posisi normal kecuali priming/servis diminta.','Tetap pada posisi servis normal.','Tidak otomatis bergerak saat mesin dimatikan.','Dapat dioperasikan dengan tangan.','CONDITION_OUTSIDE_DEMO')
profile('drain','Drain bersyarat','conditional','Mengeluarkan kondensat bila tersedia dan kondisi pembukaan terpenuhi.','Posisi internal dan kondensat belum dimodelkan.','Tidak diberi gerak periodik tanpa data kondensat.','Kondensat dapat tersisa di titik rendah.','Tetap sebagai batas drain.','CONDITION_OUTSIDE_DEMO')
profile('cap','Katup ambang tekanan','conditional','Tutup menjaga tekanan sistem dan menyediakan pengembalian coolant dari reservoir.','Pada kondisi dingin normal katup duduk.','Katup tekanan membuka bila ambang 93–123 kPa terlampaui. Pengujian terpisah memakai kalibrasi contoh 108 kPa.','Katup balik dapat membuka bila tekanan dalam tangki turun di bawah atmosfer.','Duduk pada tekanan setimbang.','DOCUMENTED_CONDITION')
profile('cap_spring','Pegas kalibrasi tutup','deforming','Mempertahankan gaya penutupan katup sampai beda tekanan membukanya.','Tetap pada panjang terpasang.','Pada uji tekanan, memendek dengan angkatan katup.','Kembali saat beda tekanan hilang.','Pada panjang terpasang.','ILLUSTRATIVE_TRAVEL')
profile('pump_seal','Face dan bellows seal putar','rotating','Mengikuti poros pompa sambil merapatkan bidang gesek terhadap face tetap.','Mulai berputar dengan poros pompa.','Muka stasioner dan berputar bekerja berhadapan.','Berhenti bersama poros.','Duduk terhadap muka tetap.','ILLUSTRATIVE_GEOMETRY')
profile('turbo_bearing','Bushing dalam dua film oli','rotating','Film oli antara rotor, bushing dan rumah menggerakkan bushing penuh pada sebagian putaran rotor.','Bushing mulai terseret saat turbo berputar.','Demo memakai kira-kira setengah putaran rotor menurut contoh fully-floating Garrett.','Melambat bersama rotor dan film oli.','Berhenti setelah rotor meluncur.','ILLUSTRATIVE_FREE_SPEED')
profile('mixed','Subkomponen bergerak belum dipisah','unknown','Sebagian gerak relatif atau fungsi material internal belum terukur pada unit ini.','Keadaan internal belum direkonstruksi terpisah.','Tidak diberi rasio atau perpindahan terkaan.','Keadaan internal belum dapat diuji.','Bentuk terpasang dipertahankan.','UNVERIFIED_INTERNAL_BEHAVIOR')

def fixed_profile(row,routes):
    id,name=row['id'],row['name'].lower()
    n=id.rsplit('-',1)[-1]
    if id in ('EXT-FRONT-04',):return 'belt'
    if id in ('EXT-INTAKE-14',):return 'drain'
    if id in ('EXT-FUEL-217','EXT-FUEL-218','EXT-BLOCK-18','EXT-LUBE-65') and ('pegas' in name or 'prim' in name or 'pegangan' in name):return 'service'
    if id in ('EXT-EXHAUST-30','EXT-EXHAUST-31','EXT-COOLING-24','EXT-COOLING-39'):return 'seal'
    if id in ('EXT-ELECTRIC-43','EXT-ELECTRIC-51'):return 'starter_coil'
    if id.startswith('EXT-ELECTRIC') and any(word in name for word in ('stator','regulator','sikat','penyearah','sensor','harness')):return 'electric'
    if any(w in name for w in ('mur ', 'locknut','washer','clamp','baut','bolt','pengikat','pengunci','pasak','dowel','snap ring','penjepit','screw')):return 'fastener'
    if any(w in name for w in ('gasket','o-ring','seal','packing')):return 'seal'
    if any(w in name for w in ('housing','rumah','dudukan','rakitan','casting','casting utama')) and not id.startswith('INT-FUELINJ'):return 'case'
    if any(w in name for w in ('bearing','bantalan','bushing','rocker shaft','pemandu','spindle','liner','ring luar')):return 'bearing'
    if any(w in name for w in ('media','elemen kertas','screen','air cleaner')):return 'filter'
    if any(w in name for w in ('bundel','core','pendingin oli tipe','penukar panas')):return 'exchanger'
    if routes or any(w in name for w in ('pipa','siku','header','duct','hose','manifold','gallery','saluran','union','fitting')):return 'route'
    return 'case'

def drive_profile(row,group):
    n=row['id'];label=row['name'].lower();id=group['id'];act=group['actuation']
    if n=='EXT-COOLING-35':return 'wet_impeller'
    if n in ('EXT-COOLING-380','EXT-COOLING-381'):return 'pump_seal'
    if id=='turbo-floating-bushes':return 'turbo_bearing'
    if act.startswith('cap-'):return 'cap_spring' if act=='cap-spring' else 'cap'
    if act=='turbo':return 'turbo'
    if act=='centrifuge':return 'centrifuge'
    if act=='starter_shift':return 'starter_shift'
    if act=='starter_pinion':return 'starter_pinion'
    if act=='starter_drive':return 'starter_motor'
    if act=='fuel-metering':return 'plunger' if id.startswith('metering-plunger') else 'fuel_meter'
    if act=='fuel-rack':return 'fuel_meter'
    if act=='governor-spring':return 'governor_spring'
    if act.startswith('governor-'):return 'governor'
    if act=='thermostat':return 'thermostat'
    if act=='thermostat-spring':return 'thermo_spring'
    if act=='injection':return 'injection_spring' if group['kind']=='spring' else 'injection'
    return dict(spin='rotor',reciprocate='follower',rock='follower',spring='spring',belt='belt',orbit='rotor')[group['kind']]

def main():
    groups=read('model/motion/drivetrain.json')['groups']
    active={n:g for g in groups for n in g['targets']}
    basic={r['id']:r for r in read('model/motion/shaft-inventory.json')['rows']}
    routes=defaultdict(list)
    for r in read('model/flow/routes.json')['routes']:
        for id in set(r['component_ids']):routes[id].append(r['id'])
    rows={}
    digests={}
    sources=[]
    for layer in ('internal','exterior'):
        rel='model/'+layer+'/'
        meshes=glb_tree(ROOT/(rel+layer+'.glb'))
        objects=read(rel+'inventory.json')['components']
        assert set(meshes)=={x['id'] for x in objects}
        digests[layer]=sha(rel+layer+'.glb')
        for row in objects:
            key=row['id'];motor=basic[key]['controller'];g=active.get(key);rr=routes.get(key,[])
            refs=(g or {}).get('source_refs',[])+row.get('source_refs',row.get('sumber',[]))
            if key in ('EXT-EXHAUST-30','EXT-EXHAUST-31'):
                refs.append('Garrett Motion / The turbocharger oil and gas sealing system, stepped bore piston rings.')
            if g:profile_name=drive_profile(row,g)
            elif motor:
                profile_name='spring' if 'SPRING' in motor else 'follower' if motor.startswith(('MOT-INT-VALVE','MOT-INT-ROD','MOT-INT-ROCKER','MOT-INT-PISTON','MOT-INT-TAPPET')) else 'rotor'
            else:profile_name=fixed_profile(row,rr)
            if not refs:
                refs=['D01 Service Manual 6AYM-W, bagian '+key.split('-')[1]]
            ords=[]
            for ref in dict.fromkeys(refs):
                if ref not in sources:sources.append(ref)
                ords.append(sources.index(ref))
            en=dict(profile=profile_name,category=profiles[profile_name]['category'],controller=motor,
                    source_refs=ords,route_ids=rr)
            if profile_name=='mixed':en['limits']= 'Cincin gesek, film fluida atau mekanisme tersembunyi belum diuraikan pada model.'
            if key=='EXT-ELECTRIC-58':en['limits']='Jumlah roller contoh; fase ketat/bebas dan putaran lokal roller tidak dihitung.'
            if key.startswith('EXT-COOLING-33') and key[-1] in '345':en['limits']='Pinhole tipe B dan jiggle pin ditunjukkan dalam posisi contoh.'
            if key=='EXT-FUEL-02':en['limits']='Tuas luar pada casing merupakan geometri gabungan. Posisi mekanisme internal ditunjukkan secara terpisah.'
            if profile_name=='wet_impeller':en['limits']='Profil sudu dan cam edukatif. Tekanan kontak dan daya elastomer tidak dihitung.'
            if key in ('EXT-EXHAUST-30','EXT-EXHAUST-31'):
                en['limits']='Ring mengembang pada bore tetap seperti contoh seal piston turbo Garrett. Kebocoran dan beda tekanan lokal tidak dihitung.'
            if key in ('EXT-EXHAUST-22','EXT-EXHAUST-23'):
                en['limits']='Rasio bushing TD13M tidak tersedia. Nilai 0,5 kali rotor memperagakan prinsip dua film oli dari Garrett.'
            if key in ('EXT-COOLING-24','EXT-COOLING-39','EXT-COOLING-380','EXT-COOLING-381'):
                en['limits']='Fungsi pasangan face terpisah diperagakan; lebar muka, kompresi bellows dan film seal diestimasi.'
            if key in ('EXT-COOLING-382','EXT-COOLING-383','EXT-COOLING-384'):
                en['limits']='Tutup tidak diuji tekan pada unit ini. Di luar uji kontinjensi tidak ada sensor beda tekanan yang disimulasikan.'
            rows[key]=en
    assert set(rows)==set(basic)
    payload=dict(version=1,assets_sha256=digests,source_refs=sources,profiles=profiles,components=rows,
                 counts=dict(total=len(rows),by_category=Counter(x['category'] for x in rows.values()),
                             by_profile=Counter(x['profile'] for x in rows.values()),direct=len(active),
                             inherited=sum(r['classification']=='legacy' for r in basic.values())),
                 notes=['Pemetaan mencakup setiap mesh yang diekspor.',
                        'Akurasi identitas part dan geometri per nomor seri mengikuti sumber pada inventaris.',
                        'Profil sensor, arus listrik, film oli, tegangan kontak dan tekanan bukan hasil simulasi fisika.'])
    (ROOT/'model/motion/functions.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(payload['counts'],ensure_ascii=False))
if __name__=='__main__':main()
