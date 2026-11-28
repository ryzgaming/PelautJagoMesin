"""Lightweight audit of active URL paths and DOM boundary in the delivered runtime."""
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root=Path(__file__).resolve().parents[2]
package_core=sorted((root/'model/runtime').glob('*.js'))
ui=root/'ui-workspace'
client=sorted(ui.glob('*.js'))
class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in {'src','href','poster'} and value:
                self.found.append((tag,key,value))

checked=[]
unresolved=[]
absolute_runtime=[]
for path in list(ui.glob('*.html'))+client+package_core:
    raw=path.read_text()
    relative=path.relative_to(root).as_posix()
    for bad in ['/workspace/','file://','/opt/codex/']:
        if bad in raw:
            absolute_runtime.append([relative,bad])
    refs=[]
    if path.suffix=='.html':
        parser=LocalReferences()
        parser.feed(raw)
        refs=[url for _,_,url in parser.found]
    if path.suffix=='.js':
        refs=re.findall(r"(?m)^import.*?\bfrom\s*['\"]([^'\"]+)",raw)
    for ref in refs:
        url=urlsplit(ref)
        if url.scheme or url.netloc or not url.path:
            continue
        linked=(path.parent/unquote(url.path)).resolve()
        row={'referer':relative,'reference':ref,
             'target':linked.relative_to(root).as_posix() if linked.is_relative_to(root) else None}
        checked.append(row)
        if url.path.startswith('/') or not linked.is_relative_to(root) or not linked.exists():
            unresolved.append(row)
core_find=[]
for file in package_core:
    for n,line in enumerate(file.read_text().splitlines(),1):
        if re.search(r'\bdocument\b|querySelector|getElementById|\.innerHTML\b|\.textContent\b|ui-workspace',line):
            core_find.append({'file':file.relative_to(root).as_posix(),'line':n,'text':line})
workspace_uses=[]
minimal=(ui/'minimal.js').read_text()
for token in ['engine.workspace','./studio.js','getElementById(\'operation-']:
    if token in minimal:
        workspace_uses.append(token)
manifest=json.loads((root/'model/manifest.json').read_text())
verified={}
for path,claimed in manifest['integrity'].items():
    expected=(root/'model'/path).resolve()
    actual=sha256(expected.read_bytes()).hexdigest()
    verified[path]=claimed==actual and expected.is_relative_to(root/'model')
result={'checked_relative_references':checked,'unresolved_relative_references':unresolved,
        'external_absolute_workspace_tokens':absolute_runtime,'active_core_DOM_tokens':core_find,
        'minimal_Studio_specific_dependencies':workspace_uses,'immutable_manifest':verified}
(root/'agensi/validasi-pemisahan/batas-runtime.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'resolved_count':len(checked)-len(unresolved),'unresolved':unresolved,
                  'absolute_runtime':absolute_runtime,'core_dom_tokens':core_find,'minimal_private_workspace_uses':workspace_uses}))
