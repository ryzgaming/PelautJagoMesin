"""Educational angular cam profile between the existing inlet and discharge ports."""
from math import atan2, cos, sin, pi
CAM_ANGLE=-1.08
CAM_HALF_WIDTH=.60
TIP_RADIUS=.084
HUB_RADIUS=.031
BEND=.30
EXTRA_BEND=.12
SHORTEN=.005
def envelope(angle):
    offset=atan2(sin(angle-CAM_ANGLE),cos(angle-CAM_ANGLE))
    return cos(pi*offset/(2*CAM_HALF_WIDTH))**2 if abs(offset)<CAM_HALF_WIDTH else 0.

def contact(angle):
    # The blade tip moves tangentially as it folds. Iterate on the actual tip
    # angle so that the compression remains tied to a stationary pump cam.
    compression=0.
    for _ in range(14):
        compression=envelope(angle+BEND+EXTRA_BEND*compression)
    return compression

def shape_keys(api, ob, center):
    ob.shape_key_add(name='Basis')
    basis=[v.co.copy() for v in ob.data.vertices]
    matrix=ob.matrix_world.copy()
    inv=matrix.inverted()
    keys=[]
    for i in range(10):
        key=ob.shape_key_add(name=f'VANE_{i+1:02d}')
        key.value=contact(i*2*pi/10)
        keys.append(key)
    for idx,local in enumerate(basis):
        p=matrix@local
        y,z=p.z-center.y,-p.y-center.z
        radius=(y*y+z*z)**.5
        if radius<=HUB_RADIUS:continue
        u=min(1,(radius-HUB_RADIUS)/(TIP_RADIUS-HUB_RADIUS))
        theta=atan2(z,y)
        vane=round((theta-BEND*u*u)*10/(2*pi))%10
        key=keys[vane]
        end=theta+EXTRA_BEND*u*u
        compressed=radius-SHORTEN*u*u
        new=api['world']((p.x,center.y+compressed*cos(end),center.z+compressed*sin(end)))
        key.data[idx].co=inv@new

def cam(api,center,radius):
    rings=[]
    for j in range(49):
        angle=CAM_ANGLE+CAM_HALF_WIDTH*(j/24-1)
        w=envelope(angle)
        limit=TIP_RADIUS+.00065-SHORTEN*w+.0024*(1-w)
        rings.append([(center.x+x,center.y+r*cos(angle),center.z+r*sin(angle)) for x,r in
                      ((-.020,limit),(-.020,radius),(.020,radius),(.020,limit))])
    return api['polygon_loft'](rings,api['cast'],0)
