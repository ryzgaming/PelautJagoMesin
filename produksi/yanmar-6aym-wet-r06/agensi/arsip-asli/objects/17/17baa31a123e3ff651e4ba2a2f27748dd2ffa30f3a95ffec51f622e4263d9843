"""Build a matched-camera owner plate with room for measured clearance."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser()
parser.add_argument('baseline',type=Path)
parser.add_argument('final',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--gap-mm',type=float,required=True)
args=parser.parse_args()
panels=[Image.open(p).convert('RGB') for p in (args.baseline,args.final)]
assert panels[0].size==panels[1].size
width=1000
height=round(width/panels[0].width*panels[0].height)
image=Image.new('RGB',(width+48,height*2+238),'#eef3f3')
draw=ImageDraw.Draw(image)
fonts='/usr/share/fonts/truetype/dejavu/'
def font(size,bold=False):
    return ImageFont.truetype(fonts+('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),size)
def pin(position):
    x,y=position
    draw.ellipse((x-14,y-14,x+14,y+14), fill='#104644',outline='#ffffff',width=3)
    draw.line((x-5,y,x+5,y),fill='#ffffff',width=2)
    draw.line((x,y-5,x,y+5),fill='#ffffff',width=2)
def panel(img,top,title,status,state):
    draw.text((24,top),title,font=font(25,True),fill='#123637')
    draw.text((275,top+2),status,font=font(19),fill=state)
    img=img.resize((width,height),Image.Resampling.LANCZOS)
    image.paste(img,(24,top+37))
    a=(24+round(width*.445),top+37+round(height*.57))
    b=(24+round(width*.555),top+37+round(height*.592))
    for end,label,x,y in ((a,'Filter udara turbo',a[0]-210,a[1]+75),
                           (b,'Manifold gas buang',b[0]+48,b[1]+80)):
        tw=int(draw.textlength(label,font=font(19,True)))
        draw.line((end[0],end[1],x+8,y+18),fill='white',width=3)
        draw.rounded_rectangle((x,y,x+tw+22,y+37),radius=5,fill='#143738',outline='white',width=1)
        draw.text((x+11,y+7),label,font=font(19,True),fill='white')
        pin(end)

draw.text((24,18),'Pertemuan filter udara dan manifold buang',font=font(31,True),fill='#123637')
draw.text((24,60),'Yanmar 6AYM-WET · Model 3D diimpor ulang · Kamera sama untuk kedua revisi',font=font(18),fill='#416060')
panel(panels[0],104,'r04 sebelum','Kedua permukaan saling menembus','#923531')
gap=('{:.2f}'.format(args.gap_mm)).replace('.',',')
panel(panels[1],height+166,'r05 sesudah',f'Bebas perpotongan pada pose rakit · jarak permukaan {gap} mm','#175d57')
draw.text((24,height*2+210),'Jarak minimum antarmuka mesh model pada pose rakit. Dimensi pada mesin fisik belum diukur.',font=font(15),fill='#486465')
image.save(args.output,quality=94,optimize=True)
