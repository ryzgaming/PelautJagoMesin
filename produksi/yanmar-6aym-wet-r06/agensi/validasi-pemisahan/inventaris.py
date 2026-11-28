"""Byte identity mapping from an original private r06 worktree to a package."""
import argparse
import collections
from hashlib import sha256
import json
from pathlib import Path

arg=argparse.ArgumentParser()
arg.add_argument('source',type=Path)
arg.add_argument('package',type=Path)
arg.add_argument('output',type=Path)
args=arg.parse_args()
source,package=args.source.resolve(),args.package.resolve()
own_dir=(package/'agensi/validasi-pemisahan').resolve()
volatile_output={'inventaris.json','inventaris.log','LAPORAN.md','hasil.json'}
def digest(path):
    with path.open('rb') as stream:
        h=sha256()
        for block in iter(lambda:stream.read(2**20),b''):
            h.update(block)
        return h.hexdigest()
def files(root):
    for path in sorted(root.rglob('*')):
        if path.is_file() or path.is_symlink():
            yield path
def ignore(relative):
    parts=Path(relative).parts
    return '__pycache__' in parts or parts[-1]=='.DS_Store'
def bucket(name):
    return name.split('/')[0]
dest=collections.defaultdict(list)
dest_names=[]
unsafe_links=[]
for item in files(package):
    relative=item.relative_to(package).as_posix()
    if item.is_relative_to(own_dir) and relative.split('/')[-1] in volatile_output:
        continue
    if item.is_symlink():
        if not item.resolve().is_relative_to(package) or not item.exists():
            unsafe_links.append(relative)
        continue
    if ignore(relative):
        continue
    dest_hash=digest(item)
    dest[dest_hash].append(relative)
    dest_names.append((relative,dest_hash,item.stat().st_size))
source_rows=[]
source_by_hash=collections.defaultdict(list)
for item in files(source):
    relative=item.relative_to(source).as_posix()
    row={'asal':relative,'kelompok':bucket(relative)}
    if ignore(relative):
        source_rows.append(row|{'status':'CACHE_OR_PREVIEW','destinations':[]})
        continue
    if item.is_symlink():
        source_rows.append(row|{'status':'SYMLINK_ORIGINAL','destinations':[]})
        continue
    sha=digest(item)
    source_by_hash[sha].append(relative)
    matched=dest.get(sha,[])
    source_rows.append(row|{'status':'IDENTIK' if matched else 'BELUM_COCOK',
                            'bytes':item.stat().st_size,'sha256':sha,'destinations':matched})
package_rows=[{'path':name,'bytes':size,'sha256':sha,'originals':source_by_hash[sha]}
              for name,sha,size in dest_names]
by_top=collections.defaultdict(collections.Counter)
for row in source_rows:
    by_top[row['kelompok']][row['status']]+=1
indexed_path={name:(sha,size) for name,sha,size in dest_names}
archive=package/'agensi/arsip-asli'
archive_rows=[]
archive_errors=[]
archive_r06={}
for manifest in sorted((archive/'revisions').glob('*.json')):
    payload=json.loads(manifest.read_text())
    files_in_manifest=payload['files']
    seen=set()
    checked_objects=0
    for row in files_in_manifest:
        relative=Path(row['path'])
        sha=row['sha256']
        object_path=f'agensi/arsip-asli/objects/{sha[:2]}/{sha}'
        if relative.is_absolute() or '..' in relative.parts or row['path'] in seen:
            archive_errors.append([manifest.name,row['path'],'unsafe_or_duplicate_path'])
        seen.add(row['path'])
        if indexed_path.get(object_path)!=(sha,row['size']):
            archive_errors.append([manifest.name,row['path'],'missing_or_wrong_object'])
        else:
            checked_objects+=1
        if manifest.stem=='r06':
            archive_r06[row['path']]=(sha,row['size'])
    if len(files_in_manifest)!=payload['fileCount']:
        archive_errors.append([manifest.name,'','file_count_mismatch'])
    archive_rows.append({'revision':manifest.stem,'paths':len(files_in_manifest),
                         'paths_with_valid_object':checked_objects,'excluded':len(payload['excluded'])})
original_r06={row['asal']:(row['sha256'],row['bytes']) for row in source_rows if 'sha256' in row}
r06_manifest_paths_exact=original_r06==archive_r06
output={'audit_outputs_excluded_from_package_file_index':sorted(volatile_output),'archive_revision_validation':archive_rows,'archive_errors':archive_errors,
        'r06_archive_paths_and_digests_match_original':r06_manifest_paths_exact,
        'counts_by_source_folder':dict(by_top),'source_files':len(source_rows),
        'package_files':len(package_rows),'unsafe_symlinks':unsafe_links,
        'origine_to_package':source_rows,'package_to_origine':package_rows}
args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'counts':dict(by_top),'source_files':len(source_rows),
                  'package_files':len(package_rows),'unsafe_symlinks':unsafe_links,
                  'archive_validation':archive_rows,'archive_error_count':len(archive_errors),
                  'r06_manifest_exact':r06_manifest_paths_exact},ensure_ascii=False))
