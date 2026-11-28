"""Cut r04 model entry ports before intersecting casting detail is joined."""
import json
import runpy

def head_drill(api):
    directory=api['OUT']
    flow=json.loads((directory.parent/'flow/fuel-gas.json').read_text())
    lines={route['id']:route['points'] for route in flow['routes']}
    tube=runpy.run_path(str(directory/'specialists/piping.py'))['tube']
    def drill(index,negative_pieces):
        start=lines[f'hp-pipe-{index}'][-4:-1]
        receiver=lines[f'hp-head-{index}'][:20]
        for piece in negative_pieces:
            tip=tube(api,start+receiver,.0072,api['steel'])
            api['subtract'](piece,tip)
    return drill

def axial_port(api,pieces,start,end,radius):
    bounds=api['Vector'](end)-api['Vector'](start)
    p=(api['Vector'](start)+api['Vector'](end))*.5
    for piece in pieces:
        api['subtract'](piece,api['cylinder'](p,bounds,radius,bounds.length,api['steel'],40,0))
        api['clean_boolean'](piece)



def cold_elbow_relief(api,pieces):
    import bmesh
    from math import cos,pi,sin
    directory=api['OUT']
    graph=json.loads((directory.parent/'flow/fuel-gas.json').read_text())
    route=next(entry for entry in graph['routes'] if entry['id']=='cold-air-elbow')
    V=api['Vector']
    original=route['points']
    pts=list(map(V,[*original[::5],original[-1]]))
    if pts[-1]==pts[-2]:
        pts.pop()
    radius=route['radius_m']+.0045

    # Each cut is a convex capsule. A single tool swept along this short
    # elbow would fold over itself at the inner radius.
    def capsule(a,b):
        bm=bmesh.new()
        verts=[bm.verts.new(p+radius*V((cos(lat)*cos(az),sin(lat),cos(lat)*sin(az))))
               for p in (a,b) for lat in [k*pi/12 for k in range(-5,6)]
               for az in [j*pi/9 for j in range(18)]]
        verts.extend(bm.verts.new(p+sign*radius*V((0,1,0))) for p in (a,b) for sign in (-1,1))
        hull=bmesh.ops.convex_hull(bm,input=verts,use_existing_faces=False)
        dead=[ele for ele in hull['geom_interior'] if isinstance(ele,bmesh.types.BMVert)]
        if dead:
            bmesh.ops.delete(bm,geom=dead,context='VERTS')
        bm.verts.index_update()
        coords=[v.co.copy() for v in bm.verts]
        faces=[tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        return api['mesh'](coords,faces,api['cast'])

    for piece in pieces:
        api['bpy'].context.view_layer.update()
        bounds=[piece.matrix_world@api['Vector'](corner) for corner in piece.bound_box]
        for a,b in zip(pts,pts[1:]):
            bl=api['world'](a)
            br=api['world'](b)
            if any(max(p[i] for p in bounds)<min(bl[i],br[i])-radius or
                   min(p[i] for p in bounds)>max(bl[i],br[i])+radius for i in range(3)):
                continue
            api['subtract'](piece,capsule(a,b))
            if not piece.data.polygons:
                raise ValueError('Cold elbow clearance erased a structural casting')
        api['clean_boolean'](piece)
