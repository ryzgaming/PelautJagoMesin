"""Rebuild review centrelines in glTF world metres. Endpoints are shared by keyed ports."""
import json
from pathlib import Path

ports = {}
routes = []
water = "D01 PDF 163, cetak 159, Cooling Water System"
oil = "D01 PDF 157, cetak 153, Lubricating Oil System"

def port(key, label, xyz, component, boundary=False):
    ports[key] = dict(id=key, name=label, point=list(xyz), component_id=component, boundary=boundary)

def smooth(knots):
    """Cubic through measured mating points, with local tangent and exact end planes."""
    pts = []
    for j, (a,b) in enumerate(zip(knots,knots[1:])):
        prev=knots[max(0,j-1)]
        after=knots[min(j+2,len(knots)-1)]
        for i in range(8):
            t=i/8
            pts.append([round((1-t)**3*a[k]+3*(1-t)**2*t*(a[k]+(b[k]-prev[k])/7)
                        +3*(1-t)*t*t*(b[k]-(after[k]-a[k])/7)+t**3*b[k],7) for k in range(3)])
    pts[0]=list(knots[0])
    return [*pts,list(knots[-1])]

def fair(pts):
    """Clamped cubic B-spline; controls guide pipe elbows, endpoint tangents follow mating axes."""
    degree=min(3,len(pts)-1)
    n=len(pts)-1
    count=n-degree+1
    knots=[0]*(degree+1)+list(range(1,count))+[count]*(degree+1)
    sampling=12
    out=[]
    for j in range(count*sampling):
        u=j/sampling
        k=int(u)+degree
        work=[list(pts[k-degree+i]) for i in range(degree+1)]
        for level in range(1,degree+1):
            for h in range(degree,level-1,-1):
                idx=k-degree+h
                alpha=(u-knots[idx])/(knots[idx+degree-level+1]-knots[idx])
                work[h]=[(1-alpha)*a+alpha*b for a,b in zip(work[h-1],work[h])]
        out.append([round(v,7) for v in work[-1]])
    out[0]=list(pts[0])
    return [*out,list(pts[-1])]

def route(key,label,src,dst,knots,r,refs,component=None,extra=(),raw=False,reason=''):
    sys={'SW':'seawater','FW':'freshwater','LO':'lubrication'}[key.split('-')[0]]
    all_knots=[ports[src]['point'],*knots,ports[dst]['point']]
    ids=list(dict.fromkeys([ports[src]['component_id'],*([component] if component else []),*extra,ports[dst]['component_id']]))
    detail='Bentuk dan diameter lokal diperkirakan. Arah antaralat mengikuti diagram servis.' if component else 'Garis skematis menunjukkan arah di dalam komponen. Bentuk galeri, pembagian debit dan dimensi saluran belum terukur.'
    routes.append(dict(id=key,name=label,system=sys,kind='physical' if component else 'schematic',
                      **{'from':src,'to':dst},points=all_knots if raw else (fair(all_knots) if component else smooth(all_knots)),radius_m=r,
                      source_refs=[oil if sys=='lubrication' else water,*refs],component_ids=ids,
                      mesh_id=component,geometry_status='ESTIMATED' if component else 'ILLUSTRATIVE',
                      direction_status='DOCUMENTED',note=(detail+' '+reason).strip()))

# Ports at actual selected model interfaces. Only the seawater pump translates.
def sw_moved(p):
    return (round(p[0]-.110,7),round(p[1]+.123696470855145,7),p[2])
sw='EXT-COOLING-04'
fw='EXT-COOLING-03'
ac='EXT-INTAKE-06'
hx='EXT-COOLING-01'
oc='EXT-LUBE-05'
bloc='EXT-BLOCK-01'
tc='EXT-EXHAUST-04'
header='EXT-LUBE-01'
port('SW-ship-in','Flange masuk air laut dari kapal',(-.203,.316,-.600),'EXT-COOLING-05',True)
port('SW-pump-in','Flange isap pompa air laut',sw_moved((-.053414,.268,-.554035)),sw)
port('SW-pump-out','Flange tekan pompa air laut',sw_moved((-.043868,.444226,-.474)),sw)
port('SW-charge-in','Leher bawah ruang air intercooler',(-.178,.685,-.4585),ac)
port('SW-charge-out','Leher atas ruang air intercooler',(-.141,.760,-.4495),ac)
port('SW-hx-in','Masuk sisi pipa pada penukar panas depan',(1.566,.741,-.4565),'EXT-COOLING-51')
port('SW-ship-out','Keluar ke saluran buang milik instalasi kapal',(1.566,.741,.3215),'EXT-COOLING-52',True)
route('SW-suction','Sambungan laut ke pompa','SW-ship-in','SW-pump-in',
      [(-.191,.322,-.597),(-.181,.342,-.591),(-.172,.379,-.581),(-.169,.3916965,-.5655)],.032,
      ['D05 Fig 66; P07, P18, siku belakang'], 'EXT-COOLING-05')
route('SW-impeller','Pompa air laut, sisi isap ke tekan','SW-pump-in','SW-pump-out',
      [sw_moved(p) for p in [(-.009,.27,-.489),(.015,.315,-.493),(.015,.372,-.462),(-.028,.406,-.473)]],.009,['D05 Fig 55, pompa air laut'])
route('SW-delivery','Pompa air laut ke intercooler','SW-pump-out','SW-charge-in',
      [(-.160,.580,-.474),(-.174,.609,-.499),(-.181,.640,-.502),(-.178,.685,-.482)],.020,
      ['D05 Fig 66, pipa dan selang air laut; P18'], 'EXT-COOLING-300')
route('SW-air-cooler','Dua lintasan air laut dalam intercooler','SW-charge-in','SW-charge-out',
      [(-.178,.685,-.401),(-.174,.69229,-.344),(-.174,.69229,.220),(-.176,.698,.257),
       (-.157,.744,.264),(-.142,.74771,.220),(-.142,.74771,-.344),(-.141,.760,-.391)],
      .003,['D05 Fig 37, core nomor 5, division rib nomor 6 dan return cover'],extra=['EXT-INTAKE-08','EXT-INTAKE-07'],raw=True)
route('SW-transfer','Intercooler ke penukar panas depan','SW-charge-out','SW-hx-in',
      [(-.141,.760,-.478),(-.117,.751,-.525),(-.056,.691,-.550),(.076,.628,-.540),
       (.28,.618,-.533),(.71,.618,-.533),(1.10,.618,-.533),(1.30,.628,-.541),
       (1.476,.681,-.535),(1.558,.731,-.500),(1.566,.741,-.479)],.018,
      ['D05 Fig 66, C.S.W. pump–air cooler–F.W. cooler; P07/P18'], 'EXT-COOLING-301')
route('SW-front-core','Air laut melalui core depan ke keluaran mesin','SW-hx-in','SW-ship-out',
      [(1.566,.741,-.416),(1.564,.742,-.385),(1.564,.742,.250),(1.566,.741,.285)],
      .003,['D05 Fig 57, core dan tutup penukar panas'],extra=['EXT-COOLING-50'],raw=True)

port('FW-pump-in','Sisi isap pompa coolant',(1.438,.5365,.306),fw)
port('FW-pump-out','Sisi tekan pompa coolant',(1.430,.462868,.497226),fw)
port('FW-oil-hx-in','Masuk coolant pada badan pendingin oli',(1.086,.331,.374),oc)
port('FW-oil-hx-out','Keluar coolant dari badan pendingin oli',(.240,.331,.373),oc)
port('FW-block-in','Masuk jaket silinder pada blok',(.180,.304,.286),bloc)
port('FW-jacket-head','Jaket air bagian atas silinder',(.227,.559,.089),'EXT-HEADS-01')
port('FW-manifold','Keluaran jaket manifold gas buang',(1.2841,.641,.272),'EXT-EXHAUST-01')
port('FW-thermo-in','Masuk ke ruang termostat depan',(1.3585,.735,.011),hx)
port('FW-stat','Kelompok termostat pendingin',(1.495,.838,.024),'EXT-COOLING-57')
port('FW-hx-return','Keluar sisi coolant penukar panas',(1.502,.5762,.157),hx)
route('FW-pump','Pompa air tawar','FW-pump-in','FW-pump-out',
      [(1.418,.481,.309),(1.410,.406,.322),(1.415,.415,.398)],.009,['D05 Fig 54, pompa air tawar'])
route('FW-pump-cooler','Pompa coolant ke pendingin oli','FW-pump-out','FW-oil-hx-in',
      [(1.430,.478,.548),(1.418,.493,.585),(1.378,.489,.607),(1.327,.460,.596),(1.300,.415,.552),
       (1.270,.368,.514),(1.218,.331,.432),(1.153,.331,.374),(1.109,.331,.374)],.028,
      ['D05 Fig 65, pendingin oli–blok; PDF 163'], 'EXT-COOLING-302')
route('FW-oil-cooler','Sisi coolant di sekeliling unit pelat','FW-oil-hx-in','FW-oil-hx-out',
      [(1.035,.331,.374),(.917,.355,.382),(.693,.354,.382),(.641,.354,.382),(.402,.354,.382),(.292,.331,.373)],
      .006,['D05 Fig 42; D01 PDF 161, cetak 157'],extra=['EXT-LUBE-60','EXT-LUBE-61'])
route('FW-cooler-block','Pendingin oli ke jaket blok','FW-oil-hx-out','FW-block-in',
      [(.215,.331,.373),(.179,.324,.369),(.167,.304,.348),(.180,.304,.321)],.021,
      ['D05 Fig 65, pipa air dan gasket; P17'], 'EXT-COOLING-303')
route('FW-cylinder-jacket','Jaket air liner dan kepala silinder','FW-block-in','FW-jacket-head',
      [(.18,.303,.202),(.18,.302,.102),(.225,.322,.094),(.267,.478,.059),(.25,.535,.081)],.009,['D01 PDF 163'],extra=['EXT-HEADS-01'])
route('FW-wet-exhaust','Jaket kepala ke jaket manifold','FW-jacket-head','FW-manifold',
      [(.228,.584,.129),(.235,.620,.216),(.283,.636,.266),(.651,.641,.272),(1.062,.641,.272)],.009,
      ['D05 Fig 27, exhaust manifold'])
route('FW-to-stat','Jaket manifold ke rumah termostat','FW-manifold','FW-thermo-in',
      [(1.312,.641,.272),(1.334,.650,.252),(1.337,.672,.215),(1.337,.697,.163),
       (1.336,.711,.109),(1.334,.723,.068),(1.331,.735,.041),(1.332,.735,.011)],.022,
      ['D01 PDF 163; P17, bagian dalam sambungan tertutup'], 'EXT-COOLING-304')
route('FW-thermostat','Ruang masuk ke termostat','FW-thermo-in','FW-stat',
      [(1.423,.745,.011),(1.466,.783,.023)],.009,['D01 PDF 166, cetak 162; D05 Fig 57'])
route('FW-cooler-shell','Termostat ke sisi selubung penukar panas','FW-stat','FW-hx-return',
      [(1.496,.827,.021),(1.474,.809,-.030),(1.405,.744,-.086),(1.412,.673,-.022),
       (1.442,.617,.078),(1.497,.596,.157)],.008,['D05 Fig 57; D01 PDF 163'],
      reason='Pada temperatur kerja, termostat terbuka. Pergerakan merangkum sirkulasi dalam selubung.')
route('FW-return','Siku balik pendingin ke pompa coolant','FW-hx-return','FW-pump-in',
      [(1.502,.524,.157),(1.537,.480,.186),(1.584,.476,.263),(1.582,.518,.338),
       (1.544,.574,.365),(1.480,.608,.344),(1.438,.592,.306)],.025,['D05 Fig 63, bend 148660-49233'], 'EXT-COOLING-06')

port('LO-screen','Saringan isap dalam karter',(.201,-.482,0),'INT-OILPUMP-11')
port('LO-pump-in','Isap pompa oli',(.09,-.20,-.031),'INT-OILPUMP-02')
port('LO-pressure','Keluaran pompa oli',(.09,-.114,.016),'INT-OILPUMP-02')
port('LO-block-feed','Sambungan keluar saluran oli blok',(.224,.208,.301),bloc)
port('LO-cool-in','Port sisi oli pada cover pendingin',(.292,.335,.431),'EXT-LUBE-62')
port('LO-cool-out','Port kembali pada cover pendingin',(1.034,.335,.431),'EXT-LUBE-62')
port('LO-filter-in','Saluran masuk rumah filter oli',(1.087,.281,.4545),header)
port('LO-filter-out','Saluran balik ke galeri dari filter',(.785,.28,.3315),header)
port('LO-gallery','Galeri distribusi oli pada blok',(.666,.288,.209),bloc)
port('LO-turbo-tap','Sambungan tekanan ke turbo pada blok',(.682,.217,.301),bloc)
port('LO-turbo-in','Sambungan oli rumah bantalan turbo',(.677,.743,.481),tc)
port('LO-turbo-drain','Keluar oli rumah bantalan turbo',(.677,.638,.481),tc)
port('LO-drain-block','Sambungan pipa balik pada blok',(.481,.119,.3212),bloc)
route('LO-pickup','Saringan karter ke isap pompa','LO-screen','LO-pump-in',
      [(.186,-.445,0),(.169,-.371,-.012),(.157,-.325,-.024),(.133,-.298,-.031),(.103,-.266,-.032),
       (.092,-.245,-.032),(.09,-.222,-.031)],.014,['D05 Fig 41; koordinat dari INT-OILPUMP-10'], 'INT-OILPUMP-10',raw=True)
route('LO-pump','Pompa oli roda gigi','LO-pump-in','LO-pressure',
      [(.09,-.17,-.043),(.09,-.137,-.061),(.09,-.115,-.031)],.006,['D01 PDF 158, Fig pompa oli'])
route('LO-to-port','Saluran tekanan dari pompa ke sisi blok','LO-pressure','LO-block-feed',
      [(.098,-.101,.077),(.113,-.02,.140),(.193,.137,.187),(.224,.208,.263)],.006,['D01 PDF 157'])
route('LO-cooler-feed','Oli tekan menuju pendingin pelat','LO-block-feed','LO-cool-in',
      [(.224,.208,.330),(.222,.209,.407),(.230,.222,.445),(.250,.280,.460),(.278,.326,.466),(.292,.335,.451)],.010,
      ['D05 Fig 49, pipa oli 148620-39150 / 148620-39160'], 'EXT-LUBE-300')
route('LO-plate-core','Sisi oli pada kedua unit pelat','LO-cool-in','LO-cool-out',
      [(.292,.335,.392),(.292,.335,.353),(.475,.335,.354),(.626,.335,.354),(.691,.335,.356),
       (.871,.335,.356),(1.034,.335,.356),(1.034,.335,.392)],.004,['D05 Fig 42; D01 PDF 161'],extra=['EXT-LUBE-60','EXT-LUBE-61'])
route('LO-cooler-out','Pendingin oli ke rumah filter utama','LO-cool-out','LO-filter-in',
      [(1.034,.335,.453),(1.041,.331,.478),(1.066,.310,.483),(1.087,.287,.479),(1.087,.281,.468)],.010,
      ['D05 Fig 49, pipa sambungan oli'], 'EXT-LUBE-301')
route('LO-filter','Filter utama dan galeri keluar','LO-filter-in','LO-filter-out',
      [(1.039,.281,.429),(1.014,.250,.440),(1.014,.107,.458),(1.014,.076,.44),
       (1.014,.236,.425),(.969,.281,.385),(.812,.28,.381)],.005,['D05 Fig 45/46, filter oli; D01 PDF 157'],extra=['EXT-LUBE-03'])
route('LO-main-gallery','Keluaran filter ke galeri distribusi','LO-filter-out','LO-gallery',
      [(.781,.282,.301),(.752,.287,.238)],.006,['D01 PDF 157'])
route('LO-turbo-supply','Cabang galeri ke sambungan turbo','LO-gallery','LO-turbo-tap',
      [(.676,.277,.216),(.682,.226,.245)],.004,['D01 PDF 157; D05 Fig 50'])
route('LO-turbo-line','Pipa suplai oli ke turbo','LO-turbo-tap','LO-turbo-in',
      [(.682,.217,.340),(.682,.221,.458),(.687,.25,.506),(.689,.450,.525),(.683,.585,.549),
       (.682,.722,.552),(.681,.758,.543),(.677,.766,.524),(.677,.768,.488),(.677,.754,.481)],.009,
      ['D05 Fig 50, pipa suplai turbo 148660-39412'], 'EXT-LUBE-302')
route('LO-turbo-bearings','Jalur pelumasan bantalan turbo','LO-turbo-in','LO-turbo-drain',
      [(.677,.716,.481),(.68,.692,.474),(.69,.675,.467),(.682,.656,.48)],.004,
      ['D05 Fig 32, center housing; D01 PDF 157'])
route('LO-turbo-return','Pipa gravitasi dari turbo ke blok','LO-turbo-drain','LO-drain-block',
      [(.677,.610,.481),(.676,.551,.493),(.656,.469,.513),(.621,.407,.524),(.601,.300,.530),
       (.543,.194,.521),(.489,.134,.475),(.481,.119,.387),(.481,.119,.341)],.015,
      ['D05 Fig 51, pipa oli balik 148660-39741'], 'EXT-LUBE-303')
route('LO-sump-return','Oli kembali ke karter dan saringan','LO-drain-block','LO-screen',
      [(.574,.101,.233),(.538,-.056,.164),(.493,-.253,.101),(.451,-.424,.075),(.284,-.472,.022)],.006,
      ['D01 PDF 157, aliran jatuh kembali ke karter'])

# Static gallery taps lead through the stationary bearing film. The handoff to a
# moving drill uses the axis, the only point fixed in both coordinate systems.
from math import cos, sin, radians
journals=[.114,.309,.509,.709,.909,1.109,1.303]
pins=[.209,.409,.609,.809,1.009,1.209]
phases=[0,120,240,240,120,0]
journal_r=.1339425/2
pin_r=.10595/2
for j,x in enumerate(journals,1):
    port(f'LO-gallery-{j}',f'Cabang galeri menuju tumpuan {j}',(x,.208,.176),bloc)
    port(f'LO-main-{j}',f'Alur metal atas tumpuan {j}',(x,journal_r+.00008,0),f'INT-MAIN-{j*10+1}')
    port(f'LO-journal-{j}',f'Sumbu referensi journal {j}',(x,0,0),f'INT-CRANK-{j:02d}')
    route(f'LO-main-bearing-{j}',f'Cabang menuju metal utama {j}',f'LO-gallery-{j}',f'LO-main-{j}',
          [(x,.161,.143),(x,.117,.085),(x,.088,.038)],.0035,
          ['D01 PDF 104, 106; metal atas dengan alur oli','D05 Fig 38, crankshaft'])
    route(f'LO-main-film-{j}',f'Alur oli metal atas dan journal {j}',f'LO-main-{j}',f'LO-journal-{j}',
          [(x,.054,0),(x,.030,0)],.003,['D01 PDF 104, 106, metal atas dan journal'],
          reason='Sumbu journal adalah titik peralihan koordinat antara blok diam dan poros berputar. Posisi lubang radial belum diketahui.')
    routes[-1]['direction_status']='INFERRED'
for j,src in [(4,'LO-gallery'),(3,'LO-gallery'),(2,'LO-gallery-3'),(1,'LO-gallery-2'),
              (5,'LO-gallery-4'),(6,'LO-gallery-5'),(7,'LO-gallery-6')]:
    route(f'LO-gallery-feed-{j}',f'Galeri blok ke cabang {j}',src,f'LO-gallery-{j}',[],
          .004,['D01 PDF 157, galeri utama dan main bearing'],raw=True)

for j,(x,phase) in enumerate(zip(pins,phases),1):
    a=radians(phase)
    cy=.090*cos(a)
    cz=-.090*sin(a)
    # Feed ends on the cylindrical oil film; no guessed bore is drilled in a service mesh.
    film=(x,round(cy+pin_r*cos(a),7),round(cz-pin_r*sin(a),7))
    port(f'LO-pin-{j}',f'Lapisan oli big end silinder {j}',film,f'INT-ROD-{j*10+3}')
    jm=journals[j-1]
    route(f'LO-crankpin-{j}',f'Saluran poros ke crankpin silinder {j}',f'LO-journal-{j}',f'LO-pin-{j}',
          [(jm+.012,0,0),(x-.065,.029*cos(a),-.029*sin(a)),
           (x-.055,.073*cos(a),-.073*sin(a)),(x-.036,cy,cz),
           (x-.012,cy+.025*cos(a),cz-.025*sin(a))],
          .0033,['D01 PDF 101–102, crank pin oil clearance; PDF 104–106, poros dan metal'],
          extra=[f'INT-CRANK-{j*10+10}',f'INT-CRANK-{j*10+11}'],
          reason='Gang bor dan pasangan journal/crankpin diilustrasikan dari posisi mekanisme; arah bor per journal tidak diukur.')
    routes[-1].update(motion='crank',direction_status='INFERRED')
    z_return=.112 if j%2 else -.112
    exitp=(x+.050,film[1],film[2])
    # A short rotating axial film spill opens into the stationary crankcase.
    # In the free-fall region deformation tapers to zero, keeping the sump fixed.
    fixed_y=-.375
    port(f'LO-crankcase-{j}',f'Oli menetes ke karter silinder {j}',(x,fixed_y,z_return),'EXT-OILPAN-01')
    route(f'LO-rod-drain-{j}',f'Oli keluar sisi big end {j} ke karter',f'LO-pin-{j}',f'LO-crankcase-{j}',
          [exitp,(x+.055,film[1]-.043,film[2]),(x+.049,-.147,z_return*.72),
           (x+.018,-.278,z_return*.94)],.003,
          ['D01 PDF 101–102; D01 PDF 157, pengembalian ke oil pan'],
          extra=[f'INT-ROD-{j*10+1}'],raw=True,
          reason='Tetes dan aliran balik di ruang engkol ditampilkan secara skematis, tanpa perhitungan dinamika fluida.')
    routes[-1].update(motion='crank_drain',motion_weights=[1,1,.8,.36,.13,0],direction_status='INFERRED')
    route(f'LO-reservoir-{j}',f'Karter silinder {j} ke bak oli bersama',f'LO-crankcase-{j}','LO-screen',
          [(x,-.421,z_return*.88),(x,-.463,z_return*.58),((x+.201)*.5,-.469,z_return*.23)],
          .003,['D01 PDF 157, bak oli'],reason='Satu volume bak bersama. Lintasan cairan setelah masuk bak bersifat ilustratif.')
    routes[-1]['direction_status']='INFERRED'
port('LO-rear-spill','Sisi tumpuan ujung di atas karter',(1.321,.036,.044),'INT-MAIN-71')
route('LO-main-end-spill','Oli dari tumpuan ujung kembali ke karter','LO-journal-7','LO-rear-spill',
      [(1.303,.028,.028),(1.306,.044,.04)],.003,['D01 PDF 104 dan 157'])
routes[-1]['direction_status']='INFERRED'
route('LO-main-end-return','Kembali ke bak dari tumpuan ujung','LO-rear-spill','LO-crankcase-6',
      [(1.325,-.068,.053),(1.316,-.173,.028),(1.299,-.291,-.026)],.003,['D01 PDF 157'])
routes[-1]['direction_status']='INFERRED'

import runpy
runpy.run_path(str(Path(__file__).resolve().parents[1]/'motion'/'freshwater_pump.py'))['update_flow'](ports,routes,fair,smooth)

# D01 piping diagram: pump circulates through the hot engine before the
# thermostat opens. This alternate return is shown schematically because the
# construction of the internal bypass passage is not dimensioned.
route('FW-cold-bypass','Bypass coolant dingin kembali ke pompa','FW-stat','FW-pump-in',
      [(1.516,.819,.018),(1.542,.763,-.016),(1.548,.675,-.051),(1.548,.554,-.068),(1.536,.490,-.069)],
      .007,['D01 PDF15 cetak11, Piping Diagram','D01 PDF163 cetak159, coolant circuit','D01 PDF168 cetak164'],
      extra=['EXT-COOLING-01','EXT-COOLING-55','EXT-COOLING-58'],reason='Lokasi bor dan bentuk aktual belum terukur. Ini jalur fungsional skematis pada kondisi dingin.')
for r in routes:
    if r['system']=='freshwater':
        r['thermal_branch']='bypass' if r['id']=='FW-cold-bypass' else 'exchanger' if r['id'] in ('FW-cooler-shell','FW-return') else 'circulation'
        r['condition']={'bypass':'Lebih besar ketika termostat dingin','exchanger':'Mengalir ketika termostat membuka','circulation':'Pompa bergerak pada crank, idle dan coast'}[r['thermal_branch']]
data=dict(frame='glTF metres, positive Y up',ports=list(ports.values()),routes=routes,
          gaps=['Cabang katup keselamatan dan pengatur tekanan, filter bypass, pompa injeksi, rocker, nok dan pendinginan piston tercantum pada D01 PDF 157. Routing 3D cabang tersebut belum diverifikasi.',
                'Bypass termostat dingin memperlihatkan topologi, bentuk pengeboran belum diketahui. Selang dan tangki pemulihan tekanan berada di luar geometri jalur.',
                'Geometri dan identitas sambungan sesuai nomor seri belum terverifikasi. Pipa milik kapal dan opsi pendingin gearbox berhenti di batas mesin.'])
Path(__file__).with_name('water-lube.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
