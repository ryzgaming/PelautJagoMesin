"""Contact between the polygonal pump cam, the guided 9 mm roller and the feed eccentric."""
import math
def roller_clearance(phi,index):
    radius=.009
    section=[]
    for k in range(48):
        t=k*math.tau/48
        r=.022+.010*max(0,math.cos(t+index*math.pi/3))**2.5
        angle=t+phi*.5
        section.append((r*math.cos(angle),r*math.sin(angle)))
    heights=[]
    for (a,b),(c,d) in zip(section,section[1:]+section[:1]):
        if abs(b)<=radius:heights.append(a+math.sqrt(max(0,radius**2-b**2)))
        dy,dz=c-a,d-b
        length=math.hypot(dy,dz)
        ny,nz=dz/length,-dy/length
        if ny<=0 or abs(dz)<1e-12:continue
        t=(-radius*nz-b)/dz
        if 0<=t<=1:heights.append(a+dy*t+radius*ny)
    return max(heights)-radius

def feed_lift(phi):
    # Positive displacement into the outboard feed piston. Axis of piston remains fixed.
    angle=phi*.5
    r=.0185+.005
    e=.0024
    relative=e*math.cos(angle)-math.sqrt(r*r-(e*math.sin(angle))**2)
    return (e-r)-relative
