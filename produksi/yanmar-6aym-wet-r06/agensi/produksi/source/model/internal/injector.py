"""TP2 mechanical injector and per-cylinder inspection assembly."""

import hashlib
import json
import math
import re
from pathlib import Path

CATALOG_URL = "https://yanmarshop.com/en-GB/catalog/all/servicebom/yanmardata-1311833/yanmar-marine-marine-main-engine-medium-ay-series-6aym-wet-fig-79-fuel-injection-valve"
MANUAL = "D01 PDF 150–152 / cetak 146–148, Fuel Injector, gambar 016377-00EN01, 014971-00E dan 016375-00EN01"
CATALOG = "D05 katalog 6AYM-WET, Fig. 79 Fuel Injection Valve"
VARIANT = "6AYM-WET H, nozzle TP2 tipe semi-long hole"
NOTE = ("Identitas dan susunan mengikuti D01 dan D05. Ukuran rumah, panjang, detail ulir, orientasi port "
        "dan sambungan ke pipa diperagakan. Nomor subkomponen mengikuti unit WET Fig. 79. Kecocokan nomor seri "
        "dan dimensi selubung aktual belum terverifikasi.")
SCALE = .001

# Exploded destinations are teaching offsets only. All six meshes use the same installed parts stack.
# The cap and lower stack move in opposite directions along the injector axis.
PARTS = [
    (1,"Rumah injektor (nozzle holder)","shell",1,None,0,0,0,
     "Menopang bagian internal dan menyalurkan bahan bakar dari sambungan samping ke nozzle."),
    (2,"Cap nut (tutup setelan)","shell",19,"139684-53450",0,115,0,
     "Melindungi adjuster dan menutup bagian atas rumah setelah penyetelan. Pada r02 ID ini berlabel “Injector union hex”; identifikasinya dikoreksi sesuai D05 Fig. 79 ref. 19. Sambungan pipa tekanan tinggi berada di sisi rumah."),
    (3,"Adjusting bolt","inner",13,"148620-53160",0,53,0,
     "Memberikan preload ke pegas melalui retainer. Preload menentukan tekanan pembukaan jarum."),
    (4,"Locknut adjuster","inner",14,"139684-53170",0,99,0,
     "Mengunci posisi adjusting bolt setelah penyetelan."),
    (5,"Gasket atas 12 × 1 mm","seal",20,"23414-120000",0,108,0,
     "Merapatkan bidang antara cap nut dan locknut."),
    (6,"Gasket bawah 12 × 1 mm","seal",20,"23414-120000",0,87,0,
     "Merapatkan bidang locknut pada sisi atas rumah."),
    (7,"Retainer atas pegas","inner",17,"126616-53300",0,-82,0,
     "Meneruskan gaya adjuster ke ujung atas pegas dan memusatkannya."),
    (8,"Pegas nozzle","inner",11,"126616-53120",0,-118,0,
     "Menahan jarum pada dudukannya dan menutupnya kembali setelah injeksi."),
    (9,"Spring holder bawah","inner",12,"126616-53130",0,-125,0,
     "Mendudukkan pegas dan meneruskan gayanya ke pangkal jarum."),
    (10,"Spacer pembatas langkah jarum","inner",16,"148620-53240",0,-132,0,
     "Memposisikan nozzle terhadap holder dan menyediakan batas angkat jarum."),
    (11,"Dowel penyelaras atas","inner",15,"103200-53210",37,-128,0,
     "Sepasang dowel menjaga posisi dan arah muka spacer terhadap holder."),
    (12,"Dowel penyelaras bawah","inner",15,"103200-53210",37,-144,0,
     "Sepasang dowel menjaga posisi dan arah nozzle serta bore pengaliran terhadap spacer."),
    (13,"Jarum nozzle (nozzle valve)","inner",3,None,13,-171,0,
     "Tekanan bahan bakar mengangkat jarum dari dudukannya. Pegas menutupnya kembali saat tekanan turun."),
    (14,"Nozzle body berongga","shell",3,None,0,-210,0,
     "Memandu jarum, memuat ruang bahan bakar, dan menyemprotkan bahan bakar lewat lubang pada ujung nozzle."),
    (15,"Nozzle nut (retaining nut)","shell",9,"148620-53080",0,-273,0,
     "Mengikat pasangan nozzle dan spacer ke rumah injektor dengan ulir."),
    (16,"O-ring rumah atas 1AP42.0","seal",21,"24311-000420",-43,-13,0,
     "Merapatkan bagian luar holder pada dudukan injector sleeve."),
    (17,"O-ring rumah bawah","seal",18,"152623-53360",-43,-31,0,
     "Merapatkan bagian luar holder pada dudukan bawah di cylinder head."),
]


def sources(ref):
    return [f"{CATALOG} ref {ref}",MANUAL]


def part_id(cyl_no, number):
    if number in (1,2):
        return f"INT-FUELINJ-{cyl_no}{number}"
    return f"INT-FUELINJ-{cyl_no}1-{number:02}"


def build(api, centers, deck):
    bpy, bmesh = api["bpy"],api["bmesh"]
    v, empty, make, lathe, cyl, ring, curve_tube, mat = (api[k] for k in
        ("v","empty","make","lathe","cyl","ring","curve_tube","mat"))
    items, groups, out = api["ITEMS"],api["GROUPS"],api["OUT"]
    steel, steel_light, spring_m, seal = (api[k] for k in ("steel","turned","spring_m","rubber"))
    needle_m = mat("Injector needle and spring seats · display finish",(.53,.31,.12),.36,.66)
    washer_m = mat("Injector gasket · display finish",(.38,.14,.06),.42,.4)
    nozzle_m = mat("Precision nozzle steel · display finish",(.34,.43,.51),.29,.70)
    group="FUELINJ"
    rows=[]
    node=None

    def mm(point):
        return tuple(c*SCALE for c in point)

    def stepped(number,axis,profile,material,center=(0,0,0),n=64,closed=True):
        label = PARTS[number-1][1]
        return lathe(part_id(1,number),label,group,axis,mm(center),
                     [(h*SCALE,r*SCALE) for h,r in profile],material,node,n=n,closed=closed)

    def annulus(number,h,r0,r1,w,material,n=48,axis=1,center=None):
        label=PARTS[number-1][1]
        return ring(part_id(1,number),label,group,axis,mm(center or (0,h,0)),
                    r0*SCALE,r1*SCALE,w*SCALE,material,node,n=n)

    def hex_lathe(number,profile,material):
        label=PARTS[number-1][1]
        n=48
        points=[]
        for h,r,external in profile:
            for i in range(n):
                a=math.tau*i/n
                radius=r*math.cos(math.pi/6)/math.cos((a+math.pi/6)%(math.pi/3)-math.pi/6) if external else r
                points.append(mm((radius*math.cos(a),h,radius*math.sin(a))))
        faces=[]
        for j in range(len(profile)):
            a,b=j*n,(j+1)%len(profile)*n
            faces.extend((a+i,a+(i+1)%n,b+(i+1)%n,b+i) for i in range(n))
        return make(part_id(1,number),label,group,points,faces,material,node,smooth=True)

    def join_pieces(objects):
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:
            ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        return objects[0]

    def cylinder_tool(start,end,r,n=24):
        a,b=v(mm(start)),v(mm(end))
        bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r*SCALE,depth=(b-a).length,
                                           location=(a+b)/2)
        ob=bpy.context.object
        ob.parent=node
        ob.rotation_euler=(b-a).normalized().to_track_quat('Z','Y').to_euler()
        bpy.context.view_layer.update()
        return ob

    def boolean(obj,tool,operation="DIFFERENCE"):
        mod=obj.modifiers.new("Machined passage","BOOLEAN")
        mod.object=tool
        mod.operation=operation
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(tool,do_unlink=True)

    def clean(obj):
        mesh=bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=1e-8)
        bmesh.ops.recalc_face_normals(mesh,faces=list(mesh.faces))
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()

    node=empty("RAK-INJECTOR-1",(centers[0],deck+.002,0),groups[group])
    body=stepped(1,1,[
        (50,8.8),(50,13.6),(51,14.7),(67,14.7),(69,16.3),
        (71,16.3),(71,15.2),(74,15.2),(74,16.3),(92,16.3),
        (94,20.0),(96,22.6),(98,22.6),(98,20.5),(102,20.5),
        (102,22.6),(105,22.6),(107,20.1),(145,20.1),(147,18.4),
        (147,6.2),(132,6.2),(130,8.8),
    ],steel)
    # Side inlet is integrated with the holder. The transverse port communicates with
    # a separate, off-axis drill to the nozzle face, rather than the spring bore.
    boolean(body,cylinder_tool((0,108.4,-15),(0,108.4,-34),6.2,48),"UNION")
    boolean(body,cylinder_tool((0,108.4,-35),(0,108.4,-10),3.2,24))
    boolean(body,cylinder_tool((0,49,-11.7),(0,110,-11.7),1.35,24))
    for dx in (-5.0,5.0):
        boolean(body,cylinder_tool((dx,49,10.1),(dx,55,10.1),1.35,20))
    clean(body)
    hex_lathe(2,[(155.04,6.05,False),(155.04,8.6,True),(156,9.0,True),(202,9.0,True),
                   (204,7.9,True),(204,2.1,False),(198,2.1,False),(195,5.05,False),
                   (171,5.05,False),(169,6.05,False)],steel_light)
    stepped(3,1,[(124.73,3.0),(125.04,3.8),(149,3.8),(150,4.8),(175,4.8),(176,3.9)],needle_m,closed=False)
    hex_lathe(4,[(148.03,5.03,False),(148.03,8.4,True),(153.97,8.4,True),(153.97,5.03,False)],steel)
    annulus(5,154.5,6,8.7,1,washer_m)
    annulus(6,147.5,6,8.7,1,washer_m)
    stepped(7,1,[(119.6,3.0),(120.5,5.8),(124.0,5.8),(124.7,3.55)],needle_m,closed=False)
    coil=[]
    for j in range(201):
        u=j/200
        a=math.tau*8*u
        coil.append(mm((5.77*math.cos(a),61.5+56.9*u,5.77*math.sin(a))))
    curve_tube(part_id(1,8),PARTS[7][1],group,coil,1.14*SCALE,spring_m,node,ns=12)
    stepped(9,1,[(54.13,2.1),(54.4,3.1),(58.5,3.1),(59.3,7.2),(60.34,7.2),(60.34,4.4),(60.89,4.4)],needle_m,closed=False)
    spacer=stepped(10,1,[(44.04,3.2),(44.04,14.15),(44.7,14.8),(49.5,14.8),
                         (49.96,14.3),(49.96,3.2)],steel_light)
    boolean(spacer,cylinder_tool((0,43,-11.7),(0,51,-11.7),1.35,24))
    for y1,y2 in [(43,46),(48,51)]:
        for dx in (-5.0,5.0):
            boolean(spacer,cylinder_tool((dx,y1,10.1),(dx,y2,10.1),1.35,20))
    clean(spacer)
    for number,h in [(11,50.6),(12,43.4)]:
        pins=[]
        for dx in (-5.0,5.0):
            pins.append(cyl(part_id(1,number),PARTS[number-1][1],group,1,mm((dx,h,10.1)),
                            1.25*SCALE,5.0*SCALE,steel_light,node,n=24))
        join_pieces(pins)
        items.pop()
    stepped(13,1,[(1.85,.61),(3.05,1.17),(4.6,1.90),(12.0,1.90),(14.3,2.12),(26.4,2.12),
                 (29.2,4.15),(41.7,4.15),(42.4,2.43),(50.0,2.43),(51.0,1.8),
                 (54.1,1.8)],needle_m,closed=False)
    nozzle=stepped(14,1,[
        (0,.71),(0,1.09),(.72,2.52),(4.0,3.65),(6.2,5.45),
        (21.0,5.45),(23.0,6.40),(23.0,13.3),(24.2,14.55),(43.4,14.55),(44.0,13.7),
        (44.0,4.22),(29.1,4.22),(28.0,6.4),(24.0,5.85),
        (22.0,2.40),(5.1,2.40),(3.0,1.26),(1.8,.72)
    ],nozzle_m)
    boolean(nozzle,cylinder_tool((0,44.5,-11.7),(0,26.75,-5.05),1.2,24))
    for dx in (-5.0,5.0):
        boolean(nozzle,cylinder_tool((dx,40.0,10.1),(dx,44.5,10.1),1.35,20))
    for count,angle,diameter,feed_y,clock in [(8,80,.30,2.72,0),(4,45,.22,1.22,math.pi/8)]:
        a=math.radians(angle)
        for j in range(count):
            phi=clock+math.tau*j/count
            f=(math.sin(a)*math.cos(phi),-math.cos(a),math.sin(a)*math.sin(phi))
            o=(0,feed_y,0)
            # Start within the bore. Stop beyond the cutting outer contour.
            p=tuple(q+6*d for q,d in zip(o,f))
            boolean(nozzle,cylinder_tool(o,p,diameter/2,16))
    clean(nozzle)
    stepped(15,1,[(10,5.65),(10,7.6),(12,9.2),(20.0,9.2),(21.7,10.8),(22.65,15.1),(24.1,16.5),
                 (48.5,16.5),(58.5,16.0),(59.4,15.65),(59.4,14.90),(49.3,14.90),
                 (23,14.67),(22.4,6.55),(20.5,5.65)],steel_light)
    for number,h,r,wire in [(16,100.0,22.35,1.40),(17,72.5,16.55,1.05)]:
        profile=[(h+wire*math.sin(math.tau*j/16),r+wire*math.cos(math.tau*j/16)) for j in range(16)]
        stepped(number,1,profile,seal,n=56)

    for number,label,role,ref,pn,dx,dy,dz,function in PARTS:
        name=part_id(1,number)
        obj=bpy.data.objects[name]
        row=next(it for it in items if it["id"]==name)
        row.update(name=label, source_refs=sources(ref), notes=NOTE, part_number=pn, function=function,
                   injector_cylinder=1, injector_group=node.name, role=role,
                   xray_shell=role=="shell", xray_content=role!="shell")
        obj["source"]=row["source_refs"][0]
        obj["part_label"]=label
        obj["function"]=function
        obj["xray_shell"]=row["xray_shell"]
        obj["xray_content"]=row["xray_content"]
        obj["role"]=role
        obj["injector_cylinder"]=1
        if number in (13,14):
            row["notes"]+=" Jarum dan body merupakan pasangan nozzle 148691-53002 (ref 3); tidak ada nomor terpisah."
        if number==13:
            row["dimensions"]={"needle_lift_mm":{"value":.50,"range":[.49,.51],"status":"DOCUMENTED","source":MANUAL}}
        if number==14:
            row["dimensions"]={"spray_banks":[{"count":8,"diameter_mm":.30,"angle_deg":160},
                                               {"count":4,"diameter_mm":.22,"angle_deg":90}],
                               "opening_pressure_mpa":{"value":31,"range":[30.5,31.5],"status":"DOCUMENTED"},
                               "nozzle_id_mark":"TP2","status":"DOCUMENTED","source":MANUAL}
        if number in (5,6):
            row["dimensions"]={"gasket_nominal_size_mm":[12,1],"status":"DOCUMENTED"}
        rows.append((obj,row))

    def make_recipe(i):
        root=f"RAK-INJECTOR-{i}"
        parts=[]
        for j,label,role,ref,pn,dx,dy,dz,function in PARTS:
            name=part_id(i,j)
            shift=mm((dx,dy,dz))
            norm=math.sqrt(sum(q*q for q in shift))
            parts.append(dict(no=j,nama=label,role=role,object_ids=[name],nomor_oem=pn,
                          fungsi=function,status="OBSERVED",sumber=sources(ref),source_refs=sources(ref),
                          posisi=[dict(object_id=name,arah=[q/norm for q in shift],jarak_m=norm,
                                       urutan=j)] if norm else []))
        recipe=dict(id=root,nama=f"Injektor mekanis TP2 · Silinder {i}",parent_rakitan="RAK-INT-FUELINJ",
                    node_rakitan=root,acuan={"no":1,"object_ids":[part_id(i,1)]},
                    diagram={"arah_pandang":[.19,.27,-.94],"atas":[0,1,0]},
                    cut_axis=[0,1,0],cut_normal=[1,0,0],bagian=parts,source_refs=[MANUAL,CATALOG],
                    status="UNVERIFIED",notes=NOTE,unit_injector_pn="748691-53102",
                    section_asset="injector-section.webp",exploded_asset="injector-exploded.webp",
                    plate_asset="injector-section-exploded.pdf")
        (out.parent/"assemblies"/f"{root}.json").write_text(json.dumps(recipe,indent=2,ensure_ascii=False)+"\n")
    make_recipe(1)
    for i,x in enumerate(centers[1:],2):
        root=empty(f"RAK-INJECTOR-{i}",(x,deck+.002,0),groups[group])
        for j,(template,row) in enumerate(rows,1):
            clone=template.copy()
            clone.name=part_id(i,j)
            clone.parent=root
            clone["injector_cylinder"]=i
            bpy.context.scene.collection.objects.link(clone)
            items.append(dict(row,id=clone.name,node=clone.name,parent=root.name,injector_cylinder=i,injector_group=root.name))
        make_recipe(i)

    evidence=out/"evidence"
    html=(evidence/"D05-fig79.html").read_text()
    records=[]
    for row in re.findall("data-consists-of='([^']+)'",html):
        data=json.loads(row)
        records.append({k:data[k] for k in ["referenceNo","partNo","description","quantity"]})
    manual_hash=hashlib.sha256((out.parent.parent/"doc"/"D01-service.pdf").read_bytes()).hexdigest()
    report=dict(manual_sha256=manual_hash,variant=VARIANT,status="UNVERIFIED",manual_locator=MANUAL,catalog=CATALOG,
                catalog_url=CATALOG_URL,manual_values={"opening_pressure_MPa":[30.5,31.5],
                "needle_lift_mm":[.49,.51],"spray_angle_deg":[160,90],
                "holes":[[8,.30],[4,.22]],"mark":"TP2"},bom=records,
                hashes={name:hashlib.sha256((evidence/name).read_bytes()).hexdigest()
                        for name in ["D05-fig79.html","D05-fig79.svg"]},notes=NOTE)
    (evidence/"injector-source-register.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
