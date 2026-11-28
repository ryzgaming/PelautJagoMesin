"""Full operating-cycle BVH checks of the YPE-1615 feed and governor repair."""
import sys,json,hashlib,itertools,bpy
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[2]
scratch='--scratch' in sys.argv
if not scratch:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root/'model/exterior/exterior.glb'))
bpy.context.view_layer.update()
matrix_file=Path(sys.argv[sys.argv.index('--matrices')+1]) if '--matrices' in sys.argv else root/'qa/r05/final/running-sweep-matrices.json'
run=json.loads(matrix_file.read_text())
basis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));inverse=basis.inverted()
S=lambda n:f'EXT-FUEL-{n:02d}'
hard=set()
for k in [213,214,215,216,234,235,236,237]:
    for j in [1,2,12,19,210,211,212,217,218,219,238,239]:
        hard.add((k,j))
    for j in range(230,234):
        if k not in [j-17,j+4]:
            hard.add((k,j))
for k in [200,201,202,21,210,211,212,238]:
    for j in [1,2,12,19,217,218]:
        hard.add((k,j))
for i in range(4):
    for j in range(4):
        if i!=j:
            for a in (213+i,234+i):
                for b in (213+j,234+j):hard.add(tuple(sorted((a,b))))
intended=set((k+i,j+i) for i in range(4) for k,j in [(213,230),(213,234),(234,230)])
ids=set(i for p in hard|intended for i in p)
geo={}
for i in ids:
    ob=bpy.data.objects[S(i)];ob.data.calc_loop_triangles();vs=[ob.matrix_world@v.co for v in ob.data.vertices]
    fs=[tuple(t.vertices) for t in ob.data.loop_triangles if t.area>1.e-13];geo[i]=(vs,fs,BVHTree.FromPolygons(vs,fs,all_triangles=True))
hits={}
valve_lifts=[[] for i in range(4)]
for f in run['frames']:
    deg=f['degree']; cache={}
    for i in ids:
        verts,tri,base=geo[i];mat=f['moved'].get(S(i))
        if not mat:cache[i]=base;continue
        change=basis@Matrix([mat[c::4] for c in range(4)])@inverse
        cache[i]=BVHTree.FromPolygons([change@p for p in verts],tri,all_triangles=True)
    for i,(x,z) in enumerate(((.441,-.466),(.441,-.484),(.498,-.466),(.498,-.484))):
        ray_x=x+.00345
        up=Vector((0,0,1))
        disc=cache[213+i].ray_cast(Vector((ray_x,-z,.190)),up,.020)[0]
        seat=cache[230+i].ray_cast(Vector((ray_x,-z,.205)),-up,.020)[0]
        if disc is None or seat is None:raise ValueError(f'Missing check-valve face for #{i+1}')
        valve_lifts[i].append((disc.z-seat.z)*1000)
    for a,b in hard|intended:
        n=len(cache[a].overlap(cache[b]))
        if n:hits.setdefault((a,b),[]).append((deg,n))
def failed(t):return {f'{S(k[0])}/{S(k[1])}':dict(poses=len(v),peak=max(r[1] for r in v)) for k,v in hits.items() if k in t}
d=dict(exterior_sha256=None if scratch else hashlib.sha256((root/'model/exterior/exterior.glb').read_bytes()).hexdigest(),matrix_sha256=hashlib.sha256(matrix_file.read_bytes()).hexdigest(),
        poses=len(run['frames']),first_deg=run['frames'][0]['degree'],last_deg=run['frames'][-1]['degree'],hard_pairs_tested=len(hard),intentional_pairs_tested=len(intended),unwanted=failed(hard),registered_seat_spring_contacts=failed(intended))
d['valve_opening_mm']=[dict(check=i+1,closed_gap_mm=min(lifts),max_opening_mm=max(lifts)) for i,lifts in enumerate(valve_lifts)]
d['passed']=not d['unwanted'] and all(abs(min(lifts))<.011 and abs(max(lifts)-.7)<.015 for lifts in valve_lifts)
out=root/'qa/r05/final'/('feed-governor-scratch.json' if scratch else 'feed-governor-release.json')
out.write_text(json.dumps(d,indent=2)+'\n');print('FEED_GOVERNOR',d,flush=True)
if not d['passed']:raise RuntimeError('Fuel-feed/governor geometry did not pass the operating-cycle check.')
