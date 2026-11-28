"""Regenerate the representative pinion flank from the existing 180T flywheel profile.
Optional offline authoring tool. Requires NumPy and Shapely; normal Blender builds use the saved profile.
"""
import json,math
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
here=Path(__file__).resolve().parent
import starter
shape=[(0,.3117),(.12,.3117),(.34,.316),(.59,.316),(.82,.3117)]
fly=np.array([(r*math.cos(2*math.pi*(i+t)/180),r*math.sin(2*math.pi*(i+t)/180)) for i in range(180) for t,r in shape])
p=np.array([starter.SHAFT_Y,starter.SHAFT_Z]);pitch=starter.PINION_PITCH
blank=Point(0,0).buffer(pitch+.0027,quad_segs=360)
def mat(a):
 return np.array([[math.cos(a),math.sin(a)],[-math.sin(a),math.cos(a)]])
clips=[]
for a in np.linspace(0,math.radians(20),1801):
 pts=(fly@mat(-a)-p)@mat(-18*a)
 geom=Polygon(pts).buffer(.00010,quad_segs=2).intersection(blank)
 if not geom.is_empty:clips.append(geom)
allowed=blank.difference(unary_union(clips))
N=96
samples=[]
for j in range(N):
 t=2*math.pi*j/(10*N)
 ray=LineString([(0,0),(.022*math.cos(t),.022*math.sin(t))])
 samples.append(round(allowed.intersection(ray).length,8))
(here/'pinion-profile.json').write_text(json.dumps({'source':'Educative conjugate mesh to the modeled D01 180-tooth ring, sampled from the swept tooth flank with 0.10 mm running envelope. Not OEM cutting data.','radius_m':samples},separators=(',',':'))+'\n')
print('pinion envelope',min(samples),max(samples))
