import {api,ready,tr,showAccount,errorMessage,fallbackProducts,lang} from './app.js';
const frame=document.querySelector('#workspace-frame'),status=document.querySelector('#workspace-status');
const id=new URLSearchParams(location.search).get('product')||'shinko-gj-sim';
function translateWorkspace(){document.querySelector('#workspace-note').textContent=tr('Workspace 3D · Model edukasi dengan estimasi visual · Materi teknis sumber dalam bahasa Indonesia','3D workspace · Educational model with visual estimates · Source technical material is in Indonesian');}
translateWorkspace();document.addEventListener('om-language',translateWorkspace);
async function open(){document.querySelector('#workspace-title').textContent=fallbackProducts.find(p=>p.id===id)?.title||id;if(id==='shinko-gj-sim'){frame.src='shinko-gj-sim.html';frame.hidden=false;return;}await ready;try{const html=await api('access',{productId:id},true);frame.setAttribute('sandbox','allow-scripts');
  // Only the authenticated MAN V4 response enables the immersive host layout.
  // Other premium products and the free Shinko simulator stay unchanged.
  document.body.classList.toggle('v4-workspace-host',id==='man-l2330h'&&html.includes('id="man-v4-native-css"'));
  frame.srcdoc=html;frame.hidden=false;}catch(e){status.className='notice';status.textContent=errorMessage(e);const b=document.createElement('button');b.className='btn';b.textContent=tr('Masuk ke akun','Sign in');b.onclick=showAccount;status.append(document.createElement('br'),b);}}
open();
