"""Alternator and starter, catalogue-option mechanical teaching sections for 6AYM-WET."""
from math import cos, sin, pi

def build(api):
    add = api['add']
    ring, sleeve = api['ring'], api['annulus']
    cyl, box, mesh = api['cylinder'], api['box'], api['mesh']
    steel, iron, graphite = api['steel'], api['cast'], api['rubber']
    copper = api['appearance']('Cuivre des bobinages', (.48,.164,.045), .59,.38)
    insul = api['appearance']('Vernis isolant brun', (.22,.055,.019), .25,.44)
    axis=(1,0,0)
    parent='RAK-ELECTRIC'
    source_base='D05 0CG10-M34300, WET (A) / Fig. '
    import json
    from pathlib import Path
    catalog = api['OUT'].parents[1]/'qa/catalog/figures'

    def setup(number,group,anchor,center,limitation):
        rows={r['referenceNo']:r for r in json.loads((catalog/f'{number}.json').read_text())['positions']}
        ref=source_base+str(number)
        evid=[ref, 'D01 PDF 14 / component locations; P08 guard, P17 starter']
        members=[]
        def at(x,y=0,z=0): return (x,center[0]+y,center[1]+z)
        def rad(x,r,a): return at(x,r*cos(a),r*sin(a))
        def tube(x,outer,inner,length,mat):
            return sleeve(at(x),axis,outer,inner,length,mat)
        def pipe(x,shape,mat,n=48):
            return ring(at(x),axis,shape,mat,n)
        def arc(x0,x1,ri,ro,a,b,mat,steps=8):
            vs=[]
            for j in range(steps+1):
                ang=a+(b-a)*j/steps
                vs.extend([rad(x0,ri,ang),rad(x0,ro,ang),rad(x1,ro,ang),rad(x1,ri,ang)])
            faces=[(0,1,2,3),(4*steps+3,4*steps+2,4*steps+1,4*steps)]
            faces.extend((4*j+i,4*(j+1)+i,4*(j+1)+(i+1)%4,4*j+(i+1)%4) for j in range(steps) for i in range(4))
            return mesh(vs,faces,mat)
        def part(id,label,shapes,item,role,fn,displ,dist):
            if group=='RAK-STARTER':
                # Register the estimated motor stack on the flywheel housing without entering
                # the adjacent crankcase inspection door. Gear and pinion datum x≤.018 is fixed.
                api['bpy'].context.view_layer.update()
                for piece in shapes if isinstance(shapes,list) else [shapes]:
                    matrix=piece.matrix_world.copy()
                    inverse=matrix.inverted()
                    for vertex in piece.data.vertices:
                        xyz=matrix@vertex.co
                        if xyz.x>.018:
                            xyz.x=.018+.60*(xyz.x-.018)
                            vertex.co=inverse@xyz
                    piece.data.update()

            refs=[ref+' pos. '+item] if item else [ref+' (section)']
            key=rows.get(item,{}).get('partNo')
            obj=add('ELECTRIC',id,label,shapes,refs,fn+' '+limitation,status='ESTIMATED',
                xray=role=='shell',parent=group,nested_under=parent,role=role,
                direction=displ,oem=key)
            poses=[] if not dist else [dict(object_id=obj.name,arah=list(displ),jarak_m=dist,urutan=len(members)+1)]
            members.append(dict(no=len(members)+1,nama=label,object_ids=[obj.name],posisi=poses,status='ESTIMATED',role=role,sumber=refs,fungsi=fn,nomor_oem=key,ukuran=None))
        def end(title):
            api['register_recipe'](dict(id=group,nama=title,node_rakitan=group,parent_rakitan=parent,
                status='UNVERIFIED',source_refs=evid,acuan=dict(no=1,object_ids=[anchor]),
                diagram=dict(arah_pandang=[.42,.36,-.83],atas=[0,1,0]),bagian=members,notes=limitation))
        return at,rad,tube,pipe,arc,part,end

    def split_bearing(x,outer,bore,width,outer_id,inner_id,ball_id,ref,dir,displacement,starter=False):
        radius=(outer+bore)*.5
        ball_radius=(outer-bore)*.235
        part(outer_id,'Ring luar bantalan '+str(ref),tube(x,outer,radius+ball_radius-.00004,width,steel),
             ref,'bearing','Duduk tetap pada bracket.',dir,displacement)
        part(inner_id,'Ring dalam bantalan '+str(ref),tube(x,radius-ball_radius+.00004,bore,width,steel),
             ref,'bearing','Mengikuti poros yang bertumpu pada bantalan.',dir,displacement+.012)
        rolling=[]
        for k in range(9):
            api['bpy'].ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=8,radius=ball_radius,
                location=api['world'](rad(x,radius,2*pi*k/9)))
            sphere=api['bpy'].context.object
            if starter:sphere.scale.x=1/.60
            rolling.append(api['shade'](sphere,steel,smooth=True))
        part(ball_id,'Bola bantalan '+str(ref),rolling,ref,'bearing',
             'Pusat-pusat bola mengorbit poros pada pitch model; jumlah, kecepatan cage dan geometri lintasan diestimasi.',dir,displacement+.024)

    p=(1,0,0); m=(-1,0,0); up=(0,1,0)
    group='RAK-ALTERNATOR'
    api['remove_part']('EXT-ELECTRIC-01')
    at,rad,tube,pipe,arc,part,end=setup(109,group,'EXT-ELECTRIC-01',(.275,-.340),
        'Opsi 600 W pada katalog; identitas unit terpasang, lilitan, ukuran dan celah belum terverifikasi. Alternatif 24 V–1 kW dirinci terpisah di Fig.108.')
    frame=[tube(1.370,.090,.083,.090,iron),tube(1.324,.084,.076,.012,iron),tube(1.308,.080,.027,.013,iron)]
    for i in range(14):
        a=2*pi*i/14
        frame.append(arc(1.338,1.412,.089,.094,a-.046,a+.046,iron,2))
    part(1,'Rumah belakang alternator • opsi 600 W',frame,'4','shell','Menopang stator dan dudukan bantalan sisi belakang.',None,0)
    wind=[tube(1.375,.080,.063,.057,steel)]
    for i in range(21):
        a=2*pi*i/21
        wind.extend([arc(1.345,1.405,.055,.064,a-.044,a+.044,steel,3),
                     arc(1.338,1.411,.061,.071,a+.065,a+.165,copper,4)])
        for x in [1.337,1.411]:wind.append(arc(x-.002,x+.002,.061,.070,a-.110,a+.196,copper,5))
    part(20,'Stator dengan inti dan kumparan',wind,'2','core','Kumparan stator menerima fluks rotor dan menghasilkan arus bolak-balik.',p,.174)
    rotor_shaft=cyl(at(1.389),axis,.010,.177,steel)
    def key_seat(body):
        api['subtract'](body,box(at(1.452,.0100),(.0163,.0042,.0038),graphite,0))
    key_seat(rotor_shaft)
    rotor=[rotor_shaft,tube(1.374,.036,.0105,.050,insul)]
    for k in range(6):
        for sign in [-1,1]:
            a=2*pi*k/6+(.52 if sign==1 else 0)
            x0=1.374+sign*.03;x1=1.374-sign*.017
            verts=[rad(x,r,a+da) for x,w in [(x0,.24),(x1,.045)] for r,da in [(.034,-w),(.0515,-w),(.0515,w),(.034,w)]]
            rotor.append(mesh(verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],steel))
    rotor.extend([tube(1.326+x,.015,.0104,.003,copper) for x in [0,.006]])
    part(21,'Rotor kutub cakar, poros dan slip ring',rotor,'23','rotor','Medan magnet berputar di dalam stator; slip ring membawa arus eksitasi.',p,.310)
    split_bearing(1.314,.024,.0101,.011,22,70,71,'24',m,.150)
    split_bearing(1.433,.026,.0101,.010,23,72,73,'28',p,.413)
    part(24,'Bracket depan berventilasi',[tube(1.424,.090,.080,.019,iron),tube(1.430,.030,.026,.016,iron)]+[
        arc(1.422,1.427,.029,.082,i*pi/3-.085,i*pi/3+.085,iron,4) for i in range(6)],'27','cover','Menyangga bantalan depan dan menyediakan bukaan pendinginan.',p,.49)
    sheave=pipe(1.453,[(-.0133,.0101),(-.0133,.058),(-.0074,.058),(-.004,.0487),
                       (-.0033,.0484),(.0033,.0484),(.004,.0487),(.0074,.058),(.014,.058),(.014,.0101)],iron)
    key_seat(sheave)
    part(25,'Pulley dengan alur V dan kipas',[sheave]+[
        arc(1.440,1.4425,.057,.072,i*pi/7,i*pi/7+.080,steel,3) for i in range(14)],'36','drive','Meneruskan gerak belt; sirip belakang mengalirkan udara.',p,.57)
    part(30,'Pasak puli alternator',box(at(1.452,.010),(.016,.0040,.0035),steel,.00025),'34','key',
         'Meneruskan torsi antara alur puli dan poros rotor.',up,.11)
    nut=cyl(at(1.4703),axis,.0145,.0064,steel,6,.00035)
    api['subtract'](nut,cyl(at(1.4703),axis,.01005,.012,graphite,64,0))
    part(31,'Mur penahan puli alternator',nut,'35','nut','Menahan puli pada ujung poros rotor.',p,.65)
    part(26,'Pelat penyearah dan heat sink',[
        arc(1.316,1.323,.035,.070,a,a+.65,steel,10) for a in (1.7,2.43,3.17,3.91)]+[
        cyl(rad(1.324,.052,a),axis,.006,.004,graphite,16,.0004) for a in (2,2.70,3.45,4.20)],'5','rectifier','Pelat menyerap panas dari penyearah keluaran.',m,.22)
    brushes=[]
    for x in (1.326,1.332):
        brush=box(at(x,.0215),(.0028,.016,.007),graphite,.0003)
        api['subtract'](brush,cyl(at(x),axis,.01504,.012,graphite,96,0))
        brushes.append(brush)
    part(27,'Sikat eksitasi',brushes,'21','brush','Kontak geser meneruskan arus ke kedua slip ring.',up,.085)
    part(28,'Dudukan sikat',box(at(1.329,.037),(.021,.017,.014),graphite,.002),'20','holder','Mengarahkan sikat eksitasi menuju slip ring.',up,.125)
    part(29,'Regulator alternator',box(at(1.317,.056),(.014,.032,.030),graphite,.003),'37','regulator','Mengatur arus eksitasi sesuai tegangan keluaran.',m,.29)
    end('Isi alternator · contoh katalog 600 W')

    import runpy
    sd=runpy.run_path(str(api['OUT'].parent/'motion'/'starter.py'))
    gear=sd['gear_mesh']
    y_axis,z_axis=sd['SHAFT_Y'],sd['SHAFT_Z']
    group='RAK-STARTER'
    api['remove_part']('EXT-ELECTRIC-02')
    at,rad,tube,pipe,arc,part,end=setup(106,group,'EXT-ELECTRIC-02',(y_axis,z_axis),
        'Contoh katalog starter earth-float Fig.106. Fig.105 menunjukkan varian earth; identitas dan ukuran komponen unit aktual belum terverifikasi.')
    frame=[tube(.074,.072,.064,.145,iron)]
    for a in (.25,1.82,3.39,4.96):frame.append(arc(.024,.119,.049,.065,a-.28,a+.28,steel,7))
    part(2,'Yoke starter dan sepatu kutub',frame,'2','shell','Menopang medan magnet yang bekerja pada armature.',None,0)
    arm=[cyl(at(.0805),axis,.009,.170,steel),
        gear(api,at(.002),.014,12,.0126,.0088,steel,phase=-.46*2*pi/12),cyl(at(.070),axis,.035,.077,iron),
        cyl(at(.127),axis,.021,.029,insul)]
    for i in range(22):
        a=2*pi*i/22
        arm += [arc(.030,.109,.034,.039,a,a+.194,copper,4),arc(.115,.140,.0205,.024,a,a+.24,copper,4)]
    part(40,'Armature, lilitan dan komutator',arm,'9','rotor','Arus pada lilitan menghasilkan torsi; komutator berhubungan dengan sikat.',p,.275)
    part(41,'Bracket belakang starter',pipe(.158,[(-.012,.062),(-.012,.071),(.008,.069),(.014,.052),(.014,.012),(.006,.012),(.006,.058)],iron),'4','cover','Menutup ujung komutator dan menyangga bantalan belakang.',p,.46)
    split_bearing(.151,.023,.0091,.009,42,74,75,'10',p,.380,starter=True)
    brushes=[arc(.117,.137,.024,.035,i*pi/2-.13,i*pi/2+.13,graphite,4) for i in range(4)]
    part(43,'Set sikat armature',brushes,'6','brush','Menyalurkan arus ke segmen komutator saat motor berputar.',p,.335)
    part(44,'Dudukan sikat starter',tube(.128,.051,.038,.014,iron),'3','holder','Memegang sikat pada ujung komutator.',p,.36)
    part(45,'Ring gear dalam tetap · contoh 36 gigi',
         gear(api,at(.002),.020,36,.0378,.0528,steel,phase=-.46*2*pi/36,internal=True),
         '13','drive','Ring gear tetap pada housing. Gigi ke dalam menjadi lintasan planet.',m,.16)
    carrier=[tube(-.013,.041,.0078,.004,iron)]
    for i in range(3):
        a=2*pi*i/3
        y,z=sd['PLANET_RAD']*cos(a),sd['PLANET_RAD']*sin(a)
        carrier.append(cyl(at(-.0025,y,z),axis,.0038,.025,steel,24,.0004))
        planet=gear(api,at(.002,y,z),.014,12,.0126,.00388,steel)
        part(54+i,f'Gear planet starter {i+1}',planet,'14','gear','Gear bebas pada pin carrier dan berputar relatif sambil mengorbit.',m,.23+.025*i)
    part(46,'Carrier dengan tiga pin planet',carrier,'14','gear','Tiga pin tetap pada carrier, menerima reaksi planet dan meneruskan putaran ke poros keluaran.',m,.22)
    part(47,'Poros penggerak pinion',cyl(at(-.046),axis,.008,.079,steel),'16','shaft','Menghubungkan reduksi planetary ke kopling pinion.',m,.28)
    # Preserve the fork groove and tooth geometry of the proven assembled fit.
    # The outer clutch race transmits starting torque. The inner race, sleeve
    # and pinion can overrun the motor together on engine pick-up.
    clutch=pipe(-.034,[(-.009,.0146),(-.009,.0262),(-.0065,.0262),(-.0065,.0153),
            (.0065,.0153),(.0065,.0262),(.009,.0262),(.009,.025),(.0155,.025),(.0155,.00815),
            (.0105,.00815),(.0105,.0146)],steel)
    pinion=[tube(-.049,.0143,.00815,.020,iron),tube(-.032,.0114,.00815,.024,steel),
            gear(api,at(-.054),.020,sd['PINION_TEETH'],sd['PINION_PITCH'],.00815,steel,sd['PINION_PHASE'])]
    part(48,'Pinion dan cincin dalam kopling searah',pinion,'21','clutch','Gigi berpaut selama starter. Ketika mesin menyala, pinion dapat melampaui penggerak sebelum mundur.',m,.35)
    part(57,'Kopling searah starter · cincin penggerak dan alur garpu',clutch,'21','drive',
         'Subkomponen rakitan Fig.106 pos.21. Meneruskan torsi ke pinion sewaktu pengasutan. Geometri lintasan roller individual belum terukur.',m,.32)
    rollers=[]
    for i in range(6):
        theta=2*pi*i/6
        rollers.append(cyl(rad(-.032,.013,theta),axis,.00155,.016,steel,20,.00012))
    part(58,'Set roller kopling satu arah · ilustrasi',rollers,'21','roller',
         'Enam roller ilustratif pada rakitan penggerak. Saat overrunning, gerak relatif cincin diperagakan; bidang ramp dan spin roller belum diukur.',m,.34)
    nose=pipe(-.030,[(-.041,.031),(-.041,.038),(-.025,.054),(-.006,.065),(.041,.066),
                  (.041,.0531),(.022,.0526),(.020,.0526),(.014,.054),(-.006,.053),(-.028,.037)],iron)
    # The inner window of the starter nose clears the actual rotating flywheel.
    api['subtract'](nose,cyl((-.102,0,0),axis,.3170,.107,steel,128,0))
    uy,uz=sd['U']
    slot=[(y_axis+along*uy-edge*uz,z_axis+along*uz+edge*uy)
          for along,edge in ((.036,-.006),(.082,-.006),(.082,.006),(.036,.006))]
    api['subtract'](nose,api['prism'](slot,'x',-.058,-.023,steel,.001))
    api['clean_boolean'](nose)
    part(49,'Rumah ujung pinion',nose,'25','cover','Melindungi pinion dan menopang ring gear tetap, dengan mulut terbuka pada sisi flywheel.',m,.44)
    sy,sz=sd['SOLENOID']
    part(50,'Rumah sakelar elektromagnet starter',[
        sleeve((.012,sy,sz),axis,.035,.029,.069,steel),cyl((.047,sy,sz),axis,.033,.012,graphite),
        cyl((.056,sy+.015,sz),axis,.006,.014,copper,12,.0004)],'28','shell','Sakelar elektromagnet menarik linkage dan menyambungkan daya starter.',(0,1,0),.18)
    part(51,'Kumparan solenoid',sleeve((.012,sy,sz),axis,.027,.016,.056,copper),None,'winding','Bagian edukasi sakelar Fig.106. Kumparan menggerakkan plunger saat diberi arus.',up,.10)
    part(52,'Plunger solenoid dan batang',[
        cyl((-.012,sy,sz),axis,.014,.055,steel),cyl((-.039,sy,sz),axis,.005,.025,steel)],None,'core','Bagian edukasi sakelar Fig.106. Menggerakkan lever menuju pinion.',m,.14)
    uy,uz=sd['U'];px,py,pz=sd['PIVOT']
    coupler=at(px,sd['FORK_TIP_RADIUS']*uy,sd['FORK_TIP_RADIUS']*uz)
    lever=[api['straight']((px,sy,sz),(px,py,pz),.0032,steel),
           api['straight']((px,py,pz),coupler,.0032,steel)]
    for side in (-1,1):
        off=(px,coupler[1]-.010*uz*side,coupler[2]+.010*uy*side)
        lever.append(api['straight'](coupler,off,.0025,steel))
        # Bearing shoes fill the annular sliding groove and press its forward face during engagement.
        shoe=[(y_axis+radial*uy-edge*uz,z_axis+radial*uz+edge*uy)
              for radial,edge in ((.0158,side*.005-.0015),(.0182,side*.005-.0015),
                                  (.0182,side*.005+.0015),(.0158,side*.005+.0015))]
        lever.append(api['prism'](shoe,'x',px-.0061,px+.0048,steel,.00015))
    part(53,'Lever penggeser pinion',lever,'20','lever','Lengan pada pivot tetap meneruskan tarikan solenoid menjadi gerak aksial pinion.',(0,1,0),.125)
    end('Isi starter · contoh katalog earth-float')
