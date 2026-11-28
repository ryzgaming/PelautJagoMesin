"""Educational, indexed gear pairs in the Y-up engine datum. Tooth sizes are estimates."""
from pathlib import Path
import runpy
SPEC=runpy.run_path(str(Path(__file__).resolve().parents[1]/'motion'/'water_drive_spec.py'))
from math import acos, atan2, cos, hypot, pi, sin, sqrt, tan, tau, radians


def profile(radius, count):
    """Ordered radial involutes. Equal-module gears share a pressure angle and backlash."""
    module = 2 * radius / count
    pressure = radians(20)
    base = radius * cos(pressure)
    root, tip = radius - 1.20 * module, radius + .88 * module
    radii = [max(root, base) + (tip - max(root, base)) * i / 6 for i in range(7)]
    def flank(r):
        a = acos(min(1, base / r))
        return (.475 * pi / count + tan(pressure) - pressure - tan(a) + a)
    side = [(r, flank(r)) for r in radii]
    if root < base:
        side.insert(0, (root, flank(base)))
    return [(r, -f) for r, f in side] + [(r, f) for r, f in reversed(side)]


def index_angle(center_a, center_b, na, nb, phase_a):
    bearing = atan2(center_b[1]-center_a[1], center_b[0]-center_a[0])
    tooth_offset = (bearing - phase_a) * na / tau
    return (bearing + pi - (.5 - tooth_offset) * tau / nb) % (tau / nb)


def build(a):
    cam_yz = (a['CAM_Y'], a['CAM_Z'])
    pump_yz = SPEC['FIP_CENTER_YZ']
    rear_cam_radius = SPEC['FIP_RADIUS']
    d = hypot(*cam_yz)
    crank_radius=SPEC['CRANK_REAR_RADIUS']
    crank_idler=2*crank_radius
    h = (crank_idler**2 - (1.5*rear_cam_radius)**2 + d*d)/(2*d)
    k = sqrt(crank_idler**2 - h*h)
    idler = ((h*cam_yz[0]-k*cam_yz[1])/d,(h*cam_yz[1]+k*cam_yz[0])/d)
    positions = {1:(0.,0.),2:idler,3:idler,4:cam_yz,5:pump_yz,7:(-.150,0.),8:cam_yz,10:(.090755,-.289654)}
    # Physical crankshaft sign is applied separately by the motion driver.
    specs = {
        1:('Rear crankshaft timing gear',.023,crank_radius,SPEC['CRANK_REAR_TEETH'],.06412,1,1),
        2:('Compound idler gear B',.023,crank_radius,SPEC['IDLER_B_TEETH'],.028,-1,-1),
        3:('Compound idler gear A',.057,rear_cam_radius/2,SPEC['IDLER_A_TEETH'],.028,-1,-1),
        4:('Rear camshaft timing gear',.057,rear_cam_radius,SPEC['REAR_CAM_TEETH'],.02597,1,.5),
        5:('Injection pump driving gear',.057,rear_cam_radius,SPEC['FIP_TEETH'],.02497,-1,-.5),
        7:('Lubricating oil pump driving gear',.023,SPEC['OIL_GEAR_RADIUS'],SPEC['OIL_GEAR_TEETH'],.02205,-1,-SPEC['CRANK_REAR_TEETH']/SPEC['OIL_GEAR_TEETH']),
        8:('Front camshaft driving gear',1.354,SPEC['FRONT_CAM_RADIUS'],SPEC['FRONT_CAM_TEETH'],.02597,-1,.5),
        10:('Front alternator intermediate driving gear',1.354,SPEC['ALT_RADIUS'],SPEC['ALT_TEETH'],.01403,1,-SPEC['FRONT_CAM_TEETH']/2/SPEC['ALT_TEETH']),
    }
    phases = {1:0., 3:0., 8:0.}
    for driver, driven in [(1,2),(3,4),(4,5),(1,7),(8,10)]:
        phases[driven] = index_angle(positions[driver],positions[driven],specs[driver][3],specs[driven][3],phases[driver])
    def wheel(part,name,group,pivot,r,width,teeth,bore,hand,phase,parent=None):
        x,y,z=(0.,0.,0.) if parent else pivot
        section=profile(r,teeth)
        points=[(rad,phase + tau*i/teeth+angle) for i in range(teeth) for rad,angle in section]
        verts=[]
        for axial,outer in [(-width/2,False),(-width/2,True),(0,True),(width/2,True),(width/2,False)]:
            twist=hand*tan(radians(7))*axial/r if outer else 0.
            for rad,angle in points:
                angle+=twist
                rr=rad if outer else bore
                verts.append((x+axial,y+rr*cos(angle),z+rr*sin(angle)))
        n=len(points)
        faces=[]
        for j in range(5):
            for i in range(n):
                q=(i+1)%n; lo=j*n; hi=(j+1)%5*n
                faces.append((lo+i,lo+q,hi+q,hi+i))
        return a['make'](part,name,group,verts,faces,a['turned'],parent,(x,y,z),False,status='ESTIMATED',
            note='Profil involut, celah gigi, jumlah gigi dan sudut heliks adalah parameter model pendidikan. D01 PDF 111–112 mendasari hubungan penggerak.')
    for n,(name,x,r,teeth,bore,hand,ratio) in specs.items():
        y,z=positions[n]
        node=a['empty'](f'MOT-INT-GEAR-{n:02d}',(x,y,z),a['GROUPS']['TIMING'],(1,0,0))
        wheel(f'INT-TIMING-{n:02d}',name,'TIMING',(x,y,z),r,.024,teeth,bore,hand,phases[n],node)
        a['MOTION'][node.name].update(signed_crank_rotation_ratio=ratio,teeth_model=teeth,pitch_radius_m=r,tooth_phase_rad=phases[n])
    # Split compound hub sleeves occupy adjacent axial spans and revolve with the paired wheels.
    for n,idx,ax in [(11,2,.0255),(12,3,.0535)]:
        root=a['bpy'].data.objects[f'MOT-INT-GEAR-{idx:02d}']
        a['ring'](f'INT-TIMING-{n:02d}','Hub gear idler majemuk','TIMING',0,(ax-specs[idx][1],0.,0.),.0171,.028,.028,a['bronze'],root)
    a['cyl']('INT-TIMING-IDLER-PIN','Poros tumpu tetap gear idler majemuk','TIMING',0,(.0395,*idler),.017,.084,a['steel'],status='ESTIMATED',note='Pin tetap pada housing. Gear majemuk berputar pada sumbu ini. Fig.29.')
    drive=a['bpy'].data.objects['MOT-INT-GEAR-05']
    a['lathe']('INT-TIMING-FIP-SHAFT','Poros penggerak pompa injeksi','TIMING',0,(0.,0.,0.),
        [(-.014,.0248),(.021,.0248),(.023,.018),(.237,.018),(.244,.014),(.278,.014)],a['turned'],drive,closed=False,status='ESTIMATED',note='D05 Gbr.80 ref.3. Panjang dan penampang pada model merupakan perkiraan.')
    a['lathe']('INT-TIMING-FIP-COUPLING','Kopling penggerak ke nok pompa injeksi','TIMING',0,(0.,0.,0.),
        [(.244,.0142),(.244,.019),(.248,.025),(.258,.025),(.261,.016),(.319,.016),(.322,.025),(.332,.025),(.335,.0155),(.386,.0155),(.387,.0142),(.387,.0115),(.278,.0115),(.278,.0142)],a['steel'],drive,status='ESTIMATED',note='D05 Gbr.76 dan 80. Bentuk luar kopling merupakan rekonstruksi sederhana.')
    pump_centers=[(-.150,0.),(-.150,-.043)]
    for i,(y,z) in enumerate(pump_centers):
        angle=0. if i==0 else index_angle(pump_centers[0],pump_centers[1],14,14,0.)
        wheel(f'INT-OILPUMP-{3+i:02d}','Rotor roda gigi pompa oli','OILPUMP',(.09,y,z),.0215,.040,14,.00905,0,angle)


def seawater_wheel(api, center, bore):
    """Indexed to the injection pump. This reconstruction yields 1,572 rpm at 1,900 crank rpm."""
    pump = SPEC['FIP_CENTER_YZ']
    r = SPEC['SEA_RADIUS']
    count = SPEC['SEA_TEETH']
    import json
    data = json.loads((Path(__file__).parent/'kinematics.json').read_text())
    phase = index_angle(pump, (center[1],center[2]), SPEC['FIP_TEETH'], count, data['motion_roots']['MOT-INT-GEAR-05']['tooth_phase_rad'])
    pts=[(rad,tau*i/count + phase + angle) for i in range(count) for rad,angle in profile(r,count)]
    loops=[]
    for dx,outer in [(-.009,False),(-.009,True),(0,True),(.009,True),(.009,False)]:
        turn=dx*tan(radians(7))/r if outer else 0.
        loops.append([(center[0]+dx,center[1]+(rad if outer else bore)*cos(theta+turn),
                       center[2]+(rad if outer else bore)*sin(theta+turn)) for rad,theta in pts])
    return api['polygon_loft'](loops,api['steel'],0,True)
