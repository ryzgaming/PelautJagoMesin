"""Independent QA. Args after --: exterior.glb internal.glb output_dir [render]."""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

exterior, internal, output = map(Path, sys.argv[sys.argv.index("--") + 1:][:3])
extras = sys.argv[sys.argv.index("--") + 4:]
render = 'render' in extras
baseline = Path(next(x.split('=',1)[1] for x in extras if x.startswith('baseline='))) if any(x.startswith('baseline=') for x in extras) else None
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def xyz(b):
    return (b.x, b.z, -b.y)

def bounds(points):
    return [[min(v[i] for v in points) for i in range(3)], [max(v[i] for v in points) for i in range(3)]]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

registered = {}
objects = {}
all_vertices = {}
for path in (exterior, internal):
    previous = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    bpy.context.view_layer.update()
    current = sorted(set(scene.objects) - previous, key=lambda o: o.name)
    model_data = {}
    vertices = []
    seen = []
    for obj in current:
        if obj.type != 'MESH':
            continue
        objects[obj.name] = obj
        verts = [xyz(obj.matrix_world @ v.co) for v in obj.data.vertices]
        obj.data.calc_loop_triangles()
        degenerate = sum(face.area <= 1e-12 for face in obj.data.loop_triangles)
        parent = []
        current_parent = obj.parent
        while current_parent:
            parent.append(current_parent.name)
            current_parent = current_parent.parent
        seen.append(obj.name)
        model_data[obj.name] = {
            "origin_m": xyz(obj.matrix_world.translation), "bounds_m": bounds(verts) if verts else None,
            "vertices": len(verts), "triangles": len(obj.data.loop_triangles),
            "degenerate_triangles_below_1e-12_m2": degenerate, "ancestors": parent,
            "evidence_status": obj.get('evidence_status'), "negative_scale": obj.matrix_world.determinant() < 0,
        }
        if verts:
            vertices.extend(verts)
            all_vertices[obj.name] = verts
    inv = json.loads((path.parent / 'inventory.json').read_text())
    parts = next((inv[key] for key in ('parts','objects','inventory','items','components') if key in inv), [])
    expected = {item['id']: item for item in parts}
    statuses = {}
    for item in parts:
        key = item.get('status')
        statuses[key] = statuses.get(key, 0) + 1
    registered[path.stem] = {
        'asset': str(path), 'sha256': digest(path), 'bytes': path.stat().st_size,
        'catalogue_item_count': len(parts), 'inventory_status_counts': statuses,
        'inventory_missing_sources': [item['id'] for item in parts if not item.get('source_refs')],
        'mesh_object_count': len(seen), 'triangles': sum(item['triangles'] for item in model_data.values()),
        'unmanifested_glb_meshes': sorted(set(seen) - expected.keys()),
        'inventory_missing_glb_mesh': sorted(expected.keys() - set(seen)),
        'wrong_parent': [i for i in set(seen) & expected.keys() if expected[i].get('parent') and
                         (not model_data[i]['ancestors'] or expected[i]['parent'] != model_data[i]['ancestors'][0])],
        'bounds_m': bounds(vertices), 'geometry': model_data,
    }

def range_at(part, axis):
    return [min(v[axis] for v in all_vertices[part]), max(v[axis] for v in all_vertices[part])]

def bore_data(i):
    part = f'INT-LINER-{10*i+1:02d}'
    verts = all_vertices[part]
    bx = range_at(part, 0)
    bz = range_at(part, 2)
    x, z = sum(bx)/2, sum(bz)/2
    return {"x": x, "z": z, "diameter": 2*min(math.hypot(v[0]-x, v[2]-z) for v in verts),
            "top": range_at(part, 1)[1]}

def bore_rays(part, x, radius, n=360):
    obj = objects[part]
    bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    inv = obj.matrix_world.inverted()
    hit, miss = [], []
    for j in range(n):
        theta = math.tau*j/n
        start = inv @ Vector((x,radius*math.sin(theta),radius*math.cos(theta)))
        direction = inv.to_3x3() @ Vector((-1,0,0))
        loc, _, _, _ = bvh.ray_cast(start,direction,.045)
        (hit if loc is not None else miss).append(j)
    return {"on_angle": hit, "through_angle": miss, "probe_x_m": x,
            "probe_depth_m": .045, "degrees": 360/n, "radius_m": radius}

dimensions = {}
if 'INT-LINER-11' in all_vertices:
    dimensions["liners"] = [bore_data(i) for i in range(1,7)]
    dimensions["c1_to_c6_m"] = dimensions["liners"][-1]["x"] - dimensions["liners"][0]["x"]
pins = {}
for i in range(1,7):
    pid = f'INT-CRANK-{10*i+10:02d}'
    if pid not in objects:
        continue
    low, high = bounds(all_vertices[pid])
    c = [(a+b)/2 for a, b in zip(low,high)]
    pins[pid] = dict(center_m=c, throw_m=math.hypot(c[1],c[2]),
                     phase_degrees=math.degrees(math.atan2(c[2],c[1]))%360)
dimensions['pins'] = pins

whole = bounds([v for verts in all_vertices.values() for v in verts])
extreme = [{axis:{'min': min(all_vertices, key=lambda p:range_at(p,a)[0]),
                  'max': max(all_vertices, key=lambda p:range_at(p,a)[1])}} for a, axis in enumerate('xyz')]
extremes = {k:v for d in extreme for k,v in d.items()}
report = {"blender": bpy.app.version_string, "method": "Blender reimport then matrix_world @ vertex, transform Blender coordinates (x,y,z) to glTF (x,z,-y), AABB uses actual vertices. Bore min sampled radius at vertices, not a gauge fit.",
          "assets": registered, "overall_bounds_m": whole, "extrema": extremes, "measurements": dimensions}
(output / 'reimport.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
if not render:
    sys.exit()

# Preserve both assets in the numerical result. Render installed exterior and selected internal-only cameras.
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 1000, 920
scene.render.image_settings.file_format = 'PNG'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.world = bpy.data.worlds.new('QA Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.28,.28,.28,1)
scene.view_settings.view_transform = 'AgX'

def light(kind, name, position, energy):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((.65, 0, .24)) - obj.location).to_track_quat('-Z','Y').to_euler()
    if kind == 'AREA':
        data.shape = 'DISK'
        data.size = 2.6

for p,e in [((.4,-2.9,3.3),650),((.1,3,2),430),((-2,1.2,2.8),260),((3.0,-.8,2.6),350)]:
    light('AREA','Neutral area',p,e)
material = bpy.data.materials.new('QA matte neutral')
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.49,.49,.49,1)
bsdf.inputs['Roughness'].default_value = .70
scene.view_layers[0].material_override = material
cam_data = bpy.data.cameras.new('QA neutral camera')
camera = bpy.data.objects.new('QA neutral camera', cam_data)
scene.collection.objects.link(camera)
scene.camera = camera
cam_data.type = 'ORTHO'

center = Vector((.684, .01, .224))
camera_plan = {
    "depan": ((1,0,0),1.91), "belakang": ((-1,0,0),1.91), "kiri": ((0,1,0),2.27),
    "kanan": ((0,-1,0),2.27), "atas": ((0,0,1),2.27), "tiga_perempat": ((1,1,.37),2.42),
}
for name, (direction, scale) in camera_plan.items():
    for obj in objects.values():
        obj.hide_render = obj.name.startswith('INT-')
    camera.location = center + 7*Vector(direction).normalized()
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z','Y').to_euler()
    if name == 'atas':
        camera.rotation_euler = (0,0,0)
    cam_data.ortho_scale = scale
    scene.render.filepath = str((output/f'neutral_{name}.png').resolve())
    bpy.ops.render.render(write_still=True)
for obj in objects.values():
    obj.hide_render = not obj.name.startswith('INT-')
camera.location = center + 7*Vector((.25,1,.66)).normalized()
camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
cam_data.ortho_scale = 1.95
scene.render.filepath = str((output/'neutral_internal.png').resolve())
bpy.ops.render.render(write_still=True)
if baseline:
    from mathutils import Matrix
    for obj in objects.values():
        obj.hide_render = True
    previous = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(baseline.resolve()))
    bpy.context.view_layer.update()
    added = set(scene.objects)-previous
    ref = next(o for o in added if o.name=='Piston motion 1').matrix_world.translation.x
    old_crank = next(o for o in added if o.name=='Crankshaft rotating assembly').matrix_world.translation.copy()
    old_full = [xyz(obj.matrix_world @ v.co) for obj in added if obj.type=='MESH' for v in obj.data.vertices]
    transform = Matrix.Translation((.209+ref,0,-old_crank.z)) @ Matrix.Rotation(math.pi,4,'Z')
    for obj in added:
        if obj.parent is None:
            obj.matrix_world = transform @ obj.matrix_world
        if obj.type == 'MESH' and obj.get('layer') == 'core' and not obj.name.startswith('Flywheel'):
            obj.hide_render = True
    bpy.context.view_layer.update()
    retained = [xyz(obj.matrix_world @ v.co) for obj in added if obj.type=='MESH' and not obj.hide_render for v in obj.data.vertices]
    direction,scale = camera_plan['tiga_perempat']
    camera.location = center + 7*Vector(direction).normalized()
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    cam_data.ortho_scale = scale
    scene.render.filepath = str((output/'neutral_baseline_v8_tiga_perempat.png').resolve())
    bpy.ops.render.render(write_still=True)
    (output/'baseline.json').write_text(json.dumps({'sha256':digest(baseline),'original_bounds_m':bounds(old_full),
        'aligned_visible_bounds_m':bounds(retained),'original_crank_origin_blender_m':list(old_crank),
        'original_cyl1_center_x_m':ref,'alignment':'180° about Blender Z, translate to common #1 and crank centerline; no scaling. Excludes internal core except flywheel in render. Fixed new revision 3/4 camera, lights, exposure and viewport. Comparison of appearance, not source validation.'},indent=2))
(output/'render-settings.json').write_text(json.dumps({'assets': {k:v['sha256'] for k,v in registered.items()}, 'camera_plan': camera_plan,
    'center_blender_m':list(center), 'resolution':[1000,920], 'engine':'Cycles CPU 12 samples, denoising off, AgX, 4 area lights',
    'appearance':'neutral matte; internal hidden in six installed exterior renders; exterior hidden in internal render'}, indent=2))
