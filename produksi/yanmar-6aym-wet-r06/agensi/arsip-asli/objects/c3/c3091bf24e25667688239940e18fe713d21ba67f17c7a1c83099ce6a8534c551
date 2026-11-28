"""Encode the browser's recorded frames, preserving scaled relative timing."""
import argparse
import json
from pathlib import Path
import subprocess

p=argparse.ArgumentParser()
p.add_argument('frames',type=Path)
p.add_argument('output',type=Path)
p.add_argument('--duration',type=float,default=27)
a=p.parse_args()
frames=json.loads((a.frames/'timeline.json').read_text())
assert len(frames)>=8
duration=frames[-1]['timestamp']-frames[0]['timestamp']
scale=min(1,a.duration/duration)
lines=[]
for current,nxt in zip(frames,frames[1:]):
    original=nxt['timestamp']-current['timestamp']
    adjusted=max(.032,min(original*scale,1))
    lines.extend([f"file '{(a.frames/current['file']).resolve()}'",f"duration {adjusted:.4f}"])
lines.append(f"file '{(a.frames/frames[-1]['file']).resolve()}'")
concat=a.frames/'frames.txt'
concat.write_text('\n'.join(lines)+'\n')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),
 '-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=24','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',
 str(a.output)],check=True)
print(json.dumps({'source_frames':len(frames),'original_wall_seconds':duration,'timeline_scale':scale,'recorded_audio':False}))
