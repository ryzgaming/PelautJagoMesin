"""Blender projection payload for independent GA silhouette comparison."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
import numpy as np

asset,out=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset.resolve()))
bpy.context.view_layer.update()
faces=[]
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    obj.data.calc_loop_triangles()
    co=np.array([tuple(obj.matrix_world @ v.co) for v in obj.data.vertices],dtype=np.float32)
    co=co[:,[0,2,1]]
    co[:,2]*=-1
    faces.append(co[np.array([tuple(t.vertices) for t in obj.data.loop_triangles],dtype=np.int32)])
np.savez_compressed(out/'ga-projection.npz',triangles=np.concatenate(faces),sha256=hashlib.sha256(asset.read_bytes()).hexdigest())
