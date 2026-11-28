"""Independent reimport of the finite starter gear mesh, belt envelope and interfaces."""
import json,math,sys,hashlib
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
root=Path(sys.argv[sys.argv.index('--')+1])
out=Path(sys.argv[sys.argv.index('--')+2])
bpy.ops.wm.read_factory_settings(use_empty=True)
for layer in ('internal','exterior'):
 bpy.ops.import_scene.gltf(filepath=str(root/'model'/layer/(layer+'.glb')))
def world(p):return Vector((p[0],-p[2],p[1]))
cache={}
def raw(n):
 if n not in cache:
  o=bpy.data.objects[n];o.data.calc_loop_triangles()
  v=[o.matrix_world@x.co for x in o.data.vertices]
  tri=[tuple(t.vertices) for t in o.data.loop_triangles if t.area>1e-14]
  cache[n]=(v,tri,BVHTree.FromPolygons(v,tri,all_triangles=True))
 return cache[n]
def moved(n,p,r,offset=(0,0,0)):
 a,t,b=raw(n);p=world(p);tr=Matrix.Translation(p+world(offset))@Matrix.Rotation(r,4,'X')@Matrix.Translation(-p)
 return BVHTree.FromPolygons([tr@v for v in a],t,all_triangles=True)
def overlaps(a,b):
 return len(a.overlap(b))
m=json.loads((root/'model/motion/drivetrain.json').read_text())
g={r['id']:r for r in m['groups']}
pin=g['starter-pinion'];future=pin['mode_offset_m']
origin=pin['pivot_m']
sample=[]; planet_hits=[]; wheel_disk=[]; carrier_ring=[]; fork_contacts=[]
for j in range(49):
 phi=math.radians(2*j/48)
 ring=moved('EXT-FLYWHEEL-20',[0,0,0],-phi)
 pinion=moved('EXT-ELECTRIC-48',origin,phi*pin['ratio'],(future,0,0))
 # Work in carrier coordinates for the sun/planet and planet/fixed-ring meshes.
 planet=g['starter-planet-1']
 body=moved('EXT-ELECTRIC-54',planet['secondary_pivot_m'],phi*planet['secondary_ratio'])
 sun=moved('EXT-ELECTRIC-40',origin,phi*(g['starter-armature']['ratio']-planet['ratio']))
 fixed=moved('EXT-ELECTRIC-45',origin,-phi*planet['ratio'])
 sample.append(overlaps(ring,pinion));planet_hits.append([overlaps(sun,body),overlaps(fixed,body)])
 wheel_disk.append(overlaps(pinion,moved('EXT-FLYWHEEL-02',[0,0,0],-phi)))
 carrier_ring.append(overlaps(moved('EXT-ELECTRIC-46',origin,phi*planet['ratio']),raw('EXT-ELECTRIC-45')[2]))
 lever=g['starter-lever'];v,t,_=raw('EXT-ELECTRIC-53');p=world(lever['pivot_m'])
 transform=Matrix.Translation(p)@Matrix.Rotation(lever['mode_angle_rad'],4,world(lever['axis']))@Matrix.Translation(-p)
 fork=BVHTree.FromPolygons([transform@vert for vert in v],t,all_triangles=True)
 fork_contacts.append(dict(collar=overlaps(fork,pinion),nose=overlaps(fork,raw('EXT-ELECTRIC-49')[2]),
                    solenoid_case=overlaps(fork,raw('EXT-ELECTRIC-50')[2]),coil=overlaps(fork,raw('EXT-ELECTRIC-51')[2])))
def static(a,b):return len(raw(a)[2].overlap(raw(b)[2]))
pairs={}
for l in ['EXT-FRONT-04','EXT-FRONT-06','EXT-FRONT-07','EXT-FRONT-08','EXT-ELECTRIC-48','EXT-ELECTRIC-49']:
 for r in ['EXT-FLYWHEEL-01','EXT-FLYWHEEL-02','EXT-FLYWHEEL-20','EXT-FRONT-01','EXT-FRONT-02','EXT-FRONT-03','EXT-COOLING-01','EXT-ELECTRIC-01','EXT-ELECTRIC-25','EXT-EXHAUST-01']:
  hits=static(l,r)
  if hits:pairs[' / '.join([l,r])]=hits
# Check actual contact or clearance between moving enclosed parts and fixed apparatus.
startfits={}
for n in ['EXT-ELECTRIC-48','EXT-ELECTRIC-49','EXT-ELECTRIC-45','EXT-ELECTRIC-40']:
 for q in ['EXT-FLYWHEEL-01','EXT-FLYWHEEL-02','EXT-FLYWHEEL-20','EXT-ELECTRIC-49']:
  if n==q:continue
  startfits[n+' / '+q]=overlaps(moved(n,origin,0,(future if n=='EXT-ELECTRIC-48' else 0,0,0)),raw(q)[2])
edges=loop=g['alternator-belt-travel']['path_m'];pitch=sum(math.dist(a,b) for a,b in zip(edges,edges[1:]))
target_ids=[id for group in m['groups'] for id in group['targets']]
out.write_text(json.dumps(dict(exterior_sha256=hashlib.sha256((root/'model/exterior/exterior.glb').read_bytes()).hexdigest(),
 internal_sha256=hashlib.sha256((root/'model/internal/internal.glb').read_bytes()).hexdigest(),
 missing_targets=[id for id in target_ids if not bpy.data.objects.get(id)],duplicate_targets=len(target_ids)-len(set(target_ids)),
 starter_points=49,range_crank_deg=[0,2],teeth_count_flywheel=180,starter_pinion_overlaps=sample,
 pinion_vs_solid_flywheel=wheel_disk,carrier_vs_fixed_annulus=carrier_ring,fork_in_start=fork_contacts,
 sun_planet_and_internal_ring_overlaps=planet_hits,engaged_static_pairs=startfits,static_housing_pairs=pairs,
 belt_pitch_length_m=pitch,method='Blender imports both GLBs. World-space triangle BVH with 49 samples through one tooth period of the outer flywheel. Planetary contacts are evaluated in the carrier reference frame. Pair counts describe geometric intersections, not stress/leakage.'),indent=2)+'\n')
