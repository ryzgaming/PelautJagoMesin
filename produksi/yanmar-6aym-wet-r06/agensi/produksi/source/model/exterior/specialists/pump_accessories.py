"""Sectional governor and double-acting feed pump, Yanmar 6AYM series."""
from math import pi, cos, sin

GOV = ['D01 PDF 116 / cetak 112, Construction of the governor, fig.016450-00E',
       'D05 0CG10-M34300 fig.77 GOVERNOR, kolom A (WET)']
FEED = ['D01 PDF 145 / cetak 141, fig.016382-00E, 016383-00E dan 016384-00E',
        'D05 0CG10-M34300 fig.75 FUEL FEED PUMP, kolom A (WET)']
LIMIT = ('Dimensi, bentuk kecil, peletakan dan posisi gerak merupakan perkiraan edukasi. '
         'Posisi terpasang mengikuti foto bodi. Rasio tuas, jalur bor, tekanan dan setelan belum terverifikasi.')


def hollow_governor(api, objects):
    cut, cylinder = api['subtract'], api['cylinder']
    # Counterbore the flyweight swept envelope at the true governor axis. The
    # larger original cavity is eccentric to this shaft and alone hugs one weight at speed.
    cut(objects[0],cylinder((1.024,.200,-.427),api['X'],.0384,.032,api['cast'],64,0))
    # Chambers overlap across end faces, preserving the painted outer walls.
    for obj in [objects[0],objects[1],objects[2]]:
        for x,span,r in [(1.048,.127,.089),(1.094,.048,.064),(1.128,.031,.061)]:
            cut(obj,cylinder((x,.236,-.384),api['X'],r,span,api['steel'],48,0))
        cut(obj,cylinder((.988,.200,-.427),api['X'],.010,.114,api['steel'],32,0))


def hollow_feed(api, objects):
    cut,cylinder,box=api['subtract'],api['cylinder'],api['box']
    # Relieve only the corner beside the drive coupling, leaving the feed roller chamber.
    cut(objects[0],cylinder((.424,.200,-.427),api['X'],.0163,.044,api['steel'],48,0))
    cut(objects[0],cylinder((.471,.200,-.427),api['X'],.033,.100,api['steel'],64,0))
    # Shift the pressure end cap on its mounting face to the eccentric's follower station.
    for part in objects[1:3]:
        part.location+=api['world']((-.016,-.002,0))
    cut(objects[0],box((.471,.189,-.451),(.060,.055,.062),api['cast'],.003))
    cut(objects[0],box((.484,.246,-.427),(.044,.084,.047),api['cast'],.003))
    # In the service section the manual primer sits ABOVE the feed valve. Lift
    # its complete barrel, rod and return stack to a separate axial chamber.
    for obj in objects[3:5]:
        obj.location+=api['world']((.002,.063,.003))
    api['bpy'].context.view_layer.update()
    # Drill the transverse feed-piston envelope after moving the primer barrel.
    # A pre-translation cut would travel with the barrel and close this crossing.
    for obj in (objects[0],objects[1],objects[3],objects[4]):
        cut(obj,cylinder((.464,.200,-.470),api['Z'],.01345,.074,api['cast'],48,0))
    # Drilled primer barrel has a separate spring, knob, rod/piston and seal.
    cut(objects[3],cylinder((.441,.237,-.484),api['Y'],.014,.065,api['cast'],32,0))
    cut(objects[4],cylinder((.441,.280,-.484),api['Y'],.010,.029,api['cast'],32,0))
    for x in (.441,.498):
        for z in (-.466,-.484):
            for body in (objects[0],objects[1],objects[3]):
                cut(body,cylinder((x,.201,z),api['Y'],.0070,.032,api['cast'],32,0))
            # A stepped cartridge land registers the pressed seat and supports the
            # valve spring at its far end. The bores open into a shared fuel space.
            objects.append(api['ring']((x,.198,z),api['Y'],[
                (-.009,.00275),(-.009,.00830),(.015,.00830),(.015,.0060),
                (.01420,.0060),(.01420,.0029),(.01356,.0029),(.01356,.00460),
                (-.00045,.00460),(-.00045,.00672),(-.00355,.00672),(-.00355,.00275)],api['cast'],40))
            if x>.48 and z>-.48:
                # A shallow scallop on the cast outside of the nearest cartridge
                # clears the first cam nose. Its valve guide and fuel bore stay intact.
                cut(objects[-1],cylinder((.484,.200,-.427),api['X'],.0330,.028,api['cast'],64,0))

def clear_access_cover(api,plates):
    # The feed pump occupies the left part of the original one-piece cam cover.
    # Leave a relieved split line instead of a second solid wall across its valve cartridges.
    outline=[(.407,.132),(.459,.130),(.526,.146),(.537,.218),(.507,.240),(.431,.238)]
    api['subtract'](plates[0],api['prism'](outline,'z',-.506,-.457,api['cast'],.001))
    for obj,dx,dy in [(plates[1],.058,-.005),(plates[2],.041,-.012)]:
        obj.location+=api['world']((dx,dy,0))



def build(api):
    cylinder, annulus, box, prism, straight, mesh = (
        api[k] for k in ('cylinder','annulus','box','prism','straight','mesh'))
    steel,dark,black,rubber= (api[k] for k in ('steel','boltmat','black','rubber'))
    bronze=api['appearance']('Bagian pemandu mekanis · warna edukasi',(.34,.22,.084),.6,.36)
    X,Y,Z=api['X'],api['Y'],api['Z']

    def coil(p,axis,length,r,wire,turns):
        a,b,c=api['vec_basis'](axis); center=api['Vector'](p)
        segments,sides=turns*18,8; verts=[]; faces=[]
        for j in range(segments+1):
            u=j/segments; ang=u*2*pi*turns
            radial=cos(ang)*b+sin(ang)*c
            for k in range(sides):
                theta=k*2*pi/sides
                verts.append(center+(length*(u-.5)+wire*sin(theta))*a
                            +(r+wire*cos(theta))*radial)
        faces.extend([tuple(reversed(range(sides))),tuple(range(segments*sides,(segments+1)*sides))])
        faces.extend((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k)
                     for j in range(segments) for k in range(sides))
        return mesh(verts,faces,dark,0,True)

    def assembly(key,anchor,label,sources):
        api['reparent_part'](anchor,key,'RAK-FUEL',role='shell',xray=True)
        shell=next(p for p in api['parts'] if p['id']==anchor)
        shell['source_refs']=list(dict.fromkeys(shell['source_refs']+sources))
        shell['sumber']=shell['source_refs']
        rows=[{'no':1,'nama':shell['nama'],'object_ids':[anchor],'posisi':[],'role':'shell',
               'status':'ESTIMATED','sumber':sources,'fungsi':'Rumah dan sambungan luar.'}]
        def part(suffix,label,shapes,direction,distance,function):
            obj=api['add']('FUEL',suffix,label,shapes,sources,function+' '+LIMIT,
                    direction=direction,parent=key,nested_under='RAK-FUEL',role='inner')
            api['parts'][-1]['xray_content']=True
            n=len(rows)+1
            rows.append({'no':n,'nama':label,'object_ids':[obj.name],'role':'inner',
                    'posisi':[{'object_id':obj.name,'arah':list(direction),'jarak_m':distance,'urutan':n}],
                    'status':'ESTIMATED','sumber':sources,'fungsi':function})
        api['register_recipe']({'id':key,'parent_rakitan':'RAK-FUEL','node_rakitan':key,
                'nama':label,'acuan':{'no':1,'object_ids':[anchor]},'bagian':rows,
                'diagram':{'arah_pandang':[.45,.34,-.83],'atas':[0,1,0]},
                'source_refs':sources,'notes':LIMIT,'status':'ESTIMATED'})
        return part

    governor=assembly('RAK-GOVERNOR','EXT-FUEL-02','Governor mekanis pompa YPE-1615',GOV)
    y,z=.200,-.427
    governor(200,'Poros governor dan dudukan pemberat',[
        cylinder((1.018,y,z),X,.006,.166,steel,32,.0007),
        cylinder((1.015,y,z),X,.025,.008,dark,32,.0009),
        cylinder((1.010,y,z),X,.013,.012,steel,32,.0008)],(-1,0,0),.08,
        'Dudukan meneruskan putaran ke pemberat sentrifugal.')
    for i,sign in enumerate((1,-1)):
        # Two opposed pivoting weights with mass at the outer edge and a nose near the shifter.
        profile=[(1.015,y+sign*.018),(1.016,y+sign*.033),(1.023,y+sign*.036),
                 (1.034,y+sign*.033),(1.033,y+sign*.025),(1.026,y+sign*.022),
                 (1.034,y+sign*.011),(1.030,y+sign*.008)]
        governor(201+i,f'Pemberat sentrifugal governor {i+1}',[
            prism(profile,'z',z-.009,z+.009,dark,.0012),
            cylinder((1.020,y+sign*.020,z),Z,.003,.024,steel,24,.0005)],
            (0,sign,0),.07,'Pemberat berayun melalui pin dan menekan shifter.')
    governor(203,'Selongsong shifter dan bantalan dorong',[
        annulus((1.039,y,z),X,.014,.0063,.010,bronze),
        annulus((1.049,y,z),X,.009,.0063,.012,steel),
        annulus((1.034,y,z),X,.017,.0064,.003,steel)],(1,0,0),.09,
        'Selongsong menerima gaya aksial pemberat dan meneruskannya ke tuas.')
    governor(204,'Pegas pengatur governor',coil((1.085,y,z),X,.052,.010,.0016,9),
        (1,0,0),.16,'Pegas memberi gaya lawan gerak aksial pemberat.')
    governor(206,'Dudukan bergerak pegas dan shifter',annulus((1.057,y,z),X,.013,.0064,.003,bronze),
        (1,0,0),.17,'Penahan bergerak dengan shifter.')
    governor(207,'Dudukan ujung tetap pegas pengatur',annulus((1.113,y,z),X,.014,.0065,.004,steel),
        (1,0,0),.19,'Penahan ini tetap pada setelan pengujian idle.')
    governor(205,'Tuas governor, link dan poros pivot',[
        prism([(1.042,.220),(1.049,.219),(1.072,.252),(1.066,.272),
               (1.057,.272),(1.064,.252)],'z',z-.003,z+.003,steel,.0007),
        straight((1.060,.269,z),(1.027,.269,z),.0033,dark),
        cylinder((1.068,.251,z),Z,.0035,.023,bronze,24,.0004),
        cylinder((1.027,.269,z),Z,.0035,.016,steel,24,.0004)],
        (0,0,-1),.065,'Link menghubungkan gerak shifter ke pengendali rack secara skematis.')

    feed=assembly('RAK-FEEDPUMP','EXT-FUEL-12','Pompa feed kerja ganda dan pompa priming',FEED)
    fx,fy=.464,.200
    feed(210,'Piston pompa feed kerja ganda',[
        cylinder((fx,fy,-.474),Z,.012,.011,steel,32,.0006),
        annulus((fx,fy,-.473),Z,.0124,.011,.0018,rubber)],(0,0,-1),.060,
        'Piston memindahkan solar di kedua sisi ruang pompa.')
    feed(211,'Spindle dan pin roller feed',[
        cylinder((fx,fy,-.4481),X,.0018,.0108,steel,20,.0002),
        cylinder((fx,fy,-.4597),Z,.003,.023,steel,24,.0003)],(0,0,1),.055,
        'Spindle bergeser mengikuti roller di sisi luar eksentrik.')
    feed(238,'Roller feed pada eksentrik',annulus((fx,fy,-.4481),X,.005,.00188,.009,dark),
        (1,0,0),.045,'Roller menyentuh sisi luar eksentrik dan berputar pada pin.')
    feed(219,'Dua seal tetap spindle',[annulus((fx,fy,s),Z,.005,.0031,.0015,rubber)
        for s in (-.460,-.464)],(0,0,1),.072,'Seal terpasang pada rumah dan memisahkan ruang cam.')
    feed(212,'Pegas balik piston feed',coil((fx,fy,-.490),Z,.021,.008,.0011,6),
         (0,0,-1),.095,'Pegas mengembalikan piston feed.')
    feed(239,'Dudukan pegas balik feed',annulus((fx,fy,-.502),Z,.011,.004,.0016,steel),
         (0,0,-1),.085,'Muka diam di bagian dalam tutup penutup sisi piston.')
    for i,(x,s) in enumerate(((.441,-.466),(.441,-.484),(.498,-.466),(.498,-.484))):
        # The double-action circuit uses four poppet/check valves. Their installed
        # port identities are intentionally not assigned from this visual placement.
        feed(213+i,f'Poppet katup satu arah feed {i+1}',[
            cylinder((x,.1993,s),Y,.0042,.0036,steel,24,.0003),
            cylinder((x,.204,s),Y,.0016,.008,steel,20,.0002)],
            (0,1,0),.040+i*.013,'Poppet mengarahkan aliran selama dua langkah.')
        feed(230+i,f'Dudukan tetap katup feed {i+1}',annulus((x,.196,s),Y,.0066,.0027,.003,bronze),
            (0,-1,0),.051+i*.011,'Dudukan tetap menutup port saat poppet menempel.')
        feed(234+i,f'Pegas katup feed {i+1}',coil((x,.206,s),Y,.010,.0031,.00055,4),
            (0,1,0),.070+i*.013,'Pegas membawa poppet kembali ke dudukan.')
    feed(217,'Piston tangan priming dan packing',[
        cylinder((.441,.230,-.484),Y,.011,.008,steel,32,.0006),
        annulus((.441,.231,-.484),Y,.0121,.010,.003,rubber),
        cylinder((.441,.253,-.484),Y,.0028,.040,steel,24,.0004)],(0,1,0),.085,
        'Gerak tangan memindahkan piston untuk priming.')
    feed(218,'Pegas priming dan penahan',[
        coil((.441,.250,-.484),Y,.027,.007,.001,6),
        annulus((.441,.265,-.484),Y,.009,.0031,.002,bronze)],(0,1,0),.108,
        'Pegas mendorong mekanisme priming kembali.')
