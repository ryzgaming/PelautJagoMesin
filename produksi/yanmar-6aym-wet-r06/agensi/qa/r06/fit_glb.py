"""Inspect exported geometry at discrete poses; no authoring scene is loaded."""
import collections
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

root = Path.cwd()
target = Path(sys.argv[sys.argv.index("--")+1])
target.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for group in ('exterior','internal'):
    bpy.ops.import_scene.gltf(filepath=str(root/'model'/group/(group+'.glb')))
bpy.context.view_layer.update()
objects = {o.name:o for o in bpy.context.scene.objects}
kin = json.loads((root/'model/internal/kinematics.json').read_text())
int_parts = json.loads((root/'model/internal/inventory.json').read_text())['components']
world_data = {}

def mesh(id):
    if id not in world_data:
        obj = objects[id]
        obj.data.calc_loop_triangles()
        world_data[id] = ([obj.matrix_world @ v.co for v in obj.data.vertices],
                          [tuple(f.vertices) for f in obj.data.loop_triangles if f.area > 1e-12])
    return world_data[id]

def tree(id, tf=None):
    v,f = mesh(id)
    if tf is not None:
        v = [tf @ p for p in v]
    return BVHTree.FromPolygons(v,f,all_triangles=True,epsilon=0)

def min_max(v, i):
    return min(p[i] for p in v),max(p[i] for p in v)

def x_probe(id,radius,depth):
    t=tree(id); miss=[]
    for degree in range(360):
        a=math.radians(degree)
        src=Vector((-.16,-radius*math.sin(a),radius*math.cos(a)))
        if t.ray_cast(src,Vector((1,0,0)),depth)[0] is None:
            miss.append(degree)
    groups=[]
    for degree in miss:
        if groups and degree==groups[-1][-1]+1:
            groups[-1].append(degree)
        else:
            groups.append([degree])
    if len(groups)>1 and groups[0][0]==0 and groups[-1][-1]==359:
        groups[0]=[d-360 for d in groups.pop()]+groups[0]
    return {'circle_radius_mm': radius*1e3,'axis_span_mm':[-160,-160+depth*1e3],
            'detected_clear_angular_windows':[{'center_deg':sum(g)/len(g)%360,'samples':len(g)} for g in groups]}

fit={}
for id in ['EXT-BLOCK-01','EXT-FLYWHEEL-01','EXT-FLYWHEEL-02','EXT-FRONT-02','EXT-EXHAUST-05',
           'INT-CRANK-08','INT-CRANK-09','EXT-COOLING-05','EXT-OILPAN-01']:
    print(id, flush=True)
    v,_=mesh(id)
    fit[id]={'glb_x_m':min_max(v,0),'glb_y_m':min_max(v,2),'glb_z_m':tuple(-x for x in min_max(v,1)[::-1]),
             'origin_blender_endpoint':list(objects[id].matrix_world.translation)}
fit['flywheel_drill_circle']=x_probe('EXT-FLYWHEEL-02',.5429/2,.050)
fit['housing_drill_circle']=x_probe('EXT-FLYWHEEL-01',.6795/2,.035)
# Axial support surfaces on full mesh, plus nominal +879 body datum comparison from cover row.
cover_ids=sorted(x for x in objects if x.startswith('EXT-HEAD'))
fit['head_bounds']={id:min_max(mesh(id)[0],2) for id in cover_ids}
pad_ids=sorted(x for x in objects if (x in ('EXT-BLOCK-14','EXT-BLOCK-15','EXT-BLOCK-16','EXT-BLOCK-17')))
fit['pad_bounds']={id:min_max(mesh(id)[0],2) for id in pad_ids}

def mount_openings(id):
    v,_=mesh(id)
    x0,x1 = min_max(v,0)
    y0,y1 = min_max(v,1)
    t=tree(id)
    pitch=.001
    masked=set()
    width,height=int((x1-x0)/pitch),int((y1-y0)/pitch)
    for i in range(width):
        for j in range(height):
            x=x0+(i+.5)*pitch
            y=y0+(j+.5)*pitch
            if t.ray_cast(Vector((x,y,-.181)),Vector((0,0,1)),.040)[0] is None:
                masked.add((i,j))
    openings=[]
    while masked:
        seed=masked.pop()
        queue=[seed]
        area=[]
        boundary=False
        while queue:
            i,j=queue.pop()
            area.append((i,j))
            boundary |= i in {0,width-1} or j in {0,height-1}
            for next_coord in [(i-1,j),(i+1,j),(i,j-1),(i,j+1)]:
                if next_coord in masked:
                    masked.remove(next_coord)
                    queue.append(next_coord)
        if not boundary and len(area)>10:
            openings.append({'center_x_m':x0+(sum(i for i,j in area)/len(area)+.5)*pitch,
                             'center_z_m':-y0-(sum(j for i,j in area)/len(area)+.5)*pitch,
                             'diameter_equivalent_mm':2*math.sqrt(len(area)/math.pi)})
    return sorted(openings,key=lambda hole:hole['center_x_m'])
fit['mount_clear_openings']={id:mount_openings(id) for id in pad_ids}

# True triangle intersections at selected material pairs; report surface intersections even if
# tessellation/contact is responsible, without describing them as guaranteed solid overlap.
block=tree('EXT-BLOCK-01')
sump=tree('EXT-OILPAN-01')
fit['installed_hits']={}
for id in ['INT-CRANK-08','INT-CRANK-09','INT-LINER-11','INT-LINER-61']:
    obstacle=tree(id)
    fit['installed_hits'][id]={'block_triangle_pairs':len(block.overlap(obstacle)),
                              'sump_triangle_pairs':len(sump.overlap(obstacle))}
# Open/contact checks around cylinder 1 at 10° intervals over 720°.
results=[]
for number in range(1,7):
    c1 = kin['cylinders'][number-1]
    serial = 10*number
    phase=math.radians(c1['crankpin_phase_deg'])
    rod_length=kin['rod_center_to_center_m']
    pivot=Vector((c1['x_m'],0,0))
    rod_root=objects[c1['rod_root']]
    p0=objects[c1['piston_root']].matrix_world.translation.z
    rod0=rod_root.matrix_world.copy()
    valves=[v for v in kin['valve_train'] if v['cylinder']==number]
    piston_geom=f'INT-PISTON-{serial+1:02d}'
    piston_low,piston_high=min_max(mesh(piston_geom)[0],2)
    liner=tree(f'INT-LINER-{serial+1:02d}')
    links = {
        'ring1': f'INT-PISTON-{serial+3:02d}', 'ring2': f'INT-PISTON-{serial+4:02d}', 'oil_ring': f'INT-PISTON-{serial+5:02d}',
        'rod_bearing_upper':f'INT-ROD-{serial+3:02d}','rod_bearing_lower':f'INT-ROD-{serial+4:02d}',
    }
    valve_parts={v['valve_root']:[p['id'] for p in int_parts if p['parent']==v['valve_root'] and 'poppet' in p['name'].lower()] for v in valves}
    for elapsed in range(0,721,10):
        angle=math.radians(elapsed)
        radius=kin['throw_m']
        pin_y,pin_z=radius*math.cos(angle+phase),-radius*math.sin(angle+phase)
        delta=math.sqrt(rod_length**2-pin_z**2)
        p=pin_y+delta
        pt=Matrix.Translation((0,0,p-p0))
        crank_t=Matrix.Rotation(-angle,4,'X')
        rod_t=Matrix.Translation((pivot.x,-pin_z,pin_y))@Matrix.Rotation(math.atan2(-pin_z,delta),4,'X')@rod0.inverted()
        pin_tree=tree(f'INT-CRANK-{serial+10:02d}',crank_t)
        p_tree=tree(piston_geom,pt)
        hits={}
        for label,id in links.items():
            if label.startswith('rod'):
                count=len(tree(id,rod_t).overlap(pin_tree))
            else:
                count=len(tree(id,pt).overlap(liner))
            hits[label]=count
        hits['piston_body']=len(p_tree.overlap(liner))
        hits['piston_block']=len(p_tree.overlap(block))
        hits['rod_web_block']=len(tree(f'INT-ROD-{serial+7:02d}',rod_t).overlap(block))
        hits['counterweight_sump']=sum(len(tree(id,crank_t).overlap(sump))
                                      for id in (f'INT-CRANK-{serial+13:02d}',f'INT-CRANK-{serial+14:02d}')
                                      if id in objects)
        gap=math.inf
        valve_hits=0
        for meta in valves:
            dist=abs((elapsed-meta['lift_center_deg']+360)%720-360)
            opening=meta['lift_max_m']*max(0,math.cos(math.pi*dist/(2*meta['half_window_deg'])))**2 if dist < meta['half_window_deg'] else 0
            for id in valve_parts[meta['valve_root']]:
                low=min_max(mesh(id)[0],2)[0]-opening
                gap=min(gap,low-(piston_high+p-p0))
                valve_hits+=len(tree(id,Matrix.Translation((0,0,-opening))).overlap(p_tree))
        hits['valves_piston']=valve_hits
        results.append({'cylinder':number,'deg':elapsed,'piston_pin_y_m':p,'axial_valve_to_highest_crown_m':gap,'hits':hits})
summary=collections.Counter(name for row in results for name,n in row['hits'].items() if n)
(target/'fit.json').write_text(json.dumps({'method':'World coordinates from Blender reimport. Triangle BVH surface intersection (zero epsilon) and axial envelopes, mm unless denoted otherwise. Six cylinders, 0..720° at 10° intervals, prescribed educational motion from kinematics. Contact and containment may be ambiguous. Sampling is discrete.', 'interfaces':fit,'sample_nonzero_counts':summary,'samples':results},indent=2)+'\n')
