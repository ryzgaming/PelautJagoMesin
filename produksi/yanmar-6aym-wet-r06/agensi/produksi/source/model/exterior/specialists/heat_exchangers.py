"""6AYM-WET front coolant heat exchanger and engine oil cooler; D05 figs. 57/42."""
from math import cos, sin, pi, sqrt
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

Z=(0,0,1)
Y=(0,1,0)


def rect(x,y,w,h,r):
    return [(x+u,y+v) for u,v in [(-w+r,-h),(w-r,-h),(w,-h+r),
                (w,h-r),(w-r,h),(-w+r,h),(-w,h-r),(-w,-h+r)]]


def circle(x,y,r,n=32):
    return [(x+r*cos(2*pi*i/n),y+r*sin(2*pi*i/n)) for i in range(n)]


def plate(api,outer,holes,z0,z1,mat):
    """Perforated plate with physically open ports through both faces."""
    pts=[]; boundaries=[]
    for loop in [outer,*holes]:
        boundaries.append(list(range(len(pts),len(pts)+len(loop))))
        pts.extend(Vector(v) for v in loop)
    xy,_,tris,_,_,regions=delaunay_2d_cdt(pts,[],boundaries,0,1e-8)
    faces=[list(f) for f,r in zip(tris,regions) if r==[0]]
    n=len(xy)
    vs=[(p.x,p.y,z) for z in (z0,z1) for p in xy]
    sides={}
    for f in faces:
        for u,v in zip(f,f[1:]+f[:1]):
            k=tuple(sorted((u,v)))
            sides[k]=sides.get(k,0)+1
    polygons=[list(reversed(f)) for f in faces]+[[k+n for k in f] for f in faces]
    polygons += [(u,v,v+n,u+n) for (u,v),count in sides.items() if count==1]
    return api['mesh'](vs,polygons,mat)


class Recipe:
    def __init__(self,a,group,slug,title,anchor,fig,manual):
        self.a=a;self.group=group;self.slug=slug;self.title=title;self.anchor=anchor
        self.refs=[f'D05 Parts Catalogue WET / Fig. {fig}',manual];self.entries=[]
        a['remove_part'](f'EXT-{group}-{anchor:02d}')

    def add(self,n,name,shapes,ref,pn,role,displacement,detail,qty=1):
        length=Vector(displacement).length
        direction=tuple(Vector(displacement).normalized()) if length else None
        refs=[self.refs[0]+f' / pos. {ref}',self.refs[1]]
        obj=self.a['add'](self.group,n,name,shapes,refs,detail,parent=self.slug,nested_under='RAK-'+self.group,
                         role=role,oem=pn,xray=role in ('shell','cover'),quantity=qty,direction=direction)
        self.entries.append(dict(no=len(self.entries)+1,nama=name,object_ids=[obj.name],
                  posisi=[dict(object_id=obj.name,arah=list(direction),jarak_m=length,urutan=len(self.entries))] if length else [],
                  sumber=refs,nomor_oem=pn,ukuran=None,role=role,status='ESTIMATED',fungsi=detail))

    def finish(self):
        self.a['register_recipe'](dict(id=self.slug,node_rakitan=self.slug,parent_rakitan='RAK-'+self.group,
            nama=self.title,status='UNVERIFIED',source_refs=self.refs,acuan=dict(no=1,object_ids=self.entries[0]['object_ids']),
            diagram=dict(arah_pandang=[.46,.32,.827],atas=[0,1,0]),bagian=self.entries,
            notes='Skema bentuk berdasar gambar parts book. Dimensi, jumlah elemen geometri inti dan posisi port diperkirakan. Penetapan nomor seri belum tersedia.'))


def build(a):
    metal=a['appearance']('Inti pendingin · warna logam ilustratif',(.42,.31,.17),.66,.36)
    water(a,metal)
    oil(a,metal)


def water(a,metal):
    r=Recipe(a,'COOLING','RAK-FW-COOLER','Penukar panas coolant depan',1,57,'D01 PDF 166 cetak 162 & PDF 168 cetak 164')
    x,y=1.525,.696
    left,right=-.393,.258
    cast,cover,steel,seal=[a[k] for k in ('cast','cover','steel','rubber')]
    def section(z,rx,ry,p,cy=y):
        def power(v):return (1 if v>=0 else -1)*abs(v)**p
        return [(x+rx*power(cos(i*pi/32)),cy+ry*power(sin(i*pi/32)),z) for i in range(64)]
    outer=[section(left,.154,.12,.57),section(left+.027,.166677,.144,.51,.720),
           section(right-.029,.166677,.144,.51,.720),section(right,.154,.12,.57),
           section(right,.109,.109,1),section(right-.05,.123,.112,.68),
           section(left+.05,.123,.112,.68),section(left,.109,.109,1)]
    shell=a['polygon_loft'](outer,cast,0,True)
    # Chamber communicating with the coolant space above the bundle.
    a['subtract'](shell,a['box']((x,.841,-.048),(.118,.111,.411),cast,.004))
    a['clean_boolean'](shell)
    r.add(1,'Coran penukar panas air tawar',shell,'(1)',None,'shell',(0,0,0),
          'Ruang coolant mengelilingi core pipa. Casting merupakan bagian rakitan katalog 748660-44801.')
    holes=[(x+i*.013+(.0065 if j%2 else 0), y+j*.0115) for j in range(-7,8) for i in range(-7,8)
           if (i*.013+(.0065 if j%2 else 0))**2+(j*.0115)**2<.094**2 and abs(j*.0115)>.006]
    cores=[]
    for cx,cy in holes:
        # Open walls joined into one removable core; visual tube count is sampled.
        cores.append(a['ring']((cx,cy,0),Z,[(left+.008,.005),(right-.008,.005),
                        (right-.008,.0039),(left+.008,.0039)],metal,8))
    for z in (left+.012,right-.016):
        cores.append(plate(a,circle(x,y,.103,64),[circle(i,j,.00503,8) for i,j in holes],z,z+.004,steel))
    for z in (left+.015,right-.015):
        cores.append(a['box']((x,y,z),(.199,.006,.004),steel,0))
    for z in (-.20,-.03,.14):
        cores.append(a['annulus']((x,y,z),Z,.103,.100,.007,steel))
    r.add(50,'Core tubular air tawar',cores,14,'148633-44211','core',(0,0,.82),
          'Air laut mengalir di dalam pipa, coolant di luar pipa. Pipa dibuat berongga. Pola, jumlah pipa dan penyangga merupakan perkiraan.')
    for side,z,num,pn,ref in [(-1,left,51,'148660-44321',23),(1,right,52,'148633-44310',22)]:
        p=(x,y,z+side*.005)
        cap=a['ring'](p,(0,0,side),[(0,.103),(.003,.129),(.010,.127),(.034,.105),
                (.053,.068),(.060,.012),(.050,.012),(.044,.060),(.025,.090),(.009,.104)],cover)
        capset=[cap,a['cylinder']((x,y,z+side*.061),Z,.012,.008,cover,32,.001)]
        for i in range(8):
            w=i*pi/4
            capset.append(a['bolt']((x+.121*cos(w),y+.121*sin(w),z+side*.021),Z,.008))
        capset.append(a['annulus']((x+.041,y+.045,z+side*.046),(0,0,side),.032,.018,.035,cast))
        r.add(num,'Tutup ujung penukar panas '+str(ref),capset,ref,pn,'cover',(0,0,side*(1.05 if side==1 else .34)),
              'Tutup manifold air laut, profil dan orientasi sambungan diestimasi dari gambar.')
        r.add(53 if side<0 else 54,'O-ring tutup '+str(ref),a['annulus']((x,y,z+side*.0024),Z,.113,.109,.0028,seal),28,
              '24321-002300','seal',(0,0,side*(.94 if side==1 else .21)),'Seal antara tutup dan body.')
    # D01 thermostat grouping: plan pattern 2x3, estimated poses constrained to upper casting.
    for i in range(6):
        cx=x+(-.030 if i<3 else .030);z=-.178+(i%3)*.101
        # D01 p168: 33 mm valve bore, at least 8 mm travel. The two feet of
        # the frame support the spring below the valve. The moving capsule
        # slides around its fixed central stem.
        ref,number=(58,'148616-48200') if i<3 else (59,'126634-48180')
        d=((-.13 if i<3 else .13),.19,z*.36)
        frame=[a['annulus']((cx,.843,z),Y,.027,.0165,.004,metal),
               a['annulus']((cx,.801,z),Y,.0173,.0067,.003,metal),
               a['cylinder']((cx,.839,z),Y,.0024,.024,steel,24,.0003)]
        for side in (-1,1):
            start=Vector((cx+side*.0235,.842,z));end=Vector((cx+side*.0155,.801,z))
            frame.append(a['cylinder']((start+end)*.5,end-start,.0017,(end-start).length,steel,12,0))
        for side in (-1,1):
            a0=Vector((cx+side*.021,.845,z));a1=Vector((cx+side*.0018,.850,z))
            frame.append(a['cylinder']((a0+a1)*.5,a1-a0,.0015,(a1-a0).length,steel,12,0))
        r.add(55+i,f'Rangka termostat {71 if i<3 else 76.5} °C · {i%3+1}',frame,ref,number,'thermostat',d,
              'Rangka tetap. Tipe A mulai membuka pada 71 °C, tipe B pada 76,5 °C. Bore 33 mm.')
        disc=[a['ring']((cx,.8406,z),Y,[(-.002,.0049),(-.002,.0162),(-.0005,.0186),(.0004,.0186),(.0004,.005)],steel),
              a['annulus']((cx,.823,z),Y,.0058,.00265,.035,metal)]
        if i>=3:
            a['subtract'](disc[0],a['cylinder']((cx+.0115,.839,z),Y,.0015,.012,metal,24,0))
            disc.append(a['cylinder']((cx+.0115,.839,z),Y,.00075,.004,steel,12,0))
        r.add(330+i,f'Katup dan kapsul lilin termostat {i+1}',disc,ref,None,'valve',(d[0],.25,d[2]),
              'Subkomponen termostat. Travel model 8 mm ke bawah saat terbuka penuh; pin jiggle tipe B diperlihatkan dalam satu posisi.')
        coil=[(cx+.0103*cos(k*pi/8),.80355+.03445*k/64,z+.0103*sin(k*pi/8)) for k in range(65)]
        r.add(340+i,f'Pegas balik termostat {i+1}',a['sweep'](coil,.00092,steel,8),ref,None,'spring',(d[0],.27,d[2]),
              'Pegas memendek ketika katup membuka, dengan ujung bawah terpasang pada frame.')
    r.add(61,'Tutup ruang termostat',a['box']((x,.861,-.043),(.131,.009,.422),cover,.004),
          33,'148660-44351','cover',(0,.42,0),'Menutup keenam termostat melalui gasket terpisah.')
    outer=rect(x,-.043,.064,.209,.010)
    p=plate(a,outer,[circle(x+dx,-.178+j*.101,.026,20) for dx in [-.03,.03] for j in range(3)],-.851,-.849,seal)
    # plate helper uses xy, extrudes along Z. Rotate coordinates into x/z plane.
    for v in p.data.vertices:
        wx,wy,wz=v.co
        v.co=(wx,-wz,wy)
    r.add(62,'Gasket ruang termostat',p,34,'148660-44360','seal',(0,.315,0),'Gasket dengan enam bukaan pada posisi termostat.')
    r.finish()


def oil(a,metal):
    r=Recipe(a,'LUBE','RAK-OIL-COOLER','Pendingin oli tipe pelat',5,42,'D01 PDF 161 cetak 157, Lubricating oil cooler')
    x,y=.663,.335
    cast,cover,steel,rubber=[a[k] for k in ('cast','cover','steel','rubber')]
    outer=rect(x,y,.423,.060,.009)
    inner=rect(x,y,.407,.052,.010)
    shell=a['polygon_loft']([[(u,v,z) for u,v in loop] for loop,z in [
        (outer,.315),(outer,.418),(inner,.418),(inner,.323)]],cast,0,False)
    r.add(5,'Rumah terbuka pendingin oli',shell,2,'148620-33030','shell',(0,0,0),
           'Rongga panjang menghadap sisi non-operation. Oli dan coolant melewati saluran pelat yang berbeda.')
    for idx,cx in enumerate([x-.203,x+.203]):
        plate_outline=rect(cx,y,.190,.042,.012)
        core=[]
        # Parallel shallow stamped channels and alternate plate gaps, scaled to the model.
        for j in range(12):
            z=.332+j*.0066
            ports=[circle(cx+dx,y,.0082,16) for dx in (-.168,.168)]
            core.append(plate(a,plate_outline,ports,z,z+.003,metal))
        for dx in (-.168,.168):
            core.extend([a['annulus']((cx+dx,y,.411),Z,.012,.008,.009,steel),
                         a['annulus']((cx+dx,y+.022,.410),Z,.007,.004,.010,steel)])
        r.add(60+idx,'Core pelat pendingin oli '+str(idx+1),core,4,'148620-33010','core',(0,0,.23+idx*.04),
              'Satu dari dua unit core yang tercantum di katalog. D01 mengidentifikasi penukar tipe pelat; jumlah pelat ilustratif.')
    inspection=rect(x,y,.081,.035,.007)
    end_ports=[circle(u,y,.009,16) for u in (x-.371,x+.371)]
    flange=plate(a,outer,[inspection,*end_ports],.421,.431,cover)
    bolts=[a['bolt']((x+dx,y+dy,.438),Z,.0065) for dx in [-.398,-.203,0,.203,.398] for dy in [-.049,.049]]
    r.add(62,'Cover distribusi pendingin oli',[flange,*bolts],3,'148620-33041','cover',(0,0,.47),
          'Tutup utama membawa sambungan alir; juga menyangga tutup inspeksi kecil.')
    def gasket(out,inside,z):
        return plate(a,out,[inside],z,z+.0015,rubber)
    r.add(63,'Gasket cover panjang',gasket(outer,inner,.4185),17,'148620-33050','seal',(0,0,.35),
          'Gasket memisahkan sisi tutup dari badan.')
    small=rect(x,y,.101,.046,.009);hole=rect(x,y,.082,.035,.006)
    r.add(64,'Pelat inspeksi depan cooler oli',a['prism'](small,'z',.434,.444,cover,.002),
          16,'148620-33061','cover',(0,0,.61),'Penutup kecil terpisah di tengah tutup distribusi.')
    r.add(65,'Gasket inspeksi cooler oli',gasket(small,hole,.4315),18,'148620-33070','seal',(0,0,.55),
          'Bentuk luar gasket mengikuti perkiraan cover inspeksi.')
    for n,radius,qty,dy,ref,pn in [(66,.013,4,0,6,'24326-000300'),(67,.0068,8,.023,7,'24316-000140')]:
        centers=[(cx+dx,y+s) for cx in [x-.203,x+.203] for dx in [-.168,.168] for s in ([dy,-dy] if dy else [0])]
        seals=[a['annulus']((u,v,.417),Z,radius,radius-.0017,.0024,rubber) for u,v in centers]
        r.add(n,'Kelompok O-ring port '+str(ref),seals,ref,pn,'seal',(0,.08*(ref-5),.31),
              'Ring disajikan per kelompok; susunan, penampang dan kegunaan tiap port diestimasi.',qty)
    r.finish()
