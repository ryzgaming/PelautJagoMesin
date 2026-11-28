"""Cross-sections and angular support checks against actually imported geometry, in metres."""
from pathlib import Path
import hashlib,json,math,bpy
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
asset=root/'model/internal/internal.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(asset));bpy.context.view_layer.update()
config=json.loads((root/'model/internal/kinematics.json').read_text())
M=lambda n: bpy.data.objects[n]
def xyz(n):
    ob=M(n);return [(w.x,w.z,-w.y) for v in ob.data.vertices for w in [ob.matrix_world@v.co]]
results={}
for i,cx in enumerate(config['cylinder_center_x_m'],1):
    liner=xyz(f'INT-LINER-{i*10+1:02d}')
    bore_corner=min(math.hypot(x-cx,z) for x,y,z in liner)
    inradius=bore_corner*math.cos(math.pi/180)
    for child in [2,6,7,8,9]:
        name=f'INT-PISTON-{i*10+child:02d}'
        rad=max(math.hypot(x-cx,z) for x,y,z in xyz(name))
        results[name]={'minimum_liner_bore_inradius_mm':inradius*1000,'part_max_radial_mm':rad*1000,'radial_margin_mm':(inradius-rad)*1000}
assert min(x['radial_margin_mm'] for x in results.values())>0
valves={}
for v in config['valve_train']:
    i=v['cylinder'];j=int(v['kind']=='Exhaust')
    cid=f'INT-CAM-{i*10+j+2:02d}';fid=f'INT-CAM-{i*10+j+4:02d}'
    pts={(round(y-.158,8),round(z+.150,8)) for x,y,z in xyz(cid)}
    closed_foot_y=min(y for x,y,z in xyz(fid))-v['initial_lift_m']*v['pushrod_ratio']
    gaps=[]
    for sample in range(1441):
        theta=sample/2;angle=math.radians(-theta/2)
        cc,ss=math.cos(angle),math.sin(angle)
        top=.158+max(cc*y-ss*z for y,z in pts)
        d=(theta-v['lift_center_deg']+360)%720-360
        h=v['half_window_deg']
        lift=v['lift_max_m']*math.cos(math.pi*d/(2*h))**2 if abs(d)<h else 0
        gaps.append((closed_foot_y+v['pushrod_ratio']*lift-top)*1000)
    valves[cid]={'samples':len(gaps),'minimum_tappet_to_cam_support_gap_mm':min(gaps),'maximum_tappet_to_cam_support_gap_mm':max(gaps)}
assert min(r['minimum_tappet_to_cam_support_gap_mm'] for r in valves.values())>0
out=dict(sha256=hashlib.sha256(asset.read_bytes()).hexdigest(),liner_pin_and_retainer_envelopes=results,
         cam_tappet_samples=valves,method='Liner circular envelope vs measured maximum vertex radius; cam support height vs horizontal follower sole through 720 crank degrees in 0.5-degree steps. Gaps are model values.')
(root/'qa/r05/internal-drive-clearance.json').write_text(json.dumps(out,indent=2)+'\n')
print('minimum radial margin mm',min(r['radial_margin_mm'] for r in results.values()),'minimum cam/tappet model gap mm',min(r['minimum_tappet_to_cam_support_gap_mm'] for r in valves.values()))
