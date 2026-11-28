"""Lifecycle actuation and multi-part subassemblies around r05 mechanical controllers."""
import math

def configure(groups):
    prior={g['id']:g for g in groups}
    def ext(group,*numbers):
        return [f'EXT-{group}-{n:02d}' for n in numbers]
    def derive(parent,key,label,targets,**params):
        source=prior[parent].copy()
        source.update(id=key,label=label,targets=targets,**params)
        groups.append(source)
        return source
    for g in groups:
        gid=g['id']
        act='crank'
        if gid.startswith(('nozzle-','delivery-valve-')):act='injection'
        if gid.startswith('starter-'):
            act='starter_drive'
        if gid=='starter-pinion':act='starter_pinion'
        if gid in ('starter-lever','starter-solenoid'):act='starter_shift'
        if gid=='turbo-rotor':act='turbo'
        if gid=='centrifugal-oil-rotor':act='centrifuge'
        if gid=='seawater-shaft':act='seawater_vanes'
        g['actuation']=act
    governor=prior['governor-flyweights']
    governor['label']='Poros dan pembawa pemberat governor'
    governor['targets']=ext('FUEL',200)
    govref=['D01 PDF116 cetak112, start/idle/stop, fig.016450-00E','D05 Fig.77 posisi 23–42 dan 57.']
    for side in range(2):
        sign=1 if side==0 else -1
        derive('governor-flyweights',f'governor-weight-{side+1}',f'Pemberat governor {side+1}',ext('FUEL',201+side),
               actuation='governor-weight',source_refs=govref,secondary_axis=[0,0,1],
               secondary_pivot_m=[1.020,.200+sign*.020,-.427],pivot_sign=sign,
               note='Pemberat mengorbit poros dan membuka pada pin saat rpm naik. Sudut maksimum model adalah estimasi.')
    def conditional(key,label,nums,kind,act,pivot,axis,**fields):
        return derive('governor-flyweights',key,label,ext('FUEL',*nums),kind=kind,ratio=0,
                      actuation=act,pivot_m=list(pivot),axis=list(axis),source_refs=govref,**fields)
    conditional('governor-shifter','Perpindahan shifter dan dudukan pegas',[203,206],'reciprocate','governor-shifter',(1.039,.200,-.427),(1,0,0))
    conditional('governor-return','Pegas gaya lawan governor',[204],'spring','governor-spring',(1.111,.200,-.427),(1,0,0),length_m=.052)
    conditional('governor-control-lever','Ayunan tuas governor',[205],'rock','governor-link',(1.068,.251,-.427),(0,0,1))
    conditional('fuel-control-rack','Batang rack · start, idle dan stop',[22],'reciprocate','fuel-rack',(.690,.327,-.404),(1,0,0),
                note='D01 PDF116 menyebut maksimum saat start, kembali ke idle, lalu STOP mengalahkan gaya governor. Travel 5 mm diestimasi.')
    for i in range(1,7):
        gid=f'fuel-plunger-{i}'
        g=prior[gid]
        plunger=f'EXT-FUEL-{34+i:02d}'
        g['targets']=[n for n in g['targets'] if n!=plunger]
        xp=.484+.079*(i-1)
        derive(gid,f'metering-plunger-{i}',f'Plunger penakar {i} · angkatan dan sudut',[plunger],
               actuation='fuel-metering',pivot_m=[xp,.327,-.427],secondary_axis=[0,1,0],case_ids=g['case_ids']+ext('FUEL',40+i),
               note='Nok mengangkat plunger melalui tappet. Selongsong mengubah sudut plunger menurut rack untuk mengatur penyaluran.')
        conditional(f'fuel-control-pinion-{i}',f'Pinion pengatur dosis elemen {i}',[329+i],'rock','fuel-metering',
                    (xp,.327,-.427),(0,1,0),note='Pergeseran rack 5 mm dibagi radius pitch model 17,5 mm menentukan rotasi pinion.')
        t=i-1
        x=1.525+(-.030 if t<3 else .030)
        z=-.178+t%3*.101
        for key,nums,kind,py in [('valve',[330+t],'reciprocate',.8406),('spring',[340+t],'spring',.80355)]:
            act='thermostat' if key=='valve' else 'thermostat-spring'
            derive('coolant-shaft',f'thermostat-{key}-{i}',f'{"Katup" if key=="valve" else "Pegas"} termostat {i}',ext('COOLING',*nums),
                   kind=kind,actuation=act,opens_c=71 if t<3 else 76.5,full_open_c=85 if t<3 else 90,
                   pivot_m=[x,py,z],axis=[0,1,0],ratio=0,length_m=.03445,assembly_ids=['RAK-FW-COOLER'],
                   case_ids=ext('COOLING',1,61),source_refs=['D01 PDF168 cetak164, tabel Characteristics of thermostat','D05 Fig.57 posisi 58–59'],
                   note='Bore 33 mm, travel model 8 mm pada pembukaan penuh. Suhu dalam demo dipercepat. Interpolasi lift di antara ambang merupakan estimasi.')
    prior['coolant-shaft']['targets']+=ext('COOLING',380)
    for key,number,kind in [('pressure',382,'reciprocate'),('spring',383,'spring'),('return',384,'reciprocate')]:
        derive('coolant-shaft','cap-'+key,{'pressure':'Katup tekanan tutup coolant','spring':'Pegas katup tekanan coolant','return':'Katup balik reservoir coolant'}[key],
               ext('COOLING',number),kind=kind,actuation='cap-'+key,pivot_m=[1.512,.8995,-.148],
               axis=[0,1,0],ratio=0,length_m=.016,assembly_ids=['RAK-COOLANT-CAP'],case_ids=ext('COOLING',2),
               source_refs=['D01 PDF166–167 pressure cap and reservoir, discharge range 93–123 kPa','D05 Fig.57 ref.8'],
               note='Pada siklus biasa keduanya duduk. Uji beda tekanan tersendiri menggunakan setelan representatif 108 kPa dalam rentang manual. Ambang vakum/travel rekonstruksi.')
    turbo=prior['turbo-rotor']
    derive('turbo-rotor','turbo-floating-bushes','Dua selongsong bantalan mengambang turbo',ext('EXHAUST',22,23),ratio=turbo['ratio']*.5,
           source_refs=['D05 Fig.32 bantalan mengambang','D01 PDF170–171 TD13M','Garrett Motion / Turbocharger bearing systems, fully floating journal bearing'],
           note='Arah searah dan putaran ilustratif setengah rotor menurut contoh bantalan mengambang Garrett. Rasio TD13M nyata bergantung dua film oli dan belum diukur.')
    sea=prior['seawater-shaft']
    sea['targets']+=ext('COOLING',370,372,381)
    sea['note']='Angka 1572 rpm pada crank 1900 rpm dari D01 PDF163–164. Sepuluh sudu melentur di cam casing tetap. Profil cam, jumlah sudu dan deformasi diperkirakan.'
    ball_radius=.025*.42*.70
    derive('seawater-shaft','seawater-bearing-balls','Orbit bola dua bantalan 6308 air laut',ext('COOLING',371,373),
           actuation='crank',ratio=sea['ratio']*.5*(1-ball_radius/.0325),
           note='Pusat bola bergerak terhadap race luar yang diam. Putaran lokal bola tidak divisualkan.')
    rotor=prior['alternator-rotor']
    rotor['targets']+=ext('ELECTRIC',70,72)
    for n,(r,b) in enumerate(((.024,.0101),(.026,.0101))):
        ratio=rotor['ratio']*.5*(1-(r-b)*.235/((r+b)*.5))
        derive('alternator-rotor',f'alternator-bearing-{n+1}',f'Orbit bola bantalan alternator {n+1}',ext('ELECTRIC',71+2*n),ratio=ratio,
               note='Orbit dihitung dari radius model dengan race luar tetap.')
    arm=prior['starter-armature']
    arm['targets']+=ext('ELECTRIC',74)
    ratio=arm['ratio']*.5*(1-(.023-.0091)*.235/((.023+.0091)*.5))
    derive('starter-armature','starter-bearing-balls','Orbit bola bantalan armature',ext('ELECTRIC',75),ratio=ratio,
           note='Ring dalam mengikuti armature. Orbit bola diperkirakan dari radius model.')
    derive('starter-pinion','starter-clutch-driver','Cincin penggerak dan roller kopling searah',ext('ELECTRIC',57,58),
           actuation='starter_drive',note='Cincin penggerak mengikuti motor starter. Pinion dapat overrun ketika flywheel lebih cepat; bentuk ramp dalam dan spin roller tidak diukur.')
