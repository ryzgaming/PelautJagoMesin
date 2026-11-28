"""Fig.107 intermediate-shaft drive to Fig.109 single-groove alternator."""
import math
import runpy
from mathutils import Vector
def build(api):
    definition=runpy.run_path(str(api['OUT'].parent/'motion'/'belt.py'))
    cx=definition['FRONT_GEAR_X'];px=definition['PULLEY_X']
    ya,za=definition['DRIVER'];axis=(1,0,0)
    gear='INT-TIMING-10'
    key='RAK-ALTDRIVE';rows=[]
    fig='D05 Fig.107 GENERATOR, V-belt, intermediate shaft, bearing case and drive gear; Fig.109 pulley'
    steel,cast,rubber=api['steel'],api['cast'],api['rubber']
    def p(x):return (x,ya,za)
    def put(num,label,shapes,ref,pn,role,dx,why):
        refs=[fig+' / ref. '+str(ref),'D01 PDF 112, front cam gear and alternator driving gear']
        obj=api['add']('FRONT',num,label,shapes,refs,why+' Letak, alur, panjang kerja dan jarak bebas adalah estimasi pemasangan model.',
            parent=key,nested_under='RAK-FRONT',role=role,oem=pn,direction=(1,0,0) if dx>=0 else (-1,0,0),xray=role=='shell')
        rows.append(dict(no=len(rows)+1,nama=label,object_ids=[obj.name],nomor_oem=pn,role=role,
            status='ESTIMATED',ukuran=None,source_refs=refs,sumber=refs,fungsi=why,
            posisi=[] if not dx else [dict(object_id=obj.name,arah=[1 if dx>0 else -1,0,0],jarak_m=abs(dx),urutan=len(rows)+1)]))
    def spin(x,profile,mat=steel,count=60):return api['ring'](p(x),axis,profile,mat,count)
    def ann(x,ro,ri,width,mat):return api['annulus'](p(x),axis,ro,ri,width,mat)
    case=spin(1.397,[(-.023,.026),(-.023,.0315),(-.017,.0315),(-.014,.0325),
               (.025,.0325),(.035,.030),(.035,.016),(.030,.016),(.030,.026),(.015,.026),
               (.015,.022),(-.006,.022),(-.006,.026)],cast)
    put(8,'Rumah bantalan poros penggerak alternator',case,23,'148660-77220','shell',0,
        'Badan tetap menopang dua bearing dan seal; gear depan menggerakkan poros di dalamnya.')
    shaft=spin(1.401,[(-.066,.003),(-.066,.0095),(-.061,.011),(-.048,.011),(-.045,.0125),
              (.028,.0125),(.031,.0135),(.036,.0135),(.037,.012),(.061,.012),(.064,.0095),(.071,.0095),(.071,.003)])
    put(6,'Poros perantara penggerak alternator',shaft,22,'148660-77210','shaft',.18,
        'Poros meneruskan putaran gear Fig.107 ref.29 ke puli Fig.107 ref.21.')
    pulley=spin(px,[(-.016,.012),(-.016,.032),(-.012,.031),(-.012,.065),(-.009,.068),
        (-.0074,.068),(-.004,.0587),(-.0033,.0584),(.0033,.0584),(.004,.0587),(.0074,.068),(.009,.068),(.012,.064),(.012,.028),(.014,.027),(.014,.012)],api['cover'])
    put(7,'Puli-V penggerak sabuk alternator',pulley,21,'148633-77410','drive',.32,
        'Alur-V memberi traksi pada satu belt yang dipilih sesuai puli alternator Fig.109.')
    # Separate inner and outer races. Nominal 6205 dimensions 25 × 52 × 15 mm.
    for j,bx in enumerate((1.382,1.419)):
        outer=ann(bx,.026,.0230,.015,steel)
        inner=ann(bx,.0164,.01252,.015,steel)
        balls=[]
        for k in range(9):
            t=k*math.tau/9
            api['bpy'].ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=8,radius=.00338,
                location=api['world']((bx,ya+.0197*math.cos(t),za+.0197*math.sin(t))))
            balls.append(api['shade'](api['bpy'].context.object,steel,smooth=True))
        put(9+j*3,f'Ring luar bearing 6205 posisi {j+1}',outer,27,'24101-062054','bearing',.11+.16*j,'Ring luar dipasang tetap pada rumah bearing.')
        put(10+j*3,f'Ring dalam bearing 6205 posisi {j+1}',inner,27,'24101-062054','bearing',.14+.16*j,'Ring dalam terpasang pada poros perantara dan berputar bersamanya.')
        put(11+j*3,f'Elemen gelinding bearing 6205 posisi {j+1}',balls,27,'24101-062054','bearing',.17+.16*j,
            'Orbit set bola tanpa slip dihitung dari radius lintasan dan bola model. Putaran lokal tiap bola tidak diperagakan.')
    put(15,'Seal bibir poros perantara',ann(1.430,.023,.0138,.006,rubber),24,'136600-42480','seal',.22,'Bibir seal tetap di dalam case untuk menahan oli.')
    put(16,'Snap ring rumah bantalan',spin(1.431,[(0,.0227),(0,.026),(.0015,.026),(.0015,.0227)]),
         25,'22252-000520','fastener',.23,'Menahan bearing pada case.')
    for j,x in enumerate((1.345,1.453)):
        put(17+j,f'Pasak gear/puli {j+1}',api['box']((x,ya+.0115,za),(.014,.003,.007),steel,.001),26,'22512-070140','fastener',.19+.15*j,
            'Pasak mengunci komponen penggerak terhadap putaran relatif pada poros.')
    for j,x in enumerate((1.340,1.4685)):
        put(19+j,f'Mur pengunci M20 poros {j+1}',spin(x,[(-.003,.010),(-.003,.015),(.003,.015),(.003,.010)],steel,6),
            28,'26776-200002','fastener',.20+.17*j,'Mur mengunci tumpukan poros secara aksial.')
    path=list(map(Vector,definition['loop']()))[:-1]
    # At the transition from an arc to a long tangent, normalize both edge directions separately.
    def row(i,profile):
        before=(path[i]-path[i-1]).normalized()
        after=(path[(i+1)%len(path)]-path[i]).normalized()
        way=(before+after).normalized();radial=Vector((0,way.z,-way.y))
        return [path[i]+Vector((x,0,0))+d*radial for x,d in profile]
    shape=[(-.004,-.00415),(.004,-.00415),(.00692,.00380),(-.00692,.00380)]
    belt=api['polygon_loft']([row(i,shape) for i in range(len(path))],rubber,0,True)
    put(4,'Sabuk-V A28 penggerak alternator',belt,15,'25132-002800','belt',.25,
        'Loop terbuka pada dua puli. Satu belt sesuai alternatif satu alur. Bentuk loop tetap saat material sabuk berjalan.')
    # A short non-OEM witness stripe is bound to a material station. It makes travel unambiguous.
    q=path[0];way=(path[1]-q).normalized();normal=Vector((0,way.z,-way.y))
    witness=api['polygon_loft']([[q+way*t+Vector((x,0,0))+normal*d for x,d in
             [(-.0058,.00382),(.0058,.00382),(.0058,.00416),(-.0058,.00416)]] for t in (0,.006)],
             api['appearance']('Penanda inspeksi sabuk',(.70,.50,.18),.03,.45),0)
    put(5,'Tanda perjalanan permukaan sabuk',witness,'ilustrasi',None,'witness',.26,'Penanda edukasi bergerak mengikuti panjang loop; bukan part OEM.')
    api['register_recipe'](dict(id=key,nama='Poros perantara dan sabuk alternator',node_rakitan=key,parent_rakitan='RAK-FRONT',
       acuan=dict(no=1,object_ids=['EXT-FRONT-08']),bagian=rows,diagram=dict(arah_pandang=[1,.20,.12],atas=[0,1,0]),
       source_refs=[fig],notes='Gear Fig.107 ref.29 adalah '+gear+'. Identitas serial dan diameter pitch belum diverifikasi.',status='ESTIMATED'))
