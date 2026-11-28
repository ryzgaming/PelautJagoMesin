"""Installed geometry for the 180-tooth Ø630 mm flywheel and illustrative 10-tooth pinion."""
import json
from pathlib import Path
from math import sqrt,pi,atan2,cos,sin,asin
RING_TEETH=180
PINION_TEETH=10
FLYWHEEL_PITCH=.315
PINION_PITCH=FLYWHEEL_PITCH*PINION_TEETH/RING_TEETH
SHAFT_Y=.022
SHAFT_Z=sqrt((FLYWHEEL_PITCH+PINION_PITCH)**2-SHAFT_Y**2)
SOLENOID=(SHAFT_Y+.073,SHAFT_Z+.053)
ENGAGEMENT=-.026
PLANET_RAD=.0252
SUN_TEETH=12
PLANET_TEETH=12
INTERNAL_TEETH=36
FORK_TIP_RADIUS=.019
FORK_PIVOT_RADIUS=.069
START_LIMIT=-asin(-ENGAGEMENT/(FORK_PIVOT_RADIUS-FORK_TIP_RADIUS))
PLUNGER_TRAVEL=-(sqrt(.073**2+.053**2)-FORK_PIVOT_RADIUS)*sin(START_LIMIT)
ANGLE=atan2(SHAFT_Z,SHAFT_Y)
RING_FRACTION=(ANGLE/(2*pi/RING_TEETH))%1
PINION_PHASE=ANGLE+pi-(1.43-RING_FRACTION)*2*pi/PINION_TEETH
U=(.073/sqrt(.073**2+.053**2),.053/sqrt(.073**2+.053**2))
PIVOT=(-.034,SHAFT_Y+FORK_PIVOT_RADIUS*U[0],SHAFT_Z+FORK_PIVOT_RADIUS*U[1])
LEVER_AXIS=(0,-U[1],U[0])

def gear_mesh(api,axis_center,width,teeth,rpitch,inner,mat,phase=0,internal=False):
    x,y,z=axis_center
    crown=.00155 if teeth==10 else .00080
    depth=.00195 if teeth==10 else .00115
    shape=[(0,-depth),(.20,-depth),(.415,crown),(.505,crown),(.72,-depth)]
    conjugate=None
    if teeth==PINION_TEETH and abs(rpitch-PINION_PITCH)<1e-9:
        conjugate=json.loads(Path(__file__).with_name('pinion-profile.json').read_text())['radius_m']
        shape=[(j/len(conjugate),r-rpitch) for j,r in enumerate(conjugate)]
        phase=0
    loops=[]
    for xx,active in [(x-width/2,False),(x-width/2,True),(x+width/2,True),(x+width/2,False)]:
        loop=[]
        for k in range(teeth):
            for f,dr in shape:
                ang=phase+(k+f)*2*pi/teeth
                r=rpitch+(-dr if internal else dr) if active else inner
                loop.append((xx,y+r*cos(ang),z+r*sin(ang)))
        loops.append(loop)
    return api['polygon_loft'](loops,mat,0,True)
