#!/usr/bin/env python3
"""Restore immutable historical production files from their SHA-256 objects."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser(description='Pulihkan salinan produksi asli ke folder baru.')
    parser.add_argument('revision', choices=['r01', 'r02', 'r03', 'r04', 'r05', 'r06'])
    parser.add_argument('--tujuan', type=Path)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'revisions' / (args.revision + '.json')).read_text())
    if not args.verify and args.tujuan is None:
        parser.error('Gunakan --tujuan folder-baru atau --verify.')
    if args.tujuan and args.tujuan.exists() and any(args.tujuan.iterdir()):
        parser.error('Folder tujuan harus baru atau kosong; arsip tidak menimpa pekerjaan.')
    destination = args.tujuan.resolve() if args.tujuan else None
    verified = set()
    for item in manifest['files']:
        source = ROOT / 'objects' / item['sha256'][:2] / item['sha256']
        if item['sha256'] not in verified:
            if digest(source) != item['sha256']:
                raise ValueError('Checksum objek tidak cocok: ' + item['path'])
            verified.add(item['sha256'])
        if destination:
            target = (destination / item['path']).resolve()
            if not target.is_relative_to(destination):
                raise ValueError('Path keluar folder tujuan')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    print(json.dumps({'revision': args.revision, 'files': len(manifest['files']),
                      'unique_objects_verified': len(verified), 'destination': str(destination)}, indent=2))

if __name__ == '__main__':
    main()
