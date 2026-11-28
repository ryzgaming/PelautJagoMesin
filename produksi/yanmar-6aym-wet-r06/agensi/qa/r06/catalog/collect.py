"""Build a private position ledger from the 6AYM-WET catalog index; keep source locators."""
import concurrent.futures,json,hashlib,re,subprocess,html
from pathlib import Path
from urllib.parse import urljoin
from html.parser import HTMLParser
out=Path(__file__).resolve().parent
root=out.parent.parent
index=(root/'doc/cooler-specialist/D05-index.html').read_text()
urls=sorted(set(re.findall(r'href="([^"]+6aym-wet-fig-[^"]+)"',index)))
class BOM(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows=[]
    def handle_starttag(self,tag,attrs):
        raw=dict(attrs).get('data-consists-of')
        if raw:
            part=json.loads(raw)
            self.rows.append({k:part.get(k) for k in ('referenceNo','partNo','quantity','description')})
def fetch(relative):
    number=re.search(r'wet-fig-(\d+)',relative)[1]
    dest=out/'figures'/f'{number}.json'
    if dest.is_file() and json.loads(dest.read_text()).get('positions'):return
    url=urljoin('https://yanmarshop.com',relative)
    result={'figure':int(number),'title':relative.split('wet-fig-'+number+'-')[-1].replace('-',' '),'source':url}
    try:
        cached=next((f for f in root.rglob('*.html') if f.name in {f'D05-{number}.html',f'D05-fig{number}.html'}),None)
        data=cached.read_bytes() if cached else subprocess.check_output(['curl','-fsSL','--max-time','24','--retry','1',url],stderr=subprocess.DEVNULL)
        table=BOM();table.feed(data.decode('utf-8','replace'))
        result.update(positions=table.rows,source_sha256=hashlib.sha256(data).hexdigest(),status='catalogued' if table.rows else 'unresolved_table')
    except Exception as err:
        result.update(positions=[],status='source_unavailable',error=type(err).__name__)
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
    (out/'figures').mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(fetch,urls))
    figures=[json.loads(p.read_text()) for p in (out/'figures').glob('*.json')]
    print('figures',len(figures),'resolved',sum(bool(f['positions']) for f in figures),'positions',sum(len(f['positions']) for f in figures))
