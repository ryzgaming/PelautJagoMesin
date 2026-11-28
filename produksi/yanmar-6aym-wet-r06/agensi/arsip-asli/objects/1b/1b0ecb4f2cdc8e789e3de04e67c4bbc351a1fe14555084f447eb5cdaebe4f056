import contextlib,io,sys,json,math,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,'/tmp/yanmar-gearqa')
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import affinity
with contextlib.redirect_stdout(io.StringIO()):
 import audit_plunger as glb
R=Path(__file__).resolve().parents[2]
p=R/'model/exterior/exterior.glb';source_hash=hashlib.sha256(p.read_bytes()).hexdigest();j,b=glb.load(p);nodes=j['nodes'];by={n.get('name'):i for i,n in enumerate(nodes)};parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def projected(name):
 i=by[name];M=glb.local(nodes[i]);k=i
 while k in parents:k=parents[k];M=glb.local(nodes[k])@M
 polys=[];allv=[]
 for prim in j['meshes'][nodes[i]['mesh']]['primitives']:
  v=glb.acc(j,b,prim['attributes']['POSITION']);f=glb.acc(j,b,prim['indices']).ravel().reshape(-1,3);v=(M@np.c_[v,np.ones(len(v))].T).T[:,:3];allv.extend(v)
  for tri in v[f]:
   polygon=Polygon(np.round(tri[:,[0,2]],9))
   if polygon.area>1e-14:polys.append(polygon)
 shape=unary_union(polys);assert shape.is_valid
 return shape,np.array(allv)
rack,rv=projected('EXT-FUEL-22');s=501;travel=.005;radius=.0175;step=travel/(s-1);rows=[]
for i in range(6):
 name=f'EXT-FUEL-{330+i}';pin,v=projected(name);cx=.484+.079*i;cz=-.427;maximum_radius=float(np.linalg.norm(v[:,[0,2]]-[cx,cz],axis=1).max());mindistance=10;maxarea=0;worst=0
 for k in range(s):
  offset=k*step;moving_rack=affinity.translate(rack,xoff=offset);moving_pin=affinity.rotate(pin,-math.degrees(offset/radius),origin=(cx,cz));d=moving_rack.distance(moving_pin);a=moving_rack.intersection(moving_pin).area
  if d<mindistance:mindistance=d;worst=offset
  maxarea=max(maxarea,a)
 bound=step*(1+maximum_radius/radius)
 rows.append({'rack':'EXT-FUEL-22','pinion':name,'sample_count':s,'smallest_sampled_gap_m':mindistance,'maximum_projected_intersection_m2':maxarea,'worst_sample_travel_m':worst,'maximum_unsampled_relative_travel_m':bound,'measured_max_radius_m':maximum_radius,'continuous_separation_lower_bound_m':mindistance-bound-2e-7,'result':'SEPARATED' if mindistance>bound+2e-7 and maxarea==0 else 'UNRESOLVED'})
report={'asset_sha256':source_hash,'method':'Actual exported triangle XZ projections, union of nondegenerate triangles,500 intervals across rack travel0..5mm with conjugate pinion rotation travel/17.5mm. Disjoint projections prove solid separation irrespective of Y. Lineartranslation+rotation path covered by full interval max relativetravel bound;2e-7m numerical allowance. This audits prescribed law; actual browser matrices independently tested by QA.','parameter_source':'metering_rack.py PITCH_RADIUS17.5mm and functional-motion.js matching racktravel/radius','rows':rows}
(R/'doc/fuel-function-specialist/rack-export-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
