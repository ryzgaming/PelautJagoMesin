"""Copy all available canonical reference trees and record exact provenance.
No network or package installation. This script belongs to the delivery tooling.
"""
from pathlib import Path
import hashlib,json,shutil,re,os
ROOT=Path('/workspace/private-production/yanmar-6aym-wet-r06')
OUT=Path(__file__).resolve().parent
MAPPING={'doc':'dokumen','foto':'foto','video':'video'}
manifest=[];blocked=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for src_name,dst_name in MAPPING.items():
 src=ROOT/src_name;dst=OUT/dst_name
 for f in sorted(src.rglob('*')):
  rel=f.relative_to(src);target=dst/rel
  if f.is_dir():target.mkdir(parents=True,exist_ok=True);continue
  if not f.is_file():raise RuntimeError(f'Unsupported reference entry: {f}')
  if f.is_symlink():raise RuntimeError(f'Symlink needs explicit review: {f}')
  if any(x=='.git' or x=='.env' or x.startswith('.env.') or x in ('browser-profile','chrome-profile') for x in rel.parts):
   blocked.append({'source':str(f),'reason':'credential/environment/profile artifact'});continue
  target.parent.mkdir(parents=True,exist_ok=True)
  before=digest(f);shutil.copy2(f,target);after=digest(f)
  if before!=after or digest(target)!=after:raise RuntimeError(f'Changed during collection: {f}')
  manifest.append({'source':str(f),'path':str(target.relative_to(OUT)),'bytes':target.stat().st_size,'sha256':after,'origin_tree':src_name})
# Source statements are attributed to their own existing registry, not silently promoted.
source_entries=[]
urlpat=re.compile(r'https?://[^\s<>"\]\)]+')
def walk(o,pointer,registry):
 if isinstance(o,dict):
  url=o.get('url') or o.get('source_url') or o.get('primary_page')
  if isinstance(url,str) and url.startswith(('http://','https://')):
   access=o.get('access') or o.get('evidence_status') or o.get('visual_status') or o.get('status') or 'UNVERIFIED'
   if access in ('sampled_frames_viewed','pdf_pages_viewed'):status='OBSERVED'
   elif access in ('metadata_only','indexed_metadata','curriculum_link_only'):status='METADATA_ONLY'
   elif access in ('web_text','indexed_primary_text','DOCUMENTED'):status='DOCUMENTED_TEXT'
   elif access in ('unavailable','UNVERIFIED'):status='UNVERIFIED'
   else:status='SEE_ORIGINAL_REGISTRY'
   keys=['id','title','publisher','author','channel','model','variant','machine_model','scope','access','evidence_status','visual_status','status','locators','pages_viewed','printed_pages','frames_seconds','timestamp_range_reviewed','limitations','file','video_file','evidence','sha256']
   source_entries.append({'registry':registry,'json_pointer':pointer,'url':url,'normalized_access_status':status,'original_fields':{k:o[k] for k in keys if k in o}})
  for k,v in o.items():walk(v,pointer+'/'+str(k),registry)
 elif isinstance(o,list):
  for i,v in enumerate(o):walk(v,pointer+'/'+str(i),registry)
for m in manifest:
 f=OUT/m['path']
 if f.suffix=='.json':
  try:walk(json.loads(f.read_text()),'',m['path'])
  except (UnicodeDecodeError,json.JSONDecodeError):pass
external={};attachments={}
pathpat=re.compile(r'/workspace/[^\s"\'<>\]\[\)\(,;]+')
for m in manifest:
 f=OUT/m['path']
 if f.suffix.lower() not in ('.md','.txt','.json','.py','.js','.mjs','.html','.log'):continue
 try:s=f.read_text()
 except UnicodeDecodeError:continue
 for ref in pathpat.findall(s):
  ref=ref.rstrip(':.`')
  if ref==str(ROOT) or ref.startswith(str(ROOT)+'/'):continue
  entry=external.setdefault(ref,{'path':ref,'exists_at_collection':Path(ref).exists(),'referenced_by':[]})
  if m['path'] not in entry['referenced_by']:entry['referenced_by'].append(m['path'])
  if '.codex-attachments' in ref:attachments[ref]=entry
summary={k:{'files':sum(x['origin_tree']==k for x in manifest),'bytes':sum(x['bytes'] for x in manifest if x['origin_tree']==k)} for k in MAPPING}
report={'schema':1,'collected_date':'2026-11-28','canonical_root':str(ROOT),'mapping':MAPPING,'summary':summary,'total_files':len(manifest),'total_bytes':sum(x['bytes'] for x in manifest),'excluded':blocked,'files':manifest,'copy_verification':'SHA-256 before/after source and destination equal for every copied file'}
(OUT/'MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(OUT/'SUMBER-DAN-STATUS.json').write_text(json.dumps({'note':'Normalized labels describe recorded access. Historic statements are attributed; not new validation. Full source fields remain in original registries.','sources':source_entries},ensure_ascii=False,indent=2)+'\n')
(OUT/'RUJUKAN-PATH-EKSTERNAL.json').write_text(json.dumps({'note':'These are paths mentioned in copied reference text, not automatically dependencies or authority. Parent coordinator collects model, UI, attachments and toolkit separately.','paths':list(external.values()),'attachment_paths':list(attachments.values())},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'summary':summary,'total_files':len(manifest),'total_bytes':report['total_bytes'],'source_records':len(source_entries),'external_path_mentions':len(external),'attachment_path_mentions':len(attachments),'excluded':blocked},indent=2))
