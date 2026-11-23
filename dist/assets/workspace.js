import {api,ready,tr,showAccount,errorMessage,fallbackProducts,lang} from './app.js';
const frame=document.querySelector('#workspace-frame'),status=document.querySelector('#workspace-status');
const id=new URLSearchParams(location.search).get('product')||'shinko-gj-sim';
function translateWorkspace(){document.querySelector('#workspace-note').textContent=tr('Workspace 3D · Model edukasi dengan estimasi visual · Materi teknis sumber dalam bahasa Indonesia','3D workspace · Educational model with visual estimates · Source technical material is in Indonesian');}
translateWorkspace();document.addEventListener('om-language',translateWorkspace);
async function studioAsset(name) {
  const response = await fetch('assets/' + name);
  if (!response.ok) throw new Error('Workspace Studio gagal dimuat.');
  return response.text();
}

async function open() {
  document.querySelector('#workspace-title').textContent = fallbackProducts.find(p => p.id === id)?.title || id;
  try {
    if (id === 'shinko-gj-sim') {
      frame.src = 'shinko-gj-sim.html';
    } else {
      await ready;
      let html = await api('access', {productId:id}, true);
      // Bridge the archived PelautSim engine versions served from private storage.
      // Keep the selection reset inside the same closure as the native picking handler.
      if (html.includes('function select(p,focus,sub)') && !html.includes('clearSelection:function')) {
        html = html.replace('window.__pp={', 'window.__pp={clearSelection:function(){select(null,false,null);},');
      }
      // Inline the shared presentation inside the existing opaque sandbox.
      const [css, diagram, script] = await Promise.all([studioAsset('studio.css'), studioAsset('assembly-diagram.js'), studioAsset('studio.js')]);
      const presentation = '<style>' + css + '</style><script>' + diagram + '</script><script>' + script + '</script>';
      const end = html.toLowerCase().lastIndexOf('</body>');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.srcdoc = end < 0 ? html + presentation : html.slice(0,end) + presentation + html.slice(end);
    }
    frame.hidden = false;
    document.querySelector('.workspace-loading').hidden = true;
  } catch (error) {
    status.className = 'notice';
    status.textContent = errorMessage(error);
    const login = document.createElement('button');
    login.className = 'btn';
    login.textContent = tr('Masuk ke akun','Sign in');
    login.onclick = showAccount;
    status.append(document.createElement('br'), login);
  }
}
open();
