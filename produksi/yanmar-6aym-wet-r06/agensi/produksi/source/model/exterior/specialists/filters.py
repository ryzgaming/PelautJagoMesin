"""Private educational WET H model, fuel filters and two different lubrication filters."""
from math import cos, sin, pi

Y=(0,1,0)
FUEL=['D01 PDF 155 printed p151 / Fuel filter, Fig. 000259; paper element and replacement',
      'D05 Parts Catalog 0CG10-M34300 / Fig.83 FUEL STRAINER(DUPLEX), WET; positions 21–33',
      'P07, P08, P14 / paired housings next to injection pump']
OIL=['D01 PDF 159 printed p155 / Lubricating oil filter; cartridge replacement',
     'D05 Parts Catalog 0CG10-M34300 / Figs.45/46 WET, cartridge position 3, alternative 3-1',
     'P17 / external pair of hanging oil filters']
CENT=['D01 PDF 160 printed p156 / centrifugal bypass strainer exploded Fig.016205-01E',
      'D05 Parts Catalog 0CG10-M34300 / Fig.47 LUB.OIL BY-PASS STRAINER',
      'P17 / bypass unit on non-operation side']

class Scope:
    def __init__(self,api,group,anchor,key,label,sources,notes):
        self.api=api
        self.group,self.anchor,self.key=group,anchor,key
        self.label,self.sources,self.notes=label,sources,notes
        self.rows=[]
        api['remove_part'](f'EXT-{group}-{anchor:02d}')

    def add(self,no,label,shape,role,description,lift=0,pn=None,status='ESTIMATED',axis=Y):
        obj=self.api['add'](self.group,no,label,shape,self.sources,description,status=status,
                            xray=role=='shell',direction=axis if lift else None,parent=self.key,
                            nested_under='RAK-'+self.group,role=role,oem=pn)
        self.rows.append({'no':len(self.rows)+1,'nama':label,'object_ids':[obj.name],
                          'posisi':[{'object_id':obj.name,'arah':list(axis),'jarak_m':lift,
                                     'urutan':len(self.rows)}] if lift else [],
                          'sumber':self.sources,'fungsi':description,'status':status,
                          'role':role,'nomor_oem':pn,'ukuran':None})

    def finish(self):
        self.api['register_recipe']({'id':self.key,'nama':self.label,'node_rakitan':self.key,
            'parent_rakitan':'RAK-'+self.group,'acuan':{'no':1,'object_ids':self.rows[0]['object_ids']},
            'diagram':{'arah_pandang':[.55,.22,-.82],'atas':[0,1,0]},'bagian':self.rows,
            'notes':self.notes,'source_refs':self.sources,'status':'UNVERIFIED'})


def paper(api,x,y,z,radius,height,mat,folds):
    """A real folded solid ring, with two end caps that leave the central outlet open."""
    sections=[]
    for yy,offset in ((y-height/2,0),(y+height/2,0),(y+height/2,-.001),(y-height/2,-.001)):
        section=[]
        for i in range(folds*2):
            a=i*pi/folds
            r=radius*(.61 if i%2 else 1)+offset
            section.append((x+r*cos(a),yy,z+r*sin(a)))
        sections.append(section)
    media=api['polygon_loft'](sections,mat,0,True)
    return [media,*[api['annulus']((x,yy,z),Y,radius+.0008,radius*.53,.003,api['steel'])
                    for yy in (y-height/2-.0016,y+height/2+.0016)]]


def spring(api,x,z,y0,y1,mean,wire):
    points=[]
    for i in range(61):
        a=8*pi*i/60
        points.append((x+mean*cos(a),y0+(y1-y0)*i/60,z+mean*sin(a)))
    return api['sweep'](points,wire,api['boltmat'],8)


def cup(api,x,y,z,r,h,mat):
    stem=h*.5
    return api['ring']((x,y,z),Y,[(-stem,.005),(-stem,r*.65),(-stem+.006,r*.86),
             (-stem+.022,r),(stem-.013,r),(stem-.010,r*1.018),(stem,r*1.018),
             (stem,r*.938),(stem-.010,r*.938),(-stem+.024,r*.931),
             (-stem+.011,r*.73),(-stem+.008,.005)],mat,56)


def fuel(api,mat):
    for i,(x,y,z,r,h) in enumerate(api['filter_centers'],1):
        top=y+h/2
        bottom=y-h/2
        anchor=9+i
        suffix=100+(i-1)*10
        key=f'RAK-FUEL-FILTER-{i}'
        scope=Scope(api,'FUEL',anchor,key,f'Filter bahan bakar {i}',FUEL,
                    'Fig.83 sistem duplex. Elemen kertas merupakan komponen pengganti. Jumlah lipatan, profil, warna dan rute lubang ditafsirkan dari gambar. Kepala dan selector berada pada rakitan induk.')
        scope.add(anchor,f'Rumah canister bahan bakar {i}',cup(api,x,y,z,r,h,api['cover']),'shell',
                  'Rumah menampung bahan bakar di sisi luar media filter.')
        scope.add(suffix,'Elemen kertas dan tutup ujung',paper(api,x,y+.010,z,r*.77,h*.71,mat,48),'core',
                  'Bahan bakar melewati media kertas ke saluran tengah. Bentuk lipatan menggambarkan prinsip dan tidak menentukan jumlah lipatan OEM.',.34,'41650-501140')
        scope.add(suffix+1,'O-ring di mulut rumah',api['annulus']((x,top+.001,z),Y,r*.97,r*.91,.004,api['rubber']),'seal',
                  'Menyekat sambungan rumah ke kepala. Posisi 25 pada gambar 83.',.52,'41650-501170')
        scope.add(suffix+2,'O-ring baut pusat',api['annulus']((x,bottom+.009,z),Y,.0105,.0075,.003,api['rubber']),'seal',
                  'Memisahkan jalur di sambungan baut pusat. Posisi 24. Posisi aksial diperkirakan.',.091,'41650-501160')
        scope.add(suffix+3,'Baut panjang pusat rumah',[api['cylinder']((x,y-.003,z),Y,.0068,h-.010,api['steel'],24,.0005),
                  api['bolt']((x,bottom-.005,z),(0,-1,0),.014,api['steel'])],'fastener',
                  'Menahan rumah terhadap kepala filter. Posisi 27.',.36,'41650-501150',axis=(0,-1,0))
        scope.add(suffix+4,'Ring dan pegas penahan elemen',[
                  api['annulus']((x,bottom+.044,z),Y,r*.57,r*.31,.004,api['steel']),
                  spring(api,x,z,bottom+.012,bottom+.041,r*.29,.0017)],
                  'retainer','Menahan elemen terhadap dudukannya. Pegas dan ring ditampilkan bersama. Geometri pegas bersifat ilustratif.',.20,'X2772311701')
        scope.add(suffix+5,'Sumbat kuras dan washer',[
                  api['cylinder']((x,bottom+.035,z-r+.004),(0,0,1),.014,.018,api['steel'],24,.001),
                  api['bolt']((x,bottom+.035,z-r-.005),(0,0,-1),.013,api['steel'])],'drain',
                  'Sumbat mengakses saluran kuras di bagian bawah. Posisi 32/33. Identitas sumbat pada unit foto belum terkonfirmasi.',.08,axis=(0,0,-1))
        scope.finish()


def fullflow(api,mat):
    for i,x in enumerate((.852,1.012),1):
        y,z,r,h=.116,.442,.056,.277
        base=20+4*(i-1)
        key=f'RAK-OIL-FILTER-{i}'
        scope=Scope(api,'LUBE',1+i,key,f'Cartridge oli utama {i}',OIL,
          'Fig.45/46 memberikan cartridge pengganti sebagai satu unit servis. Penampang edukasi menunjukkan media dan penyangga, bukan BOM bagian lepas. Detail bahan, lipatan atau lubang pabrik tidak tersedia.')
        scope.add(i+1,f'Cangkang cartridge oli {i}',cup(api,x,y,z,r,h,api['cover']),'shell',
                  'Rumah cartridge mengelilingi media oli. PN 148633-35400 dan 148620-35400 adalah alternatif untuk cartridge utuh; cangkang tidak memiliki PN terpisah.')
        scope.add(base,'Media lipat cartridge · ilustrasi',paper(api,x,y,z,r*.83,h*.78,mat,40),'core',
                  'Media menahan partikel saat oli melewatinya. Lipatan dan bahan model merupakan ilustrasi, elemen tidak tercantum sebagai suku cadang terpisah.',.29,status='ILLUSTRATIVE')
        scope.add(base+1,'Penyangga tengah · ilustrasi',[api['annulus']((x,yy,z),Y,r*.431,r*.35,.004,api['steel']) for yy in (y-.100,y-.049,y,y+.049,y+.100)]+[
            api['cylinder']((x+r*.39*cos(t*pi/4),y,z+r*.39*sin(t*pi/4)),Y,.0017,.204,api['steel'],12,.0002)
            for t in range(8)],'support','Model penyangga menunjukkan arah aliran menuju inti. Pola bukaan dan bentuk tidak terverifikasi.',.50,status='ILLUSTRATIVE')
        scope.add(base+2,'Pelat sambungan dan seal cartridge',[
             api['annulus']((x,y+h/2-.004,z),Y,r*.930,.018,.009,api['steel']),
             api['annulus']((x,y+h/2+.002,z),Y,r*.87,r*.77,.004,api['rubber'])],
             'seal','Pelat pemasangan dan ring dudukan divisualkan sebagai satu kelompok dari tampak cartridge terlepas D01.',.68,status='ILLUSTRATIVE')
        scope.finish()


def centrifuge(api):
    x,z=.644,.423
    r,ann,cy=api['ring'],api['annulus'],api['cylinder']
    steel,cast,cover=api['steel'],api['cast'],api['cover']
    scope=Scope(api,'LUBE',4,'RAK-BYPASS-ROTOR','Filter sentrifugal bypass',CENT,
      'D01 PDF 160 menggambarkan konstruksi rotor dan jet pada spindle. Fig.47 menyajikan beberapa seal dan pengikat di bawah nomor strainer utuh. Profil, kelonggaran dan sudut nozzle merupakan perkiraan; nomor seri belum teridentifikasi.')
    scope.add(4,'Tutup luar strainer sentrifugal',r((x,.102,z),Y,[(-.063,.054),(-.063,.062),
        (.040,.061),(.055,.056),(.069,.043),(.078,.026),(.078,.007),(.073,.007),(.070,.024),
        (.064,.041),(.050,.052),(.038,.055),(-.059,.055)],cover,64),
        'shell','Pelindung luar menutup rotor berputar di atas mangkuk dasar. Potongan memperlihatkan ruang rotor.')
    scope.add(30,'Bak dasar dan dudukan spindle',[r((x,.028,z),Y,[(-.019,.007),(-.019,.027),(-.012,.051),
        (-.003,.061),(.016,.062),(.016,.055),(.001,.052),(-.009,.028),(-.009,.007)],cast,56),
        ann((x,-.012,z),Y,.035,.008,.065,cast)],'body','Bak dasar menerima oli buangan dari nozzle rotor.',.22,axis=(0,-1,0))
    scope.add(31,'Spindle berundak',r((x,.085,z),Y,[(-.075,.002),(-.075,.005),(-.065,.011),(-.054,.011),
        (-.052,.006),(.044,.006),(.047,.004),(.084,.004),(.084,.002)],steel,36),
        'shaft','Spindle menjadi poros diam yang membimbing rotor. Posisi 7 pada Fig.47.',.42,'135410-35940')
    scope.add(32,'Badan rotor dan dua jet tangensial',[
        r((x,.089,z),Y,[(-.043,.008),(-.043,.027),(-.033,.042),(-.020,.048),(.018,.048),
          (.018,.043),(-.016,.043),(-.031,.035),(-.033,.008)],steel,60),
        ann((x,.083,z),Y,.011,.0064,.067,cast),
        *[ann((x+s*.026,.045,z+s*.013),(0,0,s),.005,.0022,.012,steel) for s in (-1,1)]
        ],'core','Rotor menampung endapan. Jet tangensial membuat rotor berputar oleh aliran oli; jumlah dua mengikuti diagram servis.',.15)
    scope.add(33,'Tutup rotor',r((x,.117,z),Y,[(-.009,.044),(-.009,.049),(-.002,.049),(.012,.043),
        (.022,.023),(.025,.009),(.019,.009),(.017,.022),(.007,.040),(-.003,.043)],cover,56),
        'cover','Tutup ini menutup rotor, terpisah dari kap luar.',.30)
    scope.add(34,'Insulator dan pegas internal',[ann((x,.107,z),Y,.025,.007,.004,steel),
        spring(api,x,z,.111,.131,.0148,.0017)],'spring','Insulator dan pegas berada antara badan dan tutup rotor sesuai penampang urai servis.',.22)
    scope.add(35,'O-ring rotor',ann((x,.103,z),Y,.0474,.044,.003,api['rubber']),
        'seal','Ring ini ikut berputar dengan rotor. Dimensi dudukan diperkirakan.',.265)
    scope.add(38,'Packing kap luar tetap',ann((x,.0405,z),Y,.058,.055,.0028,api['rubber']),
        'seal','Packing duduk pada sambungan kap luar dengan bak tetap.',.275)
    scope.add(36,'Mur pengunci rotor dan washer',[api['bolt']((x,.144,z),Y,.011,steel),
        ann((x,.139,z),Y,.013,.0042,.0025,steel)],'fastener','Mengunci tutup rotor terhadap dudukan poros.',.345)
    scope.add(37,'Cap nut dan thrust collar',[api['bolt']((x,.183,z),Y,.012,steel),
        ann((x,.178,z),Y,.014,.0045,.003,steel)],'fastener','Menahan kap luar pada sumbu spindle.',.48)
    scope.finish()


def build(api):
    mat=api['appearance']('Media filter · warna ilustratif',(.56,.37,.17),.06,.69)
    fuel(api,mat)
    fullflow(api,mat)
    centrifuge(api)
