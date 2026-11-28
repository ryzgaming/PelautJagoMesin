"""Lay out original QA renders without geometric changes or alignment distortion."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys

base,candidate,out=map(Path,sys.argv[1:])
imgs=[Image.open(p).convert('RGB') for p in (base,candidate)]
imgs=[p.resize((720,518),Image.Resampling.LANCZOS) for p in imgs]
plate=Image.new('RGB',(1496,658),(22,31,35))
pen=ImageDraw.Draw(plate)
font=Path('/usr/share/fonts/truetype/dejavu')
head=ImageFont.truetype(str(font/'DejaVuSans-Bold.ttf'),27)
tag=ImageFont.truetype(str(font/'DejaVuSans-Bold.ttf'),24)
small=ImageFont.truetype(str(font/'DejaVuSans.ttf'),17)
pen.text((24,13),'Sambungan pipa tekanan tinggi · Injektor silinder 3',font=head,fill=(239,249,245))
for i,(im,label) in enumerate(zip(imgs,('r03 · ujung berhenti sebelum holder','r04 · pipa masuk ke port holder'))):
    x=24+728*i
    pen.text((x,54),label,font=tag,fill=(136,233,202))
    plate.paste(im,(x,92))
pen.text((24,623),'GLB diimpor ulang, kamera sama. Kepala silinder disembunyikan untuk memperlihatkan sambungan.',font=small,fill=(217,229,225))
plate.save(out,quality=93,subsampling=0)
