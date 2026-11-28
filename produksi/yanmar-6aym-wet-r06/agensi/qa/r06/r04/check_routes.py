"""Independent checks of GLB-backed routes and claimed display paths."""
import hashlib
import itertools
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_line_line
from mathutils.kdtree import KDTree

root, output = map(Path,sys.argv[sys.argv.index('--')+1:])
root=root.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
assets={}
for stem in ('exterior','internal'):
    glb=root/'model'/stem/f'{stem}.glb'
    bpy.ops.import_scene.gltf(filepath=str(glb))
    assets[stem]=hashlib.sha256(glb.read_bytes()).hexdigest()
bpy.context.view_layer.update()
objects={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
cache={}
def bounds(points):
    return tuple((min(p[i] for p in points),max(p[i] for p in points)) for i in range(3))
def nearby(a,b,epsilon=0):
    return all(u0-epsilon<=v1 and v0<=u1+epsilon for (u0,u1),(v0,v1) in zip(a,b))
def g(id):
    if id not in cache:
        obj=objects[id]
        obj.data.calc_loop_triangles()
        points=[obj.matrix_world@v.co for v in obj.data.vertices]
        triangle_indices=[tuple(t.vertices) for t in obj.data.loop_triangles if t.area>1e-14]
        cache[id]=(points, BVHTree.FromPolygons(points,triangle_indices,all_triangles=True))
    return cache[id]
def v(xyz):
    return Vector((xyz[0],-xyz[2],xyz[1]))
def xyz(v):
    return [v.x,v.z,-v.y]
def nearest(points,tree):
    return min(tree.find_nearest(p)[3] for p in points)
def sensible(seq):
    return [p for p in list(itertools.chain.from_iterable(seq)) if isinstance(p,(int,float)) and math.isfinite(p)]
def sampleline(pts,step=.010):
    out=[]
    for ia,(a,b) in enumerate(zip(pts,pts[1:])):
        l=(b-a).length
        if l<1e-6:continue
        n=min(400,max(1,math.ceil(l/step)))
        for j in range(n):
            out.append((a.lerp(b,(j+.5)/n),(b-a).normalized(),ia))
    return out

flowfile=root/'model/flow/routes.json'
manifest=json.loads(flowfile.read_text())
if isinstance(manifest.get('ports'),dict):
    ports=manifest['ports']
else:
    ports={p['id']:p for p in manifest['ports']}
routes=manifest['routes']
checks={}
all_samples={}
for route in routes:
    identity=route['id']
    comps=route.get('component_ids',[])
    valid=[id for id in comps if id in objects]
    missing=[id for id in comps if id not in objects]
    pts=[v(p) for p in route.get('points',[]) if isinstance(p,list) and len(p)==3 and len(sensible([p]))==3]
    if len(pts)<2:
        checks[identity]={'error':'Route has fewer than 2 usable points'}
        continue
    samples=sampleline(pts)
    shell_hits=[]
    number8=number4=number0=0
    source=ports.get(route.get('from'))
    goal=ports.get(route.get('to'))
    radius=route.get('radius_m') or 0
    physical=route.get('kind')=='physical'
    terminal_interfaces=[]
    for side,port in [('from',source),('to',goal)]:
        if not physical or not port or port.get('boundary'):continue
        id=port.get('component_id')
        if id not in objects:continue
        hit_point=pts[0] if side=='from' else pts[-1]
        others=[r.get('component_id') for r in (source,goal) if r]
        tube=route.get('mesh')
        if tube not in valid:
            tube=next((x for x in valid if x not in others),valid[0] if valid else None)
        if not tube:continue
        pp,tt=g(id)
        gap_terminal=tt.find_nearest(hit_point)[3]
        if tube==id:
            terminal_interfaces.append({'endpoint':side,'part':id,'type':'same mesh as route','center_distance_mm':gap_terminal*1000})
            continue
        vp,vt=g(tube)
        range_local=max(radius*3,.060)
        samples_mesh=[p for p in vp if (p-hit_point).length<range_local]
        samples_target=[p for p in pp if (p-hit_point).length<range_local]
        distances=[nearest(s,t) for s,t in ((samples_mesh,tt),(samples_target,vt)) if s]
        terminal_interfaces.append({'endpoint':side,'part':id,'tube':tube,'type':'different model mesh','center_distance_mm':gap_terminal*1000,
              'closest_local_vertex_to_opposite_surface_mm':min(distances)*1000 if distances else None,
              'global_intersecting_surface_pairs':len(tt.overlap(vt))})
    if physical and valid:
        trees={id:g(id)[1] for id in valid}
        minimum=math.inf
        for p,d,seg in samples:
            plane=d.cross(Vector((0,0,1)))
            if plane.length<.01: plane=d.cross(Vector((0,1,0)))
            plane.normalize()
            up=d.cross(plane)
            walls=0
            for j in range(8):
                a=math.tau*j/8
                s=plane*math.cos(a)+up*math.sin(a)
                distances=[t.ray_cast(p,s,max(radius*3.5,.009))[3] for t in trees.values()]
                if any(x is not None for x in distances):walls+=1
            number8+=walls==8
            number4+=walls>=4
            number0+=walls==0
            nearest_wall=min(tree.find_nearest(p)[3] for tree in trees.values())
            minimum=min(minimum,nearest_wall)
            if nearest_wall<.00020:
                shell_hits.append({'segment':seg,'center_xyz_m':xyz(p),'nearest_mm':nearest_wall*1e3})
    else:
        minimum=None
    checks[identity]={'system':route.get('system'),'kind':route.get('kind'),'direction_status':route.get('direction_status'),
          'geometry_status':route.get('geometry_status'),'source_refs':route.get('source_refs'),
          'from':route.get('from'),'to':route.get('to'),'condition':route.get('condition'),
          'missing_render_meshes':missing, 'sample_count':len(samples),'length_m':sum((b-a).length for a,b in zip(pts,pts[1:])),
          'terminal_interfaces':terminal_interfaces,
          'zero_segments':[i for i,(a,b) in enumerate(zip(pts,pts[1:])) if (b-a).length<1e-6],
          'from_delta_mm':1000*(pts[0]-v(source['point'])).length if source else None,
          'to_delta_mm':1000*(pts[-1]-v(goal['point'])).length if goal else None,
          'physical_body_probe':{'against':valid,'grid_m':.010,'all8_near_walls':number8,'at_least4':number4,'none_near':number0,
                                 'min_center_vertex_to_mesh_mm':minimum*1e3 if minimum is not None and math.isfinite(minimum) else None,
                                 'near_wall_below_point2_mm':shell_hits[:60],
                                 'near_wall_total':len(shell_hits)} if physical else None}
    if physical and samples:
        all_samples[identity]=(route,samples)

# Cross-media tracks near each other: conservative screening only, labelled for manual treatment.
cross=[]
for (a,(ra,sa)),(b,(rb,sb)) in itertools.combinations(all_samples.items(),2):
    if ra['system']==rb['system']:continue
    if {ra['system'],rb['system']}=={'intake','exhaust'} and ra.get('cylinder')==rb.get('cylinder') and ra.get('cylinder'):
        continue
    ka=KDTree(len(sa))
    for i,vv in enumerate(sa):ka.insert(vv[0],i)
    ka.balance()
    min_dist=math.inf
    pair=None
    for j,(p,d,k) in enumerate(sb):
        where,i,dist=ka.find(p)
        if dist<min_dist:
            min_dist=dist
            pair=[xyz(where),xyz(p)]
    limit=(ra.get('radius_m') or 0)+(rb.get('radius_m') or 0)
    if min_dist<limit+.005:
        cross.append({'routes':[a,b],'systems':[ra['system'],rb['system']],
            'closest_samples_mm':min_dist*1000,'radii_sum_mm':limit*1000,'xyz_m':pair})
feed=[]
specs=json.loads((root/'model/internal/kinematics.json').read_text()).get('valve_train',[])
motion={}
for spec in specs:
    for field,key in [('valve_root','valve'),('tappet_root','tappet'),('rocker_root','rocker')]:
        motion[spec.get(field)]=(key,spec)
    for id in spec.get('springs',[]):motion[id]=('spring',spec)
def dynamic_contacts(id,points,target,target_id,old_bounds):
    obj=objects[id]
    ancestor=obj.parent
    while ancestor and ancestor.name not in motion:ancestor=ancestor.parent
    if not ancestor:return []
    key,spec=motion[ancestor.name]
    if not nearby(old_bounds,bounds(points),.025):return []
    obj.data.calc_loop_triangles()
    faces=[tuple(f.vertices) for f in obj.data.loop_triangles if f.area>1e-14]
    origin=ancestor.matrix_world.translation
    res=[]
    steps=math.ceil(spec['lift_max_m']/.0005)
    for step in range(1,steps+1):
        frac=step/steps
        lift=spec['lift_max_m']*frac
        if key=='valve':tf=Matrix.Translation((0,0,-lift))
        elif key=='tappet':tf=Matrix.Translation((0,0,spec['pushrod_ratio']*lift))
        elif key=='rocker':
            tf=Matrix.Translation(origin)@Matrix.Rotation(lift/spec['rocker_lever_m'],4,'X')@Matrix.Translation(-origin)
        else:
            tf=Matrix.Translation(origin)@Matrix.Diagonal((1,1,1-lift/spec['spring_height_m'],1))@Matrix.Translation(-origin)
        vs=[tf@p for p in points]
        if not nearby(old_bounds,bounds(vs)):continue
        hits=target.overlap(BVHTree.FromPolygons(vs,faces,all_triangles=True))
        if hits:
            ps=[vs[k] for b in {b for a,b in hits} for k in faces[b]]
            p=[xyz(v) for v in ps]
            region=[[min(w[k] for w in p) for k in range(3)],[max(w[k] for w in p) for k in range(3)]]
            res.append({'part':id,'motion':key,'fraction_peak_lift':frac,'lift_mm':1000*lift,'surface_crossing_pairs':len(hits),
                        'moving_part_triangle_bounds_m':region})
    return res
pipe_pairs=[]
for a,b in itertools.combinations((f'EXT-FUEL-{i:02d}' for i in range(3,9)),2):
    if a in objects and b in objects:
        hits=len(g(a)[1].overlap(g(b)[1]))
        if hits:pipe_pairs.append({'a':a,'b':b,'surface_pairs':hits})
for n in range(1,7):
    tube=f'EXT-FUEL-{n+2:02d}'
    holder=f'INT-FUELINJ-{10*n+1}'
    if tube not in objects or holder not in objects:continue
    p,a=g(tube)
    q,b=g(holder)
    cylinder_bounds=bounds(p)
    contacts=[]
    moving=[]
    candidates=[id for id,obj in objects.items() if (id.startswith(f'INT-VALVE-{n}') or
                id.startswith(f'INT-FUELINJ-{10*n+1}') or id==f'INT-FUELINJ-{10*n+2}') and id!=holder]
    for candidate in candidates:
        cv,ct=g(candidate)
        if not nearby(cylinder_bounds,bounds(cv),.025): continue
        moving.extend(dynamic_contacts(candidate,cv,a,tube,cylinder_bounds))
        hits=len(a.overlap(ct))
        if hits: contacts.append({'part':candidate,'surface_crossing_pairs':hits})
    feed.append({'tube':tube,'holder':holder,
        'nearby_valve_rocker_and_other_injector_candidates':len(candidates),
        'nearby_valve_rocker_and_other_injector_contacts_at_rest':contacts,
        'moving_stack_contacts_at_0_5mm_intervals_of_lift':moving,
        'nearest_vertex_to_opposite_surface_mm':1000*min(nearest(p,b),nearest(q,a)),
        'surface_crossing_pairs':len(a.overlap(b)),
        'tube_vs_head_shell_surface_crossing_pairs':len(a.overlap(g(f'EXT-HEADS-{n:02d}')[1]))})
report={'assets_sha256':assets,'routes_sha256':hashlib.sha256(flowfile.read_bytes()).hexdigest(),
      'method':'World coordinates measured from Blender reimport, Y-up output. Midpoint intervals ≤10 mm except cap 400 each segment. Radial wall probes use only attributed meshes, with max range 3.5 times path radius or 9 mm. Positive coverage is proximity, not proof of closed watertight wall or manifold separation. Nearest surface distance at samples and BVH pair counts distinguish gaps and geometric contact; intentional nested fittings may intersect. Cross-media sampled distance screens offset trouble, not exact volume interference.',
      'port_count':len(ports),'route_count':len(routes),'routes':checks,'possible_cross_media_nearby_samples':cross,
      'rigid_delivery_actual_holder_contacts':feed,'rigid_delivery_pipe_pair_crossings':pipe_pairs,
      'manifest_gaps':manifest.get('gaps',[])}
(output/'routes-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
