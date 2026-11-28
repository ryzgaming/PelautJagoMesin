"""Independently reimport and render a cooler group without altering source models."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('asset',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--select',type=Path,help='JSON mapping parts by role plus exploded GLB world offsets')
parser.add_argument('--label',default='baseline-r02')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.asset.resolve()))
bpy.context.view_layer.update()
scene=bpy.context.scene
select=json.loads(args.select.read_text()) if args.select else {'shell':['EXT-INTAKE-02'],'parts':[],'offsets':{}}
keep=set(select['shell']+select.get('parts',[]))
objects={}
for obj in tuple(scene.objects):
    if obj.type=='MESH':
        if obj.name not in keep:
            obj.hide_render=True
        else:
            objects[obj.name]=obj
assert set(objects)==keep,(set(objects),keep)
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED'
scene.render.threads=8
scene.render.resolution_x=920
scene.render.resolution_y=640
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('QA Lighting')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.135,.15,1)

def area(name,position,power,size):
    l=bpy.data.lights.new(name,'AREA')
    o=bpy.data.objects.new(name,l); scene.collection.objects.link(o)
    o.location=position
    o.rotation_euler=(Vector((-.158,.065,.720))-o.location).to_track_quat('-Z','Y').to_euler()
    l.energy=power
    l.size=size
area('Key',(-2.5,1.2,3.0),400,2.4)
area('Fill',(-1.5,-2.5,2.0),200,2.5)
area('Rim',(1.6,1.7,2.5),350,2.7)
cam_data=bpy.data.cameras.new('QA camera')
cam=bpy.data.objects.new('QA camera',cam_data); scene.collection.objects.link(cam);scene.camera=cam
cam_data.type='ORTHO'
target=Vector((-.16,.06,.72))
direction=Vector((-1,1.25,.69)).normalized()
cam.location=target+direction*4
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()

xray=bpy.data.materials.new('QA x-ray opacity 0.18')
xray.use_nodes=True
ns=xray.node_tree.nodes
links=xray.node_tree.links
base=ns.get('Principled BSDF')
base.inputs['Base Color'].default_value=(.24,.36,.44,1)
base.inputs['Roughness'].default_value=.62
mix=ns.new('ShaderNodeMixShader')
mix.inputs[0].default_value=.18
links.new(ns.new('ShaderNodeBsdfTransparent').outputs[0],mix.inputs[1])
links.new(base.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],ns.get('Material Output').inputs['Surface'])

mats={}
for obj in objects.values():
    mats[obj.name]=[s.material for s in obj.material_slots]
def snap(name,scale):
    cam_data.ortho_scale=scale
    scene.render.filepath=str((args.output/f'{args.label}-{name}.png').resolve())
    bpy.ops.render.render(write_still=True)

snap('assembled',1.05)
for sid in select['shell']:
    for slot in objects[sid].material_slots: slot.material=xray
snap('xray',1.05)
if select.get('offsets'):
    for id,obj in objects.items():
        t=select['offsets'].get(id,[0,0,0])
        world=obj.matrix_world.copy()
        world.translation+=Vector((t[0],-t[2],t[1]))
        obj.matrix_world=world
    bpy.context.view_layer.update()
    pts=[obj.matrix_world @ Vector(corner) for obj in objects.values() for corner in obj.bound_box]
    exploded_center=Vector([(min(v[i] for v in pts)+max(v[i] for v in pts))*.5 for i in range(3)])
    cam.location=exploded_center+direction*4
    cam.rotation_euler=(exploded_center-cam.location).to_track_quat('-Z','Y').to_euler()
    snap('exploded-xray',2.22)
if select.get('core'):
    for id,obj in objects.items(): obj.hide_render=id not in select['core']
    core_pts=[obj.matrix_world @ Vector(corner) for id,obj in objects.items() if id in select['core'] for corner in obj.bound_box]
    core_center=Vector([(min(v[i] for v in core_pts)+max(v[i] for v in core_pts))*.5 for i in range(3)])
    cam.location=core_center+direction*4
    cam.rotation_euler=(core_center-cam.location).to_track_quat('-Z','Y').to_euler()
    snap('core-removed',1.05)
(args.output/f'{args.label}-render.json').write_text(json.dumps({'asset_sha256':hashlib.sha256(args.asset.read_bytes()).hexdigest(),
    'select':select,'assembled_camera_blender':list(target+direction*4),'target_blender':list(target),'mode':'Fixed orthographic camera across versions, 1.05 assembled/X-ray, 2.22 for exploded and recentered. Core-removed recentered. Shell transparency weight .18. QA render, not browser screenshot.'},ensure_ascii=False,indent=2)+'\n')
