#!/usr/bin/env python3
"""Verify frozen model assets, or the entire delivery against its inventory."""
from pathlib import Path
import argparse, hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1]
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(4*1024*1024),b''): h.update(block)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--all', action='store_true', help='Check all packaged files; UI changes intentionally make this baseline fail.')
 args=p.parse_args()
 if args.all:
  files=json.loads((ROOT/'MANIFEST-PAKET.json').read_text())['files']
 else:
  m=json.loads((ROOT/'model/manifest.json').read_text())
  files=[{'path':'model/'+name,'sha256':digest} for name,digest in m['integrity'].items()]
 errors=[]
 for item in files:
  target=ROOT/item['path']
  if not target.is_file() or sha(target)!=item['sha256']: errors.append(item['path'])
 print(json.dumps({'status':'FAIL' if errors else 'PASS','checked':len(files),'changed_or_missing':errors},indent=2))
 sys.exit(bool(errors))
if __name__=='__main__': main()
