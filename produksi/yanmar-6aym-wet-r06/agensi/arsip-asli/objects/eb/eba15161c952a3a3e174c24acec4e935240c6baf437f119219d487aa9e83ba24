"""Overlay projected vertex silhouettes on readable GA. No perspective or nonuniform stretch."""
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

root, out = map(Path,sys.argv[1:])
data = np.load(out/'ga-projection.npz')
ga = Image.open(root/'foto/GA01.jpg').convert('RGB')
cases = {
    'kanan': {'crop': (231,223,445,387), 'axis': 0, 'scale': (384.0-290.6)/1.0, 'u_base': 290.6, 'u_ref_m': .209, 'direction':1, 'v_base':322.4, 'locator':'GA01 / center right-side elevation. No.1 leader x290.6, No.6 x384.0; crank horizontal y322.4.'},
    'depan': {'crop': (490,223,629,380), 'axis': 2, 'scale': (620.2-497.7)/1.305, 'u_base': 557.5, 'u_ref_m': 0, 'direction':-1, 'v_base':322.4, 'locator':'GA01 / right front projection. Crank center x557.5, y322.4; 1305 width limits x497.7..620.2.'},
}
report={}
up=4
for kind, p in cases.items():
    x0,y0,x1,y1=p['crop']
    img=ga.crop(p['crop']).resize(((x1-x0)*up,(y1-y0)*up),Image.Resampling.LANCZOS)
    pts=data['triangles']
    xx=(p['u_base']+p['scale']*p['direction']*(pts[:,:,p['axis']]-p['u_ref_m'])-x0)*up
    yy=(p['v_base']-p['scale']*pts[:,:,1]-y0)*up
    xy=np.rint(np.stack([xx,yy],axis=2)).astype(int)
    mask=Image.new('L',img.size)
    d=ImageDraw.Draw(mask)
    for tri in xy:
        d.polygon(list(map(tuple,tri)),fill=255)
    eroded=mask.filter(ImageFilter.MinFilter(7))
    edges=Image.fromarray(np.asarray(mask)-np.asarray(eroded))
    img.paste((210,10,10),(0,0,img.width,img.height),edges)
    canvas=Image.new('RGB',(img.width,img.height+35),'white')
    canvas.paste(img)
    ImageDraw.Draw(canvas).text((9,img.height+9),f'{kind} | merah: outline GLB | hitam: gambar GA01 | datum crank',fill='black')
    canvas.save(out/f'ga-overlay-{kind}.png')
    model_span=(float(xx.min()/up+x0),float(xx.max()/up+x0),float(yy.min()/up+y0),float(yy.max()/up+y0))
    report[kind]={**p,'projected_model_extrema_px':model_span,'pixel_denominator_m':1/p['scale']}
(out/'ga-overlay.json').write_text(json.dumps({'asset_sha256':str(data['sha256']), 'drawing':'GA01 B3-48660-4450, 2011-01-31, rating not printed', 'method':'Single isometric scale per view. Axes registered to crank centerline and drawing landmarks. Triangle masks projected orthographically, contours only. Interpret occluded/internal lines and line weight descriptively.', 'views':report},indent=2)+'\n')
