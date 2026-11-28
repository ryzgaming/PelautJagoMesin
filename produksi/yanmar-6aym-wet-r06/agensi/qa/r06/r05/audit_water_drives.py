"""Measure the actual pump surfaces and interfaces in glTF world metres in Blender."""
import sys, json, hashlib, math, runpy
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
layout=runpy.run_path(str(ROOT/'model/motion/freshwater_pump.py'))
scratch='--scratch' in sys.argv
glbs=['internal'] if scratch else ['exterior','internal']
if not scratch:
    bpy.ops.wm.read_factory_settings(use_empty=True)
hashes={}
for layer in glbs:
    path=ROOT/'model'/layer/(layer+'.glb')
    hashes[layer]=hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()
def world(a):return Vector((a[0],-a[2],a[1]))
def coords(v):return [v.x,v.z,-v.y]
pool={}
for ob in bpy.data.objects:
    if ob.type!='MESH' or not ob.name.startswith(('EXT-','INT-')):continue
    ob.data.calc_loop_triangles()
    pt=[ob.matrix_world@v.co for v in ob.data.vertices]
    tri=[tuple(t.vertices) for t in ob.data.loop_triangles if t.area>1e-13]
    if tri:
        pool[ob.name]=(pt,tri,BVHTree.FromPolygons(pt,tri,all_triangles=True))
def tree(name,pivot,angle):
    pts,tri,_=pool[name]
    mat=Matrix.Rotation(angle,3,'X')
    p=world(pivot)
    return BVHTree.FromPolygons([p+mat@(q-p) for q in pts],tri,all_triangles=True)
fw=(layout['PITCH_X'],layout['CY'],layout['CZ'])
spec=layout['spec']
sw=spec['SEA_GEAR']
gear_defs=[('INT-TIMING-08','EXT-COOLING-26',(1.354,.158,-.150),fw,spec['FRONT_CAM_TEETH'],spec['FRESH_TEETH'],spec['FRONT_CAM_RADIUS'],spec['FRESH_RADIUS']),
           ('INT-TIMING-05','EXT-COOLING-41',(.057,.200,-.427),sw,spec['FIP_TEETH'],spec['SEA_TEETH'],spec['FIP_RADIUS'],spec['SEA_RADIUS'])]
contact={}
for driver,driven,a,b,na,nb,ra,rb in gear_defs:
    if any(k not in pool for k in [driver,driven]):continue
    sweep=[];gaps=[]
    pivot=world(a);q=world(b)
    # Restrict expensive proximity queries to the driver's approaching sector.
    # Vertices wholly outside that sector cannot measure tooth-to-tooth separation.
    R=ra+rb
    querypts=[p for p in pool[driver][0] if (p-q).length<rb+.030]
    for i in range(33):
        phase=i*math.tau/32
        ta=tree(driver,a,phase/na)
        tb=tree(driven,b,-phase/nb)
        sweep.append(len(ta.overlap(tb)))
        rotation=Matrix.Rotation(phase/na,3,'X')
        gaps.append(min(tb.find_nearest(pivot+rotation@(p-pivot))[3] for p in querypts)*1000)
    h=pool[driven][2];vals=[h.find_nearest(p)[3] for p in pool[driver][0]];md=min(vals)
    k=driver+'/'+driven
    contact[k]=dict(centers_m=[a,b],pitch_m=[ra,rb],distance_axis_mm=1000*math.dist(a[1:],b[1:]),
                    distance_plane_mm=1000*abs(a[0]-b[0]),stationary_first_pair_min_surface_mm=1000*md,
                    max_triangle_crossings_33_poses=max(sweep),overlap_counts=sweep,
                    driven_tip_radius_mm=max(math.hypot(p.y-q.y,p.z-q.z) for p in pool[driven][0])*1000,
                    max_nearest_flank_gap_33_poses_mm=max(gaps),min_nearest_flank_gap_33_poses_mm=min(gaps),
                    indexed_geometry_pass=(max(sweep)==0 and max(gaps)<1.5))
    print('PAIR',k,contact[k]['distance_axis_mm'],max(sweep),1000*md)
fw_parts=['EXT-COOLING-03',*[f'EXT-COOLING-{i}' for i in range(20,29)],'EXT-COOLING-06','EXT-COOLING-302',
          *[f'EXT-COOLING-{i}' for i in range(310,325)]]
family=set(fw_parts); nearby={}
sw_parts=['EXT-COOLING-04',*[f'EXT-COOLING-{i}' for i in range(35,47)]]
for k in [*fw_parts,*sw_parts]:
    if k not in pool:continue
    hit={}
    for n,(_,_,b) in pool.items():
        if k==n:continue
        ov=pool[k][2].overlap(b)
        if ov:hit[n]=len(ov)
    nearby[k]=hit
    print('HITS',k,hit)
rot=['EXT-COOLING-20','EXT-COOLING-21','EXT-COOLING-26','EXT-COOLING-310','EXT-COOLING-311','EXT-COOLING-312',*[f'EXT-COOLING-{i}' for i in range(315,319)]]
targets=['EXT-FRONT-02','EXT-FRONT-03','EXT-FRONT-04','EXT-FRONT-06','EXT-FRONT-07','EXT-FRONT-01',
         'INT-TIMING-10',*[f'INT-PISTON-{n}' for n in [61,62,63,64]],'EXT-COOLING-03','EXT-COOLING-313']
running={}
for k in rot:
    if k not in pool:continue
    hits={n:0 for n in targets if n in pool}
    for i in range(24):
        t=tree(k,fw,math.tau*i/24)
        for n in hits:
            hits[n]=max(hits[n],len(t.overlap(pool[n][2])))
    running[k]=hits
    print('RUN',k,{k:v for k,v in hits.items() if v})
swrun={}
sw_behavior={'EXT-COOLING-35':'Flexible blades subject to intentional cam contact',
             'EXT-COOLING-36':'Shaft including seal contact','EXT-COOLING-41':'Pump gear',
             'EXT-COOLING-46':'Gear key'}
sw_target=['EXT-COOLING-04','EXT-COOLING-45','EXT-FLYWHEEL-01','EXT-FUEL-01','EXT-FUEL-15',
           'INT-TIMING-04',*[f'EXT-FUEL-{i:02d}' for i in range(10,40)]]
for k in sw_behavior:
    if k not in pool:continue
    hits={n:0 for n in sw_target if n in pool and n!=k}
    for i in range(24):
        t=tree(k,sw,math.tau*i/24)
        for n in hits:
            hits[n]=max(hits[n],len(t.overlap(pool[n][2])))
    swrun[k]=hits
    print('SW_RUNNING',k,{key:value for key,value in hits.items() if value})
report=dict(seawater_installed_24_pose_checks=swrun,asset_hashes=hashes,coordinate_order='glTF metres, Y up',freshwater_center=layout['VOLUTE'],physical_gear_pairs=contact,
            assembled_triangle_contacts=nearby,pump_sweep_24_poses=max(max(v.values()) for v in running.values()),by_rotor=running,
            limitations='The WET parts catalogue and service diagram identify direct gear drive. Tooth count, module, helix, exact installation Z and body profiles are model estimates. Triangle overlap includes intended seal, flange, shaft and key contacts; each pair must be interpreted by role.')
out=ROOT/'doc/drive-specialist/water-pumps'/('scratch-mesh-check.json' if scratch else 'canonical-mesh-check.json')
out.write_text(json.dumps(report,indent=2)+'\n')
