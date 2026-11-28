"""Lay out private source crops and camera-matched render comparisons."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--baseline-only', action='store_true')
args = parser.parse_args()
out = Path(__file__).resolve().parent
root = out.parent.parent
photo_crops = {
    'P07': ((74, 540, 1094, 1136), (345, 734, 924, 963)),
    'P08': ((27, 423, 1062, 1135), (294, 622, 928, 938)),
}
render_crops = {
    'P07': ((44, 52, 798, 458), (221, 181, 659, 368)),
    'P08': ((56, 57, 786, 488), (229, 214, 685, 391)),
}
font_dir = Path('/usr/share/fonts/truetype/dejavu')
title_font = ImageFont.truetype(str(font_dir / 'DejaVuSans-Bold.ttf'), 25)
label_font = ImageFont.truetype(str(font_dir / 'DejaVuSans.ttf'), 16)
bg = '#202326'
panel = '#30353a'

def tile(image, box, x, y, width, height):
    image = image.crop(box).convert('RGBA')
    image = ImageOps.contain(image, (width, height), Image.Resampling.LANCZOS)
    plate.paste(image, (x + (width - image.width)//2, y + (height - image.height)//2), image)

for name, labels in (
    ('P07', 'Sisi kiri / operation · pandangan hampir tegak lurus'),
    ('P08', 'Sisi kiri / operation · dari arah depan / damper, sedikit dari atas'),
):
    entries = [
        ('Foto AAM Equipment · ' + name, root / 'foto' / f'{name}.jpg', photo_crops[name]),
        ('r01 · eksterior GLB', out / f'r01-{name}.png', render_crops[name]),
    ]
    if not args.baseline_only:
        entries.append(('r02 · eksterior GLB', out / f'r02-{name}.png', render_crops[name]))
    plate = Image.new('RGB', (610 * len(entries) + 20, 790), bg)
    draw = ImageDraw.Draw(plate)
    draw.text((16, 13), name + '  ' + labels, fill='white', font=title_font)
    draw.text((16, 49), 'Foto perspektif; sudut render diperkirakan dari landmark. Penyangga pengiriman membatasi pembandingan area sump.', fill='#ccd4da', font=label_font)
    for column, (label, path, boxes) in enumerate(entries):
        x = 10 + 610 * column
        draw.text((x + 8, 80), label, fill='white', font=label_font)
        draw.rectangle((x, 108, x + 599, 456), fill=panel)
        draw.rectangle((x, 492, x + 599, 772), fill=panel)
        with Image.open(path) as image:
            tile(image, boxes[0], x + 5, 114, 590, 334)
            tile(image, boxes[1], x + 5, 496, 590, 270)
    draw.text((16, 465), 'Pembesaran sisi operasi · governor, injection pump, jalur tekanan tinggi, dan filter', fill='#ccd4da', font=label_font)
    destination = out / (f'{name}-baseline.jpg' if args.baseline_only else f'{name}-comparison.jpg')
    plate.save(destination, quality=94, subsampling=0)
