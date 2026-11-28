"""Private regression image of the two exact pump impeller nodes in a supplied GLB."""
from pathlib import Path
import sys
import bpy
from mathutils import Vector
src,out = map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=False
scene.render.resolution_x=540
scene.render.resolution_y=460
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.28,.31,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
models=[o for o in scene.objects if o.type=='MESH']
for o in models:o.hide_render=True
for no,sign in [(20,1),(35,-1)]:
    key=f'EXT-COOLING-{no}'
    parent=bpy.data.objects[key]
    target_parts=[o for o in [parent,*parent.children_recursive] if o.type=='MESH']
    for o in target_parts:o.hide_render=False
    target=sum((obj.matrix_world@Vector(corner) for obj in target_parts for corner in obj.bound_box),Vector())/(8*len(target_parts))
    cam=bpy.data.cameras.new('Camera')
    cam.type='ORTHO';cam.ortho_scale=.221
    camera=bpy.data.objects.new('Camera',cam);scene.collection.objects.link(camera)
    camera.location=target+Vector((sign*.34,-.26,.24))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    lights=[]
    for offset,w in [((sign*.24,-.28,.36),10),((sign*.32,.12,.18),5)]:
        lamp=bpy.data.lights.new('Softbox','AREA');lamp.energy=w;lamp.size=.28
        o=bpy.data.objects.new('Softbox',lamp);scene.collection.objects.link(o);o.location=target+Vector(offset)
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
    scene.render.filepath=str(out/f'{key}.png');bpy.ops.render.render(write_still=True)
    for o in lights+[camera]:bpy.data.objects.remove(o,do_unlink=True)
    for o in target_parts:o.hide_render=True
