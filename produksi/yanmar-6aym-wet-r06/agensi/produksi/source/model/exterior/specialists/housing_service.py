"""Serviceable flywheel, bonnet and sump items; engine coordinate dimensions in metres."""
from math import atan2, cos, hypot, pi, sin

FLY = ['D05 Parts catalog 0CG10-M34300 Fig.38 Crankshaft & flywheel WET #6, #8, #9',
       'D01 service PDF 113 / printed 109: flywheel Ø632, ring pitch Ø630, 180 teeth',
       'GA01 B3-48660-4450: SAE attachment face and flywheel PCD']
HEAD = ['D05 Parts catalog 0CG10-M34300 Fig.24 Bonnet, WET #8,9,12,13,14',
        'P10 / housing outline; top orthogonal shape and dimensions estimated']
SUMP = ['D05 Parts catalog 0CG10-M34300 Fig.8,9,10,11 WET: variants of sump, M30 gasket and sump gasket',
        'P18 / rear drain; GA01 side/front silhouette']
X,Y = (1,0,0),(0,1,0)


def retain(api, key, group, family, refs, description):
    api['reparent_part'](key,group,family,role='shell',xray=True)
    entry=next(v for v in api['parts'] if v['id']==key)
    entry['source_refs']=list(dict.fromkeys(entry['source_refs']+refs))
    entry['sumber']=entry['source_refs']
    return [item(1,key,entry['name'],'shell',description,entry['source_refs'])]


def item(n,key,name,role,description,refs,direction=None,length=0,pn=None):
    pose=[dict(object_id=key,arah=list(direction),jarak_m=length,urutan=n)] if length else []
    return dict(no=n,nama=name,object_ids=[key],role=role,fungsi=description,
                posisi=pose,sumber=refs,status='ESTIMATED',nomor_oem=pn)


def recipe(api,key,parent,label,rows,refs,limit,view):
    api['register_recipe'](dict(id=key,nama=label,node_rakitan=key,parent_rakitan=parent,
                acuan=dict(no=1,object_ids=rows[0]['object_ids']),
                diagram={'arah_pandang':view,'atas':[0,1,0]},bagian=rows,source_refs=refs,
                status='UNVERIFIED',notes=limit))


def flywheel(api):
    group='RAK-FLYWHEEL-DISK'
    rows=retain(api,'EXT-FLYWHEEL-02',group,'RAK-FLYWHEEL',FLY,
                'Menyimpan energi rotasi dan meneruskan putaran ke flange sisi keluaran.')
    # The two main inner loops are sized before machining the starter port.
    bell=api['bpy'].data.objects['EXT-FLYWHEEL-01']
    inverse_bell=bell.matrix_world.inverted()
    # These two reinforcement pads are separate connected islands of the same
    # casting. Their old inside edges cut through the disk on its forward face.
    neighbors=[[] for _ in bell.data.vertices]
    for edge in bell.data.edges:
        a,b=edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    visited=set()
    pad_count=0
    for seed in range(len(neighbors)):
        if seed in visited:
            continue
        ids=[];stack=[seed];visited.add(seed)
        while stack:
            i=stack.pop();ids.append(i)
            for j in neighbors[i]:
                if j not in visited:
                    visited.add(j);stack.append(j)
        points=[bell.matrix_world @ bell.data.vertices[i].co for i in ids]
        if abs(min(v.x for v in points)+.063)>.0001 or abs(max(v.x for v in points)-.036)>.0001:
            continue
        pad_count+=1
        for i,v in zip(ids,points):
            r=hypot(v.y,v.z)
            if r<.312:
                v.y*=.314/r
                v.z*=.314/r
                bell.data.vertices[i].co=inverse_bell @ v
    if pad_count!=2:
        raise RuntimeError(f'Expected two casting pads, found {pad_count}')
    bell.data.update()
    housing_info=next(v for v in api['parts'] if v['id']=='EXT-FLYWHEEL-01')
    housing_info['note']+=' Dua lingkar kontur dalam dan tepi dalam penguat samping mengikuti ruang sapuan flywheel model. Bentuk coran dan clearance OEM belum diketahui.'
    # Seat only the OD. Leave both drilled mounting zones, disk hub and its
    # crank-axis pivot intact. The existing disk was smooth in this band.
    wheel=api['bpy'].data.objects['EXT-FLYWHEEL-02']
    inverse=wheel.matrix_world.inverted()
    for v in wheel.data.vertices:
        p=wheel.matrix_world @ v.co
        radial=hypot(p.y,p.z)
        if radial>.3045:
            p.y*=.3045/radial
            p.z*=.3045/radial
            v.co=inverse @ p
    wheel.data.update()
    verts=[];faces=[]
    # Pitch Ø630 from D01. Active flank profile and axial seat are estimates.
    tooth_profile=[(0,.3117),(.12,.3117),(.34,.316),(.59,.316),(.82,.3117)]
    count=len(tooth_profile)*180
    for x,side in [(-.109,False),(-.109,True),(-.074,True),(-.074,False)]:
        for k in range(180):
            for offset,r in tooth_profile:
                a=2*pi*(k+offset)/180
                radius=r if side else .30452
                verts.append((x,radius*cos(a),radius*sin(a)))
    for j in range(4):
        l=(j+1)%4
        for i in range(count):
            k=(i+1)%count
            faces.append((j*count+i,j*count+k,l*count+k,l*count+i))
    part=api['mesh'](verts,faces,api['steel'])
    label='Ring gear starter · 180 gigi'
    note='Memberi bidang gigi untuk pinion starter; pitch Ø630 mm. Gigi, lebar dan seat berupa pendekatan visual.'
    api['add']('FLYWHEEL',20,label,part,FLY,note,parent=group,nested_under='RAK-FLYWHEEL',
               role='inner',oem='133670-21600',origin=(-.049,0,0),direction=(-1,0,0))
    rows.append(item(2,'EXT-FLYWHEEL-20',label,'inner',note,FLY,(-1,0,0),.14,'133670-21600'))
    # Preserve the 12 central cap screws that were already in the disk; they
    # stay rigidly attached in this revision (nominal BOM #9).
    entry=next(v for v in api['parts'] if v['id']=='EXT-FLYWHEEL-02')
    entry['nama']=entry['name']='Cakram flywheel dan hub'
    rows[0]['nama']=entry['name']
    coords=[wheel.matrix_world @ v.co for v in wheel.data.vertices]
    packed=[(p.x,p.z,-p.y) for p in coords]
    low=[round(min(p[i] for p in packed),6) for i in range(3)]
    high=[round(max(p[i] for p in packed),6) for i in range(3)]
    entry.update(bounds_m=[low,high],model_dimensions_m=[round(b-a,6) for a,b in zip(low,high)])
    recipe(api,group,'RAK-FLYWHEEL','Flywheel dan ring gear',rows,FLY,
           'D05 #6 adalah rakitan lengkap. Pengikat pusat #9 tetap menyatu pada mesh cakram; profil gigi dan suaian termal belum terukur.',
           [-.9,.25,-.32])


def bonnets(api):
    rect,loft=api['rect'],api['polygon_loft']
    def perimeter(x,dx,dz,h,c):
        return rect(x-dx,x+dx,-dz,dz,h,c)
    for i,x in enumerate(api['centers'],1):
        family='RAK-HEADS';group=f'RAK-BONNET-{i}';base=f'EXT-HEADS-{6+i:02}'
        api['remove_part'](base)
        # Same shell footprint and height, with the central bonnet cap bolt in
        # Fig.24 instead of the four generic corner heads in the baseline.
        outer=[perimeter(x,.096,.204,.627,.022),perimeter(x,.094,.198,.650,.024),
               perimeter(x,.086,.185,.705,.032),perimeter(x,.064,.158,.722,.027)]
        rim=loft(outer+[perimeter(x,.057,.150,.720,.025),perimeter(x,.078,.172,.701,.029),
                        perimeter(x,.082,.177,.662,.020),perimeter(x,.086,.187,.627,.020)],
                 api['cover'],.001,True)
        roof=loft([perimeter(x,.057,.150,.711,.025),perimeter(x,.057,.150,.722,.025)],api['cover'],.001)
        api['subtract'](roof,api['cylinder']((x,.715,0),Y,.0085,.04,api['black'],40,0))
        name=f'Bonnet rocker silinder {i}'
        api['add']('HEADS',6+i,name,[rim,roof],HEAD,'Tutup berlubang untuk satu baut pusat, sesuai Fig.24.',
                   parent=group,nested_under=family,role='shell',xray=True,oem='748960-11310',direction=Y)
        rows=[item(1,base,name,'shell','Menutup mekanisme rocker di atas kepala silinder.',HEAD)]
        def place(no,label,shape,role,note,pn,dy,vec=Y):
            key=f'EXT-HEADS-{no:02}'
            api['add']('HEADS',no,label,shape,HEAD,note,parent=group,nested_under=family,
                       role=role,oem=pn,direction=vec)
            rows.append(item(len(rows)+1,key,label,role,note,HEAD,vec,dy,pn))
        gasket=loft([perimeter(x,.094,.201,.626,.022),perimeter(x,.094,.201,.627,.022),
                     perimeter(x,.087,.190,.627,.020),perimeter(x,.087,.190,.626,.020)],
                    api['rubber'],0,True)
        place(30+i,'Gasket keliling bonnet',gasket,'seal','Menyekat bibir bonnet pada housing rocker; bentuk disesuaikan dengan footprint model.', '148628-11330',.047,(0,-1,0))
        place(40+i,'Washer seal baut bonnet',api['annulus']((x,.723,0),Y,.015,.0082,.002,api['rubber']),'seal','Menyekat lubang baut pada permukaan tutup.', '22190-160001',.040)
        fastener=[api['cylinder']((x,.730,0),Y,.012,.012,api['boltmat'],6,.0008),
                  api['cylinder']((x,.712,0),Y,.0074,.024,api['steel'],24,.0005)]
        place(50+i,'Baut pusat bonnet',fastener,'fastener','Menahan bonnet dan menekan washer seal. Bentuk kepala serta panjang terpasang merupakan estimasi.', '148620-11441',.080)
        # Slotted finite arc with end faces; not a full washer.
        v=[];f=[]
        for j in range(49):
            a=.18+(2*pi-.36)*j/48
            for radius,h in ((.00745,.703),(.0095,.703),(.0095,.7043),(.00745,.7043)):
                v.append((x+radius*cos(a),h,radius*sin(a)))
        for j in range(48):
            for k in range(4):f.append((4*j+k,4*j+(k+1)%4,4*j+4+(k+1)%4,4*j+4+k))
        f.extend([(0,1,2,3),(192,193,194,195)])
        place(60+i,'Cincin penahan baut',api['mesh'](v,f,api['steel']),'inner','Mempertahankan baut pada bonnet saat dibuka; bentuk alur diperkirakan.', '22242-000160',.07,(0,-1,0))
        recipe(api,group,family,name,rows,HEAD,'Cakupan bonnet Fig.24 #8,9,12–14. Housing rocker bawah, gasket serta pengikatnya merupakan rakitan lain dan belum direkonsiliasi.',[.45,.53,-.72])


def sump(api):
    group='RAK-SUMP-SERVICE';family='RAK-OILPAN'
    rows=retain(api,'EXT-OILPAN-01',group,family,SUMP,'Menampung oli mesin di bawah crankcase.')
    rect,loft=api['rect'],api['polygon_loft']
    outer=(.019,1.328,-.288,.288);inner=(.039,1.308,-.254,.254)
    def routed_rear_edge(bounds,y,corner):
        loop=rect(*bounds,y,corner)
        start,end=loop[6],loop[7]
        aft=[]
        for i in range(49):
            z=start[2]+(end[2]-start[2])*i/48
            aft.append((start[0]+api['sump_detour'](z),y,z))
        return loop[:6]+aft
    gasket=loft([routed_rear_edge(outer,-.156,.049),routed_rear_edge(outer,-.1545,.049),
                 routed_rear_edge(inner,-.1545,.042),routed_rear_edge(inner,-.156,.042)],api['rubber'],0,True)
    api['subtract'](gasket,api['box']((1.333,-.155,0),(.090,.020,.559),api['black'],0))
    # Mounting positions copied from the pan's existing mounting rows. Real
    # bolt counts differ with the pan configuration (four D05 variants).
    for s in (-1,1):
        for n in range(13):
            api['subtract'](gasket,api['cylinder']((.075+n*.099,-.155,s*.269),Y,.0055,.020,api['black'],16,0))
    api['clean_boolean'](gasket)
    name='Gasket karter terbuka di sisi timing'
    api['add']('OILPAN',20,name,gasket,SUMP,'Gasket U pada gambar, panjang, lebar dan lubang mengikuti flange model.',
               parent=group,nested_under=family,role='seal',oem='148620-01771',direction=Y)
    rows.append(item(2,'EXT-OILPAN-20',name,'seal','Menyekat sambungan karter dan crankcase.',SUMP,Y,.075,'148620-01771'))
    rows.extend(retain(api,'EXT-OILPAN-02',group,family,SUMP,'Membuka saluran pembuangan oli pada karter.'))
    rows[-1].update(no=3,role='plug',posisi=[dict(object_id='EXT-OILPAN-02',arah=[-1,0,0],jarak_m=.10,urutan=3)])
    api['reparent_part']('EXT-OILPAN-02',group,family,role='plug',xray=False)
    name='Gasket sumbat karter M30'
    api['add']('OILPAN',21,name,api['annulus']((.070,-.476,0),X,.022,.015,.001,api['steel']),SUMP,
               'Gasket 30 × 1 mm menurut katalog; diameter luar dan pemasangan model diestimasi.',role='seal',
               parent=group,nested_under=family,oem='23414-300000',direction=(-1,0,0))
    rows.append(item(4,'EXT-OILPAN-21',name,'seal','Menyekat permukaan duduk plug.',SUMP,(-1,0,0),.047,'23414-300000'))
    recipe(api,group,family,'Karter dan drain',rows,SUMP,'Kontur gasket dan letak lubang mengikuti flange model. Katalog memuat opsi sump standar, dangkal dan dudukan elastis. Kecocokan serial, posisi plug tambahan dan hardware belum terverifikasi.',[-.6,.45,-.66])


def build(api):
    flywheel(api)
    bonnets(api)
    sump(api)
