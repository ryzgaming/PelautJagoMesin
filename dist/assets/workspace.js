import {preparePremiumWorkspace, studioFiles} from './premium-workspace.js';
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
      const html = await api('access', {productId:id}, true);
      const entries = await Promise.all(studioFiles.map(async name => [name, await studioAsset(name)]));
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.srcdoc = preparePremiumWorkspace(html, id, Object.fromEntries(entries));
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
