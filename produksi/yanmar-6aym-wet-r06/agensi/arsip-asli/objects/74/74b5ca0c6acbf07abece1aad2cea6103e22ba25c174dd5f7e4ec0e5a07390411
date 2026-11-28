"""Compose matched viewport comparisons for private owner review."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse

p=argparse.ArgumentParser()
p.add_argument('--after',default='qa/r06/browser',type=Path)
p.add_argument('--before',default='qa/r06/baseline',type=Path)
p.add_argument('--output',default='qa/r06',type=Path)
a=p.parse_args()
font_folder=Path('/usr/share/fonts/truetype/dejavu')
def font(size,bold=False):
    suffix='-Bold' if bold else ''
    return ImageFont.truetype(str(font_folder/f'DejaVuSans{suffix}.ttf'),size)

for device in ('desktop','hp'):
    maxwidth=770 if device=='desktop' else 370
    margin=22
    gap=20
    rows=[]
    for tag in ('operation-ready','starter-close'):
        two=[]
        for folder in (a.before,a.after):
            image=Image.open(folder/f'{device}-{tag}.png').convert('RGB')
            image=image.resize((maxwidth,round(image.height*maxwidth/image.width)),Image.Resampling.LANCZOS)
            two.append(image)
        rows.append(two)
    width=2*maxwidth+gap+2*margin
    height=sum(row[0].height for row in rows)+246
    sheet=Image.new('RGB',(width,height),'#1d2429')
    d=ImageDraw.Draw(sheet)
    title='Yanmar 6AYM-WET di desktop' if device=='desktop' else 'Yanmar 6AYM-WET di HP'
    d.text((margin,15),title,font=font(26,True),fill='white')
    d.text((margin,51),'Tampilan operasi dan starter dengan X-ray pada kamera yang dicocokkan',font=font(15),fill='#bfcccc')
    d.text((margin,86),'r05',font=font(20,True),fill='#d9dddd')
    d.text((margin+maxwidth+gap,86),'r06',font=font(20,True),fill='#79ead0')
    top=125
    for row,label in zip(rows,('Tombol Pengoperasian','Fokus starter · X-ray')):
        d.text((margin,top),label,font=font(17,True),fill='white')
        top+=31
        sheet.paste(row[0],(margin,top))
        sheet.paste(row[1],(margin+maxwidth+gap,top))
        top+=row[0].height+22
    d.text((margin,top-3),'Tangkapan Chromium dengan render WebGL. HP diuji lewat emulasi viewport.',font=font(13),fill='#b3c2c5')
    sheet.save(a.output/f'perbandingan-{device}.png',optimize=True)
