"""Measure shaft/gear mesh envelopes relative to declared rotation lines."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

p=argparse.ArgumentParser()
p.add_argument('workspace',type=Path)
p.add_argument('out',type=Path)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
hashes={}
for layer in ('exterior','internal'):
    glb=args.workspace/'model'/layer/(layer+'.glb')
    hashes[layer]=hashlib.sha256(glb.read_bytes()).hexdigest()
    bpy.ops.import_scene.gltf(filepath=str(glb.resolve()))
bpy.context.view_layer.update()
data_path=args.workspace/'review/assets/data.json'
hashes['runtime_data']=hashlib.sha256(data_path.read_bytes()).hexdigest()
data=json.loads(data_path.read_text())
by_target={target:rule for rule in data['drivetrain']['groups'] for target in rule['targets']}
inspection=['INT-TIMING-01','INT-TIMING-02','INT-TIMING-03','INT-TIMING-04','INT-TIMING-05',
            'INT-TIMING-07','INT-TIMING-08','INT-TIMING-10','INT-OILPUMP-01','INT-OILPUMP-03','INT-OILPUMP-04',
            'EXT-COOLING-20','EXT-COOLING-21','EXT-COOLING-26','EXT-COOLING-35','EXT-COOLING-36','EXT-COOLING-41',
            'EXT-FUEL-21','EXT-EXHAUST-20','EXT-EXHAUST-21','EXT-ELECTRIC-40','EXT-ELECTRIC-48',
            'EXT-ELECTRIC-21','EXT-ELECTRIC-25']
def point(p):
    return Vector((p.x,p.z,-p.y))
rows=[]
for name in inspection:
    spec=by_target.get(name)
    obj=bpy.data.objects.get(name)
    if not spec or not obj:
        rows.append({'id':name,'missing':['rule' if not spec else 'mesh']})
        continue
    axis=Vector(spec['axis']).normalized()
    radial_a=axis.orthogonal().normalized()
    radial_b=axis.cross(radial_a).normalized()
    pivot=Vector(spec['pivot_m'])
    vertices=[point(obj.matrix_world @ v.co) for v in obj.data.vertices]
    offset=[(max(values)+min(values))/2 for dim in [radial_a,radial_b]
            if (values:=[(v-pivot).dot(dim) for v in vertices])]
    along=[(v-pivot).dot(axis) for v in vertices]
    radial=[((v-pivot)-axis*s).length for v,s in zip(vertices,along)]
    rows.append({'id':name,'axis':list(axis),'pivot_m':list(pivot),
                 'radial_bounding_midpoint_offset_mm': 1000*Vector(offset).length,
                 'radial_envelope_radius_mm':1000*max(radial),
                 'axial_range_from_pivot_mm':[1000*min(along),1000*max(along)]})
args.out.write_text(json.dumps({'hashes':hashes,'method':'World-space radial AABB midpoint projected onto two perpendicular directions. Axisymmetric shafts are good alignment probes; asymmetric fans and low tooth count envelopes can offset the midpoint.', 'parts':rows},indent=2)+'\n')
