"""Targeted independent Blender reimport of native runtime matrix poses."""
import argparse
import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
import sys
import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser()
p.add_argument('root', type=Path)
p.add_argument('capture', type=Path)
p.add_argument('out', type=Path)
p.add_argument('--family')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
capture=json.loads(a.capture.read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
hashes={}
for layer in ('exterior','internal'):
    file=a.root/'model'/layer/(layer+'.glb')
    hashes[file.name]=hashlib.sha256(file.read_bytes()).hexdigest()
    assert hashes[file.name]==capture['hashes'][file.name], f'{layer}: GLB hash mismatch'
    bpy.ops.import_scene.gltf(filepath=str(file.resolve()))
bpy.context.view_layer.update()
base={}
def mesh(id):
    if id not in base:
        object=bpy.data.objects.get(id)
        if not object or object.type!='MESH':
            raise KeyError(id)
        object.data.calc_loop_triangles()
        base[id]=([object.matrix_world@v.co for v in object.data.vertices],
                  [tuple(t.vertices) for t in object.data.loop_triangles if t.area>1e-13])
    return base[id]

basis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
inverse=basis.inverted()
@lru_cache(maxsize=200)
def posed(id,delta):
    vertices,triangles=mesh(id)
    if delta:
        relative=basis@Matrix([delta[i::4] for i in range(4)])@inverse
        vertices=[relative@vertex for vertex in vertices]
    corners=tuple((min(v[i] for v in vertices),max(v[i] for v in vertices)) for i in range(3))
    return corners,BVHTree.FromPolygons(vertices,triangles,all_triangles=True),vertices

pairs={}
def add(family,left,right,kind='hard'):
    if a.family and family!=a.family:
        return
    for a_ in left:
        for b in right:
            if a_!=b:
                pairs[(family,a_,b)]={'family':family,'parts':[a_,b],'kind':kind,'tested':0,'intersect_count':0,
                                      'worst_triangles':0,'first':None}
add('rear oil train',['INT-TIMING-07','INT-OILPUMP-01'],['EXT-OILPAN-01','EXT-OILPAN-20','EXT-BLOCK-01','EXT-FLYWHEEL-01'])
add('rotating mechanical seals',['EXT-COOLING-380'],['EXT-COOLING-03'])
add('rotating mechanical seals',['EXT-COOLING-381'],['EXT-COOLING-04'])
add('floating turbo bushes',['EXT-EXHAUST-22','EXT-EXHAUST-23'],['EXT-EXHAUST-02','EXT-EXHAUST-03'])
add('flinger stationary seal',['EXT-EXHAUST-28'],['EXT-EXHAUST-30','EXT-EXHAUST-31'])
add('rear gear mesh',['INT-TIMING-01'],['INT-TIMING-07','INT-TIMING-02'],'gear_teeth')
add('rear idlers',['INT-TIMING-02','INT-TIMING-03'],['EXT-BLOCK-01','INT-CAM-01','INT-CRANK-10'])
add('starter clutch',['EXT-ELECTRIC-48','EXT-ELECTRIC-57','EXT-ELECTRIC-58'],['EXT-FLYWHEEL-01','EXT-BLOCK-15','EXT-FLYWHEEL-02'])
add('starter tooth',['EXT-ELECTRIC-48'],['EXT-FLYWHEEL-20'],'gear_teeth')
add('starter reducer',['EXT-ELECTRIC-46'],['EXT-ELECTRIC-45'])
add('governor',['EXT-FUEL-201','EXT-FUEL-202'],['EXT-FUEL-01','EXT-FUEL-02'])
add('metering rack',['EXT-FUEL-22'],['EXT-FUEL-01'])
for i in range(6):
    pinion=f'EXT-FUEL-{330+i}'
    plunger=f'EXT-FUEL-{35+i:02}'
    add('metering external',['EXT-FUEL-22'],[pinion],'gear_teeth')
    add('metering enclosure',[pinion,plunger],['EXT-FUEL-01','EXT-FUEL-21'])
    add('metering seats',[pinion,plunger],[f'EXT-FUEL-{41+i:02}'],'mating')
    add('thermostat clearances',[f'EXT-COOLING-{330+i}',f'EXT-COOLING-{340+i}'],
        ['EXT-COOLING-01','EXT-COOLING-50','EXT-COOLING-61','EXT-COOLING-62'])
    add('thermostat seating',[f'EXT-COOLING-{330+i}',f'EXT-COOLING-{340+i}'],[f'EXT-COOLING-{55+i}'],'mating')
missing=set()
for row in pairs.values():
    for id in row['parts']:
        try:
            mesh(id)
        except KeyError:
            missing.add(id)
for index,frame in enumerate(capture['transforms']):
    for row in pairs.values():
        family=row['family']
        if family.startswith('starter') and frame['phase']=='running':
            continue
        if family.startswith('thermostat') and index>0 and frame['phase']!='running':
            continue
        ids=row['parts']
        if any(name in missing for name in ids):
            continue
        g=[posed(name,tuple(frame['moved'].get(name,()))) for name in ids]
        row['tested']+=1
        if any(g[0][0][i][1]<g[1][0][i][0] or g[1][0][i][1]<g[0][0][i][0] for i in range(3)):
            continue
        hits=len(g[0][1].overlap(g[1][1]))
        if hits:
            row['intersect_count']+=1
            if not row['first']:
                row['first']={k:v for k,v in frame.items() if k!='moved'}|{'sample':index}
        row['worst_triangles']=max(row['worst_triangles'],hits)
cold_hot=[]
for i in range(6):
    val=f'EXT-COOLING-{330+i}'
    shifts=[(f['warm'],f['moved'].get(val,[0]*16)[13]) for f in capture['transforms']]
    cold_hot.append({'id':val,'zero_shift_below_71C':max(abs(d) for temp,d in shifts if temp<71),
                     'largest_sampled_stroke_mm':1000*max(abs(d) for _,d in shifts),
                     'peak_tempc':max(t for t,_ in shifts)})
two=[f for f in capture['transforms'] if f['phase']=='cranking'][4:6]
def axis_angle(f,id):
    m=f['moved'][id]
    return math.atan2(m[6],m[5])
def difference(a,b):
    return math.atan2(math.sin(b-a),math.cos(b-a))
oil=difference(*(axis_angle(f,'INT-TIMING-07') for f in two))
crank=difference(*(axis_angle(f,'INT-TIMING-01') for f in two))
summary={'assets':hashes,'runtime':capture['hashes'],'interval':'two 720° turns at 4°, fine starter first 24° at 0.25°, interpolated warm and spin-down poses',
         'samples':len(capture['transforms']),'missing_ids':sorted(missing),'pairs':list(pairs.values()),
         'oil_measured_signed_ratio_to_crank':oil/crank,'thermostats':cold_hot}
a.out.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'tested':sum(row['tested'] for row in pairs.values()),'pair_count':len(pairs),'missing_ids':sorted(missing),
 'oil_ratio':oil/crank,'hard_hits':[row['parts'] for row in pairs.values() if row['kind']=='hard' and row['intersect_count']]}))
