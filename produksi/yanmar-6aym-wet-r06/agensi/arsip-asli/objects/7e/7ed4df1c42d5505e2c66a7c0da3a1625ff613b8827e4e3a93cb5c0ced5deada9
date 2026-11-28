"""Import final GLBs. Verify tooth size, indexing, mutual clearance and numerical shaft speeds."""
import bpy
import hashlib
import json
import math
import runpy
import sys
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parents[2]
motion=json.loads((root/'model/internal/kinematics.json').read_text())['motion_roots']
spec=runpy.run_path(str(root/'model/motion/water_drive_spec.py'))
with_pumps='--sea' in sys.argv or '--water' in sys.argv
assets=['internal','exterior'] if with_pumps else ['internal']
bpy.ops.wm.read_factory_settings(use_empty=True)
for layer in assets:
    bpy.ops.import_scene.gltf(filepath=str(root/f'model/{layer}/{layer}.glb'))
objects={o.name:o for o in bpy.context.scene.objects if o.type=='MESH'}
def timing(i):return f'INT-TIMING-{i:02d}'
wheels={}
for i in (1,2,3,4,5,7,8,10):
    node=motion[f'MOT-INT-GEAR-{i:02d}']
    wheels[timing(i)]=(node['rest_translation_m'],node['teeth_model'],node['pitch_radius_m'])
pairs=[(timing(a),timing(b)) for a,b in [(1,2),(3,4),(4,5),(1,7),(8,10)]]
wheels['INT-OILPUMP-03']=((.090,-.150,0),14,.0215)
wheels['INT-OILPUMP-04']=((.090,-.150,-.043),14,.0215)
pairs.append(('INT-OILPUMP-03','INT-OILPUMP-04'))
if with_pumps:
    wheels['EXT-COOLING-26']=(spec['FRESH_GEAR'],spec['FRESH_TEETH'],spec['FRESH_RADIUS'])
    wheels['EXT-COOLING-41']=(spec['SEA_GEAR'],spec['SEA_TEETH'],spec['SEA_RADIUS'])
    pairs.extend([(timing(8),'EXT-COOLING-26'),(timing(5),'EXT-COOLING-41')])
def world(p):return Vector((p[0],-p[2],p[1]))
geom={}
od={}
for name,(center,count,radius) in wheels.items():
    ob=objects[name]
    ob.data.calc_loop_triangles()
    verts=[ob.matrix_world@v.co for v in ob.data.vertices]
    tri=[tuple(t.vertices) for t in ob.data.loop_triangles if t.area>1e-13]
    pivot=world(center)
    actual=max(math.hypot(p.y-pivot.y,p.z-pivot.z) for p in verts)
    expected=radius+.88*2*radius/count
    od[name]=dict(teeth_model=count,pitch_radius_mm=radius*1000,tip_radius_mm=actual*1000,
                  expected_tip_radius_mm=expected*1000,tip_error_mm=abs(actual-expected)*1000)
    geom[name]=(verts,tri,pivot)
def pose(name,angle):
    pts,tris,pivot=geom[name]
    mat=Matrix.Rotation(angle,3,'X')
    posed=[pivot+mat@(p-pivot) for p in pts]
    return posed,BVHTree.FromPolygons(posed,tris,all_triangles=True)
def distance_candidates(name,other):
    pts,_,p=geom[name]
    q=geom[other][2]
    r=wheels[name][2]
    radius_other=wheels[other][2]
    # Angular margin includes the full displacement across one tooth period.
    sector=radius_other+.04+r*math.tau/wheels[name][1]
    return [k for k,v in enumerate(pts) if (v-q).length<sector and math.hypot(v.y-p.y,v.z-p.z)>r*.68]
result={}
for a,b in pairs:
    ca,na,ra=wheels[a];cb,nb,rb=wheels[b]
    driver_sector=distance_candidates(a,b)
    driven_sector=distance_candidates(b,a)
    crosses=[];gaps=[]
    for i in range(33):
        phi=math.tau*i/32
        va,ta=pose(a,phi/na)
        vb,tb=pose(b,-phi/nb)
        crosses.append(len(ta.overlap(tb)))
        gaps.append(1000*min(min(tb.find_nearest(va[k])[3] for k in driver_sector),
                             min(ta.find_nearest(vb[k])[3] for k in driven_sector)))
    axis_error=abs(math.dist(ca[1:],cb[1:])-(ra+rb))*1000
    axial=abs(ca[0]-cb[0])*1000
    # A zero-crossing pair alone would incorrectly pass a hub-only or absent tooth rim.
    okay=(max(crosses)==0 and max(gaps)<1.2 and axial<.01 and axis_error<.025
          and max(od[a]['tip_error_mm'],od[b]['tip_error_mm'])<.15)
    result[a+'/'+b]=dict(samples=33,max_crossings=max(crosses),crossings=sum(crosses),counts=crosses,
        minimum_flank_separation_mm=min(gaps),maximum_flank_separation_mm=max(gaps),
        per_pose_nearest_flank_mm=gaps,axial_plane_error_mm=axial,pitch_center_distance_error_mm=axis_error,passed=okay)
rates={}
for fluid,teeth_a,teeth_b,manual in [('freshwater',spec['FRONT_CAM_TEETH'],spec['FRESH_TEETH'],2533),
                                     ('seawater',spec['FIP_TEETH'],spec['SEA_TEETH'],1572)]:
    actual=1900*.5*teeth_a/teeth_b
    rates[fluid]=dict(manual_test_crank_rpm=1900,manual_pump_rpm=manual,model_pump_rpm=actual,
                      matched_reported_integer_rpm=round(actual)==manual)
data=dict(glb_sha256={n:hashlib.sha256((root/f'model/{n}/{n}.glb').read_bytes()).hexdigest() for n in assets},
          pairs=result,actual_wheel_size=od,pump_speed_checks=rates,
          method='33 evenly spaced samples over one full tooth period. Triangle overlap test measures tooth interference. Bidirectional nearest flank distances and OD measurements reject spurious passes when a gear or its teeth are absent.',
          tolerances={'maximum_nearest_flank_mm':1.2,'maximum_radius_error_mm':.15,'maximum_axis_distance_error_mm':.025,'maximum_axial_offset_mm':.010},
          passed=all(row['passed'] for row in result.values()) and all(x['matched_reported_integer_rpm'] for x in rates.values()))
(root/'qa/r05'/('gear-mesh-release.json' if with_pumps else 'gear-mesh-internal.json')).write_text(json.dumps(data,indent=2)+'\n')
print('GEAR_CHECK',json.dumps({k:[v['max_crossings'],round(v['maximum_flank_separation_mm'],4),v['passed']] for k,v in result.items()}))
if not data['passed']:raise RuntimeError('GEAR_CHECK failed: see the per-pair clearance and OD values.')
