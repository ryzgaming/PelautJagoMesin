"""Complete the wet pump's keyed drive and mount at the registered front cam gear plane."""
import runpy
from math import cos, sin, tan, radians, tau
from mathutils import Vector

def build(api):
    import bpy
    layout=runpy.run_path(str(api['OUT'].parent/'motion'/'freshwater_pump.py'))
    gear=runpy.run_path(str(api['OUT'].parent/'internal'/'gear_train.py'))
    dx,dy,dz=layout['DELTA']
    cx,cy,cz=layout['VOLUTE']
    gx=layout['PITCH_X']
    r=layout['PITCH_RADIUS'];teeth=layout['TEETH']
    assembly='RAK-COOLANT-PUMP'
    pan=api['nested_recipes'][assembly]
    note='Pompa sentrifugal digerakkan langsung oleh gear heliks cam depan. Jumlah 18 gigi, posisi, modul, heliks dan profil adalah parameter rekonstruksi. Rasio 4:3 menghasilkan 2.533 rpm pompa pada 1.900 rpm crank sesuai D01 hlm. 160.'
    refs=['D01 PDF 112 cetak 108, diagram front cam gear–water pump gear',
          'D05 Fig 54, 6AYM-WET cooling fresh water pump',
          'D03 PDF 17 cetak 33, tampak depan dan samping mesin; D01 PDF 14, P17']
    parent='RAK-COOLING'
    axis=(1,0,0)
    steel=api['steel']
    def xyz(x,y=0,z=0):return (x,cy+y,cz+z)
    def new(n,name,shape,part,ref,role,dist):
        ob=api['add']('COOLING',n,name,shape,[*refs,f'D05 Fig 54 ref {ref}'],note,
                      parent=assembly,nested_under=parent,role=role,oem=part,direction=(-1,0,0),
                      origin=xyz(gx) if role=='gear' else None)
        row=next((row for row in pan['bagian'] if ob.name in row['object_ids']),None)
        if row:
            row.update(nama=name,role=role,sumber=refs,nomor_oem=part,fungsi=note)
        else:
            pan['bagian'].append(dict(no=len(pan['bagian'])+1,nama=name,object_ids=[ob.name],role=role,
                status='ESTIMATED',sumber=[*refs,f'D05 Fig 54 ref {ref}'],posisi=[dict(object_id=ob.name,
                arah=[-1,0,0],jarak_m=dist,urutan=len(pan['bagian']))],fungsi=name,nomor_oem=part,ukuran=None))
        return ob
    # Keep every original water passage, fastener and seal in its assembly frame.
    for part in api['parts']:
        if part['parent']!=assembly:continue
        ob=bpy.data.objects[part['id']]
        ob.location+=api['world']((dx,dy,dz))
        part['bounds_m']=[[round(v+d,7) for v,d in zip(row,(dx,dy,dz))] for row in part['bounds_m']]
    bpy.context.view_layer.update()
    # The R04 bearing carrier extended into the pump gear teeth by 2 mm.
    # Shorten its rear lip before the journal; the wet chamber and its ports sit farther forwards.
    housing=bpy.data.objects['EXT-COOLING-03']
    inv=housing.matrix_world.inverted()
    for vert in housing.data.vertices:
        point=housing.matrix_world@vert.co
        if point.x<1.375:
            point.x=1.375-(1.375-point.x)*.40
            vert.co=inv@point
    housing.data.update()
    record=next(p for p in api['parts'] if p['id']==housing.name)
    record['bounds_m'][0][0]=round(1.375-(1.375-record['bounds_m'][0][0])*.40,7)
    record['model_dimensions_m'][0]=round(record['bounds_m'][1][0]-record['bounds_m'][0][0],7)
    for part in ('EXT-COOLING-21','EXT-COOLING-22','EXT-COOLING-23','EXT-COOLING-26'):
        api['remove_part'](part)
    # Captive 7 x 20 key. The model shaft fits both nominal 25-mm bearing inner races
    # and its gear bore. Slots cut both solids; axial retainer bears on the hub washer.
    bore=.01256
    def keytool():return api['box'](xyz(gx,.0121),(.02006,.00704,.00705),steel,.00011)
    def solid_lathe(profile):
        N=48
        rings=[[(x,cy+rad*cos(tau*j/N),cz+rad*sin(tau*j/N)) for j in range(N)] for x,rad in profile]
        return api['polygon_loft'](rings,steel,0)
    shaft=solid_lathe([(gx-.0210,.0090),(gx-.0199,.00990),(gx-.01147,.00990),(gx-.01120,.01246),
              (gx+.0118,.01246),(gx+.0122,.01240),(cx-.127,.01240),(cx-.064,.01240),
              (cx-.060,.01246),(cx+.021,.01246),(cx+.025,.0124),(cx+.030,.0095)])
    api['subtract'](shaft,keytool())
    new(21,'Poros pompa coolant dengan dudukan pasak',shaft,'148660-43140',4,'shaft',.215)
    phase=gear['index_angle'](layout['CAM_YZ'],(cy,cz),layout['spec']['FRONT_CAM_TEETH'],teeth,0.)
    polar=[(rad,phase+tau*i/teeth+angle) for i in range(teeth) for rad,angle in gear['profile'](r,teeth)]
    loops=[]
    for x,outer,rad in [(-.0115,False,bore),(-.0115,False,.019),(-.009,False,.019),
                        (-.009,True,0),(0,True,0),(.009,True,0),(.009,False,.019),(.0115,False,.019),(.0115,False,bore)]:
        twist=x*tan(radians(7))/r if outer else 0
        loops.append([xyz(gx+x,(rr if outer else rad)*cos(a+twist),(rr if outer else rad)*sin(a+twist)) for rr,a in polar])
    wheel=api['polygon_loft'](loops,steel,0,True)
    api['subtract'](wheel,keytool())
    new(26,'Gear heliks pompa coolant · 18 gigi model',wheel,'148633-43700',11,'gear',.395)
    new(310,'Pasak poros pompa coolant 7 × 20',api['box'](xyz(gx,.0121),(.020,.007,.007),steel,.0001),
        '22512-070200',12,'fastener',.43)
    new(311,'Ring datar penahan gear pompa coolant',api['annulus'](xyz(gx-.0125),axis,.0154,.0101,.002,steel),
        '22137-200000',14,'fastener',.455)
    # Circular thread clearance is independent of the six exterior flats.
    def nut_section(offset,rad,hexagon):
        pts=[]
        for j in range(48):
            a=tau*j/48
            f=rad*cos(tau/12)/cos((a% (tau/6))-tau/12) if hexagon else rad
            pts.append(xyz(gx-.0165+offset,f*cos(a),f*sin(a)))
        return pts
    nut=api['polygon_loft']([nut_section(x,rad,hexagon) for x,rad,hexagon in [
        (-.003,.01004,False),(-.003,.0152,True),(-.0024,.0167,True),
        (.0024,.0167,True),(.003,.0152,True),(.003,.01004,False)]],steel,0,True)
    new(312,'Mur M20 pengikat gear pompa coolant',nut,
        '26356-200002',13,'fastener',.480)
    # Fig.54 shows a wide drive case shared with the front housing. Only its evidenced pump
    # mounting land is reconstructed here; the front casting supplies the underlying envelope.
    # The flange straddles a ring gasket; the stepped spigot registers in the housing aperture.
    mount=api['ring'](xyz(1.3968),axis,[(-.012,.0484),(-.012,.0516),(-.0006,.0516),
          (.0002,.080),(.002,.083),(.009,.083),(.011,.079),(.011,.0484)],api['cast'],64)
    gasket=api['annulus'](xyz(1.39645),axis,.079,.0521,.0008,api['rubber'])
    # Put pilot and holes outside the bearing passage and away from the crank gear.
    pump_flange=api['ring'](xyz(1.4084),axis,[(0,.0435),(0,.079),(.0018,.081),(.0074,.081),
        (.0092,.077),(.0092,.049),(.013,.0475),(.013,.0435)],api['cast'],64)
    pump_seal=api['annulus'](xyz(1.40810),axis,.0788,.049,.00060,api['rubber'])
    bolts=[]
    for i in range(5):
        ang=tau*(i+.5)/5
        for body in (mount,pump_flange,pump_seal):
            api['subtract'](body,api['cylinder'](xyz(1.405,.067*cos(ang),.067*sin(ang)),axis,.0053,.039,steel,24,0))
        def center(x):return xyz(x,.067*cos(ang),.067*sin(ang))
        bolts.append([api['cylinder'](center(1.4076),axis,.00495,.020,steel,24,.0003),
                      api['cylinder'](center(1.4210),axis,.00905,.0068,steel,6,.0007)])
    bpy.ops.object.select_all(action='DESELECT')
    pump_flange.select_set(True)
    housing.select_set(True)
    bpy.context.view_layer.objects.active=housing
    bpy.ops.object.join()
    new(319,'Gasket flange pompa ke penggerak',pump_seal,'148660-43201',23,'seal',.55)
    for i,shapes in enumerate(bolts):
        new(320+i,'Baut M10 × 20 dudukan pompa '+str(i+1),shapes,'26106-100202',22,'fastener',.575+i*.035)
    new(313,'Dudukan pompa pada rumah penggerak depan',mount,'148660-42602',24,'casing',.525)
    new(314,'Gasket dudukan rumah penggerak pompa',gasket,'148660-42621',25,'seal',.54)
    for idx,(pn,code,x,outer,w,ball) in enumerate([
            ('24101-063054','6305',cx-.078,.031,.017,.0046),
            ('24101-062054','6205',cx-.116,.026,.015,.0036)]):
        ob,ib,balls=rolling_bearing(api,xyz(x),.0125,outer,w,ball)
        ref=6+idx
        new(22+idx,'Ring luar bantalan '+code+' pompa coolant',ob,pn,ref,'bearing',.160+idx*.11)
        new(315+2*idx,'Ring dalam bantalan '+code+' pompa coolant',ib,None,ref,'inner_race',.180+idx*.12)
        new(316+2*idx,'Bola bantalan '+code+' pompa coolant',balls,None,ref,'rolling_elements',.200+idx*.13)
    pan['source_refs'].extend(refs)
    pan['notes']=note+' D01 menyatakan sambungan langsung. Lokasi OEM lateral, profil gigi dan nomor seri belum terverifikasi.'


def rolling_bearing(api,center,bore,outer,width,ball,count=9):
    """Separate races, relieved raceway and rolling complement on the shaft X axis."""
    import bpy
    from math import sqrt
    pitch=(outer+bore)*.5
    # Two concave meridional raceways conform to an illustrated ball diameter.
    # The slight radial clearance avoids double-filled materials in section.
    groove_radius=ball+.0001
    half=ball*.78
    samples=[-half+2*half*j/12 for j in range(13)]
    low=[(p,pitch-sqrt(groove_radius**2-p*p)) for p in samples]
    high=[(p,pitch+sqrt(groove_radius**2-p*p)) for p in samples]
    base,tip=low[0][1],high[0][1]
    d=width/2
    steel=api['steel']
    inner=api['ring'](center,(1,0,0),[(-d,bore),(-d,base),*low,(d,base),(d,bore)],steel,56)
    outside=api['ring'](center,(1,0,0),[(-d,tip),(-d,outer),(d,outer),(d,tip),*reversed(high)],steel,56)
    balls=[]
    for j in range(count):
        a=tau*j/count
        pt=(center[0],center[1]+pitch*cos(a),center[2]+pitch*sin(a))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=ball,location=api['world'](pt))
        balls.append(api['shade'](bpy.context.object,steel,smooth=True))
    return outside,inner,balls
