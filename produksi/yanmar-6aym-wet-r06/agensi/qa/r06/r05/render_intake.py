"""Render the engine area around the reported overlap, using a fixed camera."""
import argparse, hashlib, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('workspace',type=Path)
p.add_argument('output',type=Path)
p.add_argument('--include-internal',action='store_true')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
hashes={}
for layer in ('exterior','internal') if args.include_internal else ('exterior',):
    f=args.workspace/'model'/layer/(layer+'.glb')
    bpy.ops.import_scene.gltf(filepath=str(f.resolve()))
    hashes[layer]=hashlib.sha256(f.read_bytes()).hexdigest()
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=18
scene.cycles.use_denoising=False
scene.render.resolution_x,scene.render.resolution_y=1270,800
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.22,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.67
target=Vector((.924,-.169,.606))
def lamp(name,delta,power,size):
    light=bpy.data.lights.new(name,'AREA')
    light.energy,light.size=power,size
    ob=bpy.data.objects.new(name,light)
    scene.collection.objects.link(ob)
    ob.location=target+Vector(delta)
    ob.rotation_euler=(-Vector(delta)).to_track_quat('-Z','Y').to_euler()
lamp('Key',(-.13,-.85,1.30),240,1.8)
lamp('Fill',(1.2,-1.4,.67),110,1.5)
lamp('Rim',(-.6,1.7,1.1),160,1.3)
camera=bpy.data.cameras.new('Intake overlap camera')
camera.type='ORTHO'
camera.ortho_scale=1.64
ob=bpy.data.objects.new(camera.name,camera)
scene.collection.objects.link(ob)
scene.camera=ob
camera_dir=Vector((.55,-1,.39)).normalized()
ob.location=target+camera_dir*3.1
ob.rotation_euler=(-camera_dir).to_track_quat('-Z','Y').to_euler()
args.output.parent.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(args.output.resolve())
bpy.ops.render.render(write_still=True)
args.output.with_suffix('.json').write_text(json.dumps({'assets_sha256':hashes,
    'orientation':'Camera from +X and +Z in the glTF frame, facing toward intake/turbo side.',
    'target_blender':list(target),'direction_blender':list(camera_dir),'orthographic_scale_m':camera.ortho_scale,
    'estimated_camera_match':True},indent=2)+'\n')
