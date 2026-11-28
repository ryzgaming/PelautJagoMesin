"""Render colored exterior GLB at approximate P07/P08 viewpoints with fixed cameras."""
import hashlib
import json
import sys
from pathlib import Path
from math import radians, sin, cos

import bpy
from mathutils import Vector

output = Path(__file__).resolve().parent
revision, model_path, *expected_hash = sys.argv[sys.argv.index('--') + 1:]
model = Path(model_path).resolve()
source_sha = hashlib.sha256(model.read_bytes()).hexdigest()
if expected_hash and source_sha != expected_hash[0]:
    raise RuntimeError('GLB does not match the supplied frozen hash')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = 820
scene.render.resolution_y = 620
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.64, .64, .64, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45

target = Vector((.71, 0, .19))
for name, position, energy, width in (
    ('Large overhead left', (1.8, 2.8, 2.7), 235, 2.0),
    ('Rear light', (-1.9, -2, 2), 160, 2.5),
    ('Near fill', (-.8, 2.4, 1.2), 65, 1.8),
):
    lamp = bpy.data.lights.new(name, 'AREA')
    lamp.energy = energy
    lamp.shape = 'DISK'
    lamp.size = width
    obj = bpy.data.objects.new(name, lamp)
    obj.location = position
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(obj)

camera = bpy.data.cameras.new('Source match')
camera.lens = 39
camera.sensor_width = 36
camera.sensor_fit = 'HORIZONTAL'
camera_object = bpy.data.objects.new('Source match', camera)
scene.collection.objects.link(camera_object)
scene.camera = camera_object
poses = {
    'P07': dict(yaw_from_left_degrees=0, elevation_degrees=2, distance_m=2.9, lens_mm=39),
    'P08': dict(yaw_from_left_degrees=28, elevation_degrees=13, distance_m=2.45, lens_mm=32),
}
for name, pose in poses.items():
    yaw = radians(pose['yaw_from_left_degrees'])
    camera.lens = pose['lens_mm']
    elevation = radians(pose['elevation_degrees'])
    direction = Vector((sin(yaw) * cos(elevation), cos(yaw) * cos(elevation), sin(elevation)))
    camera_object.location = target + direction * pose['distance_m']
    camera_object.rotation_euler = (target - camera_object.location).to_track_quat('-Z', 'Y').to_euler()
    pose['camera_location_blender_m'] = list(camera_object.location)
    scene.render.filepath = str(output / f'{revision}-{name}.png')
    bpy.ops.render.render(write_still=True)

if hashlib.sha256(model.read_bytes()).hexdigest() != source_sha:
    raise RuntimeError('GLB changed during render')
(output / f'{revision}-cameras.json').write_text(json.dumps({
    'revision': revision,
    'model_glb': str(model),
    'sha256': source_sha,
    'method': 'Visual landmark pose estimate. Yaw 0 is operation side (Blender +Y = GLB −Z); positive yaw goes toward damper (+X). No EXIF or survey camera calibration claimed.',
    'target_blender_m': list(target),
    'poses': poses,
}, indent=2) + '\n')
