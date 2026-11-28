"""Check actual mesh visibility foundations, convex/concave occupancy and nested group geometry."""
import collections, hashlib, json, math, sys
from pathlib import Path
from itertools import combinations
import bpy
from mathutils import Vector, bvhtree

root, output = map(Path,sys.argv[sys.argv.index('--')+1:])
root=root.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
assets={}
for domain in ('exterior','internal'):
    asset=root/'model'/domain/f'{domain}.glb'
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    new=set(scene.objects)-before
    assets[domain]={'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),
                   'meshes':sum(o.type=='MESH' for o in new)}
bpy.context.view_layer.update()
objects={o.name:o for o in scene.objects}
geometry={}
def mesh(id):
    if id not in geometry:
        ob=objects[id]
        ob.data.calc_loop_triangles()
        points=[ob.matrix_world@v.co for v in ob.data.vertices]
        tris=[tuple(t.vertices) for t in ob.data.loop_triangles if t.area>1e-14]
        geometry[id]=(points,tris,bvhtree.BVHTree.FromPolygons(points,tris,all_triangles=True),
                      sum(t.area<=1e-14 for t in ob.data.loop_triangles))
    return geometry[id]
def m(std):
    return [std.x,std.z,-std.y]
def limits(points):
    p=list(map(m,points))
    return [[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]
def ancestors(child):
    result=[]
    while child.parent:
        child=child.parent
        result.append(child.name)
    return result
def nearest(p,tree):
    return tree.find_nearest(p)[3]
groups={}
expected_parents={}
for domain in ('exterior','internal'):
    inventory=json.loads((root/'model'/domain/'inventory.json').read_text())
    expected_parents.update({x['id']:x.get('parent') for x in inventory['components']})
def valid_parent(id,nested,recipe):
    ob=objects[id]
    parentage=ancestors(ob)
    if nested in parentage:return True
    expected=expected_parents.get(id)
    return (nested.startswith('RAK-KATUP-') and expected is not None and bool(parentage) and
            parentage[0]==expected and recipe.get('parent_rakitan') in parentage)
for path in sorted((root/'model/assemblies').glob('*.json')):
    recipe=json.loads(path.read_text())
    if not recipe.get('node_rakitan'): continue
    nested=recipe['node_rakitan']
    all_meshes=[(row.get('role'),id,row) for row in recipe.get('bagian',[]) for id in row.get('object_ids',[])]
    groups[nested]={'declared_count':len(all_meshes),'missing':[id for _,id,_ in all_meshes if id not in objects],
                    'without_mesh':[id for _,id,_ in all_meshes if id in objects and objects[id].type!='MESH'],
                    'parent_mismatch':[id for _,id,_ in all_meshes if id in objects and not valid_parent(id,nested,recipe)],
                    'parts':{},'tested_shell_core':[]}
    result=groups[nested]
    for role,id,row in all_meshes:
        if id not in objects or objects[id].type!='MESH':continue
        p,t,_,d=mesh(id)
        result['parts'][id]={'role':role,'triangles':len(t),'tiny_face_count_1e-14m2':d,'bounds_m':limits(p),
                             'ancestors':ancestors(objects[id]),'position_sources':row.get('sumber') or row.get('source_refs'),
                             'function':row.get('fungsi'),'catalog_num':row.get('nomor_oem'),'status':row.get('status')}
    for sid,s in result['parts'].items():
        if s['role']!='shell': continue
        sp,st,tree,_=mesh(sid)
        for cid,c in result['parts'].items():
            if c['role']!='core' and not (nested=='RAK-INJECTION' and c['role']=='inner'):continue
            cp,ct,core,_=mesh(cid)
            clearances=[nearest(p,tree) for p in cp]
            hits=tree.overlap(core)
            intersecting_points=[cp[vertex] for tri in {b for a,b in hits} for vertex in ct[tri]]
            result['tested_shell_core'].append({'shell':sid,'core':cid,'mesh_triangle_crossing_pairs':len(hits),
                  'intersecting_core_triangle_bounds_m':limits(intersecting_points) if hits else None,
                  'closest_core_vertex_to_shell_mm': 1000*min(x for x in clearances if x is not None)})
    if nested.startswith('RAK-INJECTOR-'):
        solids=[id for id,p in result['parts'].items()]
        result['installed_crossings_nonzero']=[{'a':a,'b':b,'triangle_pairs':n} for a,b in combinations(solids,2)
            if (n:=len(mesh(a)[2].overlap(mesh(b)[2])))]
        pivot=objects.get(nested)
        result['origin_m']=m(pivot.matrix_world.translation) if pivot else None
        nozzle_id=next((id for id in solids if id.endswith('-14')),None)
        if nozzle_id:
            ob=objects[nozzle_id]
            bb=limits(mesh(nozzle_id)[0])
            x=0.5*(bb[0][0]+bb[1][0])
            z=0.5*(bb[0][2]+bb[1][2])
            y=bb[0][1]
            nozz=mesh(nozzle_id)[2]
            banks=[]
            for n,angle,diam,feed,clock in [(8,80,.30,2.72,0),(4,45,.22,1.22,math.pi/8)]:
                theta=math.radians(angle)
                tests=[]
                for j in range(n):
                    phi=clock+math.tau*j/n
                    d=Vector((math.sin(theta)*math.cos(phi),-math.sin(theta)*math.sin(phi),-math.cos(theta)))
                    u=d.cross(Vector((0,0,1))).normalized()
                    v=d.cross(u).normalized()
                    o=Vector((x,-z,y+feed*.001))
                    r=diam*.0005
                    center=nozz.ray_cast(o,d,.006)[0] is None
                    inner=[nozz.ray_cast(o+r*.55*vector,d,.006)[0] is None for vector in (u,-u,v,-v)]
                    outer=[nozz.ray_cast(o+r*1.35*vector,d,.006)[0] is not None for vector in (u,-u,v,-v)]
                    tests.append({'clock_deg':math.degrees(phi),'center_clear':center,'offset_inner_clear':inner,'offset_outer_hits':outer})
                banks.append({'documented_nominal_diameter_mm':diam,'simulated_cone_angle_deg':angle*2,'samples':tests})
            result['nozzle_probe']=banks
    if nested=='RAK-AIRCOOLER' and any(x['role']=='core' for x in result['parts'].values()):
        shell_id=next(i for i,x in result['parts'].items() if x['role']=='shell')
        core_id=next(i for i,x in result['parts'].items() if x['role']=='core')
        bounds=limits(mesh(core_id)[0])
        x,y,z=[(a+b)/2 for a,b in zip(*bounds)]
        targets=[(i,j) for i in range(-4,5) for j in range(-4,5) if i*i+j*j<=16]
        mask=[]
        for i,j in targets:
            start=Vector((x+i*.017,-(bounds[0][2]-.035),y+j*.017))
            direction=Vector((0,-1,0))
            ray_distance=(bounds[1][2]-bounds[0][2]+.070)
            shell=mesh(shell_id)[2].ray_cast(start,direction,ray_distance)[0]
            core=mesh(core_id)[2].ray_cast(start,direction,ray_distance)[0]
            mask.append({'grid_ij':[i,j],'body_surface':shell is not None,'core_surface':core is not None})
        result['through_axial_ray_steps_17mm']=mask

output.write_text(json.dumps({'method':'Independent Blender mesh reimport. BVH triangle surface overlap zero epsilon. Nearest core vertex/surface distances are mesh proxies. No guarantee about containment, contact fit, or a continuous service trajectory. Optional axial rays sample the air cooler body without its detached caps, along the reported datum with model geometry in installed rest.', 'assets':assets,'nested_assemblies':groups},ensure_ascii=False,indent=2)+'\n')
