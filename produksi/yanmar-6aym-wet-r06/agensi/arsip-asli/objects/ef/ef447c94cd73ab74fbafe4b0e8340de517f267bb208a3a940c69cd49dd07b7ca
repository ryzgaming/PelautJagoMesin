"""Service details for 6AYM-WET valve assemblies, cam bearings and crank thrust sets.

Kinematic parents remain motion-specific. Recipe empties host the stationary seating
components, so inspection groups can contain both stationary and moving members.
"""
import json
import math

def build(a):
    pth, items=a['OUT'],a['ITEMS']
    db=a['bpy'].data.objects
    by_id={p['id']:p for p in items}
    def sources(fig,ref,manual):
        return [f'D05-{fig} / Fig. {fig} posisi {ref}, 6AYM-WET',f'D01 PDF {manual}']
    def mark(ob,label,fn,role,fig,ref,pn,manual):
        row=by_id.get(ob.name) or items[-1]
        assert row['id']==ob.name
        row.update(name=label,part_number=pn,source_refs=sources(fig,ref,manual),status='ESTIMATED',
                   notes=fn+' Identitas dan keberadaan berbasis katalog. Bentuk rinci, profil, dan jarak bebas model merupakan estimasi.',
                   function=fn,role=role,xray_shell=role=='shell',xray_content=role=='internal')
        ob['part_label']=label;ob['source']=row['source_refs'][0];ob['role']=role
        ob['evidence_status']='ESTIMATED';ob['xray_shell']=row['xray_shell'];ob['xray_content']=row['xray_content']
        if pn: ob['part_number']=pn
        return row
    def recipe(group,parent,title,tuples):
        parts=[]
        for n,(r,dx,dy,dz) in enumerate(tuples,1):
            l=math.sqrt(dx*dx+dy*dy+dz*dz)
            parts.append(dict(no=n,nama=r['name'],role=r['role'],object_ids=[r['id']],
                nomor_oem=r['part_number'],fungsi=r['function'],status='ESTIMATED',sumber=r['source_refs'],
                posisi=[dict(object_id=r['id'],arah=[dx/l,dy/l,dz/l],jarak_m=l,urutan=n)] if l else []))
        d=dict(id=group,nama=title,content_name=title,parent_rakitan=parent,node_rakitan=group,
             acuan={'no':1,'object_ids':[tuples[0][0]['id']]},bagian=parts,
             diagram={'arah_pandang':[.27,.15,-.95],'atas':[0,1,0]},cut_axis=[0,1,0],cut_normal=[1,0,0],
             source_refs=list(dict.fromkeys(s for r,*_ in tuples for s in r['source_refs'])),status='UNVERIFIED',
             notes='Profil dudukan dan radius diperkirakan untuk visualisasi. Jarak urai adalah ilustrasi hubungan rakitan.')
        (pth.parent/'assemblies'/f'{group}.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
    for c,x in enumerate(a['C'],1):
        for j,z in enumerate((-.034,.034)):
            side='masuk' if j==0 else 'buang'
            lift=db[f'MOT-INT-VALVE-{c}-{j+1}']
            for k,sign in enumerate((-1,1)):
                lx=sign*.035
                q=c*100+20*j+30+7*k
                key=lambda n:f'INT-VALVE-{q+n:03d}'
                group=f'RAK-KATUP-{c}-{j+1}-{k+1}'
                stationary=a['empty'](group,parent=a['GROUPS']['VALVE'])
                motion_spring=db[f'MOT-INT-SPRING-{c}-{j+1}-{k+1}']
                stack=[]
                def push(r,dx=0,dy=0,dz=0):
                    # Group metadata drives the picker. Animated components retain their original motion parent.
                    r['assembly']=group
                    stack.append((r,dx,dy,dz))
                def setpart(ob,label,fn,role,ref,pn=None):
                    return mark(ob,label,fn,role,22,ref,pn,'86–90 / cetak 82–86')
                valve=setpart(db[key(0)],f'Katup {side} {c}.{k+1}','Membuka atau menutup port pada dudukan kepala.','internal','22 / 22-1' if j==0 else '18', None if j==0 else '148620-11110')
                push(valve)
                guide=db[key(2)];guide.parent=stationary
                push(setpart(guide,'Pemandu batang katup','Menjaga gerak batang sejajar dalam kepala silinder.','shell','21, 29'),.03,.03,0)
                seat=db[key(3)];seat.parent=stationary
                push(setpart(seat,'Alas pegas di kepala','Permukaan tumpu pegas pada sisi kepala.','support','24–27 / bentuk tumpuan pada model'),.03,.064,0)
                push(setpart(db[key(4)],'Pegas katup luar','Membantu menutup katup bersama pegas dalam.','internal','24–27'),0,.096,0)
                stemseal=a['lathe'](key(0)+'-SEAL','Seal batang','VALVE',1,(x+lx,.55,z),[(-.002,.00825),(-.002,.00965),(-.0001,.0096),(.0026,.0075),(.0037,.0069),(.0037,.00530),(.0018,.00530),(-.0007,.00825)],a['rubber'],parent=stationary,n=32)
                push(setpart(stemseal,'Seal bibir batang katup','Membatasi aliran oli pada batang di bibir pemandu.','seal','19,20'),-.035,.054,0)
                coil=[(.0091*math.cos(-math.tau*7*u/144),.0044+.0442*u/144,.0091*math.sin(-math.tau*7*u/144)) for u in range(145)]
                spring=a['curve_tube'](key(0)+'-INNER','Pegas katup dalam','VALVE',coil,.0013,a['spring_m'],motion_spring)
                push(setpart(spring,'Pegas katup dalam','Pegas konsentris bekerja bersama pegas luar.','internal','24–27'),-.04,.093,0)
                ret=db[key(1)]
                push(setpart(ret,'Rotator dan dudukan atas','Menahan pegas melalui cotter dan mendukung rotasi bertahap katup. Mekanisme internal rotator belum dirinci oleh katalog.','cover','30','175149-11701'),0,.158,0)
                for half in range(2):
                    cotter=a['lathe'](key(0)+f'-COT{half+1}','Cotter','VALVE',1,(lx,.114,0),[(-.003,.00455),(-.003,.0061),(.003,.0074),(.003,.0051),(.0009,.0051),(.0007,.00455)],a['turned'],lift,n=20,arc=math.pi-.05,begin=math.pi*half+.025)
                    push(setpart(cotter,f'Setengah cotter {half+1}','Mengunci rotator pada takik di batang katup bersama setengah cotter pasangannya.','internal','23','148633-11190'),(.043 if half else -.043),.180,0)
                recipe(group,'RAK-INT-VALVE',f'Katup {side} · silinder {c} · {k+1}',stack)
    # D01 p104 illustrates the two split thrust sets flanking the flywheel-end cap.
    for side,s in enumerate((-1,1),1):
        for half in (0,1):
            ob=a['ring'](f'INT-MAIN-THRUST-{side}-{half+1}','Cincin thrust','MAIN',0,(a['mains'][0]+s*.021,0,0),
                        .06725,.079,.004,a['bronze'],arc=math.pi-.018,begin=-math.pi/2+math.pi*half+.009)
            mark(ob,'Setengah pelat thrust '+('sisi flywheel' if s<0 else 'sisi blok'),'Menahan beban aksial pada sisi cap ujung flywheel. Nomor OEM adalah satu set dua belahan.','internal',1,'10','748620-02590','104–105')
    for n,x in enumerate(a['mains'],1):
        center = x if n<7 else x+.0102
        ob=a['ring'](f'INT-CAM-BUSH-{n}','Bushing camshaft','CAM',0,(center,a['CAM_Y'],a['CAM_Z']),
                     .03120,.0351,.021 if n<7 else .009,a['bronze'],n=48)
        mark(ob,'Bushing journal camshaft '+str(n),'Menumpu journal camshaft pada blok. Katalog memuat dua tipe berjumlah dua dan lima; pemasangan per posisi belum diverifikasi.','internal',1,'24,25',None,'108–109')
