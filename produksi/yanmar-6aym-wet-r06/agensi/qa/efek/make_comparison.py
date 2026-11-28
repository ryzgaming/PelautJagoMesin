from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path('/workspace/efek-review')
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda n:ImageFont.truetype(font,n)
for view in ['desktop','hp']:
 w=640 if view=='desktop' else 390;h=400 if view=='desktop' else 844
 out=Image.new('RGB',(w*2,70+4*(h+34)), '#12171c');d=ImageDraw.Draw(out)
 d.text((18,12),'SEBELUM',font=f(22),fill='#dfe7ec');d.text((w+18,12),'SESUDAH',font=f(22),fill='#70e0d2')
 d.text((18,43),'Kamera, sudut engkol, dan fase aliran sama',font=f(15),fill='#b0bfc7')
 for n,(deg,label) in enumerate([(-8,'Semburan injektor'),(8,'Puncak nyala'),(32,'Ekspansi'),(85,'Sisa panas')]):
  y=70+n*(h+34);d.text((18,y+5),f'{deg}° • {label}',font=f(17),fill='#dfe7ec')
  for i,folder in enumerate(['qa-sebelum-sama','qa-sesudah']):
   im=Image.open(root/folder/f'{view}-{deg}.png').convert('RGB');im=im.resize((w,h));out.paste(im,(i*w,y+34))
 out.save(root/f'perbandingan-{view}.png')
# Close-up crop of actual c1 burn chamber in matching desktop screenshots.
phase_labels=[(-8,'Semburan'),(8,'Puncak nyala'),(32,'Ekspansi'),(85,'Sisa panas')]
box=(448,215,582,386);tw,th=268,342
out=Image.new('RGB',(4*tw,2*th+100),'#12171c');d=ImageDraw.Draw(out)
for row,folder in enumerate(['qa-sebelum-sama','qa-sesudah']):
 y=35+row*(th+30);d.text((10,y-27),'SEBELUM' if row==0 else 'SESUDAH',font=f(20),fill='#dfe7ec')
 for col,(deg,label) in enumerate(phase_labels):
  im=Image.open(root/folder/f'desktop-{deg}.png').convert('RGB').crop(box).resize((tw,th));out.paste(im,(col*tw,y));d.text((col*tw+8,y+th-25),f'{deg}° • {label}',font=f(16),fill='#fff4cf')
out.save(root/'perbandingan-pembakaran.png')
