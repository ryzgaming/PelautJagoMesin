"""Estimated installation constrained by the 6AYM-WET catalogue, service gear diagram and D03 elevations."""
from pathlib import Path
import runpy
spec=runpy.run_path(str(Path(__file__).with_name('water_drive_spec.py')))
TEETH=spec['FRESH_TEETH']
PITCH_RADIUS=spec['FRESH_RADIUS']
CAM_PITCH_RADIUS=spec['FRONT_CAM_RADIUS']
CAM_YZ=spec['CAM_CENTER_YZ']
PITCH_X,CY,CZ=spec['FRESH_GEAR']
VOLUTE = (1.505,CY,CZ)
OLD_VOLUTE = (1.410,.387,.293)
DELTA = tuple(b-a for a,b in zip(OLD_VOLUTE,VOLUTE))

def translated(p):
    return [round(x+d,9) for x,d in zip(p,DELTA)]

def update_flow(ports,routes,fair,smooth):
    """Fix both hose start planes and the actual pump internal passage in one operation."""
    src=ports['FW-pump-in']['point']=translated(ports['FW-pump-in']['point'])
    dst=ports['FW-pump-out']['point']=translated(ports['FW-pump-out']['point'])
    rows={row['id']:row for row in routes}
    rows['FW-pump']['points']=smooth([src,*[translated(p) for p in [(1.418,.481,.309),(1.410,.406,.322),(1.415,.415,.398)]],dst])
    port=ports['FW-oil-hx-in']['point']=[1.086,.355,.374]
    cooler=rows['FW-oil-cooler']
    cooler['points']=smooth([port,(1.033,.355,.374),(.917,.355,.382),(.693,.354,.382),
        (.641,.354,.382),(.402,.354,.382),(.292,.331,.373),ports['FW-oil-hx-out']['point']])
    # Follow the translated non-operation-side neck toward +Z and retain the shell-side
    # cooler inlet at x=1.086. Both end tangents are normal to their mating planes.
    rows['FW-pump-cooler']['points']=fair([dst,(dst[0],dst[1]+.017,dst[2]+.057),
        (1.508,.423,.243),(1.478,.436,.321),(1.418,.428,.391),(1.324,.402,.431),
        (1.223,.375,.432),(1.158,.355,.374),(1.113,.355,.374),port])
    source=ports['FW-hx-return']['point']
    rows['FW-return']['points']=fair([source,(1.502,.532,.157),(1.522,.493,.133),
        (1.546,.484,.076),(1.563,.499,.010),(1.558,.515,-.039),
        (src[0],.511,src[2]),(src[0],src[1]+.028,src[2]),src])
    for key in ('FW-return','FW-pump-cooler','FW-pump'):
        rows[key]['note']+=' R05 mengikuti port pompa yang diposisikan ulang terhadap gear cam depan. Koordinat rekonstruksi diperkirakan.'
