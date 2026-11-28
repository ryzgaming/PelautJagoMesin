"""D05 Fig. 36, the three rigid air ducts and two demountable expansion joints."""
import bisect
import math
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

FIG="D05 Fig. 36 AIR DUCT, AIR HEATER, ref. 1–7 / 6AYM-WET"
REF="D01 PDF 14, 163, 170–171 / air cooler, turbocharger"
IDS={1:'148660-18111',2:'148660-18151',3:'126684-18900',4:'126684-18911',5:'26106-100402',6:'26366-100002',7:'148660-18122'}

def build(api,route):
    points=[Vector(p) for p in route['points']]
    distances=[0.]
    for a,b in zip(points,points[1:]):distances.append(distances[-1]+(b-a).length)
    length=distances[-1]
    def point(s):
        s=max(0,min(length,s))
        i=min(len(points)-2,max(0,bisect.bisect_right(distances,s)-1))
        return points[i].lerp(points[i+1],(s-distances[i])/(distances[i+1]-distances[i]))
    def frame(s):
        p=point(s)
        axis=(point(s+.001)-point(s-.001)).normalized()
        # The whole duct stays well clear of this reference-axis singularity.
        u=Vector((0,1,0))
        u=(u-axis*u.dot(axis)).normalized()
        return p,axis,u,axis.cross(u)
    def interpolate_tube(lo,hi,profile,mat,extras=()):
        samples=sorted(set([lo,hi,*[v for v in distances if lo<v<hi],*[s for s in extras if lo<s<hi]]))
        outside=[];inside=[]
        for s in samples:
            p,ax,u,v=frame(s)
            od,id_=profile(s)
            rays=[u*math.cos(math.tau*j/40)+v*math.sin(math.tau*j/40) for j in range(40)]
            outside.append([p+od*dir for dir in rays])
            inside.append([p+id_*dir for dir in rays])
        return api['polygon_loft'](outside+inside[::-1],mat,0,True)
    def mounting_face(s,offset,width,inner,mat):
        # Single watertight flange with four actual clearance holes in both planes.
        p,axis,u,v=frame(s)
        p+=axis*offset
        extent=.057
        chamfer=.010
        polygon=[(-extent+chamfer,-extent),(extent-chamfer,-extent),(extent,-extent+chamfer),
                 (extent,extent-chamfer),(extent-chamfer,extent),(-extent+chamfer,extent),
                 (-extent,extent-chamfer),(-extent,-extent+chamfer)]
        holes=[(0.,0.,inner,40)]+[(i*.040,j*.040,.00566,20) for i in (-1,1) for j in (-1,1)]
        loops=[polygon]+[[(x+r*math.cos(math.tau*j/n),y+r*math.sin(math.tau*j/n)) for j in range(n)]
                         for x,y,r,n in holes]
        xy=[]; indices=[]
        for row in loops:
            indices.append(list(range(len(xy),len(xy)+len(row))))
            xy+=list(map(Vector,row))
        coords,_,faces,_,_,owners=delaunay_2d_cdt(xy,[],indices,0,1e-8)
        top=[tuple(f) for f,labels in zip(faces,owners) if labels==[0]]
        n=len(coords)
        vertices=[p+side*axis*width*.5+x*u+y*v for side in (-1,1) for x,y in coords]
        result=[tuple(reversed(face)) for face in top]+[tuple(k+n for k in face) for face in top]
        edges={}
        for face in top:
            for a,b in zip(face,face[1:]+face[:1]):
                key=tuple(sorted((a,b)))
                edges[key]=edges.get(key,0)+1
        result += [(a,b,b+n,a+n) for (a,b),k in edges.items() if k==1]
        return api['mesh'](vertices,result,mat,smooth=False)
    rows=[]
    owner='RAK-CHARGEDUCT'
    summary='Tiga duct terhubung berurutan melalui dua expansion joint. Empat bidang gasket dan lubang baut terbuka dimodelkan. Jarak antarmuka, orientasi, dimensi bore dan bentuk lipatan diestimasi dari ilustrasi.'
    def put(num,name,pieces,ref,role,move,stage,note=None):
        direction=Vector(move)
        distance=direction.length
        if distance:direction.normalize()
        info=[f'{FIG} / posisi {ref}',REF]
        obj=api['add']('INTAKE',num,name,pieces,info,note or summary,status='ESTIMATED',
            parent=owner,nested_under='RAK-INTAKE',role=role,oem=IDS[ref],direction=list(direction))
        label=obj.name
        rows.append(dict(no=len(rows)+1,nama=name,object_ids=[label],role=role,status='ESTIMATED',
                         nomor_oem=IDS[ref],ukuran=None,source_ref_pos=ref,source_refs=info,sumber=info,
                         fungsi=note or summary,posisi=[dict(object_id=label,arah=list(direction),
                         jarak_m=distance,urutan=stage)] if distance else []))
    joints=[(.339-.038,.339+.038),(.515-.038,.515+.038)]
    gasket=.002
    rigid_flange=.011
    soft_flange=.011
    zero=(0.,0.,0.)
    cast=api['cast']; steel=api['steel']; rubber=api['rubber']
    seals=api['appearance']('Gasket duct · lembar komposit',(.16,.122,.084),.10,.70)
    lo1,hi1=joints[0];lo2,hi2=joints[1]
    segment_data=[(5,1,0,lo1-gasket/2,[(lo1,-1)],zero),
                  (50,2,hi1+gasket/2,lo2-gasket/2,[(hi1,1),(lo2,-1)],(-.36,.04,-.04)),
                  (51,7,hi2+gasket/2,length,[(hi2,1)],(-.82,.08,-.08))]
    for n,ref,a,b,faces,offset in segment_data:
        pieces=[interpolate_tube(a,b,lambda s:(.041,.0332),cast)]
        for s,sign in faces:
            pieces.append(mounting_face(s,sign*(gasket/2+rigid_flange/2),rigid_flange,.0407,cast))
        if n in (5,51):
            at=a+.016 if n==5 else b-.014
            p,ax,_,_=frame(at)
            pieces.append(api['annulus'](p,ax,.047,.0407,.011,steel))
        put(n,('Duct pangkal kompresor' if n==5 else 'Duct tengah dua flensa' if n==50 else 'Duct siku masuk air cooler'),
            pieces,ref,'pipe',offset,1+ref)
    for i,(a,b) in enumerate(joints):
        lo=a+gasket/2;hi=b-gasket/2
        left=lo+soft_flange;right=hi-soft_flange
        extra=[left+j*(right-left)/36 for j in range(37)]
        def bellows(s):
            t=max(0,min(1,(s-left)/(right-left)))
            od=.041+.006*(.5-.5*math.cos(4*math.tau*t))
            return od,od-.0048
        joint=[interpolate_tube(lo,hi,bellows,rubber,extra),
               mounting_face(a,gasket/2+soft_flange/2,soft_flange,.0407,steel),
               mounting_face(b,-gasket/2-soft_flange/2,soft_flange,.0407,steel)]
        offset=Vector((-.17-.43*i,.025+.03*i,-.035))
        put(52+i,f'Expansion joint udara {i+1}',joint,3,'coupling',offset,4+i,
            'Sambungan fleksibel berongga dengan dua flensa dan lipatan elastis. Profil dan bahan visual diestimasi.')
        for j,s in enumerate((a,b)):
            gasket_ix=54+2*i+j
            p,axis,u,v=frame(s)
            sign=1 if j==0 else -1
            # Four M10 fasteners span each gasketed interface. Under-head length 40 mm.
            put(gasket_ix,f'Gasket joint {i+1} sisi {j+1}',mounting_face(s,0,gasket,.0334,seals),
                4,'seal',offset+axis*(j-.5)*.09,5+2*i+j,'Merapatkan kedua muka flensa, dengan satu bore aliran dan empat clearance bolt.')
            for k,(du,dv) in enumerate(((-1,-1),(-1,1),(1,1),(1,-1))):
                h=p+.040*(du*u+dv*v)
                along=axis*sign
                seat=h-along*(gasket/2+rigid_flange)
                od=.005
                shank=api['cylinder'](seat+along*.020,along,od,.040,steel,20,.0005)
                head=api['cylinder'](seat-along*.0032,along,.00935,.0064,api['boltmat'],6,.0006)
                idx=i*8+j*4+k
                radial=(du*u+dv*v).normalized()
                explode=offset+axis*(j-.5)*.11+radial*.061
                put(58+idx,f'Baut M10 × 40 joint {i+1}.{j+1}.{k+1}',[head,shank],5,'fastener',
                    explode-along*.074,2,'Mengikat dua flensa dan satu gasket. Panjang nominal baut 40 mm menurut katalog.')
                nut_center=h+along*(gasket/2+soft_flange+.0040)
                nut_rings=[]
                for t,r,hexagonal in [(-.004,.00505,False),(-.004,.00835,True),(-.0035,.00925,True),
                        (.0035,.00925,True),(.004,.00835,True),(.004,.00505,False)]:
                    loop=[]
                    for vtx in range(36):
                        phi=math.tau*vtx/36
                        rr=r*math.cos(math.pi/6)/math.cos((phi%(math.pi/3))-math.pi/6) if hexagonal else r
                        loop.append(nut_center+along*t+(u*math.cos(phi)+v*math.sin(phi))*rr)
                    nut_rings.append(loop)
                nut=api['polygon_loft'](nut_rings,api['boltmat'],0,True)
                put(74+idx,f'Mur M10 joint {i+1}.{j+1}.{k+1}',nut,6,'fastener',
                    explode+along*.074,1,'Mur M10 duduk pada muka luar flensa joint. Profil ulir tidak disimulasikan.')
    api['register_recipe'](dict(id=owner,nama='Duct udara pengisian dan expansion joint · Fig. 36',
        node_rakitan=owner,parent_rakitan='RAK-INTAKE',status='ESTIMATED',
        source_refs=[FIG,REF],acuan=dict(no=1,object_ids=['EXT-INTAKE-05']),
        diagram=dict(arah_pandang=[.38,.43,.82],atas=[0,1,0]),bagian=rows,notes=summary))
