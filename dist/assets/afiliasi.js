import {ready, affiliateRpc, showAccount, escapeHtml, money, signedIn} from './app.js';
const panel = document.querySelector('#partner');
async function display(join = false) {
  await ready;
  if (!signedIn()) {
    panel.innerHTML = '<button class="btn primary">Masuk untuk bergabung</button>';
    panel.querySelector('button').onclick = showAccount;
    return;
  }
  try {
    const data = await affiliateRpc('dashboard',{p_join:join});
    const rate = data.rate_idr == null ? 'Nominal komisi menunggu penetapan admin.' : 'Komisi per akun: ' + money(data.rate_idr) + '.';
    if (!data.code) {
      panel.innerHTML = '<p>'+rate+'</p><button class="btn primary">Buat kode afiliasi saya</button>';
      panel.querySelector('button').onclick = () => display(true);
      return;
    }
    const link = new URL('/',location.origin);
    link.searchParams.set('ref',data.code);
    panel.innerHTML = '<h2>Kode saya</h2><p><strong>'+escapeHtml(data.code)+'</strong></p><label>Tautan undangan<input readonly></label><p>'+rate+'</p><h2>Komisi saya</h2><p>'+Number(data.referrals)+' akun memakai kode Anda · '+Number(data.pending)+' menunggu nominal.</p><p>Total komisi tercatat <strong>'+(data.earned_idr ? money(Number(data.earned_idr)) : 'Rp0')+'</strong></p>';
    panel.querySelector('input').value = link.href;
  } catch {
    panel.innerHTML = '<p role="alert">Data afiliasi belum dapat dibuka. Gunakan akun dengan email terverifikasi.</p><button class="btn">Coba lagi</button>';
    panel.querySelector('button').onclick = () => display();
  }
}
document.addEventListener('om-login',() => display());
display();
