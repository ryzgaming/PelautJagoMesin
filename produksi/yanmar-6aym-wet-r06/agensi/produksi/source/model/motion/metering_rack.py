"""Common conjugate rack and pinion tooth system; installed tooth size is reconstructed."""
from math import cos, pi, radians, sin, tan
from pathlib import Path
import runpy
PITCH_RADIUS=.0175
TEETH=16
MODULE=2*PITCH_RADIUS/TEETH
PITCH=pi*MODULE
def rack_tooth():
    tip=PITCH_RADIUS-.80*MODULE
    trough=PITCH_RADIUS+1.165*MODULE
    def half_width(z):return .239*PITCH+(z-PITCH_RADIUS)*tan(radians(20))
    a,b=half_width(tip),half_width(trough)
    return [(-a,tip),(a,tip),(b,trough),(b,trough+.0014),(-b,trough+.0014),(-b,trough)]

def outline():
    gear=runpy.run_path(str(Path(__file__).resolve().parents[1]/'internal/gear_train.py'))
    return [(r,2*pi*k/TEETH+theta) for k in range(TEETH) for r,theta in gear['profile'](PITCH_RADIUS,TEETH)]

def build_pinion(api,x,y,z,mat):
    contour=outline()
    rings=[[(x+(r if outer else .01425)*sin(theta),y+dy,z+(r if outer else .01425)*cos(theta))
            for r,theta in contour] for dy,outer in [(-.0045,False),(-.0045,True),(.0045,True),(.0045,False)]]
    return api['polygon_loft'](rings,mat,0,True)

def build_teeth(api,x,y,z,mat):
    return [api['prism']([(x+(k+.5)*PITCH+dx,z+dz) for dx,dz in rack_tooth()],'y',y-.003,y+.003,mat,0)
            for k in range(-3,3)]
