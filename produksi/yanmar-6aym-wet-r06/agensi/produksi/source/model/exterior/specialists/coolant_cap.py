"""Filler neck and representative operating internals for the D01 pressure/vacuum cap."""
from math import pi,cos,sin

def build(a):
    refs=['D01 PDF166–167 cetak 162–163, pressure cap and coolant reservoir','D05 Fig.57 ref.8 FILLER ASSY','P08 / penutup bagian atas']
    key='RAK-COOLANT-CAP'
    rack='RAK-COOLING'
    rows=[]
    yaxis=a['Y'];cast=a['cast'];steel=a['steel'];rubber=a['rubber']
    cx,cz=1.512,-.148
    def add(n,label,shape,role,shift,note):
        obj=a['add']('COOLING',n,label,shape,refs,note,parent=key,nested_under=rack,role=role,xray=role=='shell',direction=(0,1,0))
        rows.append(dict(no=len(rows)+1,nama=label,object_ids=[obj.name],role=role,
            posisi=[dict(object_id=obj.name,arah=[0,1,0],jarak_m=shift,urutan=len(rows)+1)] if shift else [],
            fungsi=note,sumber=refs,status='ESTIMATED'))
    base=a['box']((1.471,.864,-.142),(.152,.034,.118),cast,.010)
    a['subtract'](base,a['cylinder']((cx,.866,cz),yaxis,.016,.066,cast,48,0))
    cap=[base,a['annulus']((cx,.891,cz),yaxis,.031,.024,.026,cast),
         a['annulus']((cx,.8803,cz),yaxis,.0242,.0158,.0016,steel),
         a['cylinder']((cx,.905,cz),yaxis,.034,.010,steel,12,.002)]
    add(2,'Leher, dudukan dan tutup tetap pengisian coolant',cap,'shell',0,
        'Badan menahan katup tekanan dan katup balik reservoir. Pembukaan utama pada rentang 93–123 kPa menurut D01.')
    add(382,'Piringan katup tekanan dan seal dudukan',[
        a['annulus']((cx,.8821,cz),yaxis,.0182,.0047,.0019,steel),
        a['annulus']((cx,.8813,cz),yaxis,.0178,.0065,.0005,rubber)
    ],'valve',.09,'Terangkat melawan pegas ketika beda tekanan mencapai setelan. Travel contoh 3 mm.')
    spring=[(cx+.0105*cos(i*pi/8),.8835+.016*i/64,cz+.0105*sin(i*pi/8)) for i in range(65)]
    add(383,'Pegas katup pengaman tekanan',a['sweep'](spring,.0008,steel,8),'spring',.12,
        'Menahan piringan agar tertutup sampai tekanan membuka katup.')
    add(384,'Katup kecil pengembali reservoir',[
        a['cylinder']((cx,.8807,cz),yaxis,.0066,.0011,steel,28,.00015),
        a['cylinder']((cx,.885,cz),yaxis,.002,.0092,steel,20,.00012)
    ],'valve',.145,'Buka ke arah tangki saat tekanan turun di bawah atmosfer, sehingga coolant dapat kembali.')
    a['register_recipe'](dict(id=key,node_rakitan=key,parent_rakitan=rack,nama='Tutup tekanan coolant dan katup balik',
        acuan=dict(no=1,object_ids=['EXT-COOLING-02']),bagian=rows,diagram=dict(arah_pandang=[.25,.20,.95],atas=[0,1,0]),
        source_refs=refs,status='ESTIMATED',notes='Fungsi dan rentang tekanan dari manual. Profil internal dan angkatan piringan adalah estimasi.'))
