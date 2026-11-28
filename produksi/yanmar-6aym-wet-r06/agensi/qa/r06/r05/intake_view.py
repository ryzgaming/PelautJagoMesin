"""Fixed-camera operation-side view of the reported intake region."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

cli = argparse.ArgumentParser()
cli.add_argument('root', type=Path)
cli.add_argument('output', type=Path)
args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
asset = args.root / 'model/exterior/exterior.glb'
bpy.ops.import_scene.gltf(filepath=str(asset.resolve()))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.resolution_x = 900
scene.render.resolution_y = 1050
scene.world = bpy.data.worlds.new('Neutral workspace')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.22,.25,.29,1)
target = Vector((.60,.28,.53))
camera_data = bpy.data.cameras.new('Reference view')
camera = bpy.data.objects.new('Reference view',camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.location = target + Vector((.41, 2.2, .68))
camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 1.72
light_data = bpy.data.lights.new('Diffuse key','AREA')
light_data.energy = 250
light_data.size = 1.4
light = bpy.data.objects.new('Diffuse key',light_data)
scene.collection.objects.link(light)
light.location = target + Vector((-.25,1.25,1.05))
light.rotation_euler = (target-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath = str(args.output.resolve())
bpy.ops.render.render(write_still=True)
args.output.with_suffix('.json').write_text(json.dumps({
    'exterior_sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'target': list(target), 'camera': list(camera.location), 'ortho_scale_m': camera_data.ortho_scale
},indent=2)+'\n')
