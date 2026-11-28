"""World-space centres of the selected single-groove WET alternator drive."""
from math import atan2,acos,cos,hypot,pi,sin
FRONT_GEAR_X=1.354
PULLEY_X=1.453
DRIVER=(.090755,-.289654)
ALTERNATOR=(.275,-.340)
RADII=(.063,.053)
def loop():
    a,b=DRIVER,ALTERNATOR
    ra,rb=RADII
    dy,dz=b[0]-a[0],b[1]-a[1]
    base=atan2(dz,dy)
    half=acos((ra-rb)/hypot(dy,dz))
    ang0,ang1=base-half,base+half
    def polar(c,r,t):return [PULLEY_X,c[0]+r*cos(t),c[1]+r*sin(t)]
    pts=[polar(a,ra,ang0)]
    # Linear straight spans and smooth positive-X wraps at both sheaves.
    pts.extend(polar(b,rb,ang0+(ang1-ang0)*k/80) for k in range(81))
    pts.extend(polar(a,ra,ang1+(ang0+2*pi-ang1)*k/88) for k in range(89))
    pts[-1]=pts[0].copy()
    return pts
