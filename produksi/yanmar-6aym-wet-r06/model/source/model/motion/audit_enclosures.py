"""Measure assembled mechanical enclosure interfaces over one modeled cycle, in Blender."""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

root, output = map(Path, sys.argv[sys.argv.index('--')+1:sys.argv.index('--')+3])
bpy.ops.wm.read_factory_settings(use_empty=True)
asset = root/'model/exterior/exterior.glb'
bpy.ops.import_scene.gltf(filepath=str(asset))
groups = json.loads((root/'model/motion/drivetrain.json').read_text())['groups']
drivers = {target:g for g in groups for target in g['targets']}
cache = {}

def world(row):
    return Vector((row[0], -row[2], row[1]))

def rest(target):
    if target not in cache:
        obj = bpy.data.objects[target]
        obj.data.calc_loop_triangles()
        points = [obj.matrix_world@p.co for p in obj.data.vertices]
        triangles = [tuple(t.vertices) for t in obj.data.loop_triangles if t.area > 1e-14]
        cache[target] = points, triangles, BVHTree.FromPolygons(points, triangles, all_triangles=True)
    return cache[target]

def posed(target, degrees, mode):
    vertices, triangles, original = rest(target)
    g = drivers.get(target)
    if not g or g['mode'] not in ('both',mode):
        return original
    phase = math.radians(degrees)
    pivot, axis = map(world, (g['pivot_m'],g['axis']))
    value = g['profile']['samples'][(degrees//2)%360] if 'profile' in g else 0.
    if g['kind'] in ('spin','rock'):
        rot = Matrix.Rotation(g['ratio']*phase+g.get('mode_angle_rad',0)+value,4,axis)
    elif g.get('spin_ratio'):
        rot = Matrix.Rotation(g['spin_ratio']*phase,4,world(g['spin_axis']))
    elif g['kind']=='spring':
        rot = Matrix.Scale(1+value/g['length_m'],4,axis)
    else:
        rot = Matrix.Identity(4)
    travel = value if g['kind']=='reciprocate' else 0
    tf = Matrix.Translation(pivot+axis*(travel+g.get('mode_offset_m',0)))@rot@Matrix.Translation(-pivot)
    return BVHTree.FromPolygons([tf@v for v in vertices], triangles, all_triangles=True)

def names(group, nums):
    return ['EXT-'+group+f'-{n:02}' for n in nums]

families = [
    ('feed_pump',names('FUEL',[210,211,212,238]),names('FUEL',[1,12,19,21,239]),'running'),
    ('feed_cam',names('FUEL',[238]),names('FUEL',[240]),'running'),
    ('turbo',names('EXHAUST',[20,21,25,26,28,33]),names('EXHAUST',[1,2,3,4,27,40]),'running'),
    ('alternator',names('ELECTRIC',[21]),names('ELECTRIC',[1,20,22,23,24,27]),'running'),
    ('alternator_drive',names('ELECTRIC',[25,30,31]),names('ELECTRIC',[1,20,22,23,24,27]),'running'),
    ('belt',names('FRONT',[4]),names('FRONT',[1,2,3,7,8])+names('ELECTRIC',[1,24,25]),'running'),
    ('fork_hosts_running',names('ELECTRIC',[53]),names('ELECTRIC',[49,50,51]),'running'),
    ('fork_hosts_starting',names('ELECTRIC',[53]),names('ELECTRIC',[49,50,51]),'starting'),
    ('fork_running',names('ELECTRIC',[48]),names('ELECTRIC',[49,53]),'running'),
    ('fork_starting',names('ELECTRIC',[48]),names('ELECTRIC',[49,53]),'starting'),
]
rows = []
for name,moving,against,mode in families:
    pairs = [(left,right) for left in moving for right in against]
    measured = {pair:[] for pair in pairs}
    for degrees in range(0,720,30):
        state = {n:posed(n,degrees,mode) for n in set(moving+against)}
        for pair in pairs:
            left,right = pair
            n = len(state[left].overlap(state[right]))
            measured[pair].append(n)
    for pair,values in measured.items():
        rows.append(dict(test=name, moving=pair[0], against=pair[1], maximum=max(values),
                         poses_with_crossing=sum(v>0 for v in values), rest=values[0]))
output.write_text(json.dumps(dict(exterior_sha256=hashlib.sha256(asset.read_bytes()).hexdigest(),
                                 step_deg=30,cycle_deg=720,samples=24,pairs=rows),indent=2)+'\n')
